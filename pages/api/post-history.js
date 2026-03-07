// /api/post-history — CRUD for advisor_posts (manual paste, edit, delete)
import { createServerClient, getUserId } from '../../lib/supabase';

export default async function handler(req, res) {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = createServerClient();

  if (req.method === 'POST') {
    const { post_text, topic_tags, hook_type, linkedin_url } = req.body;
    if (!post_text || !post_text.trim()) {
      return res.status(400).json({ error: 'post_text is required' });
    }
    const { data, error } = await db.from('advisor_posts').insert({
      user_id: userId,
      post_text: post_text.trim(),
      topic_tags: topic_tags || [],
      hook_type: hook_type || null,
      linkedin_url: linkedin_url || null,
      posted_at: new Date().toISOString(),
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, post: data });
  }

  if (req.method === 'PUT') {
    const { id, post_text, likes, comments, impressions, topic_tags, hook_type, linkedin_url, posted_at } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });

    const updates = {};
    if (post_text !== undefined) updates.post_text = post_text.trim();
    if (likes !== undefined) updates.likes = parseInt(likes) || 0;
    if (comments !== undefined) updates.comments = parseInt(comments) || 0;
    if (impressions !== undefined) updates.impressions = parseInt(impressions) || 0;
    if (topic_tags !== undefined) updates.topic_tags = topic_tags;
    if (hook_type !== undefined) updates.hook_type = hook_type;
    if (linkedin_url !== undefined) updates.linkedin_url = linkedin_url;
    if (posted_at !== undefined) updates.posted_at = posted_at;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const { data, error } = await db.from('advisor_posts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, post: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const { error } = await db.from('advisor_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
