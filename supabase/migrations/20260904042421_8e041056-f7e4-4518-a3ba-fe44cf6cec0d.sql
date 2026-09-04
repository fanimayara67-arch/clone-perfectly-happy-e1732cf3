GRANT INSERT ON TABLE public.survey_responses TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.survey_responses TO authenticated;
GRANT ALL ON TABLE public.survey_responses TO service_role;