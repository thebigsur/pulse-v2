// ═══════════════════════════════════════════════════════
// THE PULSE v2 — AI Scoring & Generation (Claude API)
// Uses Haiku for scoring (cost efficient), Sonnet for generation (quality)
// ═══════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import { sanitizeText } from './utils.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
Text: ${sanitizeText(sourcePost.post_text || '').slice(0, 2000)}
Engagement: ${sourcePost.likes ?? 0} likes, ${sourcePost.comments ?? 0} comments
Suggested angle: ${sourcePost.suggested_angle || 'Create a unique take on this topic'}

CRITICAL RULES:
- Never fabricate statistics. Only use data from the source post with traceable URL.
- Never use engagement bait: "like if you agree," "comment YES," "share this," "tag someone"
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
