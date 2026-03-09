// components/PulseApp.jsx
// Thin shell — App entry, Rail nav, AuthScreen only.
// All view components extracted to their own files (Item 5).
// Dead code removed: authFetch (→ lib/api.js), C/F constants (→ lib/theme.js),
//   Spark, SignalDot, _catColorCache, _catColorIdx, RAIL_W (Items 9+10).

import { useState, useEffect } from "react";
import { createBrowserClient } from "../lib/supabase";
import { C, F, RAIL_COLLAPSED, RAIL_EXPANDED } from "../lib/theme";
import { Styles, Icons } from "./ui";
import PostsView       from "./PostsView";
import CommentsView    from "./CommentsView";
import PerformanceView from "./PerformanceView";
import ProfileView     from "./ProfileView";
import SettingsView    from "./SettingsView";

// ── Auth Screen ──────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }) {
  const [mode, setMode]         = useState("signin");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  async function handleSubmit() {
    setError(""); setSuccess("");
    if (!email.trim() || !password.trim()) { setError("Email and password are required."); return; }
    setLoading(true);
    const supabase = createBrowserClient();
    if (mode === "signin") {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) { setError(err.message); setLoading(false); return; }
      onAuth(data.session);
    } else {
      const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
      if (err) { setError(err.message); setLoading(false); return; }
      if (data.session) { onAuth(data.session); }
      else { setSuccess("Account created! You can now sign in."); setMode("signin"); }
    }
    setLoading(false);
  }

  const inp = {
    width: "100%", padding: "11px 14px", background: "#111113",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
    color: C.text, fontSize: 14, fontFamily: F.sans, outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.sans }}>
      <Styles />
      <div style={{ width: 380, animation: "popIn 0.25s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40, justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 28px rgba(200,169,110,0.2)" }}>
            <span style={{ fontFamily: F.serif, fontSize: 20, fontWeight: 500, color: C.base }}>P</span>
          </div>
          <span style={{ fontFamily: F.serif, fontSize: 22, fontWeight: 500, color: C.text }}>The Pulse</span>
        </div>
        <div style={{ background: C.elevated, border: `1px solid ${C.stroke}`, borderRadius: 14, padding: "32px 28px" }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 6 }}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </h2>
          <p style={{ fontSize: 13, color: C.textSoft, marginBottom: 24 }}>
            {mode === "signin" ? "Welcome back." : "Set up your Pulse account."}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="email" placeholder="Email address" value={email}
              onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()}
              style={inp} autoFocus />
            <input type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()}
              style={inp} />
          </div>
          {error   && <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(212,128,106,0.1)", border: "1px solid rgba(212,128,106,0.2)", borderRadius: 7, fontSize: 13, color: C.coral }}>{error}</div>}
          {success && <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(109,175,123,0.1)", border: "1px solid rgba(109,175,123,0.2)", borderRadius: 7, fontSize: 13, color: C.green }}>{success}</div>}
          <button onClick={handleSubmit} disabled={loading}
            style={{ width: "100%", marginTop: 18, padding: "11px 0", background: loading ? "rgba(200,169,110,0.4)" : C.gold, border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", color: C.base, fontSize: 14, fontWeight: 600, fontFamily: F.sans }}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <div style={{ marginTop: 18, textAlign: "center", fontSize: 13, color: C.textSoft }}>
            {mode === "signin"
              ? (<>Don't have an account?{" "}<button onClick={() => { setMode("signup"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 13, fontFamily: F.sans, padding: 0 }}>Create one</button></>)
              : (<>Already have an account?{" "}<button onClick={() => { setMode("signin"); setError(""); setSuccess(""); }} style={{ background: "none", border: "none", color: C.gold, cursor: "pointer", fontSize: 13, fontFamily: F.sans, padding: 0 }}>Sign in</button></>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Rail ─────────────────────────────────────────────────────────────────────

function Rail({ view, setView, onSignOut }) {
  const [expanded, setExpanded] = useState(false);
  const railWidth = expanded ? RAIL_EXPANDED : RAIL_COLLAPSED;

  const mainNav = [
    { id: "posts",       icon: Icons.posts,       label: "Posts"       },
    { id: "comments",    icon: Icons.comments,    label: "Comments"    },
    { id: "performance", icon: Icons.performance, label: "Performance" },
  ];

  function NavItem({ id, icon: Ic, label, onClick }) {
    const active = view === id;
    const [h, setH] = useState(false);
    return (
      <button
        onClick={onClick || (() => setView(id))}
        onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{ width: "100%", height: 44, display: "flex", alignItems: "center", paddingLeft: 20, gap: 14, background: "none", border: "none", cursor: "pointer", position: "relative", color: active ? C.gold : h ? C.textSoft : C.textGhost, transition: "color 0.15s" }}
      >
        {active && !onClick && <div style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 2, background: C.gold, borderRadius: "0 2px 2px 0", boxShadow: `0 0 8px ${C.gold}30` }} />}
        <Ic />
        {expanded && <span style={{ fontSize: 13, fontFamily: F.sans, fontWeight: active ? 500 : 400, whiteSpace: "nowrap" }}>{label}</span>}
      </button>
    );
  }

  const SignOutIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );

  return (
    <div
      onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}
      style={{ width: railWidth, height: "100vh", background: C.recessed, borderRight: `1px solid ${C.stroke}`, position: "fixed", left: 0, top: 0, display: "flex", flexDirection: "column", zIndex: 200, transition: "width 0.2s ease", overflow: "hidden" }}
    >
      <div style={{ width: "100%", height: 60, display: "flex", alignItems: "center", paddingLeft: 16, gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px rgba(200,169,110,0.15)`, flexShrink: 0 }}>
          <span style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 500, color: C.base }}>P</span>
        </div>
        {expanded && <span style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 500, color: C.text, whiteSpace: "nowrap" }}>The Pulse</span>}
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 2 }}>
        {mainNav.map(n => <NavItem key={n.id} {...n} />)}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 2 }}>
        <NavItem id="profile"  icon={Icons.user}     label="Profile"  />
        <NavItem id="settings" icon={Icons.settings} label="Settings" />
        <NavItem id="signout"  icon={SignOutIcon}     label="Sign out" onClick={onSignOut} />
      </div>
    </div>
  );
}

// ── App (root) ───────────────────────────────────────────────────────────────

const VIEWS     = { posts: PostsView, comments: CommentsView, performance: PerformanceView, profile: ProfileView, settings: SettingsView };
const WIDE_VIEWS = new Set(["performance", "comments"]);

export default function App() {
  const [session, setSession] = useState(undefined);
  const [view, setView]       = useState("posts");
  const View = VIEWS[view] || PostsView;

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await createBrowserClient().auth.signOut();
    setSession(null);
  }

  if (session === undefined) return (
    <div style={{ minHeight: "100vh", background: C.base, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Styles />
      <div style={{ width: 28, height: 28, borderRadius: 6, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 500, color: C.base }}>P</span>
      </div>
    </div>
  );

  if (!session) return <AuthScreen onAuth={setSession} />;

  return (
    <div style={{ fontFamily: F.sans, color: C.text, background: C.base, minHeight: "100vh" }}>
      <Styles />
      <Rail view={view} setView={setView} onSignOut={handleSignOut} />
      <main style={{ marginLeft: RAIL_COLLAPSED, minHeight: "100vh", overflow: "auto", maxHeight: "100vh" }}>
        <div style={{ maxWidth: WIDE_VIEWS.has(view) ? 860 : 680, margin: "0 auto", padding: "48px 40px 80px", transition: "max-width 0.3s ease" }}>
          <View key={view} />
        </div>
      </main>
    </div>
  );
}
