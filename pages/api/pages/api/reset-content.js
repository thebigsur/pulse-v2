// /api/reset-content — Clear scored/draft data from content_feed so next pipeline run
// re-scores everything against the current profile. Use after major profile changes.
import { createServerClient, getUserId } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = createServerClient();

  // 1. Clear all scoring data so posts get re-scored with current profile on next run
  const { error: scoreErr, count: scoreCount } = await db.from('content_feed')
    .update({
      expertise_signal: null,
      icp_relevance: null,
      suggested_angle: null,
      scored_at: null,
      draft_text: null,
      draft_topic_tags: null,
      draft_hook_type: null,
      draft_image_hint: null,
      draft_hashtags: null,
      draft_source_urls: null,
      draft_continuity_ref: null,
      draft_status: 'pending',
    })
    .eq('user_id', userId)
    .in('draft_status', ['generated', 'approved', 'skipped', 'expired', 'pending']);

  if (scoreErr) return res.status(500).json({ error: scoreErr.message });

  // 2. Return count for UI confirmation
  const { count } = await db.from('content_feed')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return res.json({ success: true, resetCount: count || 0 });
}
