// /api/performance — Log performance, get metrics
import { createServerClient, getUserId } from '../../../lib/supabase';

export default async function handler(req, res) {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = createServerClient();

  if (req.method === 'GET') {
    const { data: posts } = await db.from('advisor_posts')
      .select('*')
      .eq('user_id', userId)
      .order('posted_at', { ascending: false })
      .limit(100);

    const { data: metrics } = await db.from('performance_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('period_end', { ascending: false })
      .limit(5);

    const { data: commentStats } = await db.from('comment_feed')
      .select('commented')
      .eq('user_id', userId)
      .eq('commented', true);

    const { data: profileData } = await db.from('advisor_profile')
      .select('post_categories')
      .eq('user_id', userId)
      .limit(1);

    let categories = [];
    try {
      categories = JSON.parse((profileData && profileData[0] && profileData[0].post_categories) || '[]');
    } catch { categories = []; }

    return res.json({
      posts: posts || [],
      metrics: metrics || [],
      commentCount: (commentStats || []).length,
      categories,
    });
  }

  if (req.method === 'POST') {
    const { post_id, likes, comments, impressions, topic_tags } = req.body;
    if (!post_id) return res.status(400).json({ error: 'post_id required' });

    const updates = {};
    if (likes !== undefined) updates.likes = likes;
    if (comments !== undefined) updates.comments = comments;
    if (impressions !== undefined) updates.impressions = impressions;
    if (topic_tags !== undefined) updates.topic_tags = topic_tags;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });

    const { error } = await db.from('advisor_posts')
      .update(updates)
      .eq('id', post_id)
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
