import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { exactColumn, submittedAt, rowPayload, evidenceKey } from './validation.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const MAX_ROWS_PER_RUN = 300;
const TIME_BUDGET_MS = 20000;
const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
};
async function gatewayFetch(path: string) {
  const response = await fetch(`https://connector-gateway.lovable.dev/google_sheets/v4${path}`, {
    headers: {
      Authorization: `Bearer ${required('LOVABLE_API_KEY')}`,
      'X-Connection-Api-Key': required('GOOGLE_SHEETS_API_KEY'),
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Gateway Google Sheets: HTTP ${response.status}`);
  return response.json();
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
  try {
    const url = required('SUPABASE_URL');
    const userClient = createClient(url, required('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData.user) return json({ error: 'Não autenticado' }, 401);
    const admin = createClient(url, required('SUPABASE_SERVICE_ROLE_KEY'));
    const { data: role, error: roleError } = await admin.from('user_roles').select('role')
      .eq('user_id', userData.user.id).eq('role', 'admin').maybeSingle();
    if (roleError) throw new Error('Falha ao verificar permissão administrativa');
    if (!role) return json({ error: 'Sem permissão' }, 403);

    let startRow = 1;
    try {
      const body = await req.json();
      if (Number.isInteger(body?.startRow) && body.startRow > 0) startRow = body.startRow;
    } catch { /* body opcional */ }

    const sheet = required('GOOGLE_FORM_RESPONSES_SHEET_ID');
    const tab = required('GOOGLE_FORM_RESPONSES_TAB');
    const offset = required('GOOGLE_FORM_TIMEZONE_OFFSET');
    const range = `'${tab.replaceAll("'", "''")}'!A:ZZ`;
    const result = await gatewayFetch(`/spreadsheets/${encodeURIComponent(sheet)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`);
    const rows: string[][] = result.values ?? [];
    if (!rows.length) return json({ ok: true, processed: 0, valid: 0, invalid: 0, failed: 0 });
    const header = rows[0].map(String);
    const codeCol = exactColumn(header, required('GOOGLE_FORM_CODE_HEADER'));
    const timeCol = exactColumn(header, required('GOOGLE_FORM_TIMESTAMP_HEADER'));
    const answerCol = exactColumn(header, required('GOOGLE_FORM_REQUIRED_ANSWER_HEADER'));
    if (new Set([codeCol, timeCol, answerCol]).size !== 3) throw new Error('Configure três colunas distintas: código, data e resposta');
    rowPayload(header, []); // Validate headers before any mutation.
    let valid = 0, invalid = 0, failed = 0, processed = 0;
    const issues: { row: number; reason: string }[] = [];
    const startedAt = Date.now();
    let nextRow: number | null = null;
    let batchCount = 0;
    for (let i = startRow; i < rows.length; i++) {
      if (batchCount >= MAX_ROWS_PER_RUN || Date.now() - startedAt > TIME_BUDGET_MS) {
        nextRow = i + 1;
        break;
      }
      const row = rows[i].map(String);
      if (row.every(v => !v.trim())) continue;
      batchCount++;
      processed++;
      let reason = '';
      try {
        const payload = rowPayload(header, row);
        const code = (row[codeCol] ?? '').trim().toUpperCase();
        const timestamp = submittedAt(row[timeCol] ?? '', offset);
        if (!(row[answerCol] ?? '').trim()) throw new Error('Resposta obrigatória ausente');
        const { data: status, error } = await admin.rpc('ingest_verified_form_response', {
          _tracking_code: code, _source_key: await evidenceKey(sheet, tab, payload),
          _submitted_at: timestamp, _payload: payload,
        });
        if (error) { failed++; reason = `Falha no banco (${error.code ?? 'sem código'}); tente sincronizar novamente`; }
        else if (status === 'verified' || status === 'already_verified') valid++;
        else { invalid++; reason = String(status ?? 'Resposta inesperada do banco'); }
        if (reason && !error) {
          const { data: existing, error: lookupError } = await admin.from('invalid_form_responses')
            .select('id').eq('attempted_code', code).eq('payload', JSON.stringify(payload)).eq('reason', reason).limit(1);
          if (lookupError) throw new Error('Falha ao consultar pendência');
          if (!existing?.length) {
            const { error: insertError } = await admin.from('invalid_form_responses').insert({
              attempted_code: code, form_submitted_at: timestamp, payload, reason,
            });
            if (insertError) throw new Error('Falha ao registrar pendência');
          }
        }
      } catch (error) {
        failed++;
        reason = error instanceof Error ? error.message : 'Falha ao processar linha';
      }
      if (reason) issues.push({ row: i + 1, reason });
    }
    return json({ ok: failed === 0, processed, valid, invalid, failed, issues, nextRow, totalRows: rows.length - 1 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha na sincronização' }, 500);
  }
});
