// components/PerformanceView.jsx
// Fixes:
//   Item 8: All derived state (filteredPosts, allTimeMedian, topicList, insightSentence, etc.)
//           is now wrapped in useMemo with correct dependency arrays. Previously every
//           interaction (period toggle, impression edit, dropdown open) re-ran dozens
//           of reduce/filter/sort operations on every render.

import { useState, useEffect, useMemo } from "react";
import { usePerformance } from "../lib/hooks";
import { authFetch } from "../lib/api";
import { C, F, getTopicColor } from "../lib/theme";
import { Tag, SectionTitle, Icons } from "./ui";

export default function PerformanceView() {
  const { data: perfData, loading, refetch } = usePerformance();
  const [period, setPeriod] = useState("all_time");
  const [editingImp, setEditingImp] = useState(null);
  const [impValue, setImpValue] = useState("");
  const [savingImp, setSavingImp] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);

  const allPosts = perfData.posts || [];
  const commentCount = perfData.commentCount || 0;
  const commentDoneWeek = perfData.commentDoneWeek || 0;
  const commentDoneMonth = perfData.commentDoneMonth || 0;
  const commentQueue = perfData.commentQueue || 0;
  const userCategories = perfData.categories || [];
  const allCategories = useMemo(
    () => [...userCategories, ...(userCategories.includes("General") ? [] : ["General"])],
    [userCategories]
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!editingCat) return;
    const handler = () => setEditingCat(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [editingCat]);

  const handleCategoryChange = async (postId, newCategory) => {
    setEditingCat(null);
    try {
      await authFetch("/api/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, topic_tags: [newCategory] }),
      });
      refetch();
    } catch (err) { console.error("Save category failed:", err); }
  };

  const handleSaveImpressions = async (postId) => {
    const val = parseInt(impValue);
    if (isNaN(val) || val < 0) return;
    setSavingImp(true);
    try {
      await authFetch("/api/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, impressions: val }),
      });
      refetch();
      setEditingImp(null);
      setImpValue("");
    } catch (err) { console.error("Save impressions failed:", err); }
    setSavingImp(false);
  };

  // ── Scoring helpers ──────────────────────────────────────────────────────
  // These are pure functions so they don't need memoization themselves, but
  // the values they produce are memoized via the useMemo blocks below.
  const getPostScore = (p) => {
    if (!p.impressions || p.impressions <= 0) return null;
    return (p.impressions * 3) + ((p.comments || 0) * 50) + ((p.likes || 0) * 10);
  };

  const getGrade = (score, median) => {
    if (score === null || median === 0) return { letter: "—", color: C.textGhost };
    const ratio = score / median;
    if (ratio >= 2.5) return { letter: "A+", color: "#4ade80" };
    if (ratio >= 1.6) return { letter: "A",  color: "#86efac" };
    if (ratio >= 0.85) return { letter: "B", color: C.gold };
    if (ratio >= 0.4) return { letter: "C",  color: "#fbbf24" };
    return { letter: "D", color: "#f87171" };
  };

  // ── Memoised derivations ──────────────────────────────────────────────────

  // All-time median — computed once when allPosts changes
  const allTimeMedian = useMemo(() => {
    const scored = allPosts
      .filter(p => (p.impressions || 0) > 0)
      .map(p => getPostScore(p))
      .sort((a, b) => a - b);
    if (scored.length === 0) return 0;
    const mid = Math.floor(scored.length / 2);
    return scored.length % 2 === 0
      ? (scored[mid - 1] + scored[mid]) / 2
      : scored[mid];
  }, [allPosts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Period-filtered posts
  const filteredPosts = useMemo(() => {
    const now = new Date();
    return allPosts.filter(p => {
      if (period === "all_time") return true;
      if (!p.posted_at) return false;
      const posted = new Date(p.posted_at);
      if (period === "yearly") {
        const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 365);
        return posted >= cutoff;
      }
      if (period === "monthly") {
        const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 30);
        return posted >= cutoff;
      }
      if (period === "weekly") {
        const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7);
        return posted >= cutoff;
      }
      return true;
    });
  }, [allPosts, period]);

  // Aggregate metrics for the current period
  const periodMetrics = useMemo(() => {
    const scoredPosts = filteredPosts.filter(p => (p.impressions || 0) > 0);
    const periodAvgScore = scoredPosts.length > 0
      ? scoredPosts.reduce((sum, p) => sum + getPostScore(p), 0) / scoredPosts.length
      : null;
    const avgGrade = (periodAvgScore !== null && period !== "all_time")
      ? getGrade(periodAvgScore, allTimeMedian)
      : { letter: "—", color: C.textGhost };
    return {
      periodAvgScore,
      avgGrade,
      avgEngDisplay: periodAvgScore !== null ? Math.round(periodAvgScore).toLocaleString() : "—",
      totalLikes: filteredPosts.reduce((s, p) => s + (p.likes || 0), 0),
      totalComments: filteredPosts.reduce((s, p) => s + (p.comments || 0), 0),
      totalImpressions: filteredPosts.reduce((s, p) => s + (p.impressions || 0), 0),
    };
  }, [filteredPosts, allTimeMedian, period]); // eslint-disable-line react-hooks/exhaustive-deps

  // Category metrics and top-category-per-metric colours
  const { catMetrics, impColor, likesColor, commentsColor } = useMemo(() => {
    const cm = {};
    filteredPosts.forEach(p => {
      const cat = (p.topic_tags || [])[0] || "General";
      if (!cm[cat]) cm[cat] = { impressions: 0, likes: 0, comments: 0 };
      cm[cat].impressions += (p.impressions || 0);
      cm[cat].likes += (p.likes || 0);
      cm[cat].comments += (p.comments || 0);
    });
    const topFor = (metric) => {
      let best = null, bestVal = 0;
      for (const [cat, m] of Object.entries(cm)) {
        if (m[metric] > bestVal) { bestVal = m[metric]; best = cat; }
      }
      return best && bestVal > 0 ? getTopicColor(best).fg : null;
    };
    return {
      catMetrics: cm,
      impColor: topFor("impressions") || C.gold,
      likesColor: topFor("likes") || C.purple,
      commentsColor: topFor("comments") || C.green,
    };
  }, [filteredPosts]);

  // Stats cards data
  const stats = useMemo(() => [
    { label: "Impressions",      value: periodMetrics.totalImpressions > 0 ? periodMetrics.totalImpressions.toLocaleString() : "—", color: impColor },
    { label: "Total likes",      value: periodMetrics.totalLikes > 0 ? periodMetrics.totalLikes.toLocaleString() : "—", color: likesColor },
    { label: "Total comments",   value: periodMetrics.totalComments > 0 ? periodMetrics.totalComments.toLocaleString() : "—", color: commentsColor },
    { label: "Engagement Score", value: periodMetrics.avgEngDisplay, grade: periodMetrics.avgGrade, color: periodMetrics.avgGrade.color, featured: true },
  ], [periodMetrics, impColor, likesColor, commentsColor]);

  // Topic list sorted by conversation rate
  const { topicList, maxConvRate } = useMemo(() => {
    const topicMap = {};
    filteredPosts.forEach(p => {
      const tag = (p.topic_tags || [])[0] || "General";
      if (!topicMap[tag]) topicMap[tag] = { totalLikes: 0, totalComments: 0, totalImpressions: 0, count: 0 };
      topicMap[tag].totalLikes += (p.likes || 0);
      topicMap[tag].totalComments += (p.comments || 0);
      topicMap[tag].totalImpressions += (p.impressions || 0);
      topicMap[tag].count += 1;
    });
    const list = Object.entries(topicMap).map(([name, d]) => ({
      name,
      count: d.count,
      avgImpressions: d.count > 0 ? Math.round(d.totalImpressions / d.count) : 0,
      avgComments: d.count > 0 ? Math.round((d.totalComments / d.count) * 10) / 10 : 0,
      avgLikes: d.count > 0 ? Math.round(d.totalLikes / d.count) : 0,
      convRate: d.totalImpressions > 0
        ? Math.round((d.totalComments / d.totalImpressions) * 10000) / 10
        : 0,
    })).sort((a, b) => b.convRate - a.convRate);
    return { topicList: list, maxConvRate: list.length > 0 ? Math.max(...list.map(t => t.convRate), 1) : 1 };
  }, [filteredPosts]);

  // Insight sentence
  const insightSentence = useMemo(() => {
    const withConv = topicList.filter(t => t.convRate > 0 && t.count >= 1);
    if (withConv.length < 2) return null;
    const best = withConv[0];
    const bestTc = getTopicColor(best.name);
    const highReach = [...topicList].sort((a, b) => b.avgImpressions - a.avgImpressions)[0];
    if (best.name === highReach?.name) {
      const second = withConv[1];
      if (!second) return null;
      const ratio = best.convRate > 0 && second.convRate > 0 ? (best.convRate / second.convRate).toFixed(1) : null;
      return ratio && parseFloat(ratio) > 1.2
        ? { text: `${best.name} leads in both reach and conversations — ${ratio}× the conversion rate of ${second.name}.`, color: bestTc.fg }
        : { text: `${best.name} has the highest conversation rate at ${best.convRate} comments per 1K impressions.`, color: bestTc.fg };
    } else if (highReach && highReach.avgImpressions > 0) {
      return {
        text: `${best.name} converts ${best.convRate}× per 1K imp — your best for starting conversations. ${highReach.name} gets the most eyeballs (${highReach.avgImpressions >= 1000 ? (highReach.avgImpressions / 1000).toFixed(1) + "K" : highReach.avgImpressions} avg imp) but fewer engage.`,
        color: bestTc.fg,
      };
    }
    return { text: `${best.name} has your highest conversation rate at ${best.convRate} comments per 1K impressions.`, color: bestTc.fg };
  }, [topicList]);

  const postLimit = (period === "all_time" || period === "yearly") ? 20 : 10;
  const commentImpact = [
    { label: "All time",   value: commentCount,     color: C.gold },
    { label: "This week",  value: commentDoneWeek,  color: C.blue },
    { label: "This month", value: commentDoneMonth, color: C.purple },
    { label: "In queue",   value: commentQueue,     color: C.green },
  ];

  if (loading) return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <SectionTitle sub="Last 30 days">Performance</SectionTitle>
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <p style={{ fontFamily: F.serif, fontSize: 20, color: C.textSoft }}>Loading performance data...</p>
      </div>
    </div>
  );

  const { avgGrade } = periodMetrics;

  return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <SectionTitle sub={allPosts.length > 0 ? `${allPosts.length} posts synced from LinkedIn` : "Run Post History Sync in Settings"}>
        Performance
      </SectionTitle>

      {/* Period selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: C.elevated, borderRadius: 8, padding: 4, width: "fit-content" }}>
        {[
          { key: "all_time", label: "All Time" },
          { key: "yearly",   label: "Last Year" },
          { key: "monthly",  label: "Last 30 Days" },
          { key: "weekly",   label: "Last 7 Days" },
        ].map(p => (
          <button key={p.key} onClick={() => { setPeriod(p.key); setSelectedTopic(null); }} style={{
            padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer",
            fontSize: 12, fontFamily: F.mono, letterSpacing: "0.02em", transition: "all 0.2s ease",
            background: period === p.key ? C.gold : "transparent",
            color: period === p.key ? C.base : C.textFaint,
          }}>{p.label}</button>
        ))}
      </div>

      {/* Stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.stroke, borderRadius: 8, overflow: "hidden", marginBottom: 48 }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: s.featured ? `linear-gradient(135deg, ${C.elevated} 0%, rgba(212,175,55,0.08) 100%)` : C.elevated,
            padding: s.featured ? "24px 20px 24px 20px" : "24px 20px",
            animation: `fadeIn 0.3s ease ${i * 0.06}s both`,
            borderTop: s.featured ? `2px solid ${avgGrade.color || C.gold}` : "2px solid transparent",
          }}>
            <p style={{ fontSize: 10, fontFamily: F.mono, color: s.featured ? (avgGrade.color || C.gold) : C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: s.featured ? 600 : 400 }}>{s.label}</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              {s.grade && s.grade.letter !== "—" && (
                <span style={{ fontFamily: F.serif, fontSize: s.featured ? 36 : 16, fontWeight: s.featured ? 500 : 600, color: s.grade.color }}>{s.grade.letter}</span>
              )}
              <span style={{ fontFamily: s.featured ? F.mono : F.serif, fontSize: s.featured ? 14 : 30, color: s.value === "—" ? C.textGhost : (s.featured ? C.textFaint : s.color), fontWeight: 400, letterSpacing: "-0.02em" }}>{s.value}</span>
            </div>
          </div>
        ))}
      </div>

      {filteredPosts.length === 0 && allPosts.length === 0 && (
        <div style={{ padding: "32px 0 48px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: C.textFaint }}>No posts synced yet. Run Post History Sync in Settings to pull your LinkedIn posts.</p>
        </div>
      )}

      {filteredPosts.length === 0 && allPosts.length > 0 && (
        <div style={{ padding: "32px 0 48px", textAlign: "center" }}>
          <p style={{ fontSize: 14, color: C.textFaint }}>No posts in this time period.</p>
        </div>
      )}

      {insightSentence && (
        <div style={{ marginBottom: 24, padding: "12px 16px", background: C.elevated, borderRadius: 8, borderLeft: `3px solid ${insightSentence.color}` }}>
          <p style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.5 }}>{insightSentence.text}</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, marginBottom: 48 }}>
        {/* Top posts */}
        <div>
          {selectedTopic ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <button onClick={() => setSelectedTopic(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.textGhost, fontSize: 14, padding: "2px 4px", display: "flex", alignItems: "center", transition: "color 0.15s" }} onMouseEnter={e => e.currentTarget.style.color = C.text} onMouseLeave={e => e.currentTarget.style.color = C.textGhost}>←</button>
              <Tag color={getTopicColor(selectedTopic).fg} bg={getTopicColor(selectedTopic).bg}>{selectedTopic}</Tag>
              <span style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost }}>
                {filteredPosts.filter(p => ((p.topic_tags || [])[0] || "General") === selectedTopic).length} posts
              </span>
            </div>
          ) : (
            <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              Top posts{filteredPosts.length > 0 ? ` · ${Math.min(filteredPosts.length, postLimit)} of ${filteredPosts.length}` : ""}
            </p>
          )}
          {filteredPosts.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ width: 8, height: 3, borderRadius: 1, background: C.gold }} /><span style={{ fontSize: 9, fontFamily: F.mono, color: C.textGhost }}>Reach</span></div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ width: 8, height: 3, borderRadius: 1, background: "#4ade80" }} /><span style={{ fontSize: 9, fontFamily: F.mono, color: C.textGhost }}>Comments</span></div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ width: 8, height: 3, borderRadius: 1, background: C.purple }} /><span style={{ fontSize: 9, fontFamily: F.mono, color: C.textGhost }}>Likes</span></div>
            </div>
          )}
          {filteredPosts.length === 0 && <p style={{ fontSize: 12, color: C.textFaint }}>No posts in this period.</p>}
          {(() => {
            const displayPosts = selectedTopic
              ? filteredPosts.filter(p => ((p.topic_tags || [])[0] || "General") === selectedTopic)
              : filteredPosts;
            const limit = selectedTopic ? 50 : postLimit;
            return [...displayPosts]
              .sort((a, b) => (getPostScore(b) || 0) - (getPostScore(a) || 0))
              .slice(0, limit)
              .map((p, i) => {
                const tag = (p.topic_tags || [])[0] || "General";
                const tc = getTopicColor(tag);
                const date = p.posted_at ? new Date(p.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                const engRate = getPostScore(p);
                const grade = getGrade(engRate, allTimeMedian);
                const impPart = (p.impressions || 0) * 3;
                const comPart = (p.comments || 0) * 50;
                const likPart = (p.likes || 0) * 10;
                const totalParts = impPart + comPart + likPart;
                const impPct = totalParts > 0 ? (impPart / totalParts) * 100 : 0;
                const comPct = totalParts > 0 ? (comPart / totalParts) * 100 : 0;
                const likPct = totalParts > 0 ? (likPart / totalParts) * 100 : 0;

                return (
                  <div key={p.id || i}
                    style={{ padding: "16px 8px", borderBottom: `1px solid ${C.stroke}`, animation: `slideUp 0.25s ease ${i * 0.06}s both`, borderRadius: 4, margin: "0 -8px", position: "relative", zIndex: editingCat === p.id ? 10 : 1 }}
                    onMouseEnter={e => { if (editingCat !== p.id) e.currentTarget.style.background = C.surfaceHover; }}
                    onMouseLeave={e => { if (editingCat !== p.id) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, marginRight: 16 }}>
                        <p style={{ fontSize: 14, color: C.text, lineHeight: 1.5, marginBottom: 6 }}>{(p.post_text || "").substring(0, 80)}...</p>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: C.textGhost }}>{date}</span>
                          <div style={{ position: "relative" }}>
                            <div onClick={e => { e.stopPropagation(); setEditingCat(editingCat === p.id ? null : p.id); }} style={{ cursor: "pointer", display: "inline-flex" }} title="Click to change category">
                              <Tag color={tc.fg} bg={tc.bg}>{tag}</Tag>
                            </div>
                            {editingCat === p.id && (
                              <div onClick={e => e.stopPropagation()} onMouseEnter={e => e.stopPropagation()} onMouseLeave={e => e.stopPropagation()}
                                style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 9999, background: "#242428", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, boxShadow: "0 12px 40px rgba(0,0,0,0.7)", minWidth: 200, maxHeight: 260, overflowY: "auto", padding: "6px 0", isolation: "isolate" }}>
                                {allCategories.map(cat => {
                                  const catColor = getTopicColor(cat);
                                  const isActive = cat === tag;
                                  return (
                                    <button key={cat} onClick={e => { e.stopPropagation(); handleCategoryChange(p.id, cat); }}
                                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 14px", border: "none", cursor: "pointer", background: isActive ? "rgba(255,255,255,0.08)" : "transparent", color: isActive ? "#fff" : "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: F.mono, textAlign: "left", transition: "background 0.1s" }}
                                      onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                                      onMouseLeave={e => { e.stopPropagation(); e.currentTarget.style.background = isActive ? "rgba(255,255,255,0.08)" : "transparent"; }}
                                    >
                                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: catColor.fg, flexShrink: 0 }} />
                                      {cat}
                                      {isActive && <span style={{ marginLeft: "auto", fontSize: 10, color: C.gold }}>✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: C.textGhost, display: "flex" }}><Icons.external /></a>}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {grade.letter !== "—" && <span style={{ fontSize: 12, fontFamily: F.mono, fontWeight: 600, color: grade.color }}>{grade.letter}</span>}
                          <p style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost, marginTop: 2 }}>{p.likes || 0} · {p.comments || 0}</p>
                        </div>
                        {editingImp === p.id ? (
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <input type="number" value={impValue} onChange={e => setImpValue(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") handleSaveImpressions(p.id); if (e.key === "Escape") { setEditingImp(null); setImpValue(""); } }}
                              autoFocus placeholder="0"
                              style={{ width: 70, padding: "3px 6px", fontSize: 11, fontFamily: F.mono, background: C.surface, border: `1px solid ${C.gold}`, borderRadius: 4, color: C.text, outline: "none" }} />
                            <button onClick={() => handleSaveImpressions(p.id)} disabled={savingImp} style={{ fontSize: 10, fontFamily: F.mono, padding: "3px 8px", borderRadius: 4, border: "none", cursor: "pointer", background: C.gold, color: C.base }}>{savingImp ? "..." : "Save"}</button>
                            <button onClick={() => { setEditingImp(null); setImpValue(""); }} style={{ fontSize: 10, fontFamily: F.mono, padding: "3px 6px", borderRadius: 4, border: "none", cursor: "pointer", background: "transparent", color: C.textGhost }}>✕</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingImp(p.id); setImpValue(String(p.impressions || "")); }}
                            style={{ fontSize: 10, fontFamily: F.mono, padding: "2px 6px", borderRadius: 3, border: `1px solid ${C.stroke}`, cursor: "pointer", background: "transparent", color: (p.impressions || 0) > 0 ? C.gold : C.textGhost, transition: "all 0.15s ease" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.stroke; e.currentTarget.style.color = (p.impressions || 0) > 0 ? C.gold : C.textGhost; }}>
                            {(p.impressions || 0) > 0 ? `${p.impressions.toLocaleString()} imp` : "+ imp"}
                          </button>
                        )}
                        {totalParts > 0 && (
                          <div style={{ display: "flex", width: 80, height: 3, borderRadius: 2, overflow: "hidden", marginTop: 2 }} title={`Reach ${Math.round(impPct)}% · Comments ${Math.round(comPct)}% · Likes ${Math.round(likPct)}%`}>
                            <div style={{ width: `${impPct}%`, background: C.gold, transition: "width 0.5s ease" }} />
                            <div style={{ width: `${comPct}%`, background: "#4ade80", transition: "width 0.5s ease" }} />
                            <div style={{ width: `${likPct}%`, background: C.purple, transition: "width 0.5s ease" }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
          })()}
        </div>

        {/* Topics sidebar */}
        <div>
          <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>By topic</p>
          <p style={{ fontSize: 9, fontFamily: F.mono, color: C.textGhost, marginBottom: 16 }}>Sorted by conversation rate · click to view posts</p>
          {topicList.length === 0 && <p style={{ fontSize: 12, color: C.textFaint }}>Topics appear as you log posts.</p>}
          {topicList.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 0, marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontFamily: F.mono, color: C.textGhost, width: 56, textAlign: "right" }}>avg imp</span>
              <span style={{ fontSize: 9, fontFamily: F.mono, color: C.textGhost, width: 52, textAlign: "right" }}>avg cmt</span>
              <span style={{ fontSize: 9, fontFamily: F.mono, color: C.textGhost, width: 56, textAlign: "right" }}>conv rate</span>
            </div>
          )}
          {topicList.map((t, i) => {
            const tc = getTopicColor(t.name);
            const barPct = maxConvRate > 0 ? (t.convRate / maxConvRate) * 100 : 0;
            const isSelected = selectedTopic === t.name;
            return (
              <div key={i} onClick={() => setSelectedTopic(isSelected ? null : t.name)}
                style={{ padding: "10px 8px", borderBottom: `1px solid ${C.stroke}`, animation: `slideUp 0.25s ease ${i * 0.04}s both`, cursor: "pointer", borderRadius: 4, margin: "0 -8px", transition: "all 0.15s", background: isSelected ? C.surfaceHover : "transparent", borderLeft: isSelected ? `3px solid ${tc.fg}` : "3px solid transparent" }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = C.surfaceHover; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: isSelected ? C.text : C.textSoft, fontWeight: isSelected ? 600 : 500, display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: tc.fg, flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                    <span style={{ fontSize: 9, fontFamily: F.mono, color: C.textGhost, flexShrink: 0 }}>×{t.count}</span>
                  </span>
                  <div style={{ display: "flex", gap: 0, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textFaint, width: 56, textAlign: "right" }}>{t.avgImpressions > 0 ? (t.avgImpressions >= 1000 ? `${(t.avgImpressions / 1000).toFixed(1)}K` : t.avgImpressions) : "—"}</span>
                    <span style={{ fontSize: 11, fontFamily: F.mono, color: "#4ade80", width: 52, textAlign: "right" }}>{t.avgComments > 0 ? t.avgComments : "—"}</span>
                    <span style={{ fontSize: 11, fontFamily: F.mono, color: C.gold, fontWeight: 600, width: 56, textAlign: "right" }}>{t.convRate > 0 ? t.convRate : "—"}</span>
                  </div>
                </div>
                <div style={{ height: 3, background: C.stroke, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${barPct}%`, background: tc.fg, borderRadius: 2, transition: "width 1s ease", opacity: 0.7 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comment impact */}
      <div style={{ marginBottom: 48 }}>
        <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Comment impact</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.stroke, borderRadius: 8, overflow: "hidden" }}>
          {commentImpact.map((m, i) => (
            <div key={i} style={{ background: C.elevated, padding: "18px 16px", textAlign: "center" }}>
              <span style={{ fontFamily: F.serif, fontSize: 22, color: m.color }}>{m.value}</span>
              <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
