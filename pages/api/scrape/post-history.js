// POST /api/scrape/post-history — Sync advisor's own LinkedIn posts
// Uses harvestapi/linkedin-profile-posts to scrape directly from profile URL

import { createServerClient } from '../../../lib/supabase';
import { ApifyClient } from 'apify-client';
import { extractApifyToken, sanitizeText, num } from '../../../lib/utils.js';

export const config = { maxDuration: 300 };

// Parse various date formats from Apify actors
function parsePostDate(item) {
  if (item.createdAtTimestamp && typeof item.createdAtTimestamp === 'number') {
    return new Date(item.createdAtTimestamp).toISOString();
  }
  const raw = item.postedAt || item.publishedAt || item.postedDate || item.createdAt || null;
  if (!raw) return new Date().toISOString();
  if (typeof raw === 'number') return new Date(raw).toISOString();

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) return parsed.toISOString();

  // Relative time: "2w", "3d", "1mo", "5h"
  const str = String(raw).toLowerCase().trim();
  const match = str.match(/(\d+)\s*(mo|month|w|week|d|day|h|hour|m|min)/);
  if (match) {
    const val = parseInt(match[1]);
    const ms = { mo: 2592000000, month: 2592000000, w: 604800000, week: 604800000, d: 86400000, day: 86400000, h: 3600000, hour: 3600000, m: 60000, min: 60000 }[match[2]] || 0;
    return new Date(Date.now() - val * ms).toISOString();
  }
  return new Date().toISOString();
}

// Detect if a post is a repost/reshare (not original content)
function isRepost(item) {
  // Explicit repost flags from the actor
  if (item.reshared === true || item.isRepost === true || item.reposted === true) return true;
  if (item.resharedPost || item.originalPost || item.sharedPost) return true;
  
  // If the post has a different author than the profile being scraped
  // The actor nests the original author in various ways
  if (item.actor && item.actor.author === false) return true; // actor.author=false means reshared
  
  // Check for "reshared" or "reposted" in social metadata
  if (item.socialContent?.hideShareAction === true && item.socialContent?.hideSendAction === true) {
    // Some reshared posts have these flags
  }
  
  // Check if commentary is empty but content exists (pure reshare with no comment)
  // For linkedin-profile-posts actor, reshares often have empty commentary but populated content
  if (item.commentary === '' && item.content && item.content.length > 0) return true;
  if (item.commentary === null && item.resharedBy) return true;
  
  return false;
}

export default async function handler(req, res) {
  // Support both POST (scrape) and PUT/DELETE (edit) 
  if (req.method === 'PUT') {
    const db = createServerClient();
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await db.from('advisor_posts').update(updates).eq('id', id);
    return error ? res.status(500).json({ error: error.message }) : res.json({ success: true });
  }
  if (req.method === 'DELETE') {
    const db = createServerClient();
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await db.from('advisor_posts').delete().eq('id', id);
    return error ? res.status(500).json({ error: error.message }) : res.json({ success: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = createServerClient();
  let totalScraped = 0, totalStored = 0, totalErrors = 0, totalSkippedReposts = 0;
  const errorDetails = [];
  const diagnostics = {};

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
      }, { waitSecs: 120 });

      const dataset = await client.dataset(run.defaultDatasetId).listItems({ limit: 50 });
      const items = dataset.items || [];
      totalScraped = items.length;

      // Diagnostic: log first 3 items' keys and repost-related fields
      if (items.length > 0) {
        diagnostics.firstItemKeys = Object.keys(items[0]);
        diagnostics.sampleItems = items.slice(0, 3).map(item => ({
          text: (item.content || item.text || item.commentary || '').substring(0, 50),
          reshared: item.reshared,
          isRepost: item.isRepost,
          contributed: item.contributed,
          actorAuthor: item.actor?.author,
          resharedPost: !!item.resharedPost,
          originalPost: !!item.originalPost,
          commentary: item.commentary === '' ? '<empty>' : item.commentary === null ? '<null>' : (item.commentary || '').substring(0, 30),
          numLikes: item.numLikes,
        }));
      }

      for (const item of items) {
        try {
          // Skip reposts
          if (isRepost(item)) {
            totalSkippedReposts++;
            continue;
          }

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
      // Fallback: name search (same as before)
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

          const { error } = await db.from('advisor_posts').upsert({
            post_text: text, linkedin_url: postUrl, posted_at: parsePostDate(item),
            likes: num(item.engagement?.likes, item.numLikes, 0),
            comments: num(item.engagement?.comments, item.numComments, 0),
            source: 'linkedin_sync',
          }, { onConflict: 'linkedin_url', ignoreDuplicates: false });

          if (!error) totalStored++;
          else { totalErrors++; if (errorDetails.length < 5) errorDetails.push(error.message); }
        } catch (err) { totalErrors++; }
      }
    }

    console.log(`[Post History] Done: ${totalScraped} scraped, ${totalStored} stored, ${totalSkippedReposts} reposts skipped, ${totalErrors} errors`);

    await db.from('scrape_log').update({
      results_count: totalScraped, scored_count: totalStored, errors_count: totalErrors,
      status: 'completed', completed_at: new Date().toISOString(),
    }).eq('id', logEntry?.id);

    return res.json({ success: true, scraped: totalScraped, stored: totalStored, skippedReposts: totalSkippedReposts, errors: totalErrors, errorDetails, diagnostics });
  } catch (err) {
    console.error('[Post History] Pipeline error:', err);
    await db.from('scrape_log').update({
      results_count: totalScraped, scored_count: totalStored, errors_count: totalErrors,
      status: 'error', completed_at: new Date().toISOString(),
    }).eq('id', logEntry?.id);
    return res.status(500).json({ success: false, error: err.message, errorDetails, diagnostics });
  }
}
