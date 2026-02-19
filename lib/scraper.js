// ═══════════════════════════════════════════════════════
// THE PULSE v2 — Apify Scraper
// Pre-built actors handle anti-bot. Never use LinkedIn cookies.
// ═══════════════════════════════════════════════════════

import { ApifyClient } from 'apify-client';
import { extractApifyToken, sanitizeText, isQualityPost, num } from './utils.js';

function getClient() {
  const token = extractApifyToken(process.env.APIFY_API_TOKEN);
  if (!token) throw new Error('APIFY_API_TOKEN not set');
  return new ApifyClient({ token });
}

// ─── LinkedIn Content Scraping ───

export async function scrapeLinkedInContent(keywords = []) {
  const client = getClient();
  const results = [];

  for (const keyword of keywords) {
    try {
      console.log(`[Content Feed] Starting LinkedIn scrape for: "${keyword}"`);
      const run = await client.actor('harvestapi/linkedin-post-search').call({
        searchQueries: [keyword],
        maxPosts: 20,
        sortBy: 'relevance',
      }, { waitSecs: 120 });

      const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 20 });
      console.log(`[Content Feed] Got ${items.length} LinkedIn items for "${keyword}"`);

      // Log first item structure for field mapping diagnostics
      if (items.length > 0 && results.length === 0) {
        console.log(`[Content Feed] First item keys: ${Object.keys(items[0]).join(', ')}`);
        const first = items[0];
        console.log(`[Content Feed] Sample fields — text: ${(first.text || '').substring(0, 50)}, title: ${(first.title || '').substring(0, 50)}, postText: ${(first.postText || '').substring(0, 50)}, content: ${(first.content || '').substring(0, 50)}`);
      }

      for (const item of items) {
        const text = sanitizeText(item.text || item.title || item.postText || item.content || '');
        if (!isQualityPost(text)) continue;

        results.push({
          external_id: item.id || item.urn || `li-${Date.now()}-${Math.random()}`,
          platform: 'linkedin',
          creator_name: item.author?.name || item.authorName || 'Unknown',
          creator_handle: item.author?.url || item.authorUrl || '',
          post_text: text,
          url: item.linkedinUrl || item.url || item.postUrl || (item.shareUrn ? `https://www.linkedin.com/feed/update/${item.shareUrn}` : ''),
          likes: num(item.engagement?.likes, item.numLikes, item.likes, 0),
          comments: num(item.engagement?.comments, item.numComments, item.comments, 0),
          shares: num(item.engagement?.shares, item.numShares, item.shares, 0),
        });
      }
      console.log(`[Content Feed] "${keyword}": ${items.length} raw, ${results.length} total kept`);
    } catch (err) {
      console.error(`LinkedIn scrape error for "${keyword}":`, err.message);
    }
  }

  return results;
}

// ─── Twitter/X Content Scraping ───

export async function scrapeTwitterContent(keywords = []) {
  const client = getClient();
  const results = [];

  for (const keyword of keywords) {
    try {
      const run = await client.actor('apidojo/tweet-scraper').call({
        searchTerms: [keyword],
        maxTweets: 15,
        maxItems: 15,
        tweetsDesired: 15,
        sort: 'Top',
      }, { waitSecs: 60 });

      const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 15 });

      for (const item of items) {
        const text = sanitizeText(item.full_text || item.text || '');
        if (!isQualityPost(text)) continue;

        results.push({
          external_id: item.id_str || item.id || `tw-${Date.now()}-${Math.random()}`,
          platform: 'twitter',
          creator_name: item.user?.name || 'Unknown',
          creator_handle: item.user?.screen_name || '',
          post_text: text,
          url: `https://x.com/${item.user?.screen_name || 'i'}/status/${item.id_str || item.id}`,
          likes: num(item.favorite_count, item.favouriteCount, 0),
          comments: num(item.reply_count, item.replyCount, 0),
          shares: num(item.retweet_count, item.retweetCount, 0),
        });
      }
    } catch (err) {
      console.error(`Twitter scrape error for "${keyword}":`, err.message);
    }
  }

  return results;
}

// ─── TikTok Content Scraping ───

export async function scrapeTikTokContent(keywords = []) {
  const client = getClient();
  const results = [];

  for (const keyword of keywords) {
    try {
      const run = await client.actor('clockworks/tiktok-scraper').call({
        searchQueries: [keyword],
        maxItems: 10,
      }, { waitSecs: 60 });

      const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 10 });

      for (const item of items) {
        const text = sanitizeText(item.text || item.desc || '');
        if (!isQualityPost(text)) continue;

        results.push({
          external_id: item.id || `tt-${Date.now()}-${Math.random()}`,
          platform: 'tiktok',
          creator_name: item.authorMeta?.name || item.author || 'Unknown',
          creator_handle: item.authorMeta?.id || '',
          post_text: text,
          url: item.webVideoUrl || item.url || '',
          likes: num(item.diggCount, item.stats?.diggCount, 0),
          comments: num(item.commentCount, item.stats?.commentCount, 0),
          shares: num(item.shareCount, item.stats?.shareCount, 0),
        });
      }
    } catch (err) {
      console.error(`TikTok scrape error for "${keyword}":`, err.message);
    }
  }

  return results;
}

// ─── LinkedIn Comment Feed Scraping ───

export async function scrapeLinkedInCommentFeed(keywords = []) {
  const client = getClient();
  const results = [];

  for (const keyword of keywords) {
    try {
      console.log(`[Comment Feed] Starting scrape for: "${keyword}"`);
      const run = await client.actor('harvestapi/linkedin-post-search').call({
        searchQueries: [keyword],
        maxPosts: 15,
        sortBy: 'relevance',
      }, { waitSecs: 120 });

      console.log(`[Comment Feed] Run finished for "${keyword}", status: ${run.status}, datasetId: ${run.defaultDatasetId}`);
      const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 15 });
      console.log(`[Comment Feed] Got ${items.length} raw items for "${keyword}"`);

      // Log first item structure for field mapping diagnostics
      if (items.length > 0 && results.length === 0) {
        console.log(`[Comment Feed] First item keys: ${Object.keys(items[0]).join(', ')}`);
        const first = items[0];
        // Dump ALL string values that might be URLs
        const urlFields = {};
        for (const [k, v] of Object.entries(first)) {
          if (typeof v === 'string' && (v.includes('linkedin') || v.includes('http') || v.includes('urn'))) {
            urlFields[k] = v.substring(0, 200);
          }
          if (typeof v === 'object' && v !== null) {
            for (const [k2, v2] of Object.entries(v)) {
              if (typeof v2 === 'string' && (v2.includes('linkedin') || v2.includes('http') || v2.includes('urn'))) {
                urlFields[`${k}.${k2}`] = v2.substring(0, 200);
              }
            }
          }
        }
        console.log(`[Comment Feed] URL-like fields: ${JSON.stringify(urlFields)}`);
        console.log(`[Comment Feed] Full first item: ${JSON.stringify(first).substring(0, 2000)}`);
      }

      let filtered = 0;
      for (const item of items) {
        const text = sanitizeText(item.text || item.title || item.postText || item.content || '');
        if (!text || text.length < 30) { filtered++; continue; }

        // Estimate post age in hours
        let ageHours = 12; // default
        if (item.postedAt || item.publishedAt || item.postedDate) {
          const posted = new Date(item.postedAt || item.publishedAt || item.postedDate);
          ageHours = Math.max(0, (Date.now() - posted.getTime()) / (1000 * 60 * 60));
        }

        results.push({
          external_id: item.id || item.urn || `li-c-${Date.now()}-${Math.random()}`,
          platform: 'linkedin',
          creator_name: item.author?.name || item.authorName || 'Unknown',
          creator_handle: item.author?.url || '',
          creator_title: item.author?.headline || item.authorHeadline || '',
          creator_company: item.author?.company || '',
          post_text: text,
          url: item.linkedinUrl || item.url || item.postUrl || (item.shareUrn ? `https://www.linkedin.com/feed/update/${item.shareUrn}` : ''),
          likes: num(item.engagement?.likes, item.numLikes, item.likes, 0),
          comments: num(item.engagement?.comments, item.numComments, item.comments, 0),
          shares: num(item.engagement?.shares, item.numShares, item.shares, 0),
          post_age_hours: Math.round(ageHours * 10) / 10,
        });
      }
      console.log(`[Comment Feed] "${keyword}": ${items.length} raw, ${filtered} filtered, ${results.length} total kept`);
    } catch (err) {
      console.error(`LinkedIn comment feed scrape error for "${keyword}":`, err.message);
    }
  }

  return results;
}
