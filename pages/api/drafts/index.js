// /api/drafts — CRUD for post drafts
import { createServerClient } from '../../../lib/supabase';

export default async function handler(req, res) {
  const db = createServerClient();

  if (req.method === 'GET') {
    const { status } = req.query;
    let query = db.from('content_feed')
      .select('*')
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
      const { error } = await db.from('content_feed').update({ draft_status: 'approved' }).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }
    if (action === 'skip') {
      const { error } = await db.from('content_feed').update({ draft_status: 'skipped' }).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
