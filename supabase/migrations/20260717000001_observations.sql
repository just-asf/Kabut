CREATE TABLE observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  grid_id TEXT NOT NULL,
  latitude_center DOUBLE PRECISION NOT NULL,
  longitude_center DOUBLE PRECISION NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_observations_grid ON observations(grid_id);
CREATE INDEX idx_observations_expires ON observations(expires_at);
CREATE INDEX idx_observations_cooldown ON observations(grid_id, user_id, created_at);
CREATE INDEX idx_observations_ip ON observations(ip_hash, created_at);
