
REVOKE EXECUTE ON FUNCTION public.get_user_company_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO service_role;
-- This function is called inside RLS policies which run as the policy owner, so authenticated still benefits indirectly.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
-- Only triggers (run by postgres) call this; service_role retains via ownership.
