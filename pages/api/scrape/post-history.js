// POST /api/scrape/post-history — Sync advisor's own LinkedIn posts
// Uses harvestapi/linkedin-profile-posts to scrape directly from profile URL
// Falls back to name search if no profile URL is set

import { createServerClient } from '../../../lib/supabase';
import { ApifyClient } from 'apify-client';
import { extractApifyToken, sanitizeText, num } from '../../../lib/utils.js';

export const config = {
  maxDuration: 300,
};

// Parse various date formats from Apify actors
// Handles ISO strings, timestamps, and relative times like "2w", "3d", "1mo"
function parsePostDate(item) {
  // Try numeric timestamp first
  if (item.createdAtTimestamp && typeof item.createdAtTimestamp === 'number') {
    return new Date(item.createdAtTimestamp).toISOString();
  }

  // Try standard date fields
  const raw = item.postedAt || item.publishedAt || item.postedDate || item.createdAt || null;
  if (!raw) return new Date().toISOString();

  // If it's already a number (epoch ms)
  if (typeof raw === 'number') {
    return new Date(raw).toISOString();
  }

  // Try parsing as ISO/standard date string
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
    return parsed.toISOString();
  }

  // Handle relative time strings like "2w", "3d", "1mo", "5h", "2 weeks ago"
  const str = String(raw).toLowerCase().trim();
  const now = Date.now();
  const match = str.match(/(\d+)\s*(mo|month|w|week|d|day|h|hour|m|min)/);
  if (match) {
    const val = parseInt(match[1]);
    const unit = match[2];
    const ms = {
      mo: 30 * 24 * 3600000, month: 30 * 24 * 3600000,
      w: 7 * 24 * 3600000, week: 7 * 24 * 3600000,
      d: 24 * 3600000, day: 24 * 3600000,
      h: 3600000, hour: 3600000,
      m: 60000, min: 60000,
    }[unit] || 0;
    return new Date(now - val * ms).toISOString();
  }

  // Fallback to now
  return new Date().toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = createServerClient();
  let totalScraped = 0, totalStored = 0, totalErrors = 0;
  const errorDetails = [];

  const { data: logEntry } = await db.from('scrape_log').insert({
    pipeline: 'post-history', status: 'running', started_at: new Date().toISOString(),
  }).select().single();

  try {
    const { data: profile } = await db.from('advisor_profile').select('*').single();
    const profileUrl = (profile?.linkedin_profile_url || '').trim();
    const advisorName = (profile?.full_name || '').trim();

    if (!profileUrl && !advisorName) {
      await db.from('scrape_log').update({
        status: 'completed', completed_at: new Date().toISOString(),
        results_count: 0, scored_count: 0, errors_count: 0,
      }).eq('id', logEntry?.id);
      return res.json({ success: true, scraped: 0, stored: 0, errors: 0, message: 'Set your LinkedIn profile URL in Profile settings' });
    }

    const token = extractApifyToken(process.env.APIFY_API_TOKEN);
    const client = new ApifyClient({ token });
    let items = [];

    if (profileUrl) {
      // ─── Primary: Scrape directly from profile URL ───
      const slug = profileUrl.replace(/\/$/, '').split('/').pop();
      const fullUrl = profileUrl.startsWith('http') ? profileUrl : `https://www.linkedin.com/in/${slug}`;

      console.log(`[Post History] Scraping profile posts from: ${fullUrl}`);
      const run = await client.actor('harvestapi/linkedin-profile-posts').call({
        profileUrls: [fullUrl],
        maxPosts: 50,
      }, { waitSecs: 120 });

      const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 50 });
      items = dataset.items || [];
      totalScraped = items.length;

      // Log first item for debugging field names
      if (items.length > 0) {
        const first = items[0];
        console.log(`[Post History] First item keys: ${Object.keys(first).join(', ')}`);
        console.log(`[Post History] Date fields: postedAt=${first.postedAt}, publishedAt=${first.publishedAt}, createdAt=${first.createdAt}, createdAtTimestamp=${first.createdAtTimestamp}`);
        console.log(`[Post History] Content fields: content=${(first.content||'').substring(0,50)}, text=${(first.text||'').substring(0,50)}, commentary=${(first.commentary||'').substring(0,50)}`);
        console.log(`[Post History] URL fields: linkedinUrl=${first.linkedinUrl}, url=${first.url}, postId=${first.postId}`);
        console.log(`[Post History] Engagement: numLikes=${first.numLikes}, numComments=${first.numComments}, reactionCount=${first.reactionCount}`);
      }

      for (const item of items) {
        try {
          const text = sanitizeText(
            item.content || item.text || item.commentary || item.postText || item.title || ''
          );
          if (!text || text.length < 10) continue;

          const postUrl = item.linkedinUrl || item.url || item.postUrl ||
            (item.postId ? `https://www.linkedin.com/feed/update/urn:li:activity:${item.postId}` : '') ||
            (item.shareUrn ? `https://www.linkedin.com/feed/update/${item.shareUrn}` : '');
          if (!postUrl) continue;

          const postedAt = parsePostDate(item);

          const { error } = await db.from('advisor_posts').upsert({
            post_text: text,
            linkedin_url: postUrl,
            posted_at: postedAt,
            likes: num(item.numLikes, item.reactionCount, item.engagement?.likes, item.likes, 0),
            comments: num(item.numComments, item.commentCount, item.engagement?.comments, item.comments, 0),
          }, {
            onConflict: 'linkedin_url',
            ignoreDuplicates: false,
          });

          if (!error) totalStored++;
          else { totalErrors++; if (errorDetails.length < 5) errorDetails.push(`upsert: ${error.message}`); }
        } catch (err) {
          totalErrors++;
          if (errorDetails.length < 5) errorDetails.push(`item: ${err.message}`);
        }
      }

    } else {
      // ─── Fallback: Search by name ───
      console.log(`[Post History] No profile URL set. Searching by name: "${advisorName}"`);
      const run = await client.actor('harvestapi/linkedin-post-search').call({
        searchQueries: [advisorName],
        maxPosts: 30,
        sortBy: 'date',
      }, { waitSecs: 120 });

      const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 30 });
      items = dataset.items || [];
      totalScraped = items.length;

      const nameLower = advisorName.toLowerCase();
      const nameWords = nameLower.split(/\s+/);

      for (const item of items) {
        try {
          const authorName = (item.author?.name || item.authorName || '').toLowerCase();
          const matchCount = nameWords.filter(w => authorName.includes(w)).length;
          if (matchCount < Math.max(1, nameWords.length - 1)) continue;

          const text = sanitizeText(item.text || item.title || item.postText || item.content || '');
          if (!text || text.length < 10) continue;

          const postUrl = item.linkedinUrl || item.url || item.postUrl ||
            (item.shareUrn ? `https://www.linkedin.com/feed/update/${item.shareUrn}` : '');
          if (!postUrl) continue;

          const postedAt = parsePostDate(item);

          const { error } = await db.from('advisor_posts').upsert({
            post_text: text,
            linkedin_url: postUrl,
            posted_at: postedAt,
            likes: num(item.engagement?.likes, item.numLikes, item.likes, 0),
            comments: num(item.engagement?.comments, item.numComments, item.comments, 0),
          }, {
            onConflict: 'linkedin_url',
            ignoreDuplicates: false,
          });

          if (!error) totalStored++;
          else { totalErrors++; if (errorDetails.length < 5) errorDetails.push(`upsert: ${error.message}`); }
        } catch (err) {
          totalErrors++;
          if (errorDetails.length < 5) errorDetails.push(`item: ${err.message}`);
        }
      }
    }

    console.log(`[Post History] Done: ${totalScraped} scraped, ${totalStored} stored, ${totalErrors} errors`);

    await db.from('scrape_log').update({
      results_count: totalScraped, scored_count: totalStored, errors_count: totalErrors,
      status: 'completed', completed_at: new Date().toISOString(),
    }).eq('id', logEntry?.id);

    return res.json({ success: true, scraped: totalScraped, stored: totalStored, errors: totalErrors, errorDetails });
  } catch (err) {
    console.error('[Post History] Pipeline error:', err);
    await db.from('scrape_log').update({
      results_count: totalScraped, scored_count: totalStored, errors_count: totalErrors,
      status: 'error', completed_at: new Date().toISOString(),
    }).eq('id', logEntry?.id);
    return res.status(500).json({ success: false, error: err.message, errorDetails });
  }
}
