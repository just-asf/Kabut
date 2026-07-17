-- Fix: Add SECURITY DEFINER to all RPC functions.
-- Without SECURITY DEFINER, functions execute with the INVOKER's privileges,
-- causing "permission denied for table grid_status" even when called via service_role.
-- SECURITY DEFINER makes the function body run as the owner (postgres), which has full access.
-- SET search_path = public prevents search-path hijacking attacks.

CREATE OR REPLACE FUNCTION upsert_grid_observation(p_grid_id TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO grid_status (grid_id, latitude_center, longitude_center, active_reports, score, last_updated)
  VALUES (p_grid_id, p_lat, p_lng, 1, 1, now())
  ON CONFLICT (grid_id) DO UPDATE
  SET active_reports = grid_status.active_reports + 1,
      score = GREATEST((grid_status.active_reports + 1) - (grid_status.clean_votes * 0.7), 0),
      last_updated = now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION register_clean_vote(p_grid_id TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE grid_status
  SET clean_votes = clean_votes + 1,
      score = GREATEST(active_reports - ((clean_votes + 1) * 0.7), 0),
      last_updated = now()
  WHERE grid_id = p_grid_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalculate_grid_status()
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM observations WHERE expires_at < now();

  UPDATE grid_status g
  SET active_reports = sub.count,
      score = GREATEST(sub.count - (g.clean_votes * 0.7), 0),
      last_updated = now()
  FROM (
    SELECT grid_id, COUNT(*) AS count
    FROM observations
    GROUP BY grid_id
  ) sub
  WHERE g.grid_id = sub.grid_id;

  UPDATE grid_status
  SET active_reports = 0, clean_votes = 0, score = 0, last_updated = now()
  WHERE grid_id NOT IN (SELECT DISTINCT grid_id FROM observations);

  DELETE FROM clean_votes 
  WHERE grid_id NOT IN (SELECT DISTINCT grid_id FROM observations);
END;
$$ LANGUAGE plpgsql;
