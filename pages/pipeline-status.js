// /api/pipeline-status — Return last run time + status for each pipeline
import { createServerClient } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const db = createServerClient();

  // Get the most recent completed (or running) log entry for each pipeline
  const pipelines = ['content', 'comments', 'post-history'];
  const status = {};

  for (const pipeline of pipelines) {
    const { data } = await db.from('scrape_log')
      .select('pipeline, status, started_at, completed_at, results_count, scored_count, errors_count')
      .eq('pipeline', pipeline)
      .order('started_at', { ascending: false })
      .limit(1);

    status[pipeline] = (data && data.length > 0) ? data[0] : null;
  }

  return res.json(status);
}
