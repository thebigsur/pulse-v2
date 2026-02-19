import { ApifyClient } from 'apify-client';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = process.env.APIFY_API_TOKEN;
    const client = new ApifyClient({ token });
    
    console.log('[TEST] Calling actor with NEW field names...');
    const start = Date.now();
    const run = await client.actor('harvestapi/linkedin-post-search').call({
      searchQueries: ['tech careers'],
      maxPosts: 10,
      sortBy: 'relevance',
    }, { waitSecs: 120 });
    
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[TEST] Run completed in ${elapsed}s, status: ${run.status}`);
    
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log('[TEST] Items returned:', items.length);

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
