// /api/outreach — Get leads, mark as messaged/dismissed
import { createServerClient } from '../../lib/supabase';

export default async function handler(req, res) {
  const db = createServerClient();

  if (req.method === 'GET') {
    const { data, error } = await db.from('outreach_leads')
      .select('*')
      .eq('status', 'pending')
      .order('surfaced_at', { ascending: false })
      .limit(20);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'PATCH') {
    const { id, status } = req.body;
    if (!id || !['messaged', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'id and valid status required' });
    }
    const { error } = await db.from('outreach_leads').update({ status }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
