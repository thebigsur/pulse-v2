// ═══════════════════════════════════════════════════════
// THE PULSE v2 — AI Scoring & Generation (Claude API)
// Uses Haiku for scoring (cost efficient), Sonnet for generation (quality)
// ═══════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { sanitizeText } from './utils.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── LinkedIn Algorithm Rules (invisible to user, always applied) ───
const LINKEDIN_RULES = `
LINKEDIN PLATFORM RULES (always follow silently — never reference these rules in output):

═══ ALGORITHM & DISTRIBUTION ═══
- LinkedIn explicitly prioritizes expertise-driven content over viral content. A post with 50 likes from engineers and tech VPs is worth dramatically more than 500 likes from random connections.
- Expert interactions carry 7-9x more algorithmic weight than random connections. Write to attract experts, not everyone.
- The first 60-90 minutes after posting determine ~70% of total reach. The opening line must stop the scroll instantly.
- Content can stay in feeds for 2-3 weeks if it continues generating engagement — quality compounds.
- Never post more than once per 12-24 hours. A new post cuts off reach from the previous one.
- Optimal posting cadence: 2-3 times per week, Tuesday through Thursday.
- Content recycling (identical or similar posts) gets 84% less reach. Every post must feel completely fresh.
- External links in the post body reduce reach by 25-40%. NEVER include URLs in the post text. Keep all content native to LinkedIn.
- DM recipients are 90% more likely to see the sender's next post — outreach and content visibility are a feedback loop.

═══ FORMAT & STRUCTURE ═══
- Text + image posts get 2.4x more engagement, especially infographics. Suggest an image pairing when the topic supports it.
- Document carousels perform 1.9x better than average (optimal: 9 slides). When a topic suits a step-by-step or comparison format, suggest a carousel outline.
- Posts under 200 words with short, punchy sentences consistently outperform long essays.
- Every post needs a scroll-stopping first line. The hook must create an open loop, challenge an assumption, or state something unexpected.
- Use line breaks between thoughts. No walls of text. White space is a feature.
- 3-4 niche-specific hashtags is optimal. More than 5 triggers spam filters. Zero misses discoverability. Never use generic hashtags like #finance or #investing — use targeted ones like #equitycomp, #RSUtax, #techcareers.

═══ VOICE & DIFFERENTIATION ═══
- 54% of longer English LinkedIn posts are now AI-generated. Voice differentiation is CRITICAL — if it reads like AI wrote it, it fails.
- Write like a smart friend explaining something at a bar, not a compliance department issuing a memo.
- Short, punchy sentences. No fluff. No filler. No corporate jargon.
- Specific dollar amounts, statistics, and concrete examples always outperform vague advice.
- Contrarian hooks that challenge conventional wisdom with data consistently outperform agreeable content.
- Niche authority (deep expertise on a narrow topic) outperforms broad-appeal content every time.
- Actionable insights over platitudes. The reader should be able to DO something after reading.
- NEVER use these AI tells: "In today's landscape", "It's worth noting", "Let's dive in", "Here's the thing", "At the end of the day", "Game-changer", "Leverage", "Synergy", "Unpack", "Navigate", "Robust". Write like a human with a strong opinion.

═══ ENGAGEMENT BAIT — HARD BAN ═══
LinkedIn recognizes 70+ linguistic patterns of engagement bait and actively penalizes them. NEVER use any variation of:
- "Like if you agree" / "Double tap if..." / "Hit the like button"
- "Comment YES" / "Comment [word] if you want..." / "Drop a [emoji] if..."
- "Share this with someone who..." / "Tag a friend who..." / "Send this to..."
- "Follow for more" / "Follow me for daily..." / "Repost to save"
- "Who else?" / "Am I the only one?" / "Raise your hand if..."
- "Agree or disagree?" / "Thoughts?" (as a lazy closer — a specific, thoughtful question is fine)
- Any sentence whose primary purpose is soliciting a like, comment, share, follow, or repost

═══ CONTENT INTEGRITY ═══
- NEVER fabricate statistics, dollar amounts, percentages, or data points. Every number must come from the source post or be verifiable.
- If the source post contains a statistic, cite it. If it doesn't, don't invent one.
- Source URLs must be the exact URL of the source material. Never fabricate or guess a URL.
- The draft topic MUST align with the source post's core subject. Do not drift to adjacent topics. If the source is about stock taxes generally, the draft is about stock taxes — not specifically RSUs unless the source mentions RSUs.

═══ ANTI-REPETITION ═══
- NEVER draft on a topic the advisor posted about in the last 14 days.
- NEVER reuse the same hook structure (contrarian, question, story, data_driven, myth_bust, timely, framework) more than twice in a rolling month.
- Approximately once every 3-4 weeks, include a continuity callback that references a previous post ("Last week I talked about X — here's the other side").
- Vary sentence length, paragraph structure, and opening patterns across drafts. Predictable formatting is a tell.

═══ COMPLIANCE (FINANCIAL SERVICES) ═══
- No guarantees of future performance or returns. No promissory language ("will earn", "will grow", "assured", "certain return").
- No forward-looking statements presented as certainty. Projections must include cautionary language.
- No fabricated client scenarios, even anonymized, without noting they are hypothetical.
- No comparative claims against other firms or advisors.
- No urgency-driven language designed to pressure action ("act now", "limited time", "don't miss out").
- No specific security recommendations by ticker symbol without balanced risk discussion.
- Content must be fair, balanced, and not misleading.
- The advisor's firm-specific compliance rules (from their settings) take precedence over these defaults.

═══ COMMENT-SPECIFIC RULES ═══
- Every comment must be at least 15 words. Comments of 15+ words receive 2.5x more algorithmic weight.
- Length alone is not the goal. A 25-word comment that reads like an expanded "Great post, totally agree!" is worse than useless.
- The comment must add genuine insight, share a relevant experience, pose a thoughtful question, or offer a specific perspective.
- Vary comment formats: quick agreement + personal anecdote, contrarian take, insightful question to OP, relevant data point.
- The goal of every comment is to get the OP or other commenters to click the advisor's profile.
- NEVER: "Great post!", "Love this!", "So true!", "Couldn't agree more!", generic encouragement, obvious AI language, self-promotion, or pitching services.
`;

// ─── Content Scoring (Haiku — ~$0.001/post) ───

export async function scoreContent(post, advisorProfile) {
  const text = sanitizeText(post.post_text || '');
  if (!text) return null;

  const prompt = `Score this social media post for a financial advisor's content strategy.

ADVISOR CONTEXT:
- Specialization: ${advisorProfile.specialization || 'equity compensation planning'}
- Target audience: ${advisorProfile.icp_professions || 'engineers, attorneys, tech employees'} ages ${advisorProfile.icp_age_min || 25}-${advisorProfile.icp_age_max || 45}
- Topics they cover: ${advisorProfile.topics_always || 'RSUs, ISOs, NSOs, Solo 401(k), Roth conversions, concentrated stock'}

POST TO SCORE:
Platform: ${post.platform}
Creator: ${post.creator_name || 'Unknown'}
Text: ${text.slice(0, 1500)}
Engagement: ${post.likes ?? 0} likes, ${post.comments ?? 0} comments, ${post.shares ?? 0} shares

SCORING RULES (CRITICAL):
- expertise_signal (0-100): Does this content demonstrate expertise? 
  * 0 engagement = score 0-10 max. NEVER above 20 if likes+comments+shares = 0
  * 50-500 likes = 30-60
  * 500+ likes = 60-90
  * Velocity matters: 50 likes in 2 hours > 500 likes in 3 days
- icp_relevance (0-100): How closely does this map to the advisor's expertise areas and audience interests?
- suggested_angle: One line — how could the advisor create their own post riffing on this?

Respond ONLY with valid JSON, no markdown:
{"expertise_signal": <number>, "icp_relevance": <number>, "suggested_angle": "<string>"}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error('Content scoring error:', err.message);
    return null;
  }
}

// ─── Comment Scoring (Haiku — ~$0.001/post) ───

export async function scoreComment(post, advisorProfile) {
  const text = sanitizeText(post.post_text || '');
  if (!text) return null;

  const prompt = `Score this LinkedIn post for comment opportunity value for a financial advisor.

ADVISOR: ${advisorProfile.full_name || 'Financial Advisor'} — ${advisorProfile.specialization || 'equity compensation planning'}
TARGET AUDIENCE: ${advisorProfile.icp_professions || 'engineers, attorneys, tech employees'}

POST:
Author: ${post.creator_name || 'Unknown'} — ${post.creator_title || ''} at ${post.creator_company || ''}
Text: ${text.slice(0, 1500)}
Engagement: ${post.likes ?? 0} likes, ${post.comments ?? 0} comments
Age: ${post.post_age_hours ?? 0} hours

SCORE ON FOUR DIMENSIONS (each 0-100):
1. icp_magnet: How likely is the advisor's target demographic engaging with this post/creator?
2. engagement_window: Is this post in the sweet spot (2-8 hours, accelerating)? Posts past peak = low score.
3. authority_positioning: Can the advisor demonstrate expertise here without being salesy?
4. conversation_starter: Will engaging here create a natural path to a follow or DM?

Also provide:
- comment_priority: weighted composite (icp_magnet×0.3 + engagement_window×0.25 + authority_positioning×0.25 + conversation_starter×0.2)
- topic_tag: one of [tech_careers, legal_careers, financial, equity_comp, leadership, investing, other]

Respond ONLY with valid JSON, no markdown:
{"icp_magnet": <n>, "engagement_window": <n>, "authority_positioning": <n>, "conversation_starter": <n>, "comment_priority": <n>, "topic_tag": "<string>"}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error('Comment scoring error:', err.message);
    return null;
  }
}

// ─── Draft Generation (Sonnet — ~$0.03/draft) ───

export async function generateDraft(sourcePost, advisorProfile, postHistory, voiceSamples, contentPrefs) {
  const recentTopics = postHistory.slice(0, 10).flatMap(p => p.topic_tags || []);
  const recentHooks = postHistory.slice(0, 10).map(p => p.hook_type).filter(Boolean);
  const voiceText = voiceSamples.map(s => `---\n${s.sample_text}`).join('\n');

  const prompt = `You are a LinkedIn post ghostwriter for a financial advisor. Generate ONE post draft.

ADVISOR:
Name: ${advisorProfile.full_name || 'Advisor'}
Firm: ${advisorProfile.firm || ''}
Specialization: ${advisorProfile.specialization || 'equity compensation'}
Tagline: ${advisorProfile.tagline || ''}

VOICE SAMPLES (match this writing style exactly):
${voiceText || 'No samples yet — write in a punchy, direct, smart-friend-at-a-bar tone.'}

TONE RULES:
${advisorProfile.tone_rules || 'Short, punchy sentences. No fluff. Like a smart friend at a bar.'}

POST RULES:
- Preferred length: ${advisorProfile.preferred_length || 'Under 200 words'}
- Preferred formats: ${advisorProfile.preferred_formats || 'Contrarian hooks, data-driven analysis'}
- Content preferences: ${contentPrefs.map(p => p.label).join(', ') || 'Contrarian takes, data analysis'}

ANTI-REPETITION (do NOT draft on these recent topics):
${recentTopics.join(', ') || 'none yet'}

STRUCTURAL VARIETY (do NOT use these hook types — use something different):
${recentHooks.join(', ') || 'none yet'}

TOPICS TO NEVER COVER:
${advisorProfile.topics_never || 'Crypto, insurance products, specific stock picks, politics'}

COMPLIANCE RULES:
${advisorProfile.compliance_rules || 'No guarantees, no forward-looking statements, no fabricated scenarios'}

SOURCE POST TO RIFF ON:
Platform: ${sourcePost.platform}
URL: ${sourcePost.url || 'unavailable'}
Text: ${sanitizeText(sourcePost.post_text || '').slice(0, 2000)}
Engagement: ${sourcePost.likes ?? 0} likes, ${sourcePost.comments ?? 0} comments
Suggested angle: ${sourcePost.suggested_angle || 'Create a unique take on this topic'}

SOURCE ALIGNMENT RULES:
- Your draft MUST be about the same core topic as the source post. Do not drift to adjacent topics.
- If the source is about general stock taxes, your draft should be about stock taxes — not RSUs specifically unless the source mentions RSUs.
- "source_urls" in your response MUST be the exact URL above (or null if unavailable). Never fabricate a URL.

${LINKEDIN_RULES}

CRITICAL RULES:
- Match the advisor's voice samples exactly — not generic AI writing
- Post must be ready to edit in 2-3 minutes, not a rough outline

Respond ONLY with valid JSON, no markdown:
{
  "draft_text": "<full post text>",
  "topic_tags": ["<tag1>", "<tag2>"],
  "hook_type": "<contrarian|question|data_driven|story|myth_bust|timely|framework>",
  "image_suggestion": "<one-line image idea or null>",
  "hashtags": ["<tag1>", "<tag2>"] or null,
  "source_urls": "<url or null>",
  "continuity_reference": "<reference to previous post or null>"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = response.content[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error('Draft generation error:', err.message);
    return null;
  }
}

// ─── Comment Generation (Sonnet — ~$0.02/comment) ───

export async function generateComment(post, advisorProfile, commentVoiceSamples) {
  const voiceText = commentVoiceSamples.map(s => `---\n${s.sample_text}`).join('\n');

  const prompt = `Write a LinkedIn comment for a financial advisor to post on this post.

ADVISOR: ${advisorProfile.full_name || 'Advisor'} — ${advisorProfile.specialization || 'equity compensation planning'}
EXPERTISE AREAS: ${advisorProfile.topics_always || 'RSUs, ISOs, Solo 401(k), Roth conversions, concentrated stock'}

COMMENT VOICE SAMPLES (match this style):
${voiceText || 'Quick, substantive, adds genuine value. Never preachy. Humor when natural.'}

POST:
Author: ${post.creator_name || 'Unknown'} — ${post.creator_title || ''} at ${post.creator_company || ''}
Text: ${sanitizeText(post.post_text || '').slice(0, 1500)}

${LINKEDIN_RULES}

REQUIREMENTS:
- Minimum 15 words, but substance is the actual requirement
- Must add genuine insight, personal experience, smart question, or specific perspective
- Vary format: quick insight + experience, contrarian take, question to OP, relevant data point
- NEVER: generic encouragement ("Great post!"), obvious AI language, self-promotion, pitching
- Goal: get the OP or other commenters to click the advisor's profile

Respond ONLY with the comment text, nothing else. No quotes, no JSON.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].text.trim();
  } catch (err) {
    console.error('Comment generation error:', err.message);
    return null;
  }
}

// ─── Post Classification (Haiku — ~$0.002/batch of 10) ───

export async function classifyPosts(posts, categories) {
  if (!posts.length || !categories.length) return [];

  // Process in batches of 10
  const results = [];
  for (let i = 0; i < posts.length; i += 10) {
    const batch = posts.slice(i, i + 10);
    const postList = batch.map((p, idx) => 
      `[${idx}] ${(p.post_text || '').slice(0, 500)}`
    ).join('\n\n');

    const prompt = `You are classifying LinkedIn posts by a financial advisor into content categories. Read each post carefully and assign exactly ONE category.

AVAILABLE CATEGORIES: ${categories.join(', ')}

CRITICAL CLASSIFICATION RULES:

1. FINANCIAL CONTENT vs PERSONAL: A post is only "Personal or family" (or similar personal category) if it's truly about the advisor's personal life — a birthday, vacation, family photo, personal milestone, or story that has NO financial planning substance. If the post discusses ANY financial concept (wealth transfer, home prices, retirement, investing, tax, estate planning, wills, trusts, beneficiaries, market data, salary coordination, equity, etc.), it belongs in the most relevant FINANCIAL category, even if it mentions family or personal anecdotes.

2. TOPIC MATCHING HIERARCHY — match to the MOST SPECIFIC category:
   - Posts about RSUs, ISOs, NSOs, stock options, equity grants, vesting, concentrated stock → Equity Comp category
   - Posts about tax planning, tax optimization, capital gains, AMT, tax-loss harvesting → Tax Strategy category
   - Posts about market data, housing prices, S&P 500, economy, interest rates, valuations, real estate market stats → Market Commentary category
   - Posts about 401(k), pension, employer match, employer retirement benefits → Employer Sponsored Retirement Plans category
   - Posts about IRA, Roth IRA, Solo 401(k), SEP IRA, non-employer retirement → Non-Employer Sponsored Retirement Plans category
   - Posts about estate planning, wills, trusts, wealth transfer, inheritance, beneficiary designations, intergenerational wealth → whichever financial category fits best (NOT personal/family)
   - Posts about entrepreneurship, business ownership, self-employment → Business Owners category
   - Posts about employer benefits beyond retirement (ESPP, HSA, insurance, deferred comp) → Employer Benefits category

3. WHEN IN DOUBT: Choose the financial/professional category. "General" is ONLY for posts with zero financial content (e.g., motivational quotes, pop culture references, humor with no financial tie-in).

4. A post that uses a personal story AS A HOOK to discuss financial planning still belongs in the financial category matching its core educational content.

POSTS TO CLASSIFY:
${postList}

Respond ONLY with valid JSON array, no markdown:
[{"index": 0, "category": "<exact category name from list>"}, ...]`;

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });
      const raw = response.content[0].text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(raw);
      
      for (const item of parsed) {
        const post = batch[item.index];
        if (post) {
          results.push({ id: post.id, category: categories.includes(item.category) ? item.category : (item.category === 'General' ? 'General' : categories[0]) });
        }
      }
    } catch (err) {
      console.error('Classification error:', err.message);
      // Fallback: assign General to all in this batch
      for (const post of batch) {
        results.push({ id: post.id, category: 'General' });
      }
    }
  }
  return results;
}

// ─── Outreach Generation (Sonnet — ~$0.01/message) ───

export async function generateOutreach(lead, advisorProfile) {
  const prompt = `Write a LinkedIn DM conversation starter for a financial advisor.

ADVISOR: ${advisorProfile.full_name || 'Advisor'} — ${advisorProfile.specialization || 'equity compensation planning'}
TAGLINE: ${advisorProfile.tagline || ''}

LEAD:
Name: ${lead.name}
Title: ${lead.title || ''}
Company: ${lead.company || ''}
How they engaged: ${lead.interaction_text || ''}

RULES:
- Maximum 2-3 sentences. Start a conversation, don't deliver a pitch.
- MUST reference the actual interaction — never generic.
- Never suggest pitching in the first message.
- Tone: warm, direct, professional but not corporate.

Respond ONLY with the message text, nothing else.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].text.trim();
  } catch (err) {
    console.error('Outreach generation error:', err.message);
    return null;
  }
}
