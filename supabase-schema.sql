-- ═══════════════════════════════════════════════════════════════
-- THE PULSE v2 — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════

-- 1. Advisor Profile (single row, updated in place)
CREATE TABLE IF NOT EXISTS advisor_profile (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT DEFAULT '',
  firm TEXT DEFAULT '',
  title TEXT DEFAULT '',
  specialization TEXT DEFAULT '',
  tagline TEXT DEFAULT '',
  -- ICP fields
  icp_age_min INTEGER DEFAULT 25,
  icp_age_max INTEGER DEFAULT 45,
  icp_professions TEXT DEFAULT '',
  icp_pain_points TEXT DEFAULT '',
  -- Post rules
  posts_per_week INTEGER DEFAULT 4,
  preferred_length TEXT DEFAULT 'Under 200 words',
  preferred_formats TEXT DEFAULT '',
  topics_always TEXT DEFAULT '',
  topics_never TEXT DEFAULT '',
  tone_rules TEXT DEFAULT '',
  -- Compliance
  compliance_rules TEXT DEFAULT '',
  disclaimer_text TEXT DEFAULT '',
  compliance_notes TEXT DEFAULT '',
  -- Settings
  content_keywords TEXT DEFAULT '',
  comment_keywords TEXT DEFAULT '',
  non_prospect_filter TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Voice Samples
CREATE TABLE IF NOT EXISTS voice_samples (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('post', 'comment')),
  sample_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Content Preferences
CREATE TABLE IF NOT EXISTS content_preferences (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_custom BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pre-populate default content preferences
INSERT INTO content_preferences (id, label, description, active) VALUES
  ('contrarian', 'Contrarian takes', 'Challenge conventional wisdom with data.', TRUE),
  ('data', 'Data-driven analysis', 'Lead with specific numbers, stats, and dollar amounts.', TRUE),
  ('anecdotes', 'Personal anecdotes', 'Draw from real (anonymized) client scenarios.', TRUE),
  ('questions', 'Provocative questions', 'Open with a question that stops the scroll.', FALSE),
  ('frameworks', 'Actionable frameworks', 'Step-by-step thinking tools your ICP can apply.', FALSE),
  ('mythbusting', 'Myth-busting', 'Name a common belief, then dismantle it.', FALSE),
  ('timely', 'Timely / news-reactive', 'React to market events, tax law changes.', FALSE),
  ('vulnerable', 'Vulnerable / personal', 'Share your own journey, mistakes, or behind-the-scenes.', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 4. Advisor Posts (post history — what the advisor has published)
CREATE TABLE IF NOT EXISTS advisor_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_text TEXT NOT NULL,
  linkedin_url TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  topic_tags TEXT[] DEFAULT '{}',
  hook_type TEXT,
  posted_at TIMESTAMPTZ DEFAULT now(),
  performance_logged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Content Feed (scraped posts from across platforms)
CREATE TABLE IF NOT EXISTS content_feed (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT,
  platform TEXT NOT NULL,
  creator_name TEXT,
  creator_handle TEXT,
  post_text TEXT,
  url TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  -- Scoring
  expertise_signal INTEGER,
  icp_relevance INTEGER,
  suggested_angle TEXT,
  -- Draft generation
  draft_text TEXT,
  draft_topic_tags TEXT[] DEFAULT '{}',
  draft_hook_type TEXT,
  draft_image_hint TEXT,
  draft_hashtags TEXT[] DEFAULT '{}',
  draft_source_urls TEXT,
  draft_continuity_ref TEXT,
  draft_status TEXT DEFAULT 'pending' CHECK (draft_status IN ('pending', 'generated', 'approved', 'skipped', 'replaced')),
  -- Meta
  scraped_at TIMESTAMPTZ DEFAULT now(),
  scored_at TIMESTAMPTZ,
  UNIQUE(external_id, platform)
);

-- 6. Comment Feed (LinkedIn posts to comment on)
CREATE TABLE IF NOT EXISTS comment_feed (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT,
  platform TEXT DEFAULT 'linkedin',
  creator_name TEXT,
  creator_handle TEXT,
  creator_title TEXT,
  creator_company TEXT,
  post_text TEXT,
  url TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  post_age_hours REAL,
  -- Scoring (four dimensions)
  icp_magnet INTEGER,
  engagement_window INTEGER,
  authority_positioning INTEGER,
  conversation_starter INTEGER,
  comment_priority INTEGER,
  -- Generated comment
  suggested_comment TEXT,
  topic_tag TEXT,
  -- Status
  commented BOOLEAN DEFAULT FALSE,
  sn_lead BOOLEAN DEFAULT FALSE,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  scored_at TIMESTAMPTZ,
  UNIQUE(external_id, platform)
);

-- 7. Outreach Leads
CREATE TABLE IF NOT EXISTS outreach_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  linkedin_url TEXT,
  interaction_text TEXT,
  interaction_type TEXT CHECK (interaction_type IN ('commented', 'replied', 'liked_followed')),
  signal_strength TEXT DEFAULT 'moderate' CHECK (signal_strength IN ('strong', 'moderate', 'weak')),
  conversation_starter TEXT,
  sn_lead BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'messaged', 'dismissed')),
  surfaced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Sales Navigator Leads (CSV import)
CREATE TABLE IF NOT EXISTS sn_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  company TEXT,
  title TEXT,
  imported_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Scrape Log
CREATE TABLE IF NOT EXISTS scrape_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline TEXT NOT NULL,
  query TEXT,
  results_count INTEGER DEFAULT 0,
  scored_count INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 10. Algorithm State (key-value for learned preferences)
CREATE TABLE IF NOT EXISTS algorithm_state (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Performance Metrics (weekly snapshots)
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0,
  total_comments_made INTEGER DEFAULT 0,
  replies_received INTEGER DEFAULT 0,
  profile_clicks_from_comments INTEGER DEFAULT 0,
  new_connections INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_content_feed_status ON content_feed(draft_status);
CREATE INDEX IF NOT EXISTS idx_content_feed_scored ON content_feed(scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_feed_priority ON comment_feed(comment_priority DESC);
CREATE INDEX IF NOT EXISTS idx_comment_feed_commented ON comment_feed(commented);
CREATE INDEX IF NOT EXISTS idx_outreach_leads_status ON outreach_leads(status);
CREATE INDEX IF NOT EXISTS idx_advisor_posts_posted ON advisor_posts(posted_at DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE advisor_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE advisor_posts ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (allows API routes to read/write)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['advisor_profile','voice_samples','content_preferences',
    'content_feed','comment_feed','outreach_leads','sn_leads','scrape_log',
    'algorithm_state','advisor_posts','performance_metrics'])
  LOOP
    EXECUTE format('CREATE POLICY IF NOT EXISTS "Allow service role" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
  END LOOP;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Some policies may already exist - continuing';
END $$;
