// /api/comments — Get comment opportunities, mark as done
import { createServerClient, getUserId } from '../../../lib/supabase';

export default async function handler(req, res) {
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const db = createServerClient();

  if (req.method === 'GET') {
    const { data, error } = await db.from('comment_feed')
      .select('*')
      .eq('user_id', userId)
      .eq('commented', false)
      .not('suggested_comment', 'is', null)
      .order('comment_priority', { ascending: false })
      .limit(20);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'PATCH') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await db.from('comment_feed')
      .update({ commented: true })
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
