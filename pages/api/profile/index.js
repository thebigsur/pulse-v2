// /api/profile — CRUD for advisor profile, voice samples, content prefs, advisor posts
import { createServerClient, getUserId } from '../../../lib/supabase';

export default async function handler(req, res) {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = createServerClient();
  const { section } = req.query;

  if (req.method === 'GET') {
    if (section === 'voice') {
      const { data } = await db.from('voice_samples')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return res.json(data || []);
    }
    if (section === 'prefs') {
      const { data } = await db.from('content_preferences')
        .select('*')
        .eq('user_id', userId)
        .order('id');
      return res.json(data || []);
    }
    if (section === 'posts') {
      const { data } = await db.from('advisor_posts')
        .select('*')
        .eq('user_id', userId)
        .order('posted_at', { ascending: false })
        .limit(50);
      return res.json(data || []);
    }
    // Default: full profile
    const { data } = await db.from('advisor_profile')
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    let profile = data && data[0];
    if (!profile) {
      // Signup trigger should have created this, but create as fallback
      const { data: newProfile } = await db.from('advisor_profile')
        .insert({ user_id: userId })
        .select()
        .single();
      profile = newProfile;
    }
    return res.json(profile);
  }

  if (req.method === 'PUT') {
    const updates = req.body;
    const { data: existing } = await db.from('advisor_profile')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    if (existing && existing[0]) {
      const { error } = await db.from('advisor_profile')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', existing[0].id)
        .eq('user_id', userId);
      if (error) return res.status(500).json({ error: error.message });
    } else {
      const { error } = await db.from('advisor_profile')
        .insert({ ...updates, user_id: userId });
      if (error) return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true });
  }

  if (req.method === 'POST') {
    if (section === 'voice') {
      const { type, sample_text } = req.body;
      if (!type || !sample_text) return res.status(400).json({ error: 'type and sample_text required' });
      const { error } = await db.from('voice_samples')
        .insert({ user_id: userId, type, sample_text });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }
    if (section === 'posts') {
      const { post_text, linkedin_url, likes, comments } = req.body;
      if (!post_text) return res.status(400).json({ error: 'post_text required' });
      const { error } = await db.from('advisor_posts')
        .insert({ user_id: userId, post_text, linkedin_url, likes: likes || 0, comments: comments || 0 });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }
    if (section === 'prefs') {
      const { id, label, active, is_custom } = req.body;
      if (id && !is_custom) {
        // Toggle existing preference — match on (user_id, pref slug)
        const { error } = await db.from('content_preferences')
          .update({ active })
          .eq('user_id', userId)
          .eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
      } else {
        // Add custom preference
        const newId = `custom_${Date.now()}`;
        const { error } = await db.from('content_preferences')
          .insert({ user_id: userId, id: newId, label, is_custom: true, active: true });
        if (error) return res.status(500).json({ error: error.message });
      }
      return res.json({ success: true });
    }
    return res.status(400).json({ error: 'Invalid section' });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    if (section === 'voice') {
      await db.from('voice_samples').delete().eq('id', id).eq('user_id', userId);
    } else if (section === 'prefs') {
      await db.from('content_preferences').delete().eq('row_id', id).eq('user_id', userId).eq('is_custom', true);
    }
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
