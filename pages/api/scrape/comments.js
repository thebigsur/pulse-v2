// POST /api/scrape/comments — Run comment pipeline
import { createServerClient } from '../../../lib/supabase';
import { scrapeLinkedInCommentFeed, scrapeLinkedInContent } from '../../../lib/scraper';
import { scoreComment, generateComment } from '../../../lib/ai';

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = createServerClient();
  let totalScraped = 0, totalScored = 0, totalErrors = 0;

  const { data: logEntry } = await db.from('scrape_log').insert({
    pipeline: 'comments', status: 'running', started_at: new Date().toISOString(),
  }).select().single();

  try {
    const { data: profile } = await db.from('advisor_profile').select('*').single();
    const allKeywords = (profile?.comment_keywords || 'tech careers\nstartup culture\nBigLaw life\naerospace engineering')
      .split('\n').map(k => k.trim()).filter(Boolean);

    // Rotate 3 keywords per run to stay within timeout limits
    const MAX_KEYWORDS_PER_RUN = 3;
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const startIdx = (dayIndex * MAX_KEYWORDS_PER_RUN) % allKeywords.length;
    const keywords = [];
    for (let i = 0; i < Math.min(MAX_KEYWORDS_PER_RUN, allKeywords.length); i++) {
      keywords.push(allKeywords[(startIdx + i) % allKeywords.length]);
    }
    console.log(`[Comments] Running with ${keywords.length}/${allKeywords.length} keywords:`, keywords);

    // Scrape
    const posts = await scrapeLinkedInContent(keywords);
    console.log(`[Comments] Scraper returned ${posts.length} posts`);
    totalScraped = posts.length;

    for (const post of posts) {
      await db.from('comment_feed').upsert(post, { onConflict: 'external_id,platform', ignoreDuplicates: true });
    }

    // Check against SN leads
    const { data: snLeads } = await db.from('sn_leads').select('name, company');
    const snSet = new Set((snLeads || []).map(l => `${l.name}|${l.company}`.toLowerCase()));

    // Score unscored
    const { data: unscored } = await db.from('comment_feed')
      .select('*').is('scored_at', null).order('scraped_at', { ascending: false }).limit(30);

    for (const post of (unscored || [])) {
      try {
        const scores = await scoreComment(post, profile || {});
        if (scores) {
          const isSN = snSet.has(`${post.creator_name}|${post.creator_company}`.toLowerCase());
          const comment = await generateComment(post, profile || [],
            (await db.from('voice_samples').select('*').eq('type', 'comment')).data || []);

          await db.from('comment_feed').update({
            ...scores,
            suggested_comment: comment,
            sn_lead: isSN,
            scored_at: new Date().toISOString(),
          }).eq('id', post.id);
          totalScored++;
        }
      } catch (err) {
        totalErrors++;
      }
    }

    // Cleanup old entries (>7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.from('comment_feed').delete().lt('scraped_at', weekAgo).eq('commented', false);

    await db.from('scrape_log').update({
      results_count: totalScraped, scored_count: totalScored, errors_count: totalErrors,
      status: 'completed', completed_at: new Date().toISOString(),
    }).eq('id', logEntry?.id);

    return res.status(200).json({ success: true, scraped: totalScraped, scored: totalScored, errors: totalErrors });
  } catch (err) {
    await db.from('scrape_log').update({
      status: 'failed', error_message: err.message, completed_at: new Date().toISOString(),
    }).eq('id', logEntry?.id);
    return res.status(500).json({ error: err.message });
  }
}
