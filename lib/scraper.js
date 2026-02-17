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
      const run = await client.actor('harvestapi/linkedin-post-search').call({
        searchQuery: keyword,
        maxResults: 20,
        sortBy: 'relevance',
      });

      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      for (const item of items) {
        const text = sanitizeText(item.text || item.title || '');
        if (!isQualityPost(text)) continue;

        results.push({
          external_id: item.id || item.urn || `li-${Date.now()}-${Math.random()}`,
          platform: 'linkedin',
          creator_name: item.author?.name || item.authorName || 'Unknown',
          creator_handle: item.author?.url || item.authorUrl || '',
          post_text: text,
          url: item.url || item.postUrl || '',
          likes: num(item.engagement?.likes, item.numLikes, 0),
          comments: num(item.engagement?.comments, item.numComments, 0),
          shares: num(item.engagement?.shares, item.numShares, 0),
        });
      }
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
        sort: 'Top',
      });

      const { items } = await client.dataset(run.defaultDatasetId).listItems();

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
      });

      const { items } = await client.dataset(run.defaultDatasetId).listItems();

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
      const run = await client.actor('harvestapi/linkedin-post-search').call({
        searchQuery: keyword,
        maxResults: 15,
        sortBy: 'date_posted',
      });

      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      for (const item of items) {
        const text = sanitizeText(item.text || item.title || '');
        if (!text || text.length < 30) continue;

        // Estimate post age in hours
        let ageHours = 12; // default
        if (item.postedAt || item.publishedAt) {
          const posted = new Date(item.postedAt || item.publishedAt);
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
          url: item.url || item.postUrl || '',
          likes: num(item.engagement?.likes, item.numLikes, 0),
          comments: num(item.engagement?.comments, item.numComments, 0),
          shares: num(item.engagement?.shares, item.numShares, 0),
          post_age_hours: Math.round(ageHours * 10) / 10,
        });
      }
    } catch (err) {
      console.error(`LinkedIn comment feed scrape error for "${keyword}":`, err.message);
    }
  }

  return results;
}
