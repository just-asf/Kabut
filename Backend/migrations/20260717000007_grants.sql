-- Grant full privileges to service_role on all custom tables
GRANT ALL PRIVILEGES ON TABLE public.observations TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.clean_votes TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.grid_status TO service_role;

-- Grant select privilege to anon and authenticated roles for grid status
GRANT SELECT ON TABLE public.grid_status TO anon, authenticated;

-- Grant select and insert privileges to anon and authenticated roles for submissions
GRANT SELECT, INSERT ON TABLE public.observations TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.clean_votes TO anon, authenticated;

-- Grant execute permissions on RPC functions to service_role, authenticated, and anon
GRANT EXECUTE ON FUNCTION public.upsert_grid_observation(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.register_clean_vote(TEXT) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_grid_status() TO service_role, authenticated, anon;

-- Grant usage on sequences for primary keys (if any are created in future)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated, anon;
