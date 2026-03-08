// /api/reset-content — Clear scored/draft data from content_feed so next pipeline run
// re-scores everything against the current profile. Use after major profile changes.
import { createServerClient, getUserId } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = createServerClient();

  // 1. Delete ALL content_feed posts for this user — full clean slate.
  //    This ensures old keyword posts (e.g. equity comp) don't survive the reset
  //    and clog the candidate queue on the next scrape run.
  const { error: deleteErr } = await db.from('content_feed')
    .delete()
    .eq('user_id', userId);

  if (deleteErr) return res.status(500).json({ error: deleteErr.message });

  // 2. Return count for UI confirmation
  const { count } = await db.from('content_feed')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return res.json({ success: true, resetCount: count || 0 });
}
