// components/ui.jsx — Shared primitive components
// Used by every view. Import what you need rather than defining locally.

import { useState } from "react";
import { C, F } from "../lib/theme";

// ── Google Fonts + global reset ─────────────────────────────────────────────
export const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 15px; }
    body { background: ${C.base}; overflow: hidden; }
    ::selection { background: ${C.goldSoft}; color: ${C.text}; }
    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${C.textGhost}; border-radius: 3px; }
    input, textarea, select { font-family: ${F.sans}; color: ${C.text}; }
    input:focus, textarea:focus, select:focus { outline: none; }
    @keyframes enter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes popIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  `}</style>
);

// ── Button ──────────────────────────────────────────────────────────────────
export function Btn({ children, primary, ghost, danger, color: customColor, onClick, style: s }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        border: "none", borderRadius: 6, padding: primary ? "10px 22px" : "9px 18px",
        fontSize: 13, fontFamily: F.sans, fontWeight: 500, cursor: "pointer",
        transition: "all 0.15s ease", display: "inline-flex", alignItems: "center", gap: 7,
        letterSpacing: "0.005em",
        ...(primary && { background: h ? "#D4B87C" : C.gold, color: C.base }),
        ...(ghost && { background: h ? "rgba(255,255,255,0.04)" : "transparent", color: C.textSoft }),
        ...(danger && { background: h ? C.coralSoft : "transparent", color: C.coral }),
        ...(!primary && !ghost && !danger && {
          background: h ? C.surfaceHover : C.surface, color: C.textSoft,
          border: `1px solid ${h ? C.strokeHover : C.stroke}`,
        }),
        ...s,
      }}>
      {children}
    </button>
  );
}

// ── Form field wrapper ───────────────────────────────────────────────────────
export function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <label style={{ display: "block", fontSize: 11, fontFamily: F.sans, fontWeight: 600, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{label}</label>
      {hint && <p style={{ fontSize: 12, color: C.textGhost, marginBottom: 8, lineHeight: 1.5 }}>{hint}</p>}
      {children}
    </div>
  );
}

// ── Text input / textarea ────────────────────────────────────────────────────
export function Input({ multiline, rows = 3, value, onChange, placeholder, style: s, small }) {
  const shared = {
    width: "100%", background: "transparent", border: "none",
    borderBottom: `1px solid ${C.stroke}`, color: C.text,
    fontSize: small ? 13 : 14, fontFamily: F.sans,
    padding: multiline ? "12px 0" : "10px 0", lineHeight: 1.65,
    resize: "vertical", transition: "border-color 0.2s", ...s,
  };
  const handlers = {
    onFocus: e => e.target.style.borderBottomColor = C.gold,
    onBlur: e => e.target.style.borderBottomColor = C.stroke,
  };
  const valProps = onChange ? { value: value || "", onChange: e => onChange(e.target.value) } : { defaultValue: value };
  if (multiline) return <textarea rows={rows} placeholder={placeholder} {...valProps} style={shared} {...handlers} />;
  return <input type="text" placeholder={placeholder} {...valProps} style={shared} {...handlers} />;
}

// ── Section heading ──────────────────────────────────────────────────────────
export function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h1 style={{ fontFamily: F.serif, fontSize: 32, fontWeight: 400, color: C.text, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{children}</h1>
      {sub && <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textFaint, marginTop: 8 }}>{sub}</p>}
    </div>
  );
}

// ── Horizontal rule ──────────────────────────────────────────────────────────
export function Separator() {
  return <div style={{ height: 1, background: C.stroke, margin: "32px 0" }} />;
}

// ── Tag chip ─────────────────────────────────────────────────────────────────
export function Tag({ children, color: fg, bg, warm, green }) {
  const c = fg || (warm ? C.gold : green ? C.green : C.textSoft);
  const b = bg || (warm ? C.goldSoft : green ? C.greenSoft : C.surface);
  return (
    <span style={{
      fontSize: 10, fontFamily: F.mono, fontWeight: 500, color: c,
      background: b, padding: "3px 9px", borderRadius: 4,
      letterSpacing: "0.04em", textTransform: "uppercase",
    }}>{children}</span>
  );
}

// ── Save button with feedback ─────────────────────────────────────────────────
export function SaveButton({ onSave, saving, saved }) {
  return (
    <div style={{ marginTop: 32, display: "flex", alignItems: "center", gap: 12 }}>
      <Btn primary onClick={onSave} style={{ opacity: saving ? 0.6 : 1 }}>
        {saving ? "Saving..." : saved ? <><Icons.check /> Saved</> : "Save"}
      </Btn>
      {saved && <span style={{ fontSize: 12, color: C.green, fontFamily: F.mono }}>Changes saved</span>}
    </div>
  );
}

// ── Icons (hairline weight SVG) ───────────────────────────────────────────────
const I = ({ d, s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const Icons = {
  posts:        () => <I d="M4 4h16v16H4z M4 9h16 M9 4v16" />,
  comments:     () => <I d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
  performance:  () => <I d="M12 20V10 M18 20V4 M6 20v-4" />,
  user:         () => <I d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 3a4 4 0 110 8 4 4 0 010-8z" />,
  settings:     () => <I d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />,
  external:     () => <I d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6 M15 3h6v6 M10 14L21 3" />,
  copy:         () => <I d="M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />,
  check:        () => <I d="M20 6L9 17l-5-5" />,
  refresh:      () => <I d="M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15" />,
  chevDown:     () => <I d="M6 9l6 6 6-6" />,
  chevRight:    () => <I d="M9 18l6-6-6-6" />,
  sync:         () => <I d="M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15" />,
  image:        () => <I d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21" />,
  play:         () => <I d="M5 3l14 9-14 9V3z" />,
  signOut:      () => <I d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
};
