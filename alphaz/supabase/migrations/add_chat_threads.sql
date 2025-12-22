-- =====================================================
-- Chat Threads, Messages, Drafts & Versions
-- Allows org-level access for threads (anyone with org access can see them)
-- =====================================================

-- 1. Threads table
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Owner user
  user_clerk_id VARCHAR(255) NOT NULL REFERENCES public.users(clerk_user_id) ON DELETE CASCADE,

  -- Optional organization (null = personal); anyone with org access can view
  organization_id VARCHAR(255),

  -- Display title (can be auto-generated from first message or set by user)
  title VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_threads_user ON public.chat_threads(user_clerk_id);
CREATE INDEX idx_chat_threads_org ON public.chat_threads(organization_id);

CREATE TRIGGER update_chat_threads_updated_at BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Thread messages table
CREATE TABLE IF NOT EXISTS public.chat_thread_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,

  -- 'user' or 'assistant'
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant')),

  -- Message content
  content TEXT NOT NULL,

  -- Optional intent label for assistant messages (draft, edit, question, etc.)
  intent VARCHAR(50),

  -- Order/sort field (increment per message in thread)
  seq INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_thread_messages_thread ON public.chat_thread_messages(thread_id);

-- 3. Thread drafts table (each draft belongs to a thread)
CREATE TABLE IF NOT EXISTS public.chat_thread_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,

  -- Current version number (latest)
  current_version INTEGER NOT NULL DEFAULT 1,

  -- Optional title
  title VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_thread_drafts_thread ON public.chat_thread_drafts(thread_id);

CREATE TRIGGER update_chat_thread_drafts_updated_at BEFORE UPDATE ON public.chat_thread_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Draft versions table
CREATE TABLE IF NOT EXISTS public.chat_thread_draft_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.chat_thread_drafts(id) ON DELETE CASCADE,

  -- Version number (1, 2, 3, ...)
  version INTEGER NOT NULL DEFAULT 1,

  -- Full content of this version
  content TEXT NOT NULL,

  -- Optional edit prompt that led to this version
  edit_prompt TEXT,

  -- Changes bullet points (stored as JSON array of strings)
  changes JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(draft_id, version)
);

CREATE INDEX idx_draft_versions_draft ON public.chat_thread_draft_versions(draft_id);

-- =====================================================
-- RLS Policies (org-level access)
-- =====================================================

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_thread_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_thread_draft_versions ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "Service role full access on threads" ON public.chat_threads USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access on messages" ON public.chat_thread_messages USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access on drafts" ON public.chat_thread_drafts USING (auth.jwt()->>'role' = 'service_role');
CREATE POLICY "Service role full access on versions" ON public.chat_thread_draft_versions USING (auth.jwt()->>'role' = 'service_role');

-- Users can access threads they own OR threads for orgs they have access to
-- NOTE: In a real setup you'd join against a user-org membership table.
-- Here we allow anyone with the same org_id stored in JWT claim or users table.
-- For simplicity, backend uses service role so these are mainly illustrative.

CREATE POLICY "Users can access own or org threads" ON public.chat_threads
  FOR ALL USING (
    user_clerk_id = auth.uid()::text
    OR organization_id IN (
      SELECT company_id FROM public.linkedin_company_pages WHERE user_clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can access messages in accessible threads" ON public.chat_thread_messages
  FOR ALL USING (
    thread_id IN (SELECT id FROM public.chat_threads WHERE user_clerk_id = auth.uid()::text OR organization_id IN (
      SELECT company_id FROM public.linkedin_company_pages WHERE user_clerk_id = auth.uid()::text
    ))
  );

CREATE POLICY "Users can access drafts in accessible threads" ON public.chat_thread_drafts
  FOR ALL USING (
    thread_id IN (SELECT id FROM public.chat_threads WHERE user_clerk_id = auth.uid()::text OR organization_id IN (
      SELECT company_id FROM public.linkedin_company_pages WHERE user_clerk_id = auth.uid()::text
    ))
  );

CREATE POLICY "Users can access draft versions" ON public.chat_thread_draft_versions
  FOR ALL USING (
    draft_id IN (SELECT id FROM public.chat_thread_drafts WHERE thread_id IN (
      SELECT id FROM public.chat_threads WHERE user_clerk_id = auth.uid()::text OR organization_id IN (
        SELECT company_id FROM public.linkedin_company_pages WHERE user_clerk_id = auth.uid()::text
      )
    ))
  );
