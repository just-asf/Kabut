CREATE TABLE grid_status (
  grid_id TEXT PRIMARY KEY,
  latitude_center DOUBLE PRECISION NOT NULL,
  longitude_center DOUBLE PRECISION NOT NULL,
  active_reports INT DEFAULT 0,
  clean_votes INT DEFAULT 0,
  score NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_grid_lat_lng ON grid_status(latitude_center, longitude_center);
