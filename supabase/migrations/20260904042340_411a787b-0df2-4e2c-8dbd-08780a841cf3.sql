-- Reafirma permissões de acesso às tabelas públicas

-- survey_responses: anon/authenticated podem inserir; authenticated admin pode ler/atualizar/remover
GRANT INSERT ON TABLE public.survey_responses TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.survey_responses TO authenticated;
GRANT ALL ON TABLE public.survey_responses TO service_role;

-- invalid_form_responses: apenas admins autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invalid_form_responses TO authenticated;
GRANT ALL ON TABLE public.invalid_form_responses TO service_role;

-- user_roles: autenticados podem consultar (próprio papel e admin)
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;

-- valid_tokens: admins autenticados gerenciam
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.valid_tokens TO authenticated;
GRANT ALL ON TABLE public.valid_tokens TO service_role;

-- Reafirma a política de inserção anônima de respostas
DROP POLICY IF EXISTS "Anyone can submit a survey response" ON public.survey_responses;
CREATE POLICY "Anyone can submit a survey response"
  ON public.survey_responses FOR INSERT TO anon, authenticated WITH CHECK (true);