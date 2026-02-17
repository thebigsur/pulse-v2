// /api/performance — Log performance, get metrics
import { createServerClient } from '../../lib/supabase';

export default async function handler(req, res) {
  const db = createServerClient();

  if (req.method === 'GET') {
    // Get recent advisor posts with performance data
    const { data: posts } = await db.from('advisor_posts')
      .select('*').order('posted_at', { ascending: false }).limit(10);

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

  // POST — log performance for a specific post
  if (req.method === 'POST') {
    const { post_id, likes, comments, impressions } = req.body;
    if (!post_id) return res.status(400).json({ error: 'post_id required' });

    const { error } = await db.from('advisor_posts').update({
      likes: likes || 0,
      comments: comments || 0,
      impressions: impressions || 0,
      performance_logged: true,
    }).eq('id', post_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
