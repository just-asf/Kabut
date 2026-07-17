CREATE TABLE user_trust (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  reputation_score INT DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE observations 
ADD COLUMN confidence INT NOT NULL DEFAULT 100,
ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'LOW',
ADD COLUMN is_mocked BOOLEAN DEFAULT false,
ADD COLUMN accuracy DOUBLE PRECISION,
ADD COLUMN speed DOUBLE PRECISION,
ADD COLUMN device_info JSONB,
ADD COLUMN trust_reasons TEXT[] DEFAULT '{}',
ADD COLUMN exact_lat DOUBLE PRECISION,
ADD COLUMN exact_lng DOUBLE PRECISION;

CREATE INDEX idx_user_trust_score ON user_trust(reputation_score);

ALTER TABLE grid_status
ADD COLUMN cumulative_confidence DOUBLE PRECISION DEFAULT 0;

-- Update upsert function to include confidence
CREATE OR REPLACE FUNCTION upsert_grid_observation(p_grid_id TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_confidence INT DEFAULT 100)
RETURNS VOID AS $$
BEGIN
  INSERT INTO grid_status (grid_id, latitude_center, longitude_center, active_reports, cumulative_confidence, score, last_updated)
  VALUES (p_grid_id, p_lat, p_lng, 1, p_confidence, GREATEST((p_confidence / 100.0), 0), now())
  ON CONFLICT (grid_id) DO UPDATE
  SET active_reports = grid_status.active_reports + 1,
      cumulative_confidence = grid_status.cumulative_confidence + p_confidence,
      score = GREATEST(((grid_status.cumulative_confidence + p_confidence) / 100.0) - (grid_status.clean_votes * 0.7), 0),
      last_updated = now();
END;
$$ LANGUAGE plpgsql;

-- Update cron function to sum confidence
CREATE OR REPLACE FUNCTION recalculate_grid_status()
RETURNS VOID AS $$
BEGIN
  DELETE FROM observations WHERE expires_at < now();

  UPDATE grid_status g
  SET active_reports = sub.count,
      cumulative_confidence = sub.total_conf,
      score = GREATEST((sub.total_conf / 100.0) - (g.clean_votes * 0.7), 0),
      last_updated = now()
  FROM (
    SELECT grid_id, COUNT(*) AS count, COALESCE(SUM(confidence), 0) AS total_conf
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

-- Update clean vote function to use cumulative_confidence
CREATE OR REPLACE FUNCTION register_clean_vote(p_grid_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE grid_status
  SET clean_votes = clean_votes + 1,
      score = GREATEST((cumulative_confidence / 100.0) - ((clean_votes + 1) * 0.7), 0),
      last_updated = now()
  WHERE grid_id = p_grid_id;
END;
$$ LANGUAGE plpgsql;
