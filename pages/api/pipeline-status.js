// /api/pipeline-status — Return last run time + status for each pipeline
import { createServerClient, getUserId } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = createServerClient();
  const pipelines = ['content', 'comments', 'post-history'];
  const status = {};

  for (const pipeline of pipelines) {
    const { data } = await db.from('scrape_log')
      .select('pipeline, status, started_at, completed_at, results_count, scored_count, errors_count')
      .eq('pipeline', pipeline)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(1);

    status[pipeline] = (data && data.length > 0) ? data[0] : null;
  }

  return res.json(status);
}
