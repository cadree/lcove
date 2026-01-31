-- Extend brand_partnerships table with additional columns for business info
ALTER TABLE brand_partnerships ADD COLUMN IF NOT EXISTS about_business TEXT;
ALTER TABLE brand_partnerships ADD COLUMN IF NOT EXISTS exclusive_offer TEXT;
ALTER TABLE brand_partnerships ADD COLUMN IF NOT EXISTS offer_code TEXT;
ALTER TABLE brand_partnerships ADD COLUMN IF NOT EXISTS offer_terms TEXT;
ALTER TABLE brand_partnerships ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE brand_partnerships ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE brand_partnerships ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;

-- Add collective-specific columns to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS collective_topic TEXT DEFAULT 'general';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS join_requests_enabled BOOLEAN DEFAULT false;

-- Create join requests table for collectives
CREATE TABLE IF NOT EXISTS collective_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- RLS for join requests
ALTER TABLE collective_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests" ON collective_join_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Collective admins can view requests" ON collective_join_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = collective_join_requests.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role IN ('owner', 'moderator')
    )
  );

CREATE POLICY "Users can create requests" ON collective_join_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update requests" ON collective_join_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = collective_join_requests.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role IN ('owner', 'moderator')
    )
  );