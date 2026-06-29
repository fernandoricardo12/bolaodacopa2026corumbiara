REVOKE ALL ON FUNCTION public.sync_knockout_to_matches() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_knockout_to_matches() FROM anon;
REVOKE ALL ON FUNCTION public.sync_knockout_to_matches() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_knockout_to_matches() TO service_role;