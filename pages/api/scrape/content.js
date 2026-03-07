// ═══════════════════════════════════════════════════════
// POST /api/scrape/content — Run content pipeline
// Scrapes all platforms, scores with AI, generates drafts
// Called by run-pipeline.js, which passes userId in the body
// ═══════════════════════════════════════════════════════

import { createServerClient } from '../../../lib/supabase';
import { scrapeLinkedInContent, scrapeTwitterContent } from '../../../lib/scraper';
import { scoreContent, generateDraft } from '../../../lib/ai';

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: accept either CRON_SECRET (scheduled runs) or internal pipeline proxy
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Multi-user: userId is injected by run-pipeline.js from the user's JWT
  const userId = req.body?.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const db = createServerClient();
  const startedAt = new Date().toISOString();
  let totalScraped = 0, totalScored = 0, totalErrors = 0;

  // Create log entry scoped to this user
  const { data: logEntry } = await db.from('scrape_log').insert({
    user_id: userId,
    pipeline: 'content',
    status: 'running',
    started_at: startedAt,
  }).select().limit(1);
  const logId = logEntry?.[0]?.id;

  try {
    // 1. Get this user's advisor profile + keywords
    const { data: profileRows } = await db.from('advisor_profile')
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    const profile = profileRows?.[0];

    const allKeywords = (profile?.content_keywords || 'equity compensation\nRSU tax strategy\nwealth building high earners')
      .split('\n').map(k => k.trim()).filter(Boolean);

    // Rotate 3 keywords per run to stay within timeout limits
    const MAX_KEYWORDS_PER_RUN = 3;
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const startIdx = (dayIndex * MAX_KEYWORDS_PER_RUN) % allKeywords.length;
    const keywords = [];
    for (let i = 0; i < Math.min(MAX_KEYWORDS_PER_RUN, allKeywords.length); i++) {
      keywords.push(allKeywords[(startIdx + i) % allKeywords.length]);
    }
    console.log(`[Content:${userId.slice(0, 8)}] Running with ${keywords.length}/${allKeywords.length} keywords:`, keywords);

    // 2. Scrape all platforms
    const [linkedin, twitter] = await Promise.all([
      scrapeLinkedInContent(keywords),
      scrapeTwitterContent(keywords),
    ]);
    const allPosts = [...linkedin, ...twitter];
    totalScraped = allPosts.length;

    // 3. Upsert scraped posts — scoped to this user
    for (const post of allPosts) {
      await db.from('content_feed').upsert(
        { ...post, user_id: userId },
        { onConflict: 'external_id,platform,user_id', ignoreDuplicates: true }
      );
    }

    // 4. Score unscored posts for this user
    const { data: unscored } = await db.from('content_feed')
      .select('*')
      .eq('user_id', userId)
      .is('scored_at', null)
      .order('scraped_at', { ascending: false })
      .limit(50);

    const BATCH_SIZE = 10;
    for (let i = 0; i < (unscored || []).length; i += BATCH_SIZE) {
      const batch = unscored.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(post => scoreContent(post, profile || {}).catch(() => { totalErrors++; return null; }))
      );
      for (let j = 0; j < batch.length; j++) {
        if (results[j]) {
          await db.from('content_feed').update({
            expertise_signal: results[j].expertise_signal,
            icp_relevance: results[j].icp_relevance,
            suggested_angle: results[j].suggested_angle,
            scored_at: new Date().toISOString(),
          }).eq('id', batch[j].id).eq('user_id', userId);
          totalScored++;
        }
      }
    }

    // 5. Generate drafts for top posts that don't have them yet
    //    History-aware: skip source posts that overlap with recent advisor posts
    const { data: topPosts } = await db.from('content_feed')
      .select('*')
      .eq('user_id', userId)
      .is('draft_text', null)
      .not('scored_at', 'is', null)
      .eq('draft_status', 'pending')
      .order('expertise_signal', { ascending: false })
      .limit(20);

    const { data: postHistory } = await db.from('advisor_posts')
      .select('*')
      .eq('user_id', userId)
      .order('posted_at', { ascending: false })
      .limit(30);

    const { data: voiceSamples } = await db.from('voice_samples')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'post');

    const { data: contentPrefs } = await db.from('content_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true);

    // Build recent topic set from last 14 days of actual posts
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const recentPosts = (postHistory || []).filter(p =>
      p.posted_at && new Date(p.posted_at) >= fourteenDaysAgo
    );
    const recentTopicTags = new Set(
      recentPosts.flatMap(p => (p.topic_tags || []).map(t => t.toLowerCase()))
    );
    const recentTopicWords = new Set();
    recentPosts.forEach(p => {
      const text = (p.post_text || '').toLowerCase();
      const kws = ['rsu', 'iso', 'nso', 'stock option', 'equity comp', '401k', '401(k)',
        'roth', 'solo 401', 'tax', 'capital gain', 'estate plan', 'wealth transfer',
        'inheritance', 'home price', 'real estate', 'market', 'valuation', 's&p',
        'salary', 'bonus', 'insurance', 'debt', 'budget', 'net worth'];
      kws.forEach(kw => { if (text.includes(kw)) recentTopicWords.add(kw); });
    });

    const scoredCandidates = (topPosts || []).map(post => {
      const postText = (post.post_text || '').toLowerCase();
      const angle = (post.suggested_angle || '').toLowerCase();
      const tagOverlap = recentTopicTags.size > 0 &&
        [...recentTopicTags].some(tag => postText.includes(tag) || angle.includes(tag));
      const kwOverlap = [...recentTopicWords].filter(kw => postText.includes(kw)).length;
      const overlapPenalty = (tagOverlap ? 30 : 0) + (kwOverlap * 10);
      return { post, overlapPenalty, originalScore: post.expertise_signal || 0 };
    });
    scoredCandidates.sort((a, b) => (b.originalScore - b.overlapPenalty) - (a.originalScore - a.overlapPenalty));
    const filteredTopPosts = scoredCandidates.slice(0, 8).map(c => c.post);

    console.log(`[Content:${userId.slice(0, 8)}] Draft candidates: ${(topPosts || []).length} → ${filteredTopPosts.length} after history filter`);

    for (const post of filteredTopPosts) {
      try {
        const draft = await generateDraft(post, profile || {}, postHistory || [], voiceSamples || [], contentPrefs || []);
        if (draft) {
          await db.from('content_feed').update({
            draft_text: draft.draft_text,
            draft_topic_tags: draft.topic_tags || [],
            draft_hook_type: draft.hook_type,
            draft_image_hint: draft.image_suggestion,
            draft_hashtags: draft.hashtags || [],
            draft_source_urls: draft.source_urls,
            draft_continuity_ref: draft.continuity_reference,
            draft_status: 'generated',
          }).eq('id', post.id).eq('user_id', userId);
        }
      } catch (err) {
        totalErrors++;
        console.error('[Content] Draft generation error:', err.message);
      }
    }

    // 6. Update log
    await db.from('scrape_log').update({
      results_count: totalScraped,
      scored_count: totalScored,
      errors_count: totalErrors,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', logId);

    return res.status(200).json({
      success: true,
      scraped: totalScraped,
      scored: totalScored,
      errors: totalErrors,
    });

  } catch (err) {
    await db.from('scrape_log').update({
      status: 'failed',
      error_message: err.message,
      errors_count: totalErrors + 1,
      completed_at: new Date().toISOString(),
    }).eq('id', logId);

    return res.status(500).json({ error: err.message });
  }
}
