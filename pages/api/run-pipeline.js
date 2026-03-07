// /api/run-pipeline — Server-side proxy for manual pipeline runs
// Extracts user identity from JWT and passes user_id to scrape routes

export const config = {
  maxDuration: 300,
};

import { getUserId } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: verify the user's session
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { type } = req.body;
  const endpoints = {
    content: '/api/scrape/content',
    comments: '/api/scrape/comments',
    'post-history': '/api/scrape/post-history',
  };

  const endpoint = endpoints[type];
  if (!endpoint) return res.status(400).json({ error: `Invalid pipeline type: ${type}` });

  try {
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || process.env.VERCEL_URL || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
      // Pass user_id in body — scrape routes trust this since CRON_SECRET is verified
      body: JSON.stringify({ userId }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error(`[run-pipeline] Error running ${type}:`, err);
    return res.status(500).json({ error: err.message });
  }
}
