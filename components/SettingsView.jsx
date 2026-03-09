// components/SettingsView.jsx
// Fixes:
//   Item 14: Keyword fields are now tag-chip inputs instead of raw textareas.
//            Each keyword is a removable chip. Enter key or comma adds a chip.
//            Chips are stored internally as arrays, serialized to newline string for API.
//   Item 17: HistoryForm is imported from ProfileView.jsx (single source of truth).
//            SettingsView no longer has a duplicate implementation.

import { useState, useEffect, useRef } from "react";
import { authFetch } from "../lib/api";
import { C, F } from "../lib/theme";
import { Btn, Field, SectionTitle, Separator, SaveButton, Icons } from "./ui";

// ── Pipeline config ───────────────────────────────────────────────────────────
const PIPELINES = [
  { name: "Content scrape",    type: "content",      estimate: 180 },
  { name: "Comment scrape",    type: "comments",     estimate: 90  },
  { name: "Post history sync", type: "post-history", estimate: 60  },
];

function formatLastRun(status) {
  if (!status) return "Never";
  const ts = status.completed_at || status.started_at;
  if (!ts) return "Never";
  const d = new Date(ts);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Item 14: Tag-chip keyword input ─────────────────────────────────────────
// Replaces the raw textarea for keywords. Each keyword is a chip; Enter or comma
// commits it. Chips can be removed with ×. The parent receives an array of strings
// and serialises to a newline-delimited string for the API.
function KeywordChips({ keywords, onChange, placeholder }) {
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef(null);

  const commit = (raw) => {
    const trimmed = raw.trim().replace(/,$/, "").trim();
    if (!trimmed || keywords.includes(trimmed)) return;
    onChange([...keywords, trimmed]);
    setInputVal("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(inputVal);
    } else if (e.key === "Backspace" && inputVal === "" && keywords.length > 0) {
      onChange(keywords.slice(0, -1));
    }
  };

  const remove = (idx) => onChange(keywords.filter((_, i) => i !== idx));

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{
        display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
        minHeight: 44, padding: "8px 12px", borderRadius: 8,
        background: C.elevated, border: `1px solid ${C.stroke}`,
        cursor: "text", transition: "border-color 0.2s",
      }}
      onFocus={() => inputRef.current?.focus()}
    >
      {keywords.map((kw, i) => (
        <span key={i} style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 10px 3px 10px", borderRadius: 20,
          background: C.goldSoft, border: `1px solid rgba(200,169,110,0.2)`,
          fontSize: 12, fontFamily: F.mono, color: C.gold,
        }}>
          {kw}
          <button
            onClick={e => { e.stopPropagation(); remove(i); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: C.gold, padding: 0, lineHeight: 1, fontSize: 14, opacity: 0.6, display: "flex", alignItems: "center" }}
          >×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => { if (inputVal.trim()) commit(inputVal); }}
        placeholder={keywords.length === 0 ? placeholder : ""}
        style={{
          flex: 1, minWidth: 140, background: "transparent", border: "none", outline: "none",
          fontSize: 13, fontFamily: F.sans, color: C.text, padding: "2px 0",
        }}
      />
    </div>
  );
}

// ── SettingsView ──────────────────────────────────────────────────────────────
export default function SettingsView() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState({});
  const [runResult, setRunResult] = useState({});
  const [pipelineStatus, setPipelineStatus] = useState({});
  const [elapsed, setElapsed] = useState({});
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const timerRefs = useRef({});

  // Item 14: keyword fields stored as arrays in local state
  const [contentKws, setContentKws] = useState([]);
  const [commentKws, setCommentKws] = useState([]);

  useEffect(() => {
    authFetch("/api/profile")
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => {
        setSettings(data);
        // Parse newline-delimited strings into chip arrays
        setContentKws((data.content_keywords || "").split("\n").map(s => s.trim()).filter(Boolean));
        setCommentKws((data.comment_keywords || "").split("\n").map(s => s.trim()).filter(Boolean));
        setLoading(false);
      })
      .catch(() => { setSettings({}); setLoading(false); });
    fetchPipelineStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => Object.values(timerRefs.current).forEach(t => clearInterval(t));
  }, []);

  const fetchPipelineStatus = async () => {
    try {
      const res = await authFetch("/api/pipeline-status");
      if (res.ok) setPipelineStatus(await res.json());
    } catch (err) { console.error("Failed to fetch pipeline status:", err); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Serialize chip arrays back to newline strings before saving
      const payload = {
        ...settings,
        content_keywords: contentKws.join("\n"),
        comment_keywords: commentKws.join("\n"),
      };
      const res = await authFetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } catch (err) { console.error("Failed to save settings:", err); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!window.confirm("This will clear all scored content and drafts from your queue. Continue?")) return;
    setResetting(true);
    try {
      const res = await authFetch("/api/reset-content", { method: "POST" });
      if (res.ok) { setResetDone(true); setTimeout(() => setResetDone(false), 4000); }
    } catch (err) { console.error("Reset failed:", err); }
    finally { setResetting(false); }
  };

  const handleRunPipeline = async (pipelineName, pipelineType) => {
    setRunning(r => ({ ...r, [pipelineName]: true }));
    setRunResult(r => ({ ...r, [pipelineName]: null }));
    setElapsed(e => ({ ...e, [pipelineName]: 0 }));
    const startTime = Date.now();
    timerRefs.current[pipelineName] = setInterval(() => {
      setElapsed(e => ({ ...e, [pipelineName]: Math.floor((Date.now() - startTime) / 1000) }));
    }, 1000);
    try {
      const res = await authFetch("/api/run-pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: pipelineType }) });
      const result = res.ok ? "success" : "error";
      setRunResult(r => ({ ...r, [pipelineName]: result }));
      await fetchPipelineStatus();
      setTimeout(() => setRunResult(r => ({ ...r, [pipelineName]: null })), 5000);
    } catch (err) {
      setRunResult(r => ({ ...r, [pipelineName]: "error" }));
      setTimeout(() => setRunResult(r => ({ ...r, [pipelineName]: null })), 5000);
    } finally {
      clearInterval(timerRefs.current[pipelineName]);
      delete timerRefs.current[pipelineName];
      setRunning(r => ({ ...r, [pipelineName]: false }));
    }
  };

  if (loading) return (
    <div style={{ animation: "enter 0.35s ease", maxWidth: 540 }}>
      <SectionTitle sub="Pipeline configuration and operational settings">Settings</SectionTitle>
      <p style={{ color: C.textFaint, fontSize: 13 }}>Loading...</p>
    </div>
  );

  return (
    <div style={{ animation: "enter 0.35s ease", maxWidth: 540 }}>
      <SectionTitle sub="Pipeline configuration and operational settings">Settings</SectionTitle>

      {/* Item 14: Tag-chip keyword inputs */}
      <Field label="Content Source Keywords" hint="Topics that drive trending content scraping — Enter or comma to add">
        <KeywordChips keywords={contentKws} onChange={setContentKws} placeholder="equity compensation, RSU tax strategy, wealth building…" />
      </Field>

      <Field label="Comment Target Keywords" hint="Topics where your ICP engages on LinkedIn — Enter or comma to add">
        <KeywordChips keywords={commentKws} onChange={setCommentKws} placeholder="tech careers, startup culture, BigLaw life…" />
      </Field>

      <SaveButton onSave={saveSettings} saving={saving} saved={saved} />
      <Separator />

      {/* Reset queue */}
      <div style={{ marginBottom: 24, padding: "16px", background: "#0e0e10", borderRadius: 8, border: `1px solid ${C.stroke}` }}>
        <p style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Profile Changed?</p>
        <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 12, lineHeight: 1.5 }}>After updating keywords, specialization, or ICP — reset the content queue so everything gets re-scored against your current profile on the next pipeline run.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Btn danger onClick={handleReset} style={{ opacity: resetting ? 0.6 : 1 }}>
            {resetting ? "Resetting..." : "Reset & Re-score Queue"}
          </Btn>
          {resetDone && <span style={{ fontSize: 12, color: C.green, fontFamily: F.mono }}>✓ Queue cleared — run Content scrape to refill</span>}
        </div>
      </div>
      <Separator />

      {/* Pipelines */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Pipeline</p>
        {PIPELINES.map(p => {
          const status = pipelineStatus[p.type];
          const isRunning = running[p.name];
          const result = runResult[p.name];
          const elapsedSec = elapsed[p.name] || 0;
          const lastRunText = formatLastRun(status);
          const statusDotColor = result === "error" ? C.coral : (status?.status === "error" ? C.coral : C.green);

          return (
            <div key={p.name} style={{ padding: "10px 0", borderBottom: `1px solid ${C.stroke}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusDotColor, boxShadow: `0 0 4px ${statusDotColor}40` }} />
                <span style={{ fontSize: 13, color: C.textSoft }}>{p.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {isRunning ? (
                  <>
                    <span style={{ fontSize: 11, fontFamily: F.mono, color: C.gold }}>{formatElapsed(elapsedSec)}</span>
                    <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>~{formatElapsed(p.estimate)}</span>
                    <span style={{ fontSize: 11, fontFamily: F.mono, color: C.gold, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: C.gold, animation: "pulse 1.2s infinite" }} />
                      Running
                    </span>
                  </>
                ) : result === "success" ? (
                  <>
                    <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>Just now</span>
                    <span style={{ fontSize: 11, fontFamily: F.mono, color: C.green }}>✓ Done</span>
                  </>
                ) : result === "error" ? (
                  <>
                    <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>{lastRunText}</span>
                    <span style={{ fontSize: 11, fontFamily: F.mono, color: C.coral }}>✗ Error</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>{lastRunText}</span>
                    <Btn ghost onClick={() => handleRunPipeline(p.name, p.type)} style={{ padding: "5px 12px", fontSize: 11 }}>
                      <Icons.play /> Run
                    </Btn>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
