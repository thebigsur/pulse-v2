// /api/performance — Log performance, get metrics
import { createServerClient } from '../../../lib/supabase';

export default async function handler(req, res) {
  const db = createServerClient();

  if (req.method === 'GET') {
    // Get recent advisor posts with performance data
    const { data: posts } = await db.from('advisor_posts')
      .select('*').order('posted_at', { ascending: false }).limit(100);

    // Get latest performance metrics
    const { data: metrics } = await db.from('performance_metrics')
      .select('*').order('period_end', { ascending: false }).limit(5);

    // Get comment stats
    const { data: commentStats } = await db.from('comment_feed')
      .select('commented').eq('commented', true);

    return res.json({
      posts: posts || [],
      metrics: metrics || [],
      commentCount: (commentStats || []).length,
    });
  }

  // POST — update performance fields for a specific post (partial update)
  if (req.method === 'POST') {
    const { post_id, likes, comments, impressions } = req.body;
    if (!post_id) return res.status(400).json({ error: 'post_id required' });

    const updates = {};
    if (likes !== undefined) updates.likes = likes;
    if (comments !== undefined) updates.comments = comments;
    if (impressions !== undefined) updates.impressions = impressions;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });

    const { error } = await db.from('advisor_posts').update(updates).eq('id', post_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
