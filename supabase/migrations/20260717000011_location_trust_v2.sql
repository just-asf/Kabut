ALTER TABLE observations
ADD COLUMN device_id TEXT,
ADD COLUMN effective_contribution DOUBLE PRECISION DEFAULT 1.0;

-- Update the upsert_grid_observation function to use effective_contribution
CREATE OR REPLACE FUNCTION upsert_grid_observation(p_grid_id TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_confidence INT, p_reputation INT DEFAULT 50)
RETURNS VOID AS $$
DECLARE
  v_effective DOUBLE PRECISION;
BEGIN
  -- Weight = (confidence / 100.0) * (reputation / 50.0)
  v_effective := (p_confidence / 100.0) * (p_reputation / 50.0);

  INSERT INTO grid_status (grid_id, latitude_center, longitude_center, active_reports, cumulative_confidence, score, last_updated)
  VALUES (p_grid_id, p_lat, p_lng, 1, v_effective, GREATEST(v_effective, 0), now())
  ON CONFLICT (grid_id) DO UPDATE
  SET active_reports = grid_status.active_reports + 1,
      cumulative_confidence = grid_status.cumulative_confidence + v_effective,
      score = GREATEST((grid_status.cumulative_confidence + v_effective) - (grid_status.clean_votes * 0.7), 0),
      last_updated = now();
END;
$$ LANGUAGE plpgsql;

-- Update the cron recalculation to sum effective_contribution
CREATE OR REPLACE FUNCTION recalculate_grid_status()
RETURNS VOID AS $$
BEGIN
  DELETE FROM observations WHERE expires_at < now();

  UPDATE grid_status g
  SET active_reports = sub.count,
      cumulative_confidence = sub.total_effective,
      score = GREATEST(sub.total_effective - (g.clean_votes * 0.7), 0),
      last_updated = now()
  FROM (
    SELECT grid_id, COUNT(*) AS count, COALESCE(SUM(effective_contribution), 0) AS total_effective
    FROM observations
    GROUP BY grid_id
  ) sub
  WHERE g.grid_id = sub.grid_id;

  UPDATE grid_status
  SET active_reports = 0, cumulative_confidence = 0, clean_votes = 0, score = 0, last_updated = now()
  WHERE grid_id NOT IN (SELECT DISTINCT grid_id FROM observations);

  DELETE FROM clean_votes 
  WHERE grid_id NOT IN (SELECT DISTINCT grid_id FROM observations);
END;
$$ LANGUAGE plpgsql;

-- Update the clean vote register
CREATE OR REPLACE FUNCTION register_clean_vote(p_grid_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE grid_status
  SET clean_votes = clean_votes + 1,
      score = GREATEST(cumulative_confidence - ((clean_votes + 1) * 0.7), 0),
      last_updated = now()
  WHERE grid_id = p_grid_id;
END;
$$ LANGUAGE plpgsql;
