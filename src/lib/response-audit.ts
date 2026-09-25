export interface AuditableResponse {
  id: string;
  email: string | null;
  tracking_code: string | null;
  screening_answers: Record<string, unknown>;
  main_answers: Record<string, unknown>;
  google_form_completed: boolean;
  google_form_completed_at: string | null;
  token_validated?: boolean;
  verified_source_key?: string | null;
  verified_at?: string | null;
  survey_started_at?: string | null;
  research_classification?: string;
  classification_note?: string | null;
}
export function identityKeys(r: AuditableResponse): string[] {
  const consent = r.screening_answers?.electronic_consent as { identity_document?: string } | undefined;
  const document = consent?.identity_document?.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return [r.email?.trim().toLowerCase() ? `email:${r.email.trim().toLowerCase()}` : '',
    document ? `document:${document}` : '', r.tracking_code ? `code:${r.tracking_code.trim().toUpperCase()}` : '',
    r.verified_source_key ? `source:${r.verified_source_key}` : ''].filter(Boolean);
}
export function hasVerifiedSubmission(r: AuditableResponse): boolean {
  return !!(r.google_form_completed && r.google_form_completed_at && r.token_validated &&
    r.verified_source_key && r.verified_at && Object.keys(r.main_answers ?? {}).length);
}
export function auditResponses(rows: AuditableResponse[]) {
  const owners = new Map<string, string[]>();
  for (const r of rows) {
    if (['test', 'duplicate', 'excluded'].includes(r.research_classification ?? '')) continue;
    for (const key of identityKeys(r)) owners.set(key, [...(owners.get(key) ?? []), r.id]);
  }
  const possibleDuplicates = new Set([...owners.values()].filter(ids => ids.length > 1).flat());
  const reason = (r: AuditableResponse): string => {
    if (r.research_classification === 'test') return 'Teste — fora da meta';
    if (r.research_classification === 'duplicate') return 'Duplicado confirmado — fora da meta';
    if (r.research_classification === 'excluded') return 'Excluído da análise — cadastro preservado';
    if (possibleDuplicates.has(r.id)) return 'Identificador compartilhado — revisar possível duplicidade';
    if (!hasVerifiedSubmission(r)) return r.google_form_completed
      ? 'Conclusão legada — falta evidência verificada da origem'
      : r.survey_started_at ? 'Pesquisa iniciada — aguardando envio e sincronização' : 'Cadastrado — aguardando início e envio';
    if (r.research_classification !== 'real') return 'Envio verificado — falta classificação da equipe';
    return 'Válida para a meta';
  };
  const valid = rows.filter(r => reason(r) === 'Válida para a meta').length;
  return { reason, valid, missing: Math.max(0, 50 - valid), possibleDuplicates,
    verified: rows.filter(hasVerifiedSubmission).length,
    tests: rows.filter(r => r.research_classification === 'test').length,
    review: rows.filter(r => r.research_classification === 'unreviewed' || !r.research_classification).length,
    identifiableWithoutConflict: rows.filter(r => identityKeys(r).some(k => /^(email|document):/.test(k)) && !possibleDuplicates.has(r.id) && !['test','duplicate','excluded'].includes(r.research_classification ?? '')).length };
}
