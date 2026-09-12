CREATE OR REPLACE FUNCTION public.submit_survey_response(
  _age integer,
  _city text,
  _state text,
  _gender text,
  _email text,
  _screening_answers jsonb,
  _tracking_code text,
  _consent_given boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_city text := trim(COALESCE(_city, ''));
  v_state text := upper(trim(COALESCE(_state, '')));
  v_gender text := trim(COALESCE(_gender, ''));
  v_email text := NULLIF(trim(COALESCE(_email, '')), '');
  v_code text := upper(trim(COALESCE(_tracking_code, '')));
BEGIN
  IF _age IS NULL OR _age < 18 OR _age > 110 THEN RAISE EXCEPTION 'invalid age' USING ERRCODE = '22023'; END IF;
  IF char_length(v_city) < 2 OR char_length(v_city) > 80 THEN RAISE EXCEPTION 'invalid city' USING ERRCODE = '22023'; END IF;
  IF v_state !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'invalid state' USING ERRCODE = '22023'; END IF;
  IF char_length(v_gender) < 1 OR char_length(v_gender) > 40 THEN RAISE EXCEPTION 'invalid gender' USING ERRCODE = '22023'; END IF;
  IF v_email IS NOT NULL AND (char_length(v_email) > 254 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'invalid email' USING ERRCODE = '22023'; END IF;
  IF _consent_given IS DISTINCT FROM true THEN RAISE EXCEPTION 'consent required' USING ERRCODE = '22023'; END IF;
  IF v_code !~ '^UFTC-[A-Z0-9]{4,16}$' THEN RAISE EXCEPTION 'invalid tracking code' USING ERRCODE = '22023'; END IF;
  IF _screening_answers IS NULL OR jsonb_typeof(_screening_answers) <> 'object' OR pg_column_size(_screening_answers) >= 50000 THEN RAISE EXCEPTION 'invalid screening answers' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.survey_responses (age, city, state, gender, email, tracking_code, screening_answers, main_answers, consent_given)
  VALUES (_age, v_city, v_state, v_gender, v_email, v_code, _screening_answers, '{}'::jsonb, true);
  RETURN true;
EXCEPTION
  WHEN unique_violation THEN
    IF EXISTS (SELECT 1 FROM public.survey_responses WHERE tracking_code = v_code) THEN RETURN true; END IF;
    RAISE;
END;
$$;

GRANT INSERT ON TABLE public.survey_responses TO anon, authenticated;
CREATE POLICY "Validated survey submissions"
ON public.survey_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  age BETWEEN 18 AND 110
  AND char_length(trim(city)) BETWEEN 2 AND 80
  AND state ~ '^[A-Z]{2}$'
  AND char_length(trim(gender)) BETWEEN 1 AND 40
  AND (email IS NULL OR (char_length(email) <= 254 AND email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
  AND consent_given = true
  AND tracking_code ~ '^UFTC-[A-Z0-9]{4,16}$'
  AND jsonb_typeof(screening_answers) = 'object'
  AND pg_column_size(screening_answers) < 50000
  AND jsonb_typeof(main_answers) = 'object'
  AND pg_column_size(main_answers) < 50000
);

REVOKE ALL ON FUNCTION public.submit_survey_response(integer, text, text, text, text, jsonb, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_survey_response(integer, text, text, text, text, jsonb, text, boolean) TO anon, authenticated, service_role;