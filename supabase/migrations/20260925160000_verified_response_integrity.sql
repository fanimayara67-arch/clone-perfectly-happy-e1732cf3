BEGIN;
-- Additive migration: no deletion, backfill or reclassification of existing records.
ALTER TABLE public.survey_responses
  ADD COLUMN research_classification text NOT NULL DEFAULT 'unreviewed'
    CHECK (research_classification IN ('unreviewed', 'real', 'test', 'duplicate', 'excluded')),
  ADD COLUMN classification_note text,
  ADD COLUMN verified_source_key text UNIQUE,
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN survey_started_at timestamptz;
ALTER TABLE public.survey_responses ADD CONSTRAINT classification_requires_evidence
  CHECK (research_classification = 'unreviewed' OR length(trim(coalesce(classification_note, ''))) >= 5);

-- Close the direct-insert route left open by the older invoker migration.
REVOKE INSERT ON public.survey_responses FROM anon, authenticated;
DROP POLICY IF EXISTS "Validated survey submissions" ON public.survey_responses;
DROP POLICY IF EXISTS "Anyone can submit a survey response" ON public.survey_responses;
-- Admins can review/demographically edit, but cannot manufacture completion evidence.
REVOKE UPDATE ON public.survey_responses FROM authenticated;
GRANT UPDATE (full_name, age, email, city, state, gender, research_classification, classification_note)
  ON public.survey_responses TO authenticated;
GRANT EXECUTE ON FUNCTION private.submit_survey_response_checked(integer,text,text,text,text,jsonb,text,boolean) TO service_role;

-- Retire functions whose only evidence was possession of a code.
CREATE OR REPLACE FUNCTION public.confirm_response_with_token(_tracking_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Use ingest_verified_form_response with submission evidence' USING ERRCODE = '22023';
END; $$;
CREATE OR REPLACE FUNCTION public.mark_google_form_completed(_tracking_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'Use ingest_verified_form_response with submission evidence' USING ERRCODE = '22023';
END; $$;
REVOKE ALL ON FUNCTION public.confirm_response_with_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_google_form_completed(text) FROM PUBLIC, anon, authenticated;

-- One transaction locks the registration AND token before persisting evidence.
CREATE FUNCTION public.ingest_verified_form_response(
  _tracking_code text, _source_key text, _submitted_at timestamptz, _payload jsonb
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r public.survey_responses%ROWTYPE;
  t public.valid_tokens%ROWTYPE;
  v_code text := upper(trim(coalesce(_tracking_code, '')));
BEGIN
  IF v_code !~ '^UFTC-[A-Z0-9]{4,16}$' THEN RETURN 'invalid_code'; END IF;
  IF _source_key IS NULL OR _source_key !~ '^[a-f0-9]{64}$'
    OR _submitted_at IS NULL OR _submitted_at > now() + interval '5 minutes'
    OR _payload IS NULL OR jsonb_typeof(_payload) <> 'object'
    OR _payload = '{}'::jsonb OR pg_column_size(_payload) >= 50000 THEN
    RETURN 'invalid_evidence';
  END IF;
  SELECT * INTO r FROM public.survey_responses WHERE tracking_code = v_code FOR UPDATE;
  IF NOT FOUND THEN RETURN 'registration_not_found'; END IF;
  IF r.verified_source_key = _source_key THEN RETURN 'already_verified'; END IF;
  IF r.verified_source_key IS NOT NULL THEN RETURN 'multiple_submissions_review'; END IF;
  IF _submitted_at < r.created_at THEN RETURN 'submission_before_registration'; END IF;
  IF r.main_answers <> '{}'::jsonb AND r.main_answers <> _payload THEN RETURN 'existing_answers_review'; END IF;
  -- Preserve explicit legacy annulments; never silently reinstate them.
  IF EXISTS (SELECT 1 FROM jsonb_each_text(_payload) e
    WHERE lower(trim(e.key)) = 'anulado' AND lower(trim(e.value)) NOT IN ('', 'false', 'não', 'nao', '0'))
    THEN RETURN 'annulled_review'; END IF;
  SELECT * INTO t FROM public.valid_tokens WHERE valid_tokens.code = v_code FOR UPDATE;
  IF NOT FOUND THEN RETURN 'token_missing'; END IF;
  IF t.used_by_response_id IS NOT NULL AND t.used_by_response_id <> r.id THEN RETURN 'token_used_by_other'; END IF;
  IF t.used_by_response_id IS NULL AND (NOT t.is_active OR t.used_at IS NOT NULL) THEN RETURN 'token_unavailable'; END IF;
  UPDATE public.valid_tokens SET used_at = coalesce(used_at, now()), used_by_response_id = r.id,
    is_active = false WHERE id = t.id;
  UPDATE public.survey_responses SET main_answers = _payload,
    token_validated = true, token_validated_at = coalesce(token_validated_at, now()),
    google_form_completed = true, google_form_completed_at = _submitted_at,
    verified_source_key = _source_key, verified_at = now() WHERE id = r.id;
  RETURN 'verified';
END; $$;
REVOKE ALL ON FUNCTION public.ingest_verified_form_response(text,text,timestamptz,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_verified_form_response(text,text,timestamptz,jsonb) TO service_role;
CREATE FUNCTION public.start_survey(_tracking_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.survey_responses SET survey_started_at = coalesce(survey_started_at, now())
  WHERE tracking_code = upper(trim(_tracking_code));
  RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.start_survey(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_survey(text) TO anon, authenticated, service_role;
COMMIT;
