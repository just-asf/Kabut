-- Enable SELECT queries for users to check their own observations and clean votes (needed for cooldown synchronization)
CREATE POLICY "select own observations" ON observations
  FOR SELECT
  TO authenticated, anon
  USING (auth.uid() = user_id);

CREATE POLICY "select own clean votes" ON clean_votes
  FOR SELECT
  TO authenticated, anon
  USING (auth.uid() = user_id);
