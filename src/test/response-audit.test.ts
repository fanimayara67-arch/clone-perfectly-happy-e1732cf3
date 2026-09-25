import { describe, expect, it } from 'vitest';
import { auditResponses, type AuditableResponse } from '@/lib/response-audit';
import { exactColumn, submittedAt, rowPayload } from '../../supabase/functions/sync-google-form-responses/validation';
const row = (overrides: Partial<AuditableResponse> = {}): AuditableResponse => ({
  id: '1', email: 'real@example.org', tracking_code: 'UFTC-ABCDEF', screening_answers: {},
  main_answers: { pergunta: 'Sim' }, google_form_completed: true,
  google_form_completed_at: '2026-09-25T15:00:00Z', token_validated: true,
  verified_source_key: 'a'.repeat(64), verified_at: '2026-09-25T16:00:00Z', research_classification: 'real',
  ...overrides,
});
describe('Contagem conservadora', () => {
  it('não conta token, abertura ou conclusão legada sem evidência', () => {
    expect(auditResponses([row({ verified_source_key: null })]).valid).toBe(0);
    expect(auditResponses([row({ google_form_completed: false, survey_started_at: '2026-09-25' })]).valid).toBe(0);
  });
  it('conta envio real verificado e mantém resultado após recarregar dados', () => {
    expect(auditResponses(JSON.parse(JSON.stringify([row()]))).valid).toBe(1);
    expect(auditResponses([row()]).missing).toBe(49);
  });
  it.each(['test', 'duplicate', 'excluded', 'unreviewed'])('exclui classificação %s', classification => {
    expect(auditResponses([row({ research_classification: classification })]).valid).toBe(0);
  });
  it('email normalizado identifica conflito, não identidade presumida por demografia', () => {
    const result = auditResponses([row(), row({ id: '2', email: ' REAL@example.org ', tracking_code: 'UFTC-BCDEFG', verified_source_key: 'b'.repeat(64) })]);
    expect(result.possibleDuplicates.size).toBe(2);
    expect(result.valid).toBe(0);
  });
  it('duplicado confirmado não bloqueia o cadastro real preservado', () => {
    expect(auditResponses([row(), row({ id: '2', research_classification: 'duplicate' })]).valid).toBe(1);
  });
  it('documento normalizado encontra conflito sem nome ou cidade', () => {
    const a = row({ screening_answers: { electronic_consent: { identity_document: '123.456-78' } } });
    const b = row({ id: '2', email: null, tracking_code: 'UFTC-BCDEFG', verified_source_key: null,
      screening_answers: { electronic_consent: { identity_document: '12345678' } } });
    expect(auditResponses([a,b]).valid).toBe(0);
  });
});
describe('Evidência do Google Sheets', () => {
  it('interpreta dia/mês explicitamente com fuso', () => {
    expect(submittedAt('25/09/2026 12:30:00','-03:00')).toBe('2026-09-25T15:30:00.000Z');
    expect(submittedAt('05/09/2026 12:30:00','-03:00')).toBe('2026-09-05T15:30:00.000Z');
  });
  it.each(['', '31/02/2026 12:00:00', '25/09/2026 25:00:00'])('rejeita data inválida %s', raw => {
    expect(() => submittedAt(raw,'-03:00')).toThrow();
  });
  it('não escolhe coluna ambígua nem sobrescreve perguntas repetidas', () => {
    expect(() => exactColumn(['Código','Código'],'Código')).toThrow();
    expect(() => exactColumn(['Identificação pessoal'],'Código')).toThrow();
    expect(() => rowPayload(['Pergunta','Pergunta'],['A','B'])).toThrow();
    expect(exactColumn(['Documento','Código'],'Código')).toBe(1);
  });
});
