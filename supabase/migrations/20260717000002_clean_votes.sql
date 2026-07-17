CREATE TABLE clean_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  grid_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, grid_id)
);

CREATE INDEX idx_clean_votes_ip ON clean_votes(ip_hash, created_at);
