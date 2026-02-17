// /api/profile — CRUD for advisor profile, voice samples, content prefs, advisor posts
import { createServerClient } from '../../../lib/supabase';

export default async function handler(req, res) {
  const db = createServerClient();
  const { section } = req.query; // ?section=bio|voice|prefs|posts|compliance

  // GET — fetch profile data
  if (req.method === 'GET') {
    if (section === 'voice') {
      const { data } = await db.from('voice_samples').select('*').order('created_at', { ascending: false });
      return res.json(data || []);
    }
    if (section === 'prefs') {
      const { data } = await db.from('content_preferences').select('*').order('id');
      return res.json(data || []);
    }
    if (section === 'posts') {
      const { data } = await db.from('advisor_posts').select('*').order('posted_at', { ascending: false }).limit(50);
      return res.json(data || []);
    }
    // Default: full profile
    let { data } = await db.from('advisor_profile').select('*').single();
    if (!data) {
      // Create default profile if none exists
      const { data: newProfile } = await db.from('advisor_profile').insert({}).select().single();
      data = newProfile;
    }
    return res.json(data);
  }

  // PUT — update profile fields
  if (req.method === 'PUT') {
    const updates = req.body;
    const { data: existing } = await db.from('advisor_profile').select('id').single();
    if (existing) {
      const { error } = await db.from('advisor_profile').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) return res.status(500).json({ error: error.message });
    } else {
      const { error } = await db.from('advisor_profile').insert(updates);
      if (error) return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true });
  }

  // POST — add voice sample or advisor post
  if (req.method === 'POST') {
    if (section === 'voice') {
      const { type, sample_text } = req.body;
      if (!type || !sample_text) return res.status(400).json({ error: 'type and sample_text required' });
      const { error } = await db.from('voice_samples').insert({ type, sample_text });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }
    if (section === 'posts') {
      const { post_text, linkedin_url, likes, comments } = req.body;
      if (!post_text) return res.status(400).json({ error: 'post_text required' });
      const { error } = await db.from('advisor_posts').insert({ post_text, linkedin_url, likes: likes || 0, comments: comments || 0 });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }
    if (section === 'prefs') {
      const { id, label, active, is_custom } = req.body;
      if (id && !is_custom) {
        // Toggle existing preference
        const { error } = await db.from('content_preferences').update({ active }).eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
      } else {
        // Add custom preference
        const newId = `custom_${Date.now()}`;
        const { error } = await db.from('content_preferences').insert({ id: newId, label, is_custom: true, active: true });
        if (error) return res.status(500).json({ error: error.message });
      }
      return res.json({ success: true });
    }
    return res.status(400).json({ error: 'Invalid section' });
  }

  // DELETE — remove voice sample or custom pref
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    if (section === 'voice') {
      await db.from('voice_samples').delete().eq('id', id);
    } else if (section === 'prefs') {
      await db.from('content_preferences').delete().eq('id', id).eq('is_custom', true);
    }
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
