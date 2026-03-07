// POST /api/scrape/comments — Run comment pipeline
// Called by run-pipeline.js, which passes userId in the body
import { createServerClient } from '../../../lib/supabase';
import { scrapeLinkedInCommentFeed } from '../../../lib/scraper';
import { scoreComment, generateComment } from '../../../lib/ai';

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Multi-user: userId is injected by run-pipeline.js from the user's JWT
  const userId = req.body?.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const db = createServerClient();
  let totalScraped = 0, totalScored = 0, totalErrors = 0;

  // Create log entry scoped to this user
  const { data: logEntry } = await db.from('scrape_log').insert({
    user_id: userId,
    pipeline: 'comments',
    status: 'running',
    started_at: new Date().toISOString(),
  }).select().limit(1);
  const logId = logEntry?.[0]?.id;

  try {
    // 1. Get this user's profile + keywords
    const { data: profileRows } = await db.from('advisor_profile')
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    const profile = profileRows?.[0];

    const allKeywords = (profile?.comment_keywords || 'tech careers\nstartup culture\nBigLaw life\naerospace engineering')
      .split('\n').map(k => k.trim()).filter(Boolean);

    // Rotate 3 keywords per run to stay within timeout limits
    const MAX_KEYWORDS_PER_RUN = 3;
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const startIdx = (dayIndex * MAX_KEYWORDS_PER_RUN) % allKeywords.length;
    const keywords = [];
    for (let i = 0; i < Math.min(MAX_KEYWORDS_PER_RUN, allKeywords.length); i++) {
      keywords.push(allKeywords[(startIdx + i) % allKeywords.length]);
    }
    console.log(`[Comments:${userId.slice(0, 8)}] Running with ${keywords.length}/${allKeywords.length} keywords:`, keywords);

    // 2. Scrape LinkedIn comment feed
    const posts = await scrapeLinkedInCommentFeed(keywords);
    console.log(`[Comments:${userId.slice(0, 8)}] Scraper returned ${posts.length} posts`);
    totalScraped = posts.length;

    // 3. Upsert scraped posts — scoped to this user
    for (const post of posts) {
      await db.from('comment_feed').upsert(
        { ...post, user_id: userId },
        { onConflict: 'external_id,platform,user_id', ignoreDuplicates: true }
      );
    }

    // 4. Check against this user's SN leads for cross-referencing
    const { data: snLeads } = await db.from('sn_leads')
      .select('name, company')
      .eq('user_id', userId);
    const snSet = new Set((snLeads || []).map(l => `${l.name}|${l.company}`.toLowerCase()));

    // 5. Score unscored posts for this user
    const { data: unscored } = await db.from('comment_feed')
      .select('*')
      .eq('user_id', userId)
      .is('scored_at', null)
      .order('scraped_at', { ascending: false })
      .limit(30);

    // Get this user's voice samples for comment generation
    const { data: voiceSamplesResult } = await db.from('voice_samples')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'comment');
    const voiceSamples = voiceSamplesResult || [];

    for (const post of (unscored || [])) {
      try {
        const scores = await scoreComment(post, profile || {});
        if (scores) {
          const isSN = snSet.has(`${post.creator_name}|${post.creator_company}`.toLowerCase());
          const comment = await generateComment(post, profile || {}, voiceSamples);

          await db.from('comment_feed').update({
            ...scores,
            suggested_comment: comment,
            sn_lead: isSN,
            scored_at: new Date().toISOString(),
          }).eq('id', post.id).eq('user_id', userId);
          totalScored++;
        }
      } catch (err) {
        totalErrors++;
        console.error('[Comments] Scoring error:', err.message);
      }
    }

    // 6. Cleanup old entries (>7 days) for this user only
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.from('comment_feed')
      .delete()
      .eq('user_id', userId)
      .lt('scraped_at', weekAgo)
      .eq('commented', false);

    await db.from('scrape_log').update({
      results_count: totalScraped,
      scored_count: totalScored,
      errors_count: totalErrors,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', logId);

    return res.status(200).json({ success: true, scraped: totalScraped, scored: totalScored, errors: totalErrors });

  } catch (err) {
    await db.from('scrape_log').update({
      status: 'failed',
      error_message: err.message,
      completed_at: new Date().toISOString(),
    }).eq('id', logId);
    return res.status(500).json({ error: err.message });
  }
}
