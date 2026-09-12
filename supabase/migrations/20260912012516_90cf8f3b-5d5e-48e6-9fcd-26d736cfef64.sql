CREATE OR REPLACE FUNCTION public.confirm_response_with_token(_tracking_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text;
  v_response_id uuid;
  v_already_validated boolean;
  v_token_ok boolean;
BEGIN
  IF _tracking_code IS NULL THEN RETURN false; END IF;
  v_normalized := upper(trim(_tracking_code));

  IF v_normalized !~ '^UFTC-[A-Z0-9]{4,16}$' THEN RETURN false; END IF;

  SELECT id, token_validated
  INTO v_response_id, v_already_validated
  FROM public.survey_responses
  WHERE tracking_code = v_normalized
  LIMIT 1;

  IF v_response_id IS NULL THEN RETURN false; END IF;

  IF v_already_validated THEN
    RETURN true;
  END IF;

  v_token_ok := public.validate_and_consume_token(v_normalized, v_response_id);
  IF NOT v_token_ok THEN RETURN false; END IF;

  UPDATE public.survey_responses
  SET token_validated = true,
      token_validated_at = now(),
      google_form_completed = true,
      google_form_completed_at = COALESCE(google_form_completed_at, now())
  WHERE id = v_response_id;

  RETURN true;
END;
$$;