-- Drop legacy columns from grid_status and observations if they exist
ALTER TABLE grid_status DROP COLUMN IF EXISTS cumulative_confidence;
ALTER TABLE observations DROP COLUMN IF EXISTS effective_contribution;

-- 1. Rewrite upsert_grid_observation
-- Note: We retain p_confidence and p_reputation parameters to not break the backend, 
-- but we completely ignore them in the calculation.
CREATE OR REPLACE FUNCTION upsert_grid_observation(p_grid_id TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_confidence INT DEFAULT 100, p_reputation INT DEFAULT 50)
RETURNS VOID AS $$
BEGIN
  INSERT INTO grid_status (grid_id, latitude_center, longitude_center, active_reports, score, last_updated)
  VALUES (p_grid_id, p_lat, p_lng, 1, 1, now())
  ON CONFLICT (grid_id) DO UPDATE
  SET active_reports = grid_status.active_reports + 1,
      score = GREATEST((grid_status.active_reports + 1) - grid_status.clean_votes, 0),
      last_updated = now();
END;
$$ LANGUAGE plpgsql;

-- Replace other obsolete overloads to point to the same logic
CREATE OR REPLACE FUNCTION upsert_grid_observation(p_grid_id TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS VOID AS $$
BEGIN
  PERFORM upsert_grid_observation(p_grid_id, p_lat, p_lng, 100, 50);
END;
$$ LANGUAGE plpgsql;

-- 2. Rewrite recalculate_grid_status
CREATE OR REPLACE FUNCTION recalculate_grid_status()
RETURNS VOID AS $$
BEGIN
  DELETE FROM observations WHERE expires_at < now();

  UPDATE grid_status g
  SET active_reports = sub.count,
      score = GREATEST(sub.count - g.clean_votes, 0),
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

-- 3. Rewrite register_clean_vote
CREATE OR REPLACE FUNCTION register_clean_vote(p_grid_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE grid_status
  SET clean_votes = clean_votes + 1,
      score = GREATEST(active_reports - (clean_votes + 1), 0),
      last_updated = now()
  WHERE grid_id = p_grid_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Recalculate all existing data to enforce the new rule immediately
UPDATE grid_status
SET score = GREATEST(active_reports - clean_votes, 0);
