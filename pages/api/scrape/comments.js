import { ApifyClient } from 'apify-client';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = process.env.APIFY_API_TOKEN;
    console.log('[TEST] Token length:', token?.length);
    console.log('[TEST] Token starts with:', token?.substring(0, 10));
    
    const client = new ApifyClient({ token });
    
    // Use a keyword we KNOW works from the content pipeline
    console.log('[TEST] Calling actor with "equity compensation"...');
    const start = Date.now();
    const run = await client.actor('harvestapi/linkedin-post-search').call({
      searchQuery: 'equity compensation',
      maxResults: 10,
      sortBy: 'relevance',
    }, { waitSecs: 120 });
    
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[TEST] Run completed in ${elapsed}s, status: ${run.status}`);
    console.log('[TEST] Dataset ID:', run.defaultDatasetId);
    
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log('[TEST] Items returned:', items.length);
    
    if (items.length > 0) {
      console.log('[TEST] First item keys:', Object.keys(items[0]).join(', '));
      console.log('[TEST] First item text preview:', (items[0].text || '').substring(0, 100));
    }

    return res.status(200).json({
      elapsed: `${elapsed}s`,
      status: run.status,
      items: items.length,
      firstItemPreview: items[0] ? (items[0].text || '').substring(0, 100) : null,
    });
  } catch (err) {
    console.error('[TEST] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
