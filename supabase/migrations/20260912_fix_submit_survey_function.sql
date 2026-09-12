-- Recriar função submit_survey_response com segurança definida corretamente
DROP FUNCTION IF EXISTS public.submit_survey_response(integer, text, text, text, text, jsonb, text, boolean);

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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city text := trim(COALESCE(_city, ''));
  v_state text := upper(trim(COALESCE(_state, '')));
  v_gender text := trim(COALESCE(_gender, ''));
  v_email text := NULLIF(trim(COALESCE(_email, '')), '');
  v_code text := upper(trim(COALESCE(_tracking_code, '')));
BEGIN
  -- Validar idade
  IF _age IS NULL OR _age < 18 OR _age > 110 THEN
    RAISE EXCEPTION 'invalid age' USING ERRCODE = '22023';
  END IF;

  -- Validar cidade
  IF char_length(v_city) < 2 OR char_length(v_city) > 80 THEN
    RAISE EXCEPTION 'invalid city' USING ERRCODE = '22023';
  END IF;

  -- Validar estado (UF - 2 letras maiúsculas)
  IF v_state !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'invalid state' USING ERRCODE = '22023';
  END IF;

  -- Validar gênero
  IF char_length(v_gender) < 1 OR char_length(v_gender) > 40 THEN
    RAISE EXCEPTION 'invalid gender' USING ERRCODE = '22023';
  END IF;

  -- Validar email (se fornecido)
  IF v_email IS NOT NULL AND (char_length(v_email) > 254 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
    RAISE EXCEPTION 'invalid email' USING ERRCODE = '22023';
  END IF;

  -- Validar consentimento
  IF _consent_given IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'consent required' USING ERRCODE = '22023';
  END IF;

  -- Validar código de rastreamento
  IF v_code !~ '^UFTC-[A-Z0-9]{4,16}$' THEN
    RAISE EXCEPTION 'invalid tracking code' USING ERRCODE = '22023';
  END IF;

  -- Validar respostas de screening (JSONB object válido)
  IF _screening_answers IS NULL OR jsonb_typeof(_screening_answers) <> 'object' OR pg_column_size(_screening_answers) >= 50000 THEN
    RAISE EXCEPTION 'invalid screening answers' USING ERRCODE = '22023';
  END IF;

  -- Inserir resposta da pesquisa
  INSERT INTO public.survey_responses (
    age, city, state, gender, email, tracking_code,
    screening_answers, main_answers, consent_given
  ) VALUES (
    _age, v_city, v_state, v_gender, v_email, v_code,
    _screening_answers, '{}'::jsonb, true
  );

  RETURN true;

EXCEPTION
  WHEN unique_violation THEN
    -- Se o código de rastreamento já existe, é uma retentativa - retornar true
    IF EXISTS (SELECT 1 FROM public.survey_responses WHERE tracking_code = v_code) THEN
      RETURN true;
    END IF;
    RAISE;
END;
$$;

-- Dar permissão para executar a função
REVOKE ALL ON FUNCTION public.submit_survey_response(integer, text, text, text, text, jsonb, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_survey_response(integer, text, text, text, text, jsonb, text, boolean) TO anon, authenticated, service_role;
