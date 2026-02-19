// POST /api/scrape/post-history â Sync advisor's own LinkedIn posts
// Searches for the advisor's name and stores matching posts in advisor_posts

import { createServerClient } from '../../../lib/supabase';
import { ApifyClient } from 'apify-client';
import { extractApifyToken, sanitizeText, num } from '../../../lib/utils.js';

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = createServerClient();
  let totalScraped = 0, totalStored = 0, totalErrors = 0;

  const { data: logEntry } = await db.from('scrape_log').insert({
    pipeline: 'post-history', status: 'running', started_at: new Date().toISOString(),
  }).select().single();

  try {
    // Get advisor profile
    const { data: profile } = await db.from('advisor_profile').select('*').single();
    const advisorName = (profile?.name || '').trim();

    if (!advisorName) {
      await db.from('scrape_log').update({
        status: 'completed', completed_at: new Date().toISOString(),
        results_count: 0, scored_count: 0, errors_count: 0,
      }).eq('id', logEntry?.id);
      return res.json({ success: true, scraped: 0, stored: 0, errors: 0, message: 'No advisor name set in profile' });
    }

    // Search LinkedIn for the advisor's posts
    const token = extractApifyToken(process.env.APIFY_API_TOKEN);
    const client = new ApifyClient({ token });

    console.log(`[Post History] Searching for posts by: "${advisorName}"`);
    const run = await client.actor('harvestapi/linkedin-post-search').call({
      searchQueries: [advisorName],
      maxPosts: 30,
      sortBy: 'date',
    }, { waitSecs: 120 });

    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 30 });
    totalScraped = items.length;
    console.log(`[Post History] Got ${items.length} raw items`);

    // Filter to only include posts by the advisor (fuzzy name match)
    const nameLower = advisorName.toLowerCase();
    const nameWords = nameLower.split(/\s+/);

    for (const item of items) {
      try {
        const authorName = (item.author?.name || item.authorName || '').toLowerCase();
        // Match if the author name contains most of the advisor's name words
        const matchCount = nameWords.filter(w => authorName.includes(w)).length;
        if (matchCount < Math.max(1, nameWords.length - 1)) continue;

        const text = sanitizeText(item.text || item.title || item.postText || item.content || '');
        if (!text || text.length < 10) continue;

        const postUrl = item.linkedinUrl || item.url || item.postUrl ||
          (item.shareUrn ? `https://www.linkedin.com/feed/update/${item.shareUrn}` : '');

        // Skip posts without a URL (can't dedup without it)
        if (!postUrl) continue;

        // Get post date
        let postedAt = item.postedAt || item.publishedAt || item.postedDate || null;
        if (postedAt) {
          postedAt = new Date(postedAt).toISOString();
        } else {
          postedAt = new Date().toISOString();
        }

        // Upsert into advisor_posts
        const { error } = await db.from('advisor_posts').upsert({
          post_text: text,
          linkedin_url: postUrl,
          posted_at: postedAt,
          likes: num(item.engagement?.likes, item.numLikes, item.likes, 0),
          comments_count: num(item.engagement?.comments, item.numComments, item.comments, 0),
          shares: num(item.engagement?.shares, item.numShares, item.shares, 0),
          source: 'auto_sync',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'linkedin_url',
          ignoreDuplicates: false, // Update engagement numbers on existing posts
        });

        if (!error) totalStored++;
        else console.error(`[Post History] Upsert error:`, error.message);
      } catch (err) {
        totalErrors++;
        console.error(`[Post History] Item error:`, err.message);
      }
    }

    console.log(`[Post History] Done: ${totalScraped} scraped, ${totalStored} stored, ${totalErrors} errors`);

    await db.from('scrape_log').update({
      results_count: totalScraped, scored_count: totalStored, errors_count: totalErrors,
      status: 'completed', completed_at: new Date().toISOString(),
    }).eq('id', logEntry?.id);

    return res.json({ success: true, scraped: totalScraped, stored: totalStored, errors: totalErrors });
  } catch (err) {
    console.error('[Post History] Pipeline error:', err);
    await db.from('scrape_log').update({
      results_count: totalScraped, scored_count: totalStored, errors_count: totalErrors,
      status: 'error', completed_at: new Date().toISOString(),
    }).eq('id', logEntry?.id);
    return res.status(500).json({ success: false, error: err.message });
  }
}
