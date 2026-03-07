// POST /api/scrape/post-history — Sync advisor's own LinkedIn posts
// Uses harvestapi/linkedin-profile-posts with includeReposts: false
// Called by run-pipeline.js, which passes userId in the body

import { createServerClient } from '../../../lib/supabase';
import { ApifyClient } from 'apify-client';
import { extractApifyToken, sanitizeText, num } from '../../../lib/utils.js';
import { classifyPosts } from '../../../lib/ai.js';

export const config = { maxDuration: 300 };

// Parse date from actor output — postedAt can be object {timestamp, date} or string
function parsePostDate(item) {
  const pa = item.postedAt;
  if (pa && typeof pa === 'object') {
    if (pa.timestamp) return new Date(pa.timestamp).toISOString();
    if (pa.date) {
      const d = new Date(pa.date);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    const rel = pa.postedAgoShort || pa.postedAgoText || '';
    const match = String(rel).match(/(\d+)\s*(mo|month|w|week|d|day|h|hour|m|min|y|year)/i);
    if (match) {
      const val = parseInt(match[1]);
      const ms = { mo:2592e6, month:2592e6, w:6048e5, week:6048e5, d:864e5, day:864e5, h:36e5, hour:36e5, m:6e4, min:6e4, y:31536e6, year:31536e6 }[match[2].toLowerCase()] || 0;
      return new Date(Date.now() - val * ms).toISOString();
    }
  }
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

  // Multi-user: userId is injected by run-pipeline.js from the user's JWT
  const userId = req.body?.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });

  const db = createServerClient();
  let totalScraped = 0, totalStored = 0, totalErrors = 0;
  const errorDetails = [];

  // Create log entry scoped to this user
  const { data: logEntry } = await db.from('scrape_log').insert({
    user_id: userId,
    pipeline: 'post-history',
    status: 'running',
    started_at: new Date().toISOString(),
  }).select().limit(1);
  const logId = logEntry?.[0]?.id;

  try {
    // 1. Get this user's profile
    const { data: profileRows } = await db.from('advisor_profile')
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    const profile = profileRows?.[0];

    const profileUrl = (profile?.linkedin_profile_url || '').trim();
    const advisorName = (profile?.full_name || '').trim();

    if (!profileUrl && !advisorName) {
      await db.from('scrape_log').update({
        status: 'completed', completed_at: new Date().toISOString(),
        results_count: 0, scored_count: 0, errors_count: 0,
      }).eq('id', logId);
      return res.json({ success: true, scraped: 0, stored: 0, errors: 0, message: 'Set your LinkedIn profile URL in Profile settings' });
    }

    const token = extractApifyToken(process.env.APIFY_API_TOKEN);
    const client = new ApifyClient({ token });

    if (profileUrl) {
      const slug = profileUrl.replace(/\/$/, '').split('/').pop();
      const fullUrl = profileUrl.startsWith('http') ? profileUrl : `https://www.linkedin.com/in/${slug}`;

      console.log(`[Post History:${userId.slice(0, 8)}] Scraping profile posts from: ${fullUrl}`);
      const run = await client.actor('harvestapi/linkedin-profile-posts').call({
        profileUrls: [fullUrl],
        maxPosts: 50,
        includeReposts: false,
      }, { waitSecs: 120 });

      const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 50 });
      const items = dataset.items || [];
      totalScraped = items.length;

      if (items.length > 0) {
        const first = items[0];
        console.log(`[Post History] Keys: ${Object.keys(first).join(', ')}`);
        console.log(`[Post History] postedAt type: ${typeof first.postedAt}, value: ${JSON.stringify(first.postedAt)}`);
        console.log(`[Post History] engagement keys: ${first.engagement ? Object.keys(first.engagement).join(', ') : 'none'}`);
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
          const eng = item.engagement || {};
          const likes = num(eng.likes, eng.numLikes, item.numLikes, item.likes, 0);
          const comments = num(eng.comments, eng.numComments, item.numComments, item.comments, 0);
          // NOTE: impressions intentionally excluded from upsert — manual entries are preserved
          // impressions = num(eng.impressions, eng.numImpressions, eng.views, item.numImpressions, item.impressions, 0);

          const { error } = await db.from('advisor_posts').upsert({
            user_id: userId,
            post_text: text,
            linkedin_url: postUrl,
            posted_at: postedAt,
            likes,
            comments,
            source: 'linkedin_sync',
          }, {
            onConflict: 'linkedin_url,user_id',
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
      // Fallback: name search (when no profile URL set)
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
            user_id: userId,
            post_text: text,
            linkedin_url: postUrl,
            posted_at: parsePostDate(item),
            likes: num(eng.likes, item.numLikes, 0),
            comments: num(eng.comments, item.numComments, 0),
            source: 'linkedin_sync',
          }, { onConflict: 'linkedin_url,user_id', ignoreDuplicates: false });

          if (!error) totalStored++;
          else { totalErrors++; if (errorDetails.length < 5) errorDetails.push(error.message); }
        } catch (err) { totalErrors++; }
      }
    }

    console.log(`[Post History:${userId.slice(0, 8)}] Done: ${totalScraped} scraped, ${totalStored} stored, ${totalErrors} errors`);

    // 2. Classify all of this user's posts using their categories
    let classified = 0;
    try {
      const categories = JSON.parse(profile?.post_categories || '[]');
      if (categories.length > 0) {
        const { data: allDbPosts } = await db.from('advisor_posts')
          .select('id, post_text, topic_tags')
          .eq('user_id', userId)
          .order('posted_at', { ascending: false });

        if (allDbPosts && allDbPosts.length > 0) {
          console.log(`[Post History] Classifying ${allDbPosts.length} posts into categories: ${categories.join(', ')}`);
          const results = await classifyPosts(allDbPosts, categories);
          for (const r of results) {
            await db.from('advisor_posts')
              .update({ topic_tags: [r.category] })
              .eq('id', r.id)
              .eq('user_id', userId);
            classified++;
          }
          console.log(`[Post History] Classified ${classified} posts`);
        }
      }
    } catch (classErr) {
      console.error('[Post History] Classification error:', classErr.message);
    }

    await db.from('scrape_log').update({
      results_count: totalScraped, scored_count: totalStored, errors_count: totalErrors,
      status: 'completed', completed_at: new Date().toISOString(),
    }).eq('id', logId);

    return res.json({ success: true, scraped: totalScraped, stored: totalStored, classified, errors: totalErrors, errorDetails });

  } catch (err) {
    console.error('[Post History] Pipeline error:', err);
    await db.from('scrape_log').update({
      results_count: totalScraped, scored_count: totalStored, errors_count: totalErrors,
      status: 'error', completed_at: new Date().toISOString(),
    }).eq('id', logId);
    return res.status(500).json({ success: false, error: err.message, errorDetails });
  }
}
