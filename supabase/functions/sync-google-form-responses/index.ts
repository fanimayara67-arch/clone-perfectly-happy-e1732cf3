// Edge function: sync-google-form-responses
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

async function gatewayFetch(path: string, init?: RequestInit) {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const connectorKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");

  if (!lovableKey || !connectorKey) {
    throw new Error("Credenciais do gateway não configuradas");
  }

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectorKey,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gateway error ${res.status}: ${body}`);
  }

  return res.json();
}

// ====== DETECÇÃO ROBUSTA DA COLUNA ======
function findCodeColumn(header: string[]): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  return header.findIndex((h) => {
    const n = norm(h);
    return (
      n.includes("codigo") ||
      n.includes("identificacao") ||
      n.includes("autenticacao") ||
      n.includes("token") ||
      n.includes("tracking")
    );
  });
}

// ====== TIMESTAMP ======
function findTimestampColumn(header: string[]): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  return header.findIndex((h) => /carimbo|timestamp|data\/?hora/.test(norm(h)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SHEET_ID = Deno.env.get("GOOGLE_FORM_RESPONSES_SHEET_ID");

    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY || !SHEET_ID) {
      throw new Error("Configuração incompleta da sincronização");
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await userClient.auth.getUser();

    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const sheetJson = await gatewayFetch(`/spreadsheets/${SHEET_ID}/values/A1:ZZ10000`);
    const rows: string[][] = sheetJson.values ?? [];

    if (rows.length < 2) {
      return new Response(JSON.stringify({ ok: true, message: "Sem respostas" }), {
        headers: corsHeaders,
      });
    }

    const header = rows[0];

    const codeCol = findCodeColumn(header);
    const tsCol = findTimestampColumn(header);

    if (codeCol < 0) {
      console.error("HEADER RECEBIDO:", header);
      throw new Error("Coluna de código não encontrada");
    }

    let valid = 0;
    let invalid = 0;
    let processed = 0;

    for (const row of rows.slice(1)) {
      const rawCode = (row[codeCol] ?? "").toString().trim();
      const normalized = rawCode.toUpperCase();
      if (!normalized) continue;
      processed++;

      const payload: Record<string, string> = {};
      header.forEach((h, i) => (payload[h] = row[i] ?? ""));

      const { data: ok, error: confirmError } = await admin.rpc("confirm_response_with_token", {
        _tracking_code: normalized,
      });

      if (confirmError) throw confirmError;

      if (ok) {
        const completedAt = tsCol >= 0 && row[tsCol] ? new Date(row[tsCol]).toISOString() : new Date().toISOString();
        const { error: updateError } = await admin
          .from("survey_responses")
          .update({
            main_answers: payload,
            google_form_completed: true,
            google_form_completed_at: completedAt,
          })
          .eq("tracking_code", normalized);
        if (updateError) throw updateError;
        valid++;
      } else {
        const { data: existing } = await admin
          .from("invalid_form_responses")
          .select("id")
          .eq("attempted_code", normalized)
          .limit(1)
          .maybeSingle();
        if (!existing) {
          const { error: invalidError } = await admin.from("invalid_form_responses").insert({
            attempted_code: normalized,
            form_submitted_at: tsCol >= 0 && row[tsCol] ? new Date(row[tsCol]).toISOString() : null,
            payload,
            reason: "Código inexistente ou não vinculado a um cadastro",
          });
          if (invalidError) throw invalidError;
        }
        invalid++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, valid, invalid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ERRO GERAL:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
