// /api/debug-pipeline — Read-only diagnostic endpoint
// Access: /api/debug-pipeline?secret=YOUR_CRON_SECRET
// DELETE THIS FILE after debugging is complete

import { createServerClient } from '../../lib/supabase';

export default async function handler(req, res) {
  // Accept CRON_SECRET as a query param so we can hit it from a browser
  const { secret } = req.query;
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized — add ?secret=YOUR_CRON_SECRET to the URL' });
  }

  const db = createServerClient();

  // Get all users with a profile (so we can check each)
  const { data: profiles } = await db.from('advisor_profile')
    .select('user_id, content_keywords, comment_keywords');

  const results = [];

  for (const profile of (profiles || [])) {
    const userId = profile.user_id;

    const { data: posts } = await db.from('content_feed')
      .select('id, platform, scored_at, draft_status, draft_text, scraped_at, post_text, expertise_signal')
      .eq('user_id', userId)
      .order('scraped_at', { ascending: false })
      .limit(200);

    const allPosts = posts || [];
    const summary = {
      userId: userId.slice(0, 8) + '...',
      total: allPosts.length,
      byPlatform: {},
      byDraftStatus: {},
      scored: allPosts.filter(p => p.scored_at).length,
      unscored: allPosts.filter(p => !p.scored_at).length,
      withDraftText: allPosts.filter(p => p.draft_text).length,
    };

    allPosts.forEach(p => {
      summary.byPlatform[p.platform] = (summary.byPlatform[p.platform] || 0) + 1;
      summary.byDraftStatus[p.draft_status || 'null'] = (summary.byDraftStatus[p.draft_status || 'null'] || 0) + 1;
    });

    const recent3 = allPosts.slice(0, 3).map(p => ({
      platform: p.platform,
      scraped_at: p.scraped_at,
      scored_at: p.scored_at,
      draft_status: p.draft_status,
      has_draft: !!p.draft_text,
      expertise_signal: p.expertise_signal,
      text: (p.post_text || '').substring(0, 60),
    }));

    const { data: logs } = await db.from('scrape_log')
      .select('pipeline, status, started_at, completed_at, results_count, scored_count, errors_count, error_message')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(8);

    const contentKws = (profile.content_keywords || '').split('\n').map(k => k.trim()).filter(Boolean);

    results.push({
      summary,
      recent3,
      recentLogs: logs || [],
      keywords: { count: contentKws.length, first5: contentKws.slice(0, 5) },
    });
  }

  return res.json(results);
}
