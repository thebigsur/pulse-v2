// ═══════════════════════════════════════════════════════
// POST /api/scrape/content — Run content pipeline
// Scrapes all platforms, scores with AI, generates drafts
// ═══════════════════════════════════════════════════════

import { createServerClient } from '../../../lib/supabase';
import { scrapeLinkedInContent, scrapeTwitterContent, scrapeTikTokContent } from '../../../lib/scraper';
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
    const [linkedin, twitter, tiktok] = await Promise.all([
      scrapeLinkedInContent(keywords),
      scrapeTwitterContent(keywords),
      scrapeTikTokContent(keywords),
    ]);
    const allPosts = [...linkedin, ...twitter, ...tiktok];
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
    const { data: topPosts } = await db.from('content_feed')
      .select('*')
      .is('draft_text', null)
      .not('scored_at', 'is', null)
      .eq('draft_status', 'pending')
      .order('expertise_signal', { ascending: false })
      .limit(8);

    const { data: postHistory } = await db.from('advisor_posts')
      .select('*').order('posted_at', { ascending: false }).limit(15);
    const { data: voiceSamples } = await db.from('voice_samples')
      .select('*').eq('type', 'post');
    const { data: contentPrefs } = await db.from('content_preferences')
      .select('*').eq('active', true);

    for (const post of (topPosts || [])) {
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
