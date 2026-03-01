// /api/post-history — Save posts to advisor_posts (manual paste or from approved drafts)
import { createServerClient } from '../../lib/supabase';

export default async function handler(req, res) {
  const db = createServerClient();

  if (req.method === 'POST') {
    const { post_text, topic_tags, hook_type } = req.body;
    if (!post_text || !post_text.trim()) {
      return res.status(400).json({ error: 'post_text is required' });
    }

    const { data, error } = await db.from('advisor_posts').insert({
      post_text: post_text.trim(),
      topic_tags: topic_tags || [],
      hook_type: hook_type || null,
      posted_at: new Date().toISOString(),
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, post: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
