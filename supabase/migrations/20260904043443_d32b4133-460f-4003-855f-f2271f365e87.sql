CREATE OR REPLACE FUNCTION public.debug_session_role()
RETURNS TABLE(role_name text, jwt_role text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT current_user::text, COALESCE(current_setting('request.jwt.claims', true)::json->>'role', 'none')::text;
$$;

GRANT EXECUTE ON FUNCTION public.debug_session_role() TO anon, authenticated;
GRANT ALL ON FUNCTION public.debug_session_role() TO service_role;