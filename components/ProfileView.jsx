// components/ProfileView.jsx
// Item 5: extracted from PulseApp.jsx monolith.
// All sub-forms (Bio, ICP, Rules, Voice, Categories, History, Compliance) live here.

import { useState, useEffect } from "react";
import { usePerformance } from "../lib/hooks";
import { authFetch } from "../lib/api";
import { C, F } from "../lib/theme";
import { Btn, Field, Input, SectionTitle, Separator, SaveButton, Icons } from "./ui";

// ── History form (de-duplicated from SettingsView — fixes Item 17) ──────────
// Previously a near-identical HistoryForm existed in both ProfileView and
// SettingsView. The canonical version lives here; SettingsView links here.
export function HistoryForm() {
  const { data: perfData, loading } = usePerformance();
  const posts = (perfData.posts || []).map(p => ({
    id: p.id,
    text: (p.post_text || "").substring(0, 80),
    date: p.posted_at ? new Date(p.posted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
    likes: p.likes || 0,
    comments: p.comments || 0,
    url: p.linkedin_url || "#",
  }));

  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: C.textFaint }}>{posts.length} posts tracked</p>
      </div>
      {loading && <p style={{ fontSize: 12, color: C.textFaint }}>Loading...</p>}
      {!loading && posts.length === 0 && (
        <p style={{ fontSize: 12, color: C.textFaint }}>No posts logged yet. Posts appear here after you log performance.</p>
      )}
      {posts.map(p => (
        <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
          <div
            style={{ padding: "14px 8px", borderBottom: `1px solid ${C.stroke}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", borderRadius: 4, margin: "0 -8px", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontSize: 13, color: C.textSoft, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 16 }}>{p.text}</span>
            <div style={{ display: "flex", gap: 14, flexShrink: 0, alignItems: "center" }}>
              <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>{p.date}</span>
              <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textFaint }}>{p.likes} · {p.comments}</span>
              <span style={{ color: C.textGhost, display: "flex" }}><Icons.external /></span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ── Bio ──────────────────────────────────────────────────────────────────────
function BioForm({ profile, updateField, onSave, saving, saved }) {
  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      <Field label="Full Name"><Input value={profile.full_name} onChange={v => updateField("full_name", v)} placeholder="Your full name" /></Field>
      <Field label="LinkedIn Profile URL" hint="Used for post history sync — e.g. linkedin.com/in/yourname"><Input value={profile.linkedin_profile_url} onChange={v => updateField("linkedin_profile_url", v)} placeholder="https://www.linkedin.com/in/yourname" /></Field>
      <Field label="Firm"><Input value={profile.firm} onChange={v => updateField("firm", v)} placeholder="Your firm name" /></Field>
      <Field label="Title"><Input value={profile.title} onChange={v => updateField("title", v)} placeholder="Your professional title" /></Field>
      <Field label="Specialization"><Input value={profile.specialization} onChange={v => updateField("specialization", v)} placeholder="What you specialize in" /></Field>
      <Field label="Tagline" hint="Your LinkedIn headline or positioning statement"><Input value={profile.tagline} onChange={v => updateField("tagline", v)} placeholder="Your positioning statement" /></Field>
      <SaveButton onSave={onSave} saving={saving} saved={saved} />
    </div>
  );
}

// ── Content Preferences ───────────────────────────────────────────────────────
const CONTENT_PREF_OPTIONS = [
  { id: "contrarian",   label: "Contrarian takes",       desc: "Challenge conventional wisdom with data." },
  { id: "data",         label: "Data-driven analysis",   desc: "Lead with specific numbers, stats, and dollar amounts." },
  { id: "anecdotes",    label: "Personal anecdotes",     desc: "Draw from real (anonymized) client scenarios." },
  { id: "questions",    label: "Provocative questions",  desc: "Open with a question that stops the scroll." },
  { id: "frameworks",   label: "Actionable frameworks",  desc: "Step-by-step thinking tools your ICP can apply immediately." },
  { id: "mythbusting",  label: "Myth-busting",           desc: "Name a common belief, then dismantle it." },
  { id: "timely",       label: "Timely / news-reactive", desc: "React to market events, tax law changes, or trending topics." },
  { id: "vulnerable",   label: "Vulnerable / personal",  desc: "Share your own journey, mistakes, or behind-the-scenes." },
];

function ContentPreferences({ profile, updateField }) {
  const storedPrefs = (profile.content_preferences || "contrarian,data,anecdotes").split(",").map(s => s.trim()).filter(Boolean);
  const storedCustoms = (profile.custom_preferences || "").split("\n").filter(s => s.trim());

  const [selected, setSelected] = useState(new Set(storedPrefs));
  const [showCustom, setShowCustom] = useState(false);
  const [customs, setCustoms] = useState(storedCustoms);
  const [customText, setCustomText] = useState("");

  const syncToProfile = (newSelected, newCustoms) => {
    updateField("content_preferences", Array.from(newSelected).join(","));
    updateField("custom_preferences", newCustoms.join("\n"));
  };

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      syncToProfile(next, customs);
      return next;
    });
  };

  const addCustom = () => {
    if (!customText.trim()) return;
    const newCustoms = [...customs, customText.trim()];
    setCustoms(newCustoms);
    setCustomText("");
    setShowCustom(false);
    syncToProfile(selected, newCustoms);
  };

  const removeCustom = (idx) => {
    const newCustoms = customs.filter((_, j) => j !== idx);
    setCustoms(newCustoms);
    syncToProfile(selected, newCustoms);
  };

  return (
    <Field label="Content Preferences" hint="Controls which draft formats and angles get generated.">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {CONTENT_PREF_OPTIONS.map(opt => {
          const active = selected.has(opt.id);
          return (
            <button key={opt.id} onClick={() => toggle(opt.id)} style={{
              display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 6,
              background: active ? C.goldGlow : "transparent", border: `1px solid ${active ? "rgba(200,169,110,0.2)" : C.stroke}`,
              cursor: "pointer", textAlign: "left", transition: "all 0.15s ease",
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.surfaceHover; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, marginTop: 1, border: `1.5px solid ${active ? C.gold : C.textGhost}`, background: active ? C.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }}>
                {active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.base} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </div>
              <div>
                <span style={{ fontSize: 13, fontWeight: 500, color: active ? C.text : C.textSoft, display: "block" }}>{opt.label}</span>
                <span style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.5, marginTop: 2, display: "block" }}>{opt.desc}</span>
              </div>
            </button>
          );
        })}
        {customs.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 6, background: C.goldGlow, border: `1px solid rgba(200,169,110,0.2)` }}>
            <div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${C.gold}`, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.base} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text, flex: 1 }}>{c}</span>
            <button onClick={() => removeCustom(i)} style={{ background: "none", border: "none", color: C.textGhost, cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
          </div>
        ))}
        {showCustom ? (
          <div style={{ padding: "12px 14px", borderRadius: 6, background: C.elevated, border: `1px solid ${C.stroke}`, animation: "fadeIn 0.15s ease" }}>
            <input value={customText} onChange={e => setCustomText(e.target.value)} placeholder="e.g. Industry comparison benchmarks" onKeyDown={e => e.key === "Enter" && addCustom()}
              style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${C.stroke}`, color: C.text, fontSize: 13, fontFamily: F.sans, padding: "8px 0" }}
              onFocus={e => e.target.style.borderBottomColor = C.gold} onBlur={e => e.target.style.borderBottomColor = C.stroke} autoFocus />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Btn primary onClick={addCustom} style={{ padding: "7px 16px", fontSize: 12 }}>Add</Btn>
              <Btn ghost onClick={() => { setShowCustom(false); setCustomText(""); }} style={{ padding: "7px 14px", fontSize: 12 }}>Cancel</Btn>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowCustom(true)} style={{ padding: "10px 14px", borderRadius: 6, background: "transparent", border: `1px dashed ${C.stroke}`, color: C.textGhost, fontSize: 12, fontFamily: F.sans, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.strokeHover; e.currentTarget.style.color = C.textFaint; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.stroke; e.currentTarget.style.color = C.textGhost; }}>
            + Add your own
          </button>
        )}
      </div>
      <p style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost, marginTop: 10 }}>{selected.size + customs.length} selected</p>
    </Field>
  );
}

// ── ICP ───────────────────────────────────────────────────────────────────────
function ICPForm({ profile, updateField, onSave, saving, saved }) {
  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      <Field label="Age Range">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Input value={profile.icp_age_min || ""} onChange={v => updateField("icp_age_min", v)} style={{ width: 60, textAlign: "center" }} placeholder="25" />
          <span style={{ color: C.textGhost }}>to</span>
          <Input value={profile.icp_age_max || ""} onChange={v => updateField("icp_age_max", v)} style={{ width: 60, textAlign: "center" }} placeholder="45" />
        </div>
      </Field>
      <Field label="Target Professions" hint="One per line"><Input multiline rows={4} value={profile.target_professions} onChange={v => updateField("target_professions", v)} placeholder="Software Engineers&#10;Attorneys (BigLaw)&#10;Tech Employees" /></Field>
      <Field label="Pain Points" hint="One per line"><Input multiline rows={5} value={profile.pain_points} onChange={v => updateField("pain_points", v)} placeholder="Feel trapped on the W-2 treadmill&#10;Equity compensation anxiety" /></Field>
      <ContentPreferences profile={profile} updateField={updateField} />
      <SaveButton onSave={onSave} saving={saving} saved={saved} />
    </div>
  );
}

// ── Rules ─────────────────────────────────────────────────────────────────────
function RulesForm({ profile, updateField, onSave, saving, saved }) {
  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      <Field label="Posts Per Week"><Input value={profile.posts_per_week || ""} onChange={v => updateField("posts_per_week", v)} style={{ width: 60, textAlign: "center" }} placeholder="4" /></Field>
      <Field label="Preferred Post Length"><Input value={profile.preferred_length} onChange={v => updateField("preferred_length", v)} placeholder="Under 200 words — short, punchy, scannable" /></Field>
      <Field label="Preferred Formats" hint="What structures you like"><Input multiline rows={3} value={profile.preferred_formats} onChange={v => updateField("preferred_formats", v)} placeholder="Contrarian hooks under 100 words&#10;Data-driven analysis with specific numbers" /></Field>
      <Field label="Topics to Always Cover" hint="One per line"><Input multiline rows={5} value={profile.topics_always} onChange={v => updateField("topics_always", v)} placeholder="RSU/ISO/NSO taxation&#10;Solo 401(k) structures&#10;Roth conversion strategies" /></Field>
      <Field label="Topics to Never Cover" hint="One per line"><Input multiline rows={3} value={profile.topics_never} onChange={v => updateField("topics_never", v)} placeholder="Crypto/Bitcoin&#10;Insurance products&#10;Specific stock picks" /></Field>
      <Field label="Tone &amp; Voice Rules"><Input multiline rows={4} value={profile.tone_rules} onChange={v => updateField("tone_rules", v)} placeholder="Like a smart friend at a bar, not a compliance department&#10;Short, punchy sentences — no fluff" /></Field>
      <SaveButton onSave={onSave} saving={saving} saved={saved} />
    </div>
  );
}

// ── Voice Samples ─────────────────────────────────────────────────────────────
function VoiceSampleSection({ type, label, hint }) {
  const [samples, setSamples] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const res = await authFetch("/api/profile?section=voice");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setSamples((data || []).filter(s => s.type === type));
    } catch (e) {
      setError("Failed to load samples");
      setSamples([]);
    }
  };

  useEffect(() => { load(); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async () => {
    if (!newText.trim()) return;
    setAdding(true); setError(null);
    try {
      const res = await authFetch("/api/profile?section=voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, sample_text: newText.trim() }) });
      if (!res.ok) throw new Error("Failed to add");
      setNewText(""); setShowAdd(false);
      await load();
    } catch (e) { setError("Failed to add sample"); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id) => {
    setDeletingId(id); setError(null);
    try {
      const res = await authFetch("/api/profile?section=voice", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error("Failed to delete");
      await load();
    } catch (e) { setError("Failed to delete sample"); }
    finally { setDeletingId(null); }
  };

  return (
    <Field label={label} hint={hint}>
      {samples === null ? <p style={{ fontSize: 12, color: C.textGhost, fontFamily: F.mono }}>Loading...</p> : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 12 }}>
            {samples.map(s => (
              <div key={s.id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.stroke}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 13, color: C.textSoft, flex: 1, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {s.sample_text.length > 120 ? s.sample_text.substring(0, 120) + "…" : s.sample_text}
                </span>
                <button onClick={() => handleDelete(s.id)} disabled={deletingId === s.id} style={{ background: "none", border: "none", color: deletingId === s.id ? C.textGhost : C.textFaint, cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0, lineHeight: 1, opacity: deletingId === s.id ? 0.4 : 1 }}>×</button>
              </div>
            ))}
            {samples.length === 0 && !showAdd && <p style={{ fontSize: 12, color: C.textGhost, fontFamily: F.mono, marginBottom: 8 }}>No samples yet.</p>}
          </div>
          <p style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost, marginBottom: 12 }}>{samples.length} sample{samples.length !== 1 ? "s" : ""}</p>
          {showAdd ? (
            <div>
              <Input multiline rows={5} value={newText} onChange={v => setNewText(v)} placeholder={type === "post" ? "Paste a full LinkedIn post..." : "Paste a LinkedIn comment..."} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <Btn primary onClick={handleAdd} style={{ opacity: adding ? 0.6 : 1 }}>{adding ? "Adding..." : "Add"}</Btn>
                <Btn ghost onClick={() => { setShowAdd(false); setNewText(""); }}>Cancel</Btn>
              </div>
            </div>
          ) : (
            <Btn onClick={() => setShowAdd(true)}>+ Add Sample</Btn>
          )}
          {error && <p style={{ fontSize: 11, color: "#e05252", fontFamily: F.mono, marginTop: 8 }}>{error}</p>}
        </>
      )}
    </Field>
  );
}

function VoiceForm({ profile, updateField, onSave, saving, saved }) {
  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      <VoiceSampleSection type="post" label="Post Voice Samples" hint="Your real LinkedIn posts — the AI learns your writing style from these" />
      <Separator />
      <VoiceSampleSection type="comment" label="Comment Voice Samples" hint="Comment style is different from post style — paste real comments" />
      <Separator />
      <Field label="Voice Notes" hint="Free-form style rules fed into every draft and comment generation.">
        <Input multiline rows={8} value={profile.voice_notes} onChange={v => updateField("voice_notes", v)} placeholder="e.g. Never use exclamation marks. Always lead with a specific dollar amount or stat when possible." />
      </Field>
      <SaveButton onSave={onSave} saving={saving} saved={saved} />
    </div>
  );
}

// ── Post Categories ───────────────────────────────────────────────────────────
function PostCategoriesForm({ profile, updateField, onSave, saving, saved }) {
  const categories = (() => { try { return JSON.parse(profile.post_categories || "[]"); } catch { return []; } })();
  const [newCat, setNewCat] = useState("");
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassResult, setReclassResult] = useState("");

  const addCategory = () => {
    const trimmed = newCat.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    updateField("post_categories", JSON.stringify([...categories, trimmed]));
    setNewCat("");
  };
  const removeCategory = (idx) => updateField("post_categories", JSON.stringify(categories.filter((_, i) => i !== idx)));

  const reclassifyAll = async () => {
    setReclassifying(true); setReclassResult("");
    try {
      await onSave();
      const res = await authFetch("/api/run-pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "post-history" }) });
      const data = await res.json();
      setReclassResult(`Done — ${data.classified || 0} posts classified`);
    } catch (err) { setReclassResult("Error: " + err.message); }
    setReclassifying(false);
  };

  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      <Field label="Post Categories" hint="Categories for your content. AI auto-classifies each post on Post History Sync.">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {categories.map((cat, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 6, background: C.elevated, border: `1px solid ${C.stroke}` }}>
              <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{cat}</span>
              <button onClick={() => removeCategory(i)} style={{ background: "none", border: "none", color: C.textGhost, cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => e.key === "Enter" && addCategory()} placeholder="e.g. Equity Comp, Tax Strategy, Market Commentary..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: 6, background: C.surface, border: `1px solid ${C.stroke}`, color: C.text, fontSize: 13, fontFamily: F.sans }}
              onFocus={e => e.target.style.borderColor = C.gold} onBlur={e => e.target.style.borderColor = C.stroke} />
            <Btn primary onClick={addCategory} style={{ padding: "10px 18px", fontSize: 12 }}>Add</Btn>
          </div>
        </div>
        <p style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost, marginTop: 12 }}>
          {categories.length} categories defined{categories.length > 0 ? " — posts will be auto-classified on next sync" : ""}
        </p>
      </Field>
      <SaveButton onSave={onSave} saving={saving} saved={saved} />
      {categories.length > 0 && (
        <div style={{ marginTop: 24, padding: "16px 20px", borderRadius: 8, background: C.elevated, border: `1px solid ${C.stroke}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>Re-classify existing posts</p>
              <p style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>Run Post History Sync to apply categories to all synced posts</p>
            </div>
            <Btn ghost onClick={reclassifyAll} style={{ padding: "8px 16px", fontSize: 12 }}>
              {reclassifying ? "Running..." : "Sync & Classify"}
            </Btn>
          </div>
          {reclassResult && <p style={{ fontSize: 11, fontFamily: F.mono, color: C.gold, marginTop: 10 }}>{reclassResult}</p>}
        </div>
      )}
    </div>
  );
}

// ── Compliance ────────────────────────────────────────────────────────────────
function ComplianceForm({ profile, updateField, onSave, saving, saved }) {
  return (
    <div style={{ animation: "fadeIn 0.2s ease" }}>
      <p style={{ fontSize: 13, color: C.gold, marginBottom: 24 }}>All generated content is checked against these rules before you see it.</p>
      <Field label="Firm Compliance Rules" hint="One rule per line"><Input multiline rows={10} value={profile.compliance_rules} onChange={v => updateField("compliance_rules", v)} placeholder='Never use the word "guarantee" or "guaranteed returns"' /></Field>
      <Field label="Required Disclaimer Text"><Input multiline rows={3} value={profile.disclaimer_text} onChange={v => updateField("disclaimer_text", v)} placeholder="Opinions expressed are my own and do not reflect the views of..." /></Field>
      <Field label="Additional Compliance Notes"><Input multiline rows={3} value={profile.compliance_notes} onChange={v => updateField("compliance_notes", v)} placeholder="Any other compliance requirements..." /></Field>
      <SaveButton onSave={onSave} saving={saving} saved={saved} />
    </div>
  );
}

// ── ProfileView (container) ───────────────────────────────────────────────────
export default function ProfileView() {
  const [tab, setTab] = useState("bio");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    authFetch("/api/profile")
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setProfile(data); setLoading(false); })
      .catch(() => { setProfile({}); setLoading(false); });
  }, []);

  const updateField = (field, value) => { setProfile(prev => ({ ...prev, [field]: value })); setSaved(false); };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await authFetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } catch (err) { console.error("Failed to save profile:", err); }
    finally { setSaving(false); }
  };

  const tabs = [
    { id: "bio", label: "Bio" }, { id: "icp", label: "ICP" },
    { id: "rules", label: "Post Rules" }, { id: "voice", label: "Voice" },
    { id: "categories", label: "Categories" }, { id: "history", label: "Post History" },
    { id: "compliance", label: "Compliance" },
  ];

  return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <SectionTitle sub="Your professional identity — feeds every AI generation">Profile</SectionTitle>
      <div style={{ display: "flex", gap: 0, marginBottom: 36, borderBottom: `1px solid ${C.stroke}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "10px 18px",
            fontSize: 13, fontFamily: F.sans, fontWeight: tab === t.id ? 500 : 400,
            color: tab === t.id ? C.text : C.textFaint,
            borderBottom: `2px solid ${tab === t.id ? C.gold : "transparent"}`,
            transition: "all 0.15s", marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ maxWidth: 540 }}>
        {loading ? <p style={{ color: C.textFaint, fontSize: 13, padding: "40px 0" }}>Loading profile...</p> : (
          <>
            {tab === "bio"        && <BioForm profile={profile} updateField={updateField} onSave={saveProfile} saving={saving} saved={saved} />}
            {tab === "icp"        && <ICPForm profile={profile} updateField={updateField} onSave={saveProfile} saving={saving} saved={saved} />}
            {tab === "rules"      && <RulesForm profile={profile} updateField={updateField} onSave={saveProfile} saving={saving} saved={saved} />}
            {tab === "voice"      && <VoiceForm profile={profile} updateField={updateField} onSave={saveProfile} saving={saving} saved={saved} />}
            {tab === "categories" && <PostCategoriesForm profile={profile} updateField={updateField} onSave={saveProfile} saving={saving} saved={saved} />}
            {tab === "history"    && <HistoryForm />}
            {tab === "compliance" && <ComplianceForm profile={profile} updateField={updateField} onSave={saveProfile} saving={saving} saved={saved} />}
          </>
        )}
      </div>
    </div>
  );
}
