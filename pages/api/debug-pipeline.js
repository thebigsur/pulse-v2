// /api/debug-pipeline — Read-only diagnostic endpoint
// Shows exactly what's in content_feed so we can pinpoint pipeline failures
// DELETE THIS FILE after debugging is complete

import { createServerClient, getUserId } from '../../lib/supabase';

export default async function handler(req, res) {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = createServerClient();

  // 1. Raw counts by status
  const { data: allPosts } = await db.from('content_feed')
    .select('id, platform, scored_at, draft_status, draft_text, scraped_at, post_text, expertise_signal')
    .eq('user_id', userId)
    .order('scraped_at', { ascending: false })
    .limit(200);

  const posts = allPosts || [];

  const summary = {
    total: posts.length,
    byPlatform: {},
    byDraftStatus: {},
    scored: posts.filter(p => p.scored_at).length,
    unscored: posts.filter(p => !p.scored_at).length,
    withDraftText: posts.filter(p => p.draft_text).length,
    noDraftText: posts.filter(p => !p.draft_text).length,
  };

  posts.forEach(p => {
    summary.byPlatform[p.platform] = (summary.byPlatform[p.platform] || 0) + 1;
    summary.byDraftStatus[p.draft_status || 'null'] = (summary.byDraftStatus[p.draft_status || 'null'] || 0) + 1;
  });

  // 2. Most recent 5 posts (any status) — show raw data
  const recent5 = posts.slice(0, 5).map(p => ({
    id: p.id,
    platform: p.platform,
    scraped_at: p.scraped_at,
    scored_at: p.scored_at,
    draft_status: p.draft_status,
    has_draft_text: !!p.draft_text,
    expertise_signal: p.expertise_signal,
    text_preview: (p.post_text || '').substring(0, 80),
  }));

  // 3. Recent scrape logs
  const { data: logs } = await db.from('scrape_log')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(10);

  // 4. Profile keywords check
  const { data: profileRows } = await db.from('advisor_profile')
    .select('content_keywords, comment_keywords')
    .eq('user_id', userId)
    .limit(1);

  const profile = profileRows?.[0] || {};
  const contentKws = (profile.content_keywords || '').split('\n').map(k => k.trim()).filter(Boolean);

  return res.json({
    summary,
    recent5,
    recentLogs: (logs || []).map(l => ({
      pipeline: l.pipeline,
      status: l.status,
      started_at: l.started_at,
      completed_at: l.completed_at,
      results_count: l.results_count,
      scored_count: l.scored_count,
      errors_count: l.errors_count,
      error_message: l.error_message,
    })),
    keywordCount: contentKws.length,
    firstFewKeywords: contentKws.slice(0, 5),
  });
}
