// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';

// Isolated fixture: production's original valid_tokens DDL is absent from this repo.
// The token shape below follows generated types; this does not certify production schema.
const db = new PGlite();
const migration = (name: string) => readFileSync(`supabase/migrations/${name}`, 'utf8');
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private;
    CREATE TYPE app_role AS ENUM ('admin');
    CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql AS 'SELECT false';
    CREATE TABLE survey_responses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name text, age integer, city text, state text,
      gender text, email text, tracking_code text UNIQUE, screening_answers jsonb DEFAULT '{}',
      main_answers jsonb DEFAULT '{}', consent_given boolean, created_at timestamptz DEFAULT now() - interval '1 hour',
      token_validated boolean DEFAULT false, token_validated_at timestamptz,
      google_form_completed boolean DEFAULT false, google_form_completed_at timestamptz
    );
    ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, UPDATE ON survey_responses TO authenticated;
    CREATE POLICY admin_fixture ON survey_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);
    CREATE TABLE valid_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE,
      is_active boolean DEFAULT true, notes text, created_at timestamptz DEFAULT now(),
      used_at timestamptz, used_by_response_id uuid REFERENCES survey_responses(id));
    CREATE FUNCTION register_tracking_code(text) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    CREATE FUNCTION confirm_response_with_token(text) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    CREATE FUNCTION mark_google_form_completed(text) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    CREATE FUNCTION validate_and_consume_token(text,uuid) RETURNS boolean LANGUAGE sql AS 'SELECT true';
  `);
  await db.exec(migration('20260828045041_0b000ec3-090b-4d06-957b-de675159f1cd.sql'));
  await db.exec(migration('20260925143612_dc3991a1-6b68-4f74-bfeb-44fc0e15b0a7.sql'));
  await db.exec(migration('20260925160000_verified_response_integrity.sql'));
}, 30000);
afterAll(async () => { await db.close(); });
async function register(code: string) {
  return db.query("SELECT submit_survey_response(30,'Salvador','BA','Feminino','person@example.org','{}', $1, true) AS ok", [code]);
}
async function ingest(code: string, key: string, payload = { question: 'Sim' }) {
  const result = await db.query<{ status: string }>('SELECT ingest_verified_form_response($1,$2,now(),$3) AS status', [code, key.repeat(64), JSON.stringify(payload)]);
  return result.rows[0].status;
}
describe('Transação PostgreSQL local', () => {
  it('cadastro anônimo via RPC cria token e não conclui; retentativa é idempotente', async () => {
    await db.exec('SET ROLE anon');
    await register('UFTC-ABCDEF');
    await register('UFTC-ABCDEF');
    await db.exec('RESET ROLE');
    const r = await db.query('SELECT google_form_completed FROM survey_responses');
    expect(r.rows).toEqual([{ google_form_completed: false }]);
    expect((await db.query('SELECT code FROM valid_tokens')).rows).toHaveLength(1);
  });
  it('início não conclui; código inválido não é aceito', async () => {
    expect((await db.query("SELECT start_survey('UFTC-ABCDEF') AS ok")).rows).toEqual([{ ok: true }]);
    expect(await ingest('invalid','a')).toBe('invalid_code');
    expect(await ingest('UFTC-NOPE','a')).toBe('registration_not_found');
  });
  it('envio verificado persiste respostas, token e conclusão juntos; repetição não duplica', async () => {
    expect(await ingest('UFTC-ABCDEF','a')).toBe('verified');
    expect(await ingest('UFTC-ABCDEF','a')).toBe('already_verified');
    expect(await ingest('UFTC-ABCDEF','b')).toBe('multiple_submissions_review');
    const r = await db.query('SELECT google_form_completed, token_validated, main_answers FROM survey_responses');
    expect(r.rows).toEqual([{ google_form_completed: true, token_validated: true, main_answers: { question: 'Sim' } }]);
  });
  it('falha na gravação reverte consumo do token e mantém pendência', async () => {
    await register('UFTC-BCDEFG');
    await expect(ingest('UFTC-BCDEFG','a')).rejects.toThrow(); // unique source key collision
    expect((await db.query("SELECT used_at FROM valid_tokens WHERE code='UFTC-BCDEFG'")).rows).toEqual([{ used_at: null }]);
    expect((await db.query("SELECT google_form_completed FROM survey_responses WHERE tracking_code='UFTC-BCDEFG'")).rows).toEqual([{ google_form_completed: false }]);
  });
  it('token inativo mantém a resposta pendente', async () => {
    await db.exec("UPDATE valid_tokens SET is_active=false WHERE code='UFTC-BCDEFG'");
    expect(await ingest('UFTC-BCDEFG','c')).toBe('token_unavailable');
  });
  it('respostas antigas e classificação da equipe são preservadas', async () => {
    await register('UFTC-CDEFGH');
    await db.exec(`UPDATE survey_responses SET main_answers='{"legacy":"preservar"}', research_classification='real', classification_note='Seleção da equipe' WHERE tracking_code='UFTC-CDEFGH'`);
    expect(await ingest('UFTC-CDEFGH','d')).toBe('existing_answers_review');
    expect((await db.query("SELECT main_answers, research_classification FROM survey_responses WHERE tracking_code='UFTC-CDEFGH'")).rows).toEqual([{ main_answers: { legacy: 'preservar' }, research_classification: 'real' }]);
  });
  it('clientes não fabricam conclusões por RPC ou insert direto', async () => {
    await db.exec('SET ROLE anon');
    await expect(db.query("SELECT ingest_verified_form_response('UFTC-ABCDEF',repeat('f',64),now(),'{}')")).rejects.toThrow();
    await expect(db.query("SELECT mark_google_form_completed('UFTC-ABCDEF')")).rejects.toThrow();
    await expect(db.query("INSERT INTO survey_responses(tracking_code) VALUES ('UFTC-FAKE')")).rejects.toThrow();
    await db.exec('RESET ROLE; SET ROLE authenticated');
    await expect(db.query('UPDATE survey_responses SET google_form_completed=true')).rejects.toThrow();
    await db.exec('RESET ROLE');
  });
});
