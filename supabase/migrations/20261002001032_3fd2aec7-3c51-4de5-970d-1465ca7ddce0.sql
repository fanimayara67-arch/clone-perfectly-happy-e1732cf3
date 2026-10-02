CREATE OR REPLACE FUNCTION private.start_survey_checked(_tracking_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF _tracking_code IS NULL OR upper(trim(_tracking_code)) !~ '^UFTC-[A-Z0-9]{4,16}$' THEN RETURN false; END IF;
  UPDATE public.survey_responses SET survey_started_at = coalesce(survey_started_at, now())
  WHERE tracking_code = upper(trim(_tracking_code));
  RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION private.start_survey_checked(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.start_survey_checked(text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.start_survey(_tracking_code text)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp AS $$
 SELECT private.start_survey_checked(_tracking_code);
$$;
REVOKE ALL ON FUNCTION public.start_survey(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_survey(text) TO anon, authenticated, service_role;