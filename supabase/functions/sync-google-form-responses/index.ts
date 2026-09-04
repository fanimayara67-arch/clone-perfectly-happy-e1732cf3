// Edge function: sync-google-form-responses
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SHEET_ID = Deno.env.get("GOOGLE_FORM_RESPONSES_SHEET_ID");
    const SA_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

    if (!SHEET_ID) {
      throw new Error("SHEET_ID não configurado");
    }

    if (!SA_JSON) {
      throw new Error("SERVICE ACCOUNT não configurada");
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
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

    const accessToken = await getGoogleAccessToken(SA_JSON);

    const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A1:ZZ10000`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!sheetRes.ok) {
      throw new Error(`Erro Sheets: ${sheetRes.status}`);
    }

    const sheetJson = await sheetRes.json();
    const rows: string[][] = sheetJson.values ?? [];

    if (rows.length < 2) {
      return new Response(JSON.stringify({ ok: true, message: "Sem respostas" }), {
        headers: corsHeaders,
      });
    }

    const header = rows[0];

    console.log("HEADER:", header);

    const codeCol = findCodeColumn(header);
    const tsCol = findTimestampColumn(header);

    if (codeCol < 0) {
      console.error("HEADER RECEBIDO:", header);
      throw new Error("Coluna de código não encontrada");
    }

    let valid = 0;
    let invalid = 0;

    for (const row of rows.slice(1)) {
      const rawCode = (row[codeCol] ?? "").toString().trim();
      const normalized = rawCode.toUpperCase();

      const payload: Record<string, string> = {};
      header.forEach((h, i) => (payload[h] = row[i] ?? ""));

      const { data: ok } = await admin.rpc("confirm_response_with_token", {
        _tracking_code: normalized,
      });

      if (ok) {
        await admin.from("survey_responses").update({ main_answers: payload }).eq("tracking_code", normalized);
        valid++;
      } else {
        invalid++;
      }
    }

    return new Response(JSON.stringify({ ok: true, valid, invalid }), { headers: corsHeaders });
  } catch (e) {
    console.error("ERRO GERAL:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
