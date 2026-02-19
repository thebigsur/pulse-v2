// /api/run-pipeline — Server-side proxy for manual pipeline runs
// This avoids needing CRON_SECRET in the client bundle

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type } = req.body;
  const endpoints = {
    content: '/api/scrape/content',
    comments: '/api/scrape/comments',
    'post-history': '/api/scrape/post-history',
  };

  const endpoint = endpoints[type];
  if (!endpoint) return res.status(400).json({ error: `Invalid pipeline type: ${type}` });

  try {
    // Build absolute URL for internal fetch
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || process.env.VERCEL_URL || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error(`[run-pipeline] Error running ${type}:`, err);
    return res.status(500).json({ error: err.message });
  }
}
