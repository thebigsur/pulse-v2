// POST /api/scrape/post-history — Sync advisor's own LinkedIn posts
// Uses harvestapi/linkedin-profile-posts with includeReposts: false

import { createServerClient } from '../../../lib/supabase';
import { ApifyClient } from 'apify-client';
import { extractApifyToken, sanitizeText, num } from '../../../lib/utils.js';

export const config = { maxDuration: 300 };

// Parse date from actor output — postedAt can be object {timestamp, date} or string
function parsePostDate(item) {
  // Actor returns postedAt as object: { timestamp, date, postedAgoShort, postedAgoText }
  const pa = item.postedAt;
  if (pa && typeof pa === 'object') {
    if (pa.timestamp) return new Date(pa.timestamp).toISOString();
    if (pa.date) {
      const d = new Date(pa.date);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    // Try relative: "2w", "1mo"
    const rel = pa.postedAgoShort || pa.postedAgoText || '';
    const match = String(rel).match(/(\d+)\s*(mo|month|w|week|d|day|h|hour|m|min|y|year)/i);
    if (match) {
      const val = parseInt(match[1]);
      const ms = { mo:2592e6, month:2592e6, w:6048e5, week:6048e5, d:864e5, day:864e5, h:36e5, hour:36e5, m:6e4, min:6e4, y:31536e6, year:31536e6 }[match[2].toLowerCase()] || 0;
      return new Date(Date.now() - val * ms).toISOString();
    }
  }
  // Fallback: postedAt as string or number
  if (typeof pa === 'number') return new Date(pa).toISOString();
  if (typeof pa === 'string') {
    const d = new Date(pa);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d.toISOString();
    const match = pa.match(/(\d+)\s*(mo|month|w|week|d|day|h|hour|m|min|y|year)/i);
    if (match) {
      const val = parseInt(match[1]);
      const ms = { mo:2592e6, month:2592e6, w:6048e5, week:6048e5, d:864e5, day:864e5, h:36e5, hour:36e5, m:6e4, min:6e4, y:31536e6, year:31536e6 }[match[2].toLowerCase()] || 0;
      return new Date(Date.now() - val * ms).toISOString();
    }
  }
  if (item.createdAtTimestamp) return new Date(item.createdAtTimestamp).toISOString();
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

    if (profileUrl) {
      const slug = profileUrl.replace(/\/$/, '').split('/').pop();
      const fullUrl = profileUrl.startsWith('http') ? profileUrl : `https://www.linkedin.com/in/${slug}`;

      console.log(`[Post History] Scraping profile posts from: ${fullUrl}`);
      const run = await client.actor('harvestapi/linkedin-profile-posts').call({
        profileUrls: [fullUrl],
        maxPosts: 50,
        includeReposts: false,  // Actor-level repost filtering
      }, { waitSecs: 120 });

      const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 50 });
      const items = dataset.items || [];
      totalScraped = items.length;

      if (items.length > 0) {
        const first = items[0];
        console.log(`[Post History] Keys: ${Object.keys(first).join(', ')}`);
        console.log(`[Post History] postedAt type: ${typeof first.postedAt}, value: ${JSON.stringify(first.postedAt)}`);
        console.log(`[Post History] engagement keys: ${first.engagement ? Object.keys(first.engagement).join(', ') : 'none'}`);
        console.log(`[Post History] engagement: ${JSON.stringify(first.engagement)}`);
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

          // Extract engagement — actor may nest under engagement object or top-level
          const eng = item.engagement || {};
          const likes = num(eng.likes, eng.numLikes, item.numLikes, item.likes, 0);
          const comments = num(eng.comments, eng.numComments, item.numComments, item.comments, 0);
          const impressions = num(eng.impressions, eng.numImpressions, eng.views, item.numImpressions, item.impressions, 0);

          const { error } = await db.from('advisor_posts').upsert({
            post_text: text,
            linkedin_url: postUrl,
            posted_at: postedAt,
            likes,
            comments,
            impressions,
            source: 'linkedin_sync',
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
      // Fallback: name search
      const run = await client.actor('harvestapi/linkedin-post-search').call({
        searchQueries: [advisorName], maxPosts: 30, sortBy: 'date',
      }, { waitSecs: 120 });
      const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 30 });
      const items = dataset.items || [];
      totalScraped = items.length;
      const nameWords = advisorName.toLowerCase().split(/\s+/);

      for (const item of items) {
        try {
          const authorName = (item.author?.name || item.authorName || '').toLowerCase();
          if (nameWords.filter(w => authorName.includes(w)).length < Math.max(1, nameWords.length - 1)) continue;
          const text = sanitizeText(item.text || item.title || item.postText || item.content || '');
          if (!text || text.length < 10) continue;
          const postUrl = item.linkedinUrl || item.url || (item.shareUrn ? `https://www.linkedin.com/feed/update/${item.shareUrn}` : '');
          if (!postUrl) continue;
          const eng = item.engagement || {};

          const { error } = await db.from('advisor_posts').upsert({
            post_text: text, linkedin_url: postUrl, posted_at: parsePostDate(item),
            likes: num(eng.likes, item.numLikes, 0),
            comments: num(eng.comments, item.numComments, 0),
            impressions: num(eng.impressions, item.numImpressions, 0),
            source: 'linkedin_sync',
          }, { onConflict: 'linkedin_url', ignoreDuplicates: false });

          if (!error) totalStored++;
          else { totalErrors++; if (errorDetails.length < 5) errorDetails.push(error.message); }
        } catch (err) { totalErrors++; }
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
