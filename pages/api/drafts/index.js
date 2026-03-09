// /api/drafts — CRUD for post drafts
// Item 16: adds action='regenerate' to the PATCH handler
import { createServerClient, getUserId } from '../../../lib/supabase';
import { generateDraft, checkDraftFreshness } from '../../../lib/ai';

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = createServerClient();

  if (req.method === 'GET') {
    const { status } = req.query;
    let query = db.from('content_feed')
      .select('*')
      .eq('user_id', userId)
      .not('draft_text', 'is', null)
      .order('expertise_signal', { ascending: false });
    if (status) query = query.eq('draft_status', status);
    else query = query.in('draft_status', ['generated', 'approved']);
    const { data, error } = await query.limit(20);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'PATCH') {
    const { id, action } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    if (action === 'approve') {
      const { error } = await db.from('content_feed')
        .update({ draft_status: 'approved' })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    if (action === 'skip') {
      const { error } = await db.from('content_feed')
        .update({ draft_status: 'skipped' })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    // ─── Item 16: Regenerate draft with a different hook type ──────────────
    if (action === 'regenerate') {
      const { data: rows, error: fetchErr } = await db
        .from('content_feed').select('*').eq('id', id).eq('user_id', userId).limit(1);
      if (fetchErr || !rows?.length) return res.status(404).json({ error: 'Post not found' });
      const post = rows[0];

      const [profileRes, voiceRes, historyRes] = await Promise.all([
        db.from('advisor_profile').select('*').eq('user_id', userId).limit(1),
        db.from('voice_samples').select('*').eq('user_id', userId).eq('type', 'post').order('created_at', { ascending: false }).limit(10),
        db.from('advisor_posts').select('topic_tags, hook_type, post_text').eq('user_id', userId).order('posted_at', { ascending: false }).limit(30),
      ]);

      const profile = profileRes.data?.[0] || {};
      const voiceSamples = voiceRes.data || [];
      const postHistory = historyRes.data || [];

      // Exclude the current hook type by prepending it to the history list
      const currentHook = post.draft_hook_type;
      const augmentedHistory = currentHook
        ? [{ hook_type: currentHook, topic_tags: post.draft_topic_tags || [] }, ...postHistory]
        : postHistory;

      const contentPrefs = (profile.content_preferences || '').split(',').map(s => s.trim()).filter(Boolean);
      const newDraft = await generateDraft(post, profile, augmentedHistory, voiceSamples, contentPrefs);
      if (!newDraft) return res.status(500).json({ error: 'Draft generation failed' });

      // Freshness check
      let draftIsRepetitive = false, draftRepetitiveReason = null, draftFreshAngle = null;
      if (postHistory.length > 0) {
        const freshness = await checkDraftFreshness(newDraft.draft_text, postHistory.slice(0, 30));
        if (freshness.flagged) {
          draftIsRepetitive = true;
          draftRepetitiveReason = freshness.reason;
          draftFreshAngle = freshness.freshAngle;
        }
      }

      const { data: updated, error: updateErr } = await db
        .from('content_feed')
        .update({
          draft_text: newDraft.draft_text,
          draft_topic_tags: newDraft.topic_tags || [],
          draft_hook_type: newDraft.hook_type,
          draft_image_hint: newDraft.image_suggestion,
          draft_hashtags: newDraft.hashtags || [],
          draft_source_urls: newDraft.source_urls,
          draft_continuity_ref: newDraft.continuity_reference || null,
          draft_is_repetitive: draftIsRepetitive,
          draft_repetitive_reason: draftRepetitiveReason,
          draft_fresh_angle: draftFreshAngle,
          draft_status: 'generated',
        })
        .eq('id', id).eq('user_id', userId).select().single();

      if (updateErr) return res.status(500).json({ error: updateErr.message });
      return res.json({ success: true, post: updated });
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
