// ═══════════════════════════════════════════════════════
// POST /api/scrape/content — Run content pipeline
// Scrapes all platforms, scores with AI, generates drafts
// ═══════════════════════════════════════════════════════

import { createServerClient } from '../../../lib/supabase';
import { scrapeLinkedInContent, scrapeTwitterContent } from '../../../lib/scraper';
import { scoreContent, generateDraft } from '../../../lib/ai';

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  // Simple auth check
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = createServerClient();
  const startedAt = new Date().toISOString();
  let totalScraped = 0, totalScored = 0, totalErrors = 0;

  // Create log entry
  const { data: logEntry } = await db.from('scrape_log').insert({
    pipeline: 'content', status: 'running', started_at: startedAt,
  }).select().single();

  try {
    // 1. Get advisor profile + keywords
    const { data: profile } = await db.from('advisor_profile').select('*').single();
    const allKeywords = (profile?.content_keywords || 'equity compensation\nRSU tax strategy\nwealth building high earners')
      .split('\n').map(k => k.trim()).filter(Boolean);

    // Rotate 3 keywords per run to stay within timeout limits
    // Uses day-of-year to cycle through the full list
    const MAX_KEYWORDS_PER_RUN = 3;
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const startIdx = (dayIndex * MAX_KEYWORDS_PER_RUN) % allKeywords.length;
    const keywords = [];
    for (let i = 0; i < Math.min(MAX_KEYWORDS_PER_RUN, allKeywords.length); i++) {
      keywords.push(allKeywords[(startIdx + i) % allKeywords.length]);
    }
    console.log(`Running with ${keywords.length}/${allKeywords.length} keywords:`, keywords);

    // 2. Scrape all platforms
    const [linkedin, twitter] = await Promise.all([
      scrapeLinkedInContent(keywords),
      scrapeTwitterContent(keywords),
    ]);
    const allPosts = [...linkedin, ...twitter];
    totalScraped = allPosts.length;

    // 3. Upsert scraped posts (deduplicate)
    for (const post of allPosts) {
      await db.from('content_feed').upsert(post, {
        onConflict: 'external_id,platform',
        ignoreDuplicates: true,
      });
    }

    // 4. Score unscored posts
    const { data: unscored } = await db.from('content_feed')
      .select('*')
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
          }).eq('id', batch[j].id);
          totalScored++;
        }
      }
    }

    // 5. Generate drafts for top posts that don't have them
    //    History-aware: skip source posts that overlap with recent advisor posts
    const { data: topPosts } = await db.from('content_feed')
      .select('*')
      .is('draft_text', null)
      .not('scored_at', 'is', null)
      .eq('draft_status', 'pending')
      .order('expertise_signal', { ascending: false })
      .limit(20); // Fetch more candidates so we can filter

    const { data: postHistory } = await db.from('advisor_posts')
      .select('*').order('posted_at', { ascending: false }).limit(30);
    const { data: voiceSamples } = await db.from('voice_samples')
      .select('*').eq('type', 'post');
    const { data: contentPrefs } = await db.from('content_preferences')
      .select('*').eq('active', true);

    // Build recent topic set from last 14 days of actual posts
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const recentPosts = (postHistory || []).filter(p => 
      p.posted_at && new Date(p.posted_at) >= fourteenDaysAgo
    );
    const recentTopicTags = new Set(
      recentPosts.flatMap(p => (p.topic_tags || []).map(t => t.toLowerCase()))
    );
    // Extract key topic words from recent post text for broader matching
    const recentTopicWords = new Set();
    recentPosts.forEach(p => {
      const text = (p.post_text || '').toLowerCase();
      const keywords = ['rsu', 'iso', 'nso', 'stock option', 'equity comp', '401k', '401(k)',
        'roth', 'solo 401', 'tax', 'capital gain', 'estate plan', 'wealth transfer',
        'inheritance', 'home price', 'real estate', 'market', 'valuation', 's&p',
        'salary', 'bonus', 'insurance', 'debt', 'budget', 'net worth'];
      keywords.forEach(kw => { if (text.includes(kw)) recentTopicWords.add(kw); });
    });

    // Score each candidate for topic overlap with recent history
    const scoredCandidates = (topPosts || []).map(post => {
      const postText = (post.post_text || '').toLowerCase();
      const angle = (post.suggested_angle || '').toLowerCase();
      // Check tag overlap
      const tagOverlap = recentTopicTags.size > 0 && 
        [...recentTopicTags].some(tag => postText.includes(tag) || angle.includes(tag));
      // Check keyword overlap
      const kwOverlap = [...recentTopicWords].filter(kw => postText.includes(kw)).length;
      // Penalize high overlap, prefer fresh topics
      const overlapPenalty = (tagOverlap ? 30 : 0) + (kwOverlap * 10);
      return { post, overlapPenalty, originalScore: post.expertise_signal || 0 };
    });
    // Sort by adjusted score (original score minus overlap penalty), take top 8
    scoredCandidates.sort((a, b) => (b.originalScore - b.overlapPenalty) - (a.originalScore - a.overlapPenalty));
    const filteredTopPosts = scoredCandidates.slice(0, 8).map(c => c.post);

    console.log(`[Content] Draft candidates: ${(topPosts || []).length} total → ${filteredTopPosts.length} after history filter (${recentPosts.length} posts in last 14d, ${recentTopicWords.size} topic keywords)`);

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
          }).eq('id', post.id);
        }
      } catch (err) {
        totalErrors++;
        console.error('Draft generation error:', err.message);
      }
    }

    // 6. Update log
    await db.from('scrape_log').update({
      results_count: totalScraped,
      scored_count: totalScored,
      errors_count: totalErrors,
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', logEntry?.id);

    return res.status(200).json({
      success: true,
      scraped: totalScraped,
      scored: totalScored,
      errors: totalErrors,
    });

  } catch (err) {
    await db.from('scrape_log').update({
      status: 'failed', error_message: err.message,
      errors_count: totalErrors + 1,
      completed_at: new Date().toISOString(),
    }).eq('id', logEntry?.id);

    return res.status(500).json({ error: err.message });
  }
}
