// components/CommentsView.jsx
import { useState } from "react";
import { useComments } from "../lib/hooks";
import { C, F } from "../lib/theme";
import { Btn, Tag, SectionTitle, Icons } from "./ui";

function mapApiComment(item) {
  const ageStr = item.post_age_hours != null
    ? (item.post_age_hours < 1 ? "<1h" : `${Math.round(item.post_age_hours)}h`)
    : "recent";
  return {
    id: item.id,
    author: item.creator_name || item.creator_handle || "Unknown",
    title: item.creator_title || "",
    company: item.creator_company || "",
    post: item.post_text || "",
    postUrl: item.url && item.url.startsWith("http") ? item.url : "#",
    engagement: {
      likes: item.likes || 0,
      comments: item.comments || 0,
      age: ageStr,
    },
    comment: item.suggested_comment || "",
    snLead: item.sn_lead || false,
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

export default function CommentsView() {
  const { comments: rawComments, loading, markDone } = useComments();
  const [expandedId, setExpandedId] = useState(null);
  const [doneIds, setDoneIds] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  const allComments = rawComments.map(mapApiComment);
  const doneCount = Object.keys(doneIds).length;

  const handleToggle = (id) => setExpandedId(prev => prev === id ? null : id);

  const handleDone = async (c) => {
    try { await markDone(c.id); } catch (err) { console.error("Mark done failed:", err); }
    setDoneIds(d => ({ ...d, [c.id]: true }));
  };

  const handleCopyAndOpen = (c) => {
    navigator.clipboard.writeText(c.comment).then(() => {
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 2500);
      if (c.postUrl && c.postUrl !== "#") {
        window.open(c.postUrl, "_blank", "noopener,noreferrer");
      }
    }).catch(() => {});
  };

  if (loading) return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <SectionTitle>Comments</SectionTitle>
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <p style={{ fontFamily: F.serif, fontSize: 20, color: C.textSoft }}>Loading comments...</p>
        <p style={{ fontSize: 12, color: C.textFaint, marginTop: 8 }}>Fetching from Supabase</p>
      </div>
    </div>
  );

  if (allComments.length === 0) return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <SectionTitle>Comments</SectionTitle>
      <div style={{ padding: "60px 0" }}>
        <p style={{ fontFamily: F.serif, fontSize: 24, color: C.textSoft }}>No comment opportunities yet</p>
        <p style={{ fontSize: 13, color: C.textFaint, marginTop: 8 }}>Run the comment pipeline to find posts worth engaging with.</p>
      </div>
    </div>
  );

  const remaining = allComments.filter(c => !doneIds[c.id]).length;

  return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <SectionTitle sub={`${allComments.length} opportunities · ${doneCount} done · ${remaining} remaining`}>
        Comments
      </SectionTitle>

      {doneCount > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ height: 2, background: C.stroke, borderRadius: 1, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(doneCount / allComments.length) * 100}%`, background: C.green, borderRadius: 1, transition: "width 0.4s ease" }} />
          </div>
        </div>
      )}

      <div>
        {allComments.map((c, idx) => {
          const isExpanded = expandedId === c.id;
          const isDone = doneIds[c.id];
          const isCopied = copiedId === c.id;

          return (
            <div key={c.id} style={{ borderBottom: `1px solid ${C.stroke}`, opacity: isDone ? 0.45 : 1, transition: "opacity 0.2s", animation: `slideUp 0.2s ease ${idx * 0.03}s both` }}>
              <div
                onClick={() => !isDone && handleToggle(c.id)}
                style={{ padding: "14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: isDone ? "default" : "pointer", borderRadius: 4, margin: "0 -8px", transition: "background 0.15s", background: isExpanded ? C.surfaceHover : "transparent" }}
                onMouseEnter={e => { if (!isDone) e.currentTarget.style.background = C.surfaceHover; }}
                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: isDone ? C.textFaint : C.text, whiteSpace: "nowrap" }}>{c.author}</span>
                    {c.snLead && <Tag color={C.green} bg={C.greenSoft}>SN Lead</Tag>}
                    {isDone && <Tag color={C.green} bg={C.greenSoft}>Done</Tag>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                      {[c.title, c.company].filter(Boolean).join(" · ")}
                    </span>
                    <span style={{ fontSize: 12, color: C.textGhost, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                      · {c.post.substring(0, 60)}{c.post.length > 60 ? "…" : ""}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontFamily: F.mono, color: C.coral }}>{c.engagement.likes} likes</span>
                  <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>{c.engagement.age}</span>
                  {relativeDate(c.addedAt) && (
                    <span style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, opacity: 0.5 }} title="Added to Pulse">
                      added {relativeDate(c.addedAt)}
                    </span>
                  )}
                  {!isDone && (
                    <span style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "flex", color: C.textGhost }}>
                      <Icons.chevRight />
                    </span>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: "0 0 24px 8px", animation: "fadeIn 0.2s ease" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                    <div>
                      <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Their post</p>
                      <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.75, fontStyle: "italic", paddingLeft: 14, borderLeft: `1px solid ${C.stroke}`, marginBottom: 12 }}>
                        {c.post}
                      </div>
                      <div style={{ display: "flex", gap: 16 }}>
                        <span style={{ fontSize: 11, fontFamily: F.mono, color: C.coral }}>{c.engagement.likes} likes</span>
                        <span style={{ fontSize: 11, fontFamily: F.mono, color: C.blue }}>{c.engagement.comments} comments</span>
                        <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>{c.engagement.age} ago</span>
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                        Suggested comment <span style={{ color: C.textGhost, textTransform: "none" }}>· {wordCount(c.comment)}w</span>
                      </p>
                      <div style={{ fontSize: 13, color: C.text, lineHeight: 1.75, padding: "16px 18px", background: C.goldGlow, borderRadius: 8, border: "1px solid rgba(200,169,110,0.1)", marginBottom: 16 }}>
                        {c.comment}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Btn primary onClick={() => handleCopyAndOpen(c)}>
                          {isCopied ? <><Icons.check /> Copied — opening LinkedIn</> : <><Icons.external /> Copy &amp; Open</>}
                        </Btn>
                        <Btn onClick={() => handleDone(c)}>
                          <Icons.check /> Done
                        </Btn>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {doneCount === allComments.length && allComments.length > 0 && (
        <div style={{ padding: "48px 0", textAlign: "center", animation: "fadeIn 0.3s ease" }}>
          <p style={{ fontFamily: F.serif, fontSize: 24, color: C.textSoft }}>All done.</p>
          <p style={{ fontSize: 13, color: C.textFaint, marginTop: 8 }}>Next opportunities arrive tomorrow.</p>
        </div>
      )}
    </div>
  );
}
