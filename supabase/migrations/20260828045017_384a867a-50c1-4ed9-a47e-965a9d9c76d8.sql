GRANT INSERT ON TABLE public.survey_responses TO anon, authenticated;
GRANT SELECT ON TABLE public.survey_responses TO authenticated;
GRANT ALL ON TABLE public.survey_responses TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.valid_tokens TO authenticated;
GRANT ALL ON TABLE public.valid_tokens TO service_role;

GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invalid_form_responses TO authenticated;
GRANT ALL ON TABLE public.invalid_form_responses TO service_role;

GRANT EXECUTE ON FUNCTION public.register_tracking_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_response_with_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_google_form_completed(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_and_consume_token(text, uuid) TO service_role;