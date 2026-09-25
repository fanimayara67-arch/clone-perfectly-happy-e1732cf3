-- Read-only predeployment inventory. Run with an authorized admin/database session.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT count(*) AS registrations,
 count(*) FILTER (WHERE google_form_completed) AS legacy_completion_flags,
 count(*) FILTER (WHERE token_validated) AS token_flags,
 count(*) FILTER (WHERE main_answers <> '{}'::jsonb) AS registrations_with_payload
FROM public.survey_responses;
-- These are candidates, never automatic merges/deletions.
SELECT lower(trim(email)) AS normalized_email, array_agg(id ORDER BY created_at) AS registration_ids
FROM public.survey_responses WHERE nullif(trim(email),'') IS NOT NULL
GROUP BY lower(trim(email)) HAVING count(*) > 1;
SELECT upper(trim(tracking_code)) AS normalized_code, array_agg(id) AS registration_ids
FROM public.survey_responses WHERE tracking_code IS NOT NULL
GROUP BY upper(trim(tracking_code)) HAVING count(*) > 1;
SELECT regexp_replace(upper(screening_answers #>> '{electronic_consent,identity_document}'), '[^A-Z0-9]', '', 'g') AS document,
 array_agg(id) AS registration_ids
FROM public.survey_responses
WHERE nullif(regexp_replace(upper(screening_answers #>> '{electronic_consent,identity_document}'), '[^A-Z0-9]', '', 'g'),'') IS NOT NULL
GROUP BY 1 HAVING count(*) > 1;
SELECT r.id, r.tracking_code,
 CASE WHEN t.id IS NULL THEN 'token_missing'
 WHEN t.used_by_response_id IS NOT NULL AND t.used_by_response_id <> r.id THEN 'token_used_by_other'
 WHEN NOT t.is_active AND t.used_by_response_id IS NULL THEN 'inactive_unlinked'
 ELSE 'inspect_submission_evidence' END AS review_reason
FROM public.survey_responses r LEFT JOIN public.valid_tokens t ON t.code = r.tracking_code
WHERE NOT r.google_form_completed;
-- Recover missing baseline definitions before attempting a clean environment rebuild.
SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='validate_and_consume_token';
SELECT policyname, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('survey_responses','valid_tokens','user_roles','invalid_form_responses');
COMMIT;
