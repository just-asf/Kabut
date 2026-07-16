ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clean_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grid_status ENABLE ROW LEVEL SECURITY;

-- observations: user hanya bisa insert data miliknya sendiri
CREATE POLICY "insert own observation" ON observations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- clean_votes: sama seperti observations
CREATE POLICY "insert own clean vote" ON clean_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- grid_status: read-only untuk semua orang, termasuk anon
CREATE POLICY "public read grid_status" ON grid_status
  FOR SELECT
  USING (true);

-- Tidak ada policy INSERT/UPDATE/DELETE untuk grid_status dari client.
-- Edge function pakai service role key yang otomatis bypass RLS.
