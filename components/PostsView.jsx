// components/PostsView.jsx
// Fixes applied:
//   Item 13: mapApiDraft now reads draft_is_repetitive/draft_repetitive_reason/draft_fresh_angle
//            columns directly instead of parsing the REPETITIVE_FLAG: string hack.
//            Falls back to legacy string parsing for backward compatibility during migration.
//   Item 15: "Best posting window" hint shown after a draft is copied.
//   Item 16: "Regenerate" button on each draft calls the regenerate API action.

import { useState } from "react";
import { useDrafts } from "../lib/hooks";
import { authFetch } from "../lib/api";
import { C, F, getTopicColor } from "../lib/theme";
import { Btn, Tag, SectionTitle, Icons } from "./ui";

// ── Data mapper: API row → UI shape ──────────────────────────────────────────
// Item 13 fix: reads structured columns instead of parsing REPETITIVE_FLAG: strings.
// Legacy fallback retained so existing rows still display correctly.
function mapApiDraft(item) {
  const engagement = [
    item.likes ? `${item.likes.toLocaleString()} likes` : null,
    item.comments ? `${item.comments} comments` : null,
  ].filter(Boolean).join(" · ");

  // Item 13: prefer new structured columns; fall back to legacy string encoding
  let repetitiveFlag = false, repetitiveReason = "", freshAngle = "", continuityRef = null;
  if (item.draft_is_repetitive != null) {
    // New columns present — use them directly
    repetitiveFlag = item.draft_is_repetitive === true;
    repetitiveReason = item.draft_repetitive_reason || "";
    freshAngle = item.draft_fresh_angle || "";
    continuityRef = item.draft_continuity_ref || null;
  } else {
    // Legacy: parse encoded string
    const ref = item.draft_continuity_ref || "";
    if (ref.startsWith("REPETITIVE_FLAG:")) {
      const [reasonPart, anglePart] = ref.slice("REPETITIVE_FLAG:".length).split("||FRESH_ANGLE:");
      repetitiveFlag = true;
      repetitiveReason = reasonPart || "";
      freshAngle = anglePart || "";
    } else {
      continuityRef = ref || null;
    }
  }

  return {
    id: item.id,
    text: item.draft_text || "",
    source: {
      text: item.suggested_angle || item.post_text || "",
      author: item.creator_handle ? `@${item.creator_handle}` : (item.creator_name || "Unknown"),
      engagement: engagement || "New post",
      url: (item.url && item.url.startsWith("http") ? item.url : null) ||
           (item.draft_source_urls && item.draft_source_urls.startsWith("http") ? item.draft_source_urls : null),
    },
    topic: (item.draft_topic_tags && item.draft_topic_tags[0]) || "General",
    topicTags: item.draft_topic_tags || [],
    hookType: item.draft_hook_type || null,
    imageHint: item.draft_image_hint || null,
    hashtags: (item.draft_hashtags && item.draft_hashtags.length > 0) ? item.draft_hashtags : null,
    repetitiveFlag,
    repetitiveReason,
    freshAngle,
    continuityRef,
    addedAt: item.scraped_at || null,
  };
}

const wordCount = (text) => text.split(/\s+/).filter(w => w.length > 0).length;

function relativeDate(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PostsView() {
  const { drafts: rawDrafts, loading, skip: apiSkip, regenerate: apiRegenerate, refetch } = useDrafts();
  const [showSource, setShowSource] = useState({});
  const [copied, setCopied] = useState({});
  const [expandedDraft, setExpandedDraft] = useState({});
  const [regenerating, setRegenerating] = useState({});

  // Re-scrape state
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState(null);

  const handleReScrape = async () => {
    setScraping(true);
    setScrapeMsg(null);
    try {
      const res = await authFetch("/api/run-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "content" }),
      });
      const result = await res.json();
      setScrapeMsg(result.error ? "error" : "done");
      if (!result.error) setTimeout(() => { setScrapeMsg(null); refetch(); }, 1500);
    } catch {
      setScrapeMsg("error");
    } finally {
      setScraping(false);
      setTimeout(() => setScrapeMsg(null), 5000);
    }
  };

  // "Not for me" feedback state
  const [notForMeId, setNotForMeId] = useState(null);
  const [notForMeReason, setNotForMeReason] = useState("");
  const [notForMeSaving, setNotForMeSaving] = useState(false);

  const activeDrafts = rawDrafts
    .filter(d => d.draft_status === "generated")
    .map(mapApiDraft)
    .sort((a, b) => (a.repetitiveFlag ? 1 : 0) - (b.repetitiveFlag ? 1 : 0));

  const handleCopy = (draft) => {
    navigator.clipboard.writeText(draft.text).then(() => {
      setCopied(c => ({ ...c, [draft.id]: true }));
      setTimeout(() => setCopied(c => ({ ...c, [draft.id]: false })), 3000);
    }).catch(() => {});
  };

  const handleSkip = async (id) => {
    try { await apiSkip(id); } catch (err) { console.error("Skip failed:", err); }
  };

  // Item 16: Regenerate a single draft with a different angle
  const handleRegenerate = async (id) => {
    setRegenerating(r => ({ ...r, [id]: true }));
    try { await apiRegenerate(id); }
    catch (err) { console.error("Regenerate failed:", err); }
    finally { setRegenerating(r => ({ ...r, [id]: false })); }
  };

  const handleNotForMe = async () => {
    if (!notForMeReason.trim() || !notForMeId) return;
    setNotForMeSaving(true);
    try {
      const profileRes = await authFetch("/api/profile");
      const profileData = await profileRes.json();
      const existing = (profileData.content_filters || "").trim();
      const updated = existing ? `${existing}\n${notForMeReason.trim()}` : notForMeReason.trim();

      await authFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_filters: updated }),
      });
      await apiSkip(notForMeId);
      setNotForMeId(null);
      setNotForMeReason("");
    } catch (err) { console.error("Not for me failed:", err); }
    setNotForMeSaving(false);
  };

  return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 0 }}>
        <SectionTitle sub={loading ? "Loading drafts..." : `${activeDrafts.length} draft${activeDrafts.length !== 1 ? "s" : ""} to review`}>
          Posts
        </SectionTitle>
        <button
          onClick={handleReScrape}
          disabled={scraping}
          style={{
            marginTop: 6,
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: `1px solid ${scrapeMsg === "error" ? C.coral : scrapeMsg === "done" ? C.green : C.stroke}`,
            borderRadius: 6, padding: "6px 12px", cursor: scraping ? "default" : "pointer",
            color: scrapeMsg === "error" ? C.coral : scrapeMsg === "done" ? C.green : C.textFaint,
            fontSize: 11, fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.06em",
            opacity: scraping ? 0.6 : 1, transition: "border-color 0.2s, color 0.2s",
          }}
          onMouseEnter={e => { if (!scraping) e.currentTarget.style.borderColor = C.gold; if (!scraping) e.currentTarget.style.color = C.gold; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = scrapeMsg === "error" ? C.coral : scrapeMsg === "done" ? C.green : C.stroke; e.currentTarget.style.color = scrapeMsg === "error" ? C.coral : scrapeMsg === "done" ? C.green : C.textFaint; }}
        >
          <Icons.refresh />
          {scraping ? "Scraping…" : scrapeMsg === "done" ? "Done!" : scrapeMsg === "error" ? "Failed" : "Re-scrape"}
        </button>
      </div>

      {loading && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <p style={{ fontFamily: F.serif, fontSize: 20, color: C.textSoft }}>Loading drafts...</p>
          <p style={{ fontSize: 12, color: C.textFaint, marginTop: 8 }}>Fetching from Supabase</p>
        </div>
      )}

      {!loading && activeDrafts.length === 0 && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <p style={{ fontFamily: F.serif, fontSize: 20, color: C.textSoft }}>No drafts yet</p>
          <p style={{ fontSize: 12, color: C.textFaint, marginTop: 8 }}>Run the content pipeline to generate drafts from trending content.</p>
        </div>
      )}

      {!loading && activeDrafts.length > 0 && (
        <>
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
              Review · {activeDrafts.length} draft{activeDrafts.length > 1 ? "s" : ""}
            </p>
            {activeDrafts.map((draft, idx) => {
              const tc = getTopicColor(draft.topic);
              const isExpanded = expandedDraft[`active-${draft.id}`] ?? (idx === 0);
              const isCopied = copied[draft.id];
              const isRegenerating = regenerating[draft.id];

              return (
                <div key={draft.id} style={{ borderBottom: `1px solid ${C.stroke}`, animation: `slideUp 0.25s ease ${idx * 0.06}s both` }}>
                  {/* Collapsed header */}
                  <div
                    onClick={() => setExpandedDraft(e => ({ ...e, [`active-${draft.id}`]: !isExpanded }))}
                    style={{ padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", borderRadius: 4, transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: tc.fg, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, color: C.textSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {draft.text.split("\n")[0]}
                      </span>
                      {draft.repetitiveFlag && (
                        <span title="Similar topic posted recently" style={{ fontSize: 11, flexShrink: 0, opacity: 0.8 }}>⚠️</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>{wordCount(draft.text)}w</span>
                      {relativeDate(draft.addedAt) && (
                        <span style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, opacity: 0.6 }}>
                          {relativeDate(draft.addedAt)}
                        </span>
                      )}
                      <Tag color={tc.fg} bg={tc.bg}>{draft.topic}</Tag>
                      <span style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "flex", color: C.textGhost }}>
                        <Icons.chevRight />
                      </span>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ padding: "0 0 20px 18px", animation: "fadeIn 0.2s ease", borderLeft: `2px solid ${tc.fg}` }}>
                      {/* Meta row */}
                      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                        {draft.imageHint && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, color: C.blue, fontSize: 11 }}>
                            <Icons.image /> Image suggested
                          </span>
                        )}
                        {draft.hashtags && (
                          <span style={{ fontSize: 11, color: C.textGhost }}>{draft.hashtags.join(" ")}</span>
                        )}
                      </div>

                      {/* Repetitive warning */}
                      {draft.repetitiveFlag && (
                        <div style={{ padding: "10px 14px", marginBottom: 14, marginLeft: 16, maxWidth: 580, background: "#2a2400", border: "1px solid #5a4e00", borderRadius: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13 }}>⚠️</span>
                            <span style={{ fontSize: 11, fontFamily: F.mono, color: "#c8a800", textTransform: "uppercase", letterSpacing: "0.08em" }}>Similar topic posted recently</span>
                          </div>
                          {draft.repetitiveReason && <p style={{ fontSize: 12, color: "#a08600", margin: 0 }}>{draft.repetitiveReason}</p>}
                          {draft.freshAngle && (
                            <p style={{ fontSize: 12, color: "#7a9f6a", margin: 0 }}>
                              <span style={{ color: "#5a7f4a", fontFamily: F.mono, fontSize: 10, textTransform: "uppercase", marginRight: 4 }}>New angle:</span>
                              {draft.freshAngle}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Draft text */}
                      <div style={{ fontSize: 15, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 16, maxWidth: 580, paddingLeft: 16 }}>
                        {draft.text}
                      </div>

                      {/* Image hint */}
                      {draft.imageHint && (
                        <div style={{ padding: "12px 16px", background: C.blueSoft, borderRadius: 6, marginBottom: 14, maxWidth: 580, marginLeft: 16, display: "flex", alignItems: "center", gap: 10 }}>
                          <Icons.image />
                          <span style={{ fontSize: 13, color: C.blue }}>{draft.imageHint}</span>
                        </div>
                      )}

                      {/* Source — collapsible */}
                      <div style={{ paddingLeft: 16 }}>
                        <button
                          onClick={e => { e.stopPropagation(); setShowSource(s => ({ ...s, [draft.id]: !s[draft.id] })); }}
                          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: C.textGhost, fontSize: 12, fontFamily: F.sans, padding: 0, marginBottom: showSource[draft.id] ? 0 : 20, transition: "color 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.color = C.textFaint}
                          onMouseLeave={e => e.currentTarget.style.color = C.textGhost}
                        >
                          <span style={{ transform: showSource[draft.id] ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "flex" }}>
                            <Icons.chevRight />
                          </span>
                          Source
                        </button>

                        {showSource[draft.id] && (
                          <div style={{ padding: "10px 0 20px", animation: "fadeIn 0.2s ease" }}>
                            <p style={{ fontSize: 12, color: C.textFaint }}>
                              <span style={{ color: C.gold }}>{draft.source.author}</span>
                              <span style={{ margin: "0 8px", color: C.textGhost }}>·</span>
                              {draft.source.engagement}
                            </p>
                            <p style={{ fontSize: 13, color: C.textFaint, fontStyle: "italic", marginTop: 4 }}>"{draft.source.text}"</p>
                            {draft.source.url && (
                              <a href={draft.source.url} target="_blank" rel="noopener noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: C.textGhost, marginTop: 8, textDecoration: "none", transition: "color 0.15s" }}
                                onMouseEnter={e => e.currentTarget.style.color = C.gold}
                                onMouseLeave={e => e.currentTarget.style.color = C.textGhost}
                              >
                                <Icons.external /> View original post
                              </a>
                            )}
                          </div>
                        )}

                        {/* Actions row */}
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <Btn primary onClick={e => { e.stopPropagation(); handleCopy(draft); }}>
                            {isCopied ? <><Icons.check /> Copied!</> : <><Icons.copy /> Copy to Clipboard</>}
                          </Btn>

                          {/* Item 16: Regenerate button */}
                          <Btn
                            onClick={e => { e.stopPropagation(); handleRegenerate(draft.id); }}
                            style={{ opacity: isRegenerating ? 0.6 : 1 }}
                          >
                            <Icons.refresh />
                            {isRegenerating ? "Generating…" : "Regenerate"}
                          </Btn>

                          <Btn onClick={e => { e.stopPropagation(); handleSkip(draft.id); }}>
                            Skip
                          </Btn>
                          <button
                            onClick={e => { e.stopPropagation(); setNotForMeId(draft.id); setNotForMeReason(""); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: C.textGhost, fontSize: 11, fontFamily: F.mono, padding: "6px 0", transition: "color 0.15s", marginLeft: 4 }}
                            onMouseEnter={e => e.currentTarget.style.color = C.coral}
                            onMouseLeave={e => e.currentTarget.style.color = C.textGhost}
                          >
                            Not for me
                          </button>
                        </div>

                        {/* Item 15: Posting window hint — shown after copy */}
                        {isCopied && (
                          <div style={{ marginTop: 10, padding: "8px 12px", background: C.greenSoft, border: `1px solid rgba(109,175,123,0.2)`, borderRadius: 6, display: "flex", alignItems: "center", gap: 8, animation: "fadeIn 0.2s ease" }}>
                            <span style={{ fontSize: 13 }}>🗓</span>
                            <span style={{ fontSize: 12, color: C.green }}>Best posting window: <strong>Tuesday–Thursday, 8–10am</strong></span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {activeDrafts.length === 0 && (
            <div style={{ padding: "50px 0", animation: "fadeIn 0.3s ease" }}>
              <p style={{ fontFamily: F.serif, fontSize: 24, color: C.textSoft }}>All caught up.</p>
              <p style={{ fontSize: 13, color: C.textFaint, marginTop: 8 }}>Next drafts arrive tomorrow at 6am.</p>
            </div>
          )}
        </>
      )}

      {/* "Not for me" modal */}
      {notForMeId && (
        <div onClick={() => { setNotForMeId(null); setNotForMeReason(""); }} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#242428", borderRadius: 12, padding: "28px 28px 24px", width: 420, maxWidth: "90vw", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
            <p style={{ fontFamily: F.serif, fontSize: 20, color: C.text, marginBottom: 6 }}>Not for me</p>
            <p style={{ fontSize: 13, color: C.textFaint, marginBottom: 20, lineHeight: 1.5 }}>
              Describe what to avoid so future drafts skip content like this. This gets saved to your profile permanently.
            </p>
            <textarea
              autoFocus value={notForMeReason} onChange={e => setNotForMeReason(e.target.value)}
              placeholder="e.g. Don't suggest posts about tax laws from other countries — only US tax content"
              rows={3}
              style={{ width: "100%", background: C.surface, border: `1px solid ${C.stroke}`, borderRadius: 8, color: C.text, padding: "12px 14px", fontSize: 14, fontFamily: F.sans, lineHeight: 1.5, resize: "vertical", outline: "none" }}
              onFocus={e => e.target.style.borderColor = C.gold}
              onBlur={e => e.target.style.borderColor = C.stroke}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <Btn onClick={() => { setNotForMeId(null); setNotForMeReason(""); }}>Cancel</Btn>
              <Btn primary onClick={handleNotForMe} style={{ opacity: notForMeReason.trim() ? 1 : 0.4, pointerEvents: notForMeReason.trim() ? "auto" : "none" }}>
                {notForMeSaving ? "Saving..." : "Save & Skip"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
