CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

ALTER POLICY "Admins can manage invalid responses delete" ON public.invalid_form_responses USING (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can manage invalid responses insert" ON public.invalid_form_responses WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can manage invalid responses update" ON public.invalid_form_responses USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can view invalid responses" ON public.invalid_form_responses USING (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can view all responses" ON public.survey_responses USING (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins can view roles" ON public.user_roles USING (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins manage tokens delete" ON public.valid_tokens USING (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins manage tokens insert" ON public.valid_tokens WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins manage tokens select" ON public.valid_tokens USING (private.has_role(auth.uid(), 'admin'::public.app_role));
ALTER POLICY "Admins manage tokens update" ON public.valid_tokens USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP FUNCTION public.has_role(uuid, public.app_role);