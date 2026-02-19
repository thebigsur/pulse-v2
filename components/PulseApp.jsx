import { useState, useRef, useEffect } from "react";
import { useDrafts, useComments, useOutreach } from "../lib/hooks";

// ═══════════════════════════════════════════════════════════════
// THE PULSE v2 — Redesign v3
// All drafts visible, meaningful color, Approve + New Draft
// ═══════════════════════════════════════════════════════════════

// --- Color System: every color means something ---
const C = {
  // Surfaces
  base: "#09090A",
  elevated: "#111113",
  recessed: "#060607",
  surface: "#16161A",
  surfaceHover: "#1C1C21",

  stroke: "rgba(255,255,255,0.06)",
  strokeHover: "rgba(255,255,255,0.1)",

  // Text
  text: "#E2DFD8",
  textSoft: "#9E9A91",
  textFaint: "#5C5950",
  textGhost: "#3A3834",

  // MEANINGFUL COLORS — each encodes a type of information
  gold: "#C8A96E",          // User's brand / primary action / own content
  goldSoft: "rgba(200,169,110,0.10)",
  goldGlow: "rgba(200,169,110,0.06)",

  green: "#6DAF7B",         // Positive signal: approved, strong, growth, success
  greenSoft: "rgba(109,175,123,0.10)",

  blue: "#6A9FD8",          // Informational: timing, engagement data, neutral metrics
  blueSoft: "rgba(106,159,216,0.10)",

  coral: "#D4806A",         // Attention / action needed / hot engagement
  coralSoft: "rgba(212,128,106,0.10)",

  purple: "#9B84C9",        // ICP / audience / people-related signals
  purpleSoft: "rgba(155,132,201,0.10)",

  silver: "#8A8A8A",        // Neutral / secondary
};

// Topic → color mapping (meaningful: each topic area has a color)
const TOPIC_COLORS = {
  "RSU Taxation": { fg: C.coral, bg: C.coralSoft },
  "High-Earner Psychology": { fg: C.purple, bg: C.purpleSoft },
  "Market Valuations": { fg: C.blue, bg: C.blueSoft },
  "Solo 401(k)": { fg: C.green, bg: C.greenSoft },
  "Roth Conversions": { fg: "#D4A86A", bg: "rgba(212,168,106,0.10)" },
  "Equity Comp": { fg: C.coral, bg: C.coralSoft },
  "Valuations": { fg: C.blue, bg: C.blueSoft },
  "Psychology": { fg: C.purple, bg: C.purpleSoft },
};

const getTopicColor = (topic) => TOPIC_COLORS[topic] || { fg: C.textFaint, bg: C.surface };

const F = {
  serif: "'Playfair Display', 'Georgia', serif",
  sans: "'Instrument Sans', 'DM Sans', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

const RAIL_W = 60;

// ═══════════════════════════════════════════
// GLOBAL STYLES
// ═══════════════════════════════════════════

const Styles = () => (
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
  `}</style>
);

// ═══════════════════════════════════════════
// PRIMITIVES
// ═══════════════════════════════════════════

function Btn({ children, primary, ghost, danger, color: customColor, onClick, style: s }) {
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

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <label style={{ display: "block", fontSize: 11, fontFamily: F.sans, fontWeight: 600, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{label}</label>
      {hint && <p style={{ fontSize: 12, color: C.textGhost, marginBottom: 8, lineHeight: 1.5 }}>{hint}</p>}
      {children}
    </div>
  );
}

function Input({ multiline, rows = 3, value, onChange, placeholder, style: s, small }) {
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
  // Controlled mode when onChange is provided, otherwise uncontrolled (backward compat)
  const valProps = onChange ? { value: value || "", onChange: e => onChange(e.target.value) } : { defaultValue: value };
  if (multiline) return <textarea rows={rows} placeholder={placeholder} {...valProps} style={shared} {...handlers} />;
  return <input type="text" placeholder={placeholder} {...valProps} style={shared} {...handlers} />;
}

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h1 style={{ fontFamily: F.serif, fontSize: 32, fontWeight: 400, color: C.text, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{children}</h1>
      {sub && <p style={{ fontFamily: F.sans, fontSize: 13, color: C.textFaint, marginTop: 8 }}>{sub}</p>}
    </div>
  );
}

function Separator() { return <div style={{ height: 1, background: C.stroke, margin: "32px 0" }} />; }

function Tag({ children, color: fg, bg, warm, green }) {
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

function Spark({ data, color = C.gold, w = 72, h = 22 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data), min = Math.min(...data), r = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / r) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / r) * (h - 4) - 2} r="2" fill={color} />
    </svg>
  );
}

// Signal strength indicator — colored dot
function SignalDot({ strength }) {
  const color = strength === "strong" ? C.green : strength === "moderate" ? C.gold : C.textFaint;
  return <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}40` }} />;
}

// ═══════════════════════════════════════════
// ICONS — hairline weight
// ═══════════════════════════════════════════

const I = ({ d, s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const Icons = {
  posts: () => <I d="M4 4h16v16H4z M4 9h16 M9 4v16" />,
  comments: () => <I d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
  outreach: () => <I d="M22 2L11 13 M22 2l-7 20-4-9-9-4z" />,
  performance: () => <I d="M12 20V10 M18 20V4 M6 20v-4" />,
  user: () => <I d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 3a4 4 0 110 8 4 4 0 010-8z" />,
  settings: () => <I d="M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />,
  external: () => <I d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6 M15 3h6v6 M10 14L21 3" />,
  copy: () => <I d="M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />,
  check: () => <I d="M20 6L9 17l-5-5" />,
  refresh: () => <I d="M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15" />,
  chevDown: () => <I d="M6 9l6 6 6-6" />,
  chevRight: () => <I d="M9 18l6-6-6-6" />,
  sync: () => <I d="M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15" />,
  image: () => <I d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21" />,
  play: () => <I d="M5 3l14 9-14 9V3z" />,
};

// ═══════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════

const DRAFTS = [
  { id: 1, text: `Your RSUs aren't a bonus.\nThey're a tax time bomb.\n\nI see this every week: engineers at $200K+ comp sitting on 6 figures of company stock, treating vesting dates like paydays.\n\nMeanwhile they're:\n→ Paying 40%+ effective tax on every vest\n→ Holding concentrated positions they'd never buy on purpose\n→ Missing the 83(b) election window entirely\n\nThe fix isn't complicated. But it requires planning BEFORE vesting day, not after.`, source: { text: "Why I sold all my RSUs the day they vested", author: "@SeniorEng_FAANG", engagement: "2,847 likes · 14h", url: "https://linkedin.com/feed/update/urn:li:activity:source001" }, topic: "RSU Taxation", imageHint: "Chart: RSU tax impact at different income levels", hashtags: null },
  { id: 2, text: `"I make $350K and I'm broke."\n\nI hear this from attorneys more than anyone.\n\nBigLaw salary. Student loans. Lifestyle inflation. Golden handcuffs.\n\nThe math looks good on paper. The reality doesn't.\n\nHere's what nobody tells you about high-income financial planning: earning more doesn't automatically mean building more.`, source: { text: "BigLaw burnout and the wealth illusion", author: "@CorpLawReality", engagement: "1,923 likes · 8h", url: "https://linkedin.com/feed/update/urn:li:activity:source002" }, topic: "High-Earner Psychology", imageHint: null, hashtags: null },
  { id: 3, text: `The S&P 500 is trading at 22x forward earnings.\n\nFor context:\n→ 10-year average: 17.6x\n→ Pre-COVID average: 15.8x\n→ Current level: 22.1x\n\nThis doesn't mean "sell everything."\nIt means your expected 10-year return from this starting point is historically ~4-6% annualized.\n\nAct accordingly.`, source: { text: "Market valuations are screaming", author: "@DataDrivenInvstr", engagement: "4,102 likes · 22h", url: "https://twitter.com/DataDrivenInvstr/status/source003" }, topic: "Market Valuations", imageHint: "Chart: S&P 500 P/E ratio vs subsequent 10-year returns", hashtags: ["#equitycomp", "#wealthmanagement", "#financialplanning"] },
  { id: 4, text: `Hot take: Your 401(k) match isn't free money.\n\nIt's compensation you already earned, delivered in the most tax-inefficient way possible for high earners.\n\nIf your employer matches 6% into a traditional 401(k) and you're in the 37% bracket, that "free" $14K costs you ~$5,200 in future taxes.\n\nThere's a better structure. Most people don't know it exists.`, source: { text: "The 401k match myth", author: "@RetirementNerd", engagement: "1,556 likes · 6h", url: "https://linkedin.com/feed/update/urn:li:activity:source004" }, topic: "Solo 401(k)", imageHint: null, hashtags: null },
];

const REPLACEMENT_DRAFTS = [
  { id: 101, text: `Stop maxing out your 401(k) before reading this.\n\nIf you're in the 35%+ bracket with equity comp, the traditional 401(k) max-out advice might be costing you.\n\nHere's why: every dollar you defer today gets taxed as ordinary income when you withdraw. If your tax rate stays the same (or goes up), you've just delayed the inevitable.\n\nThe alternative? A properly structured Roth strategy.`, source: { text: "The Roth backdoor nobody talks about", author: "@TaxStrategyGuy", engagement: "1,102 likes · 4h", url: "https://linkedin.com/feed/update/urn:li:activity:source101" }, topic: "Roth Conversions", imageHint: null, hashtags: null },
  { id: 102, text: `Your financial advisor should make you uncomfortable.\n\nNot because they're pushy — because they ask questions you've been avoiding.\n\n"What happens if you get laid off with $400K in unvested RSUs?"\n"Have you modeled what your tax bill looks like if your company gets acquired?"\n"Why are you holding 60% of your net worth in one stock?"\n\nComfort is expensive in financial planning.`, source: { text: "Hard conversations with your advisor", author: "@WealthMindset_", engagement: "890 likes · 10h", url: "https://linkedin.com/feed/update/urn:li:activity:source102" }, topic: "Equity Comp", imageHint: null, hashtags: null },
  { id: 103, text: `I ran the numbers on dollar-cost averaging vs. lump sum investing for a client last week.\n\nThe data is clear: lump sum wins about 68% of the time historically.\n\nBut here's what the data doesn't capture: the client who lump sums $500K and watches it drop 15% in month one will panic-sell. The client who DCA's over 6 months sleeps fine.\n\nThe best strategy is the one you'll actually stick with.`, source: { text: "DCA vs lump sum: the real answer", author: "@EvidenceInvestor", engagement: "2,200 likes · 12h", url: "https://linkedin.com/feed/update/urn:li:activity:source103" }, topic: "Market Valuations", imageHint: null, hashtags: null },
  { id: 104, text: `The most expensive financial mistake I see engineers make isn't about taxes.\n\nIt's waiting.\n\nWaiting to diversify until "after the next vest."\nWaiting to start a plan until they "have more time."\nWaiting to talk to someone until they "know more."\n\nThe compounding cost of waiting 3 years on a $1M portfolio?\nRoughly $180K in lost growth at historical averages.\n\nStart now. Optimize later.`, source: { text: "The cost of financial procrastination", author: "@TechCareerCoach", engagement: "1,700 likes · 5h", url: "https://linkedin.com/feed/update/urn:li:activity:source104" }, topic: "High-Earner Psychology", imageHint: null, hashtags: null },
];

const COMMENTS = [
  { id: 1, author: "Sarah Chen", title: "VP Engineering", company: "Stripe", post: "After 8 years in tech, I finally understand why senior engineers burn out. It's not the code. It's the golden handcuffs. RSUs vest, lifestyle inflates, and suddenly you can't afford to leave...", postUrl: "https://linkedin.com/feed/update/urn:li:activity:comment001", engagement: { likes: 847, comments: 156, age: "3h" }, comment: "The golden handcuffs thing is real — I see it every week with engineers at your level. The irony is that a proper equity liquidation strategy actually gives you MORE freedom, not less. Most people just don't know the 3 levers they can pull to optimize the tax hit on those vests.", snLead: true },
  { id: 2, author: "Marcus Williams", title: "Associate Attorney", company: "Davis Polk", post: "Year 3 at a V10 firm. $245K base + $40K bonus. $180K in student loans. My net worth is technically negative. Nobody talks about this in BigLaw...", postUrl: "https://linkedin.com/feed/update/urn:li:activity:comment002", engagement: { likes: 612, comments: 98, age: "5h" }, comment: "This is more common than people realize. The good news? At your income trajectory, you're probably 18-24 months from a complete financial pivot — if you have the right structure in place. The bad news? Most attorneys in your position wait 5+ years to set that up.", snLead: false },
  { id: 3, author: "Priya Ramanathan", title: "Sr. Product Manager", company: "Google", post: "Got my first ISO grant today. 50,000 shares at $0.12 strike. My coworkers say 'just hold.' My accountant says 'it depends.' I have no idea what to do and I'm terrified of making the wrong move.", postUrl: "https://linkedin.com/feed/update/urn:li:activity:comment003", engagement: { likes: 234, comments: 67, age: "2h" }, comment: "The 'just hold' advice costs engineers real money. With ISOs at that strike price, you've got AMT exposure, a concentration risk building, and a potential exercise-and-sell strategy that could save you 6 figures in taxes over the next 3 years. The answer isn't hold or sell — it's planned liquidation on YOUR timeline.", snLead: false },
  { id: 4, author: "Kevin Tran", title: "Staff Engineer", company: "Meta", post: "Just hit $1M net worth at 31. Mostly from FAANG RSUs. Everyone says congrats but honestly I have no idea if I'm doing this right. Should I keep holding? Diversify? I don't even have an advisor...", postUrl: "https://linkedin.com/feed/update/urn:li:activity:comment004", engagement: { likes: 1203, comments: 287, age: "4h" }, comment: "Congrats on the milestone — but your instinct is right to question it. A $1M net worth concentrated in one tech stock is fundamentally different from $1M in a diversified portfolio. The risk profile is closer to a $600K portfolio in practical terms. Worth mapping out what a 12-month diversification plan looks like.", snLead: false },
];

const OUTREACH = [
  { id: 1, name: "David Park", title: "Staff Engineer at Airbnb", profileUrl: "https://linkedin.com/in/david-park", interaction: "Replied to your comment about RSU tax optimization with 'This is exactly what I've been dealing with. Where do I even start?'", daysAgo: 1, signal: "strong", starter: "Hey David — glad that resonated. The short version: start with a concentrated stock analysis before your next vest. Most engineers at your level are leaving $30-50K on the table per year. Happy to walk you through what that looks like if you're curious." },
  { id: 2, name: "Rachel Torres", title: "Partner Track Attorney, Kirkland & Ellis", profileUrl: "https://linkedin.com/in/rachel-torres", interaction: "Liked your post + followed you after your comment on BigLaw comp thread", daysAgo: 2, signal: "moderate", starter: "Rachel — noticed you followed after that BigLaw comp discussion. I work with a lot of attorneys at your stage navigating the partner track financially. If you ever want a second opinion on how your comp structure is working for you, I'm always happy to chat." },
  { id: 3, name: "James Liu", title: "Engineering Manager at Tesla", profileUrl: "https://linkedin.com/in/james-liu", interaction: "Commented on your market valuation post: 'What would you actually recommend for someone 30 with $500K in concentrated TSLA stock?'", daysAgo: 1, signal: "strong", starter: "James — great question. The honest answer is it depends on your vesting schedule and tax basis, but the general framework: nobody should have more than 10-15% of their net worth in their employer's stock. Want to compare what a diversification timeline might look like for your situation?" },
];

const PERF = {
  stats: [
    { label: "Impressions", value: "34.2K", delta: "+18%", spark: [18, 21, 24, 28, 31, 34.2], color: C.gold },
    { label: "Profile views", value: "891", delta: "+22%", spark: [450, 520, 610, 720, 810, 891], color: C.purple },
    { label: "New followers", value: "+47", delta: "+14%", spark: [22, 28, 35, 38, 41, 47], color: C.green },
    { label: "Engagement", value: "4.2%", delta: "+0.4", spark: [2.8, 3.1, 3.5, 3.8, 4.0, 4.2], color: C.blue },
  ],
  posts: [
    { text: "Your RSUs aren't a bonus. They're a tax time bomb.", likes: 847, comments: 156, date: "Feb 12", topic: "RSU Taxation", mult: "3.2×", url: "https://linkedin.com/feed/update/urn:li:activity:7296001" },
    { text: "The S&P 500 at 22x earnings means your expected return is 4-6%.", likes: 612, comments: 89, date: "Feb 10", topic: "Valuations", mult: "2.1×", url: "https://linkedin.com/feed/update/urn:li:activity:7295002" },
    { text: "I make $350K and I'm broke — high income ≠ wealth.", likes: 523, comments: 134, date: "Feb 8", topic: "Psychology", mult: "1.8×", url: "https://linkedin.com/feed/update/urn:li:activity:7294003" },
  ],
  topics: [
    { name: "RSU Taxation", avg: 520, count: 8, pct: 100, trend: "up" },
    { name: "High-Earner Psychology", avg: 445, count: 6, pct: 85, trend: "up" },
    { name: "Market Valuations", avg: 380, count: 5, pct: 73, trend: "flat" },
    { name: "Solo 401(k)", avg: 290, count: 4, pct: 56, trend: "down" },
    { name: "Roth Conversions", avg: 260, count: 3, pct: 50, trend: "flat" },
  ],
  commentImpact: { total: 47, replies: 18, clickRate: "12%", connections: 8 },
};

const POST_HISTORY = [
  { id: 1, text: "Your RSUs aren't a bonus. They're a tax time bomb...", date: "Feb 12", likes: 847, comments: 156, url: "https://linkedin.com/feed/update/urn:li:activity:7296001" },
  { id: 2, text: "The S&P 500 at 22x earnings means your expected return...", date: "Feb 10", likes: 612, comments: 89, url: "https://linkedin.com/feed/update/urn:li:activity:7295002" },
  { id: 3, text: "I make $350K and I'm broke — why high income ≠ wealth...", date: "Feb 8", likes: 523, comments: 134, url: "https://linkedin.com/feed/update/urn:li:activity:7294003" },
  { id: 4, text: "Hot take: Your 401(k) match isn't free money...", date: "Feb 5", likes: 445, comments: 78, url: "https://linkedin.com/feed/update/urn:li:activity:7293004" },
  { id: 5, text: "If your financial advisor hasn't asked about stock options...", date: "Feb 3", likes: 389, comments: 92, url: "https://linkedin.com/feed/update/urn:li:activity:7292005" },
];

// ═══════════════════════════════════════════
// DATA MAPPER — API → UI shape
// ═══════════════════════════════════════════

function mapApiDraft(item) {
  const engagement = [
    item.likes ? `${item.likes.toLocaleString()} likes` : null,
    item.comments ? `${item.comments} comments` : null,
  ].filter(Boolean).join(" · ");

  return {
    id: item.id,
    text: item.draft_text || "",
    source: {
      text: item.suggested_angle || item.post_text || "",
      author: item.creator_handle ? `@${item.creator_handle}` : (item.creator_name || "Unknown"),
      engagement: engagement || "New post",
      url: item.url || null,
    },
    topic: (item.draft_topic_tags && item.draft_topic_tags[0]) || "General",
    imageHint: item.draft_image_hint || null,
    hashtags: (item.draft_hashtags && item.draft_hashtags.length > 0) ? item.draft_hashtags : null,
  };
}

// ═══════════════════════════════════════════
// POSTS — All visible, scrollable, Approve + New Draft
// ═══════════════════════════════════════════

function PostsView() {
  const { drafts: rawDrafts, loading, approve: apiApprove, skip: apiSkip } = useDrafts();
  const [showSource, setShowSource] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const [replacing, setReplacing] = useState({});
  const [copied, setCopied] = useState({});
  const [expandedApproved, setExpandedApproved] = useState({});

  const wordCount = (text) => text.split(/\s+/).filter(w => w.length > 0).length;

  // Map API data to UI shape and split by status
  const allDrafts = rawDrafts.map(mapApiDraft);
  const activeDrafts = rawDrafts.filter(d => d.draft_status === 'generated').map(mapApiDraft);
  const approvedDrafts = rawDrafts.filter(d => d.draft_status === 'approved').map(mapApiDraft);

  const handleApprove = async (id) => {
    try { await apiApprove(id); } catch (err) { console.error('Approve failed:', err); }
  };

  const handleNewDraft = async (id) => {
    setReplacing(r => ({ ...r, [id]: true }));
    try {
      await apiSkip(id);
    } catch (err) {
      console.error('Skip failed:', err);
    } finally {
      setTimeout(() => setReplacing(r => ({ ...r, [id]: false })), 300);
    }
  };

  const handleCopy = (draft) => {
    navigator.clipboard.writeText(draft.text).then(() => {
      setCopied(c => ({ ...c, [draft.id]: true }));
      setTimeout(() => setCopied(c => ({ ...c, [draft.id]: false })), 2000);
    }).catch(() => {});
  };

  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteSaved, setPasteSaved] = useState(false);

  const handleSavePaste = () => {
    if (!pasteText.trim()) return;
    setPasteSaved(true);
    setTimeout(() => { setPasteSaved(false); setShowPaste(false); setPasteText(""); }, 2000);
  };

  return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <SectionTitle sub={loading ? "Loading drafts..." : `${activeDrafts.length} drafts this week · ${approvedDrafts.length} approved`}>
        Posts
      </SectionTitle>

      {loading && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <p style={{ fontFamily: F.serif, fontSize: 20, color: C.textSoft }}>Loading drafts...</p>
          <p style={{ fontSize: 12, color: C.textFaint, marginTop: 8 }}>Fetching from Supabase</p>
        </div>
      )}

      {!loading && activeDrafts.length === 0 && approvedDrafts.length === 0 && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <p style={{ fontFamily: F.serif, fontSize: 20, color: C.textSoft }}>No drafts yet</p>
          <p style={{ fontSize: 12, color: C.textFaint, marginTop: 8 }}>Run the content pipeline to generate drafts from trending content.</p>
        </div>
      )}

      {/* Last post performance callout */}
      {!loading && activeDrafts.length + approvedDrafts.length > 0 && <><div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", borderRadius: 8, marginBottom: 24,
        background: C.greenSoft, border: `1px solid rgba(109,175,123,0.15)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}50` }} />
          <span style={{ fontSize: 13, color: C.green, fontWeight: 500 }}>Your RSU post outperformed your average by 3.2×</span>
          <span style={{ fontSize: 12, color: C.textFaint }}>— 847 likes, 156 comments</span>
        </div>
        <a href="https://linkedin.com/feed/update/urn:li:activity:7296001" target="_blank" rel="noopener noreferrer" style={{ color: C.textGhost, display: "flex" }}>
          <Icons.external />
        </a>
      </div>

      {/* Paste your latest post */}
      {!showPaste ? (
        <button onClick={() => setShowPaste(true)} style={{
          width: "100%", padding: "16px 18px", borderRadius: 8,
          background: "transparent", border: `1px dashed ${C.stroke}`,
          color: C.textGhost, fontSize: 13, fontFamily: F.sans,
          cursor: "pointer", textAlign: "left", marginBottom: 32,
          transition: "all 0.15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.strokeHover; e.currentTarget.style.color = C.textFaint; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.stroke; e.currentTarget.style.color = C.textGhost; }}
        >
          + Paste your latest LinkedIn post to update history
        </button>
      ) : (
        <div style={{
          marginBottom: 32, padding: "18px 20px", borderRadius: 8,
          background: C.elevated, border: `1px solid ${C.stroke}`,
          animation: "fadeIn 0.2s ease",
        }}>
          <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Paste your latest post
          </p>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder="Paste the full text of your LinkedIn post here..."
            rows={5}
            style={{
              width: "100%", background: "transparent", border: "none",
              borderBottom: `1px solid ${C.stroke}`, color: C.text,
              fontSize: 14, fontFamily: F.sans, padding: "10px 0",
              lineHeight: 1.65, resize: "vertical",
            }}
            onFocus={e => e.target.style.borderBottomColor = C.gold}
            onBlur={e => e.target.style.borderBottomColor = C.stroke}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <Btn primary onClick={handleSavePaste}>
              {pasteSaved ? <><Icons.check /> Saved to History</> : "Save to History"}
            </Btn>
            <Btn ghost onClick={() => { setShowPaste(false); setPasteText(""); }}>Cancel</Btn>
            {pasteText.trim() && (
              <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost, marginLeft: 8 }}>
                {wordCount(pasteText)}w
              </span>
            )}
          </div>
        </div>
      )}

      {/* All drafts — visible, scrollable */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {activeDrafts.map((draft, idx) => {
          const tc = getTopicColor(draft.topic);
          const isReplacing = replacing[draft.id];

          return (
            <div key={draft.id} style={{
              animation: `slideUp 0.3s ease ${idx * 0.06}s both`,
              opacity: isReplacing ? 0.3 : 1,
              transition: "opacity 0.3s ease",
              borderLeft: `2px solid ${tc.fg}`,
              paddingLeft: 24,
            }}>
              {/* Topic tag + word count — colored by topic */}
              <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <Tag color={tc.fg} bg={tc.bg}>{draft.topic}</Tag>
                <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>{wordCount(draft.text)}w</span>
                {draft.imageHint && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4, color: C.blue, fontSize: 11 }}>
                    <Icons.image /> Image suggested
                  </span>
                )}
                {draft.hashtags && (
                  <span style={{ fontSize: 11, color: C.textGhost }}>
                    {draft.hashtags.join(" ")}
                  </span>
                )}
              </div>

              {/* Draft text */}
              <div style={{
                fontSize: 15, color: C.text, lineHeight: 1.8,
                whiteSpace: "pre-wrap", marginBottom: 16,
                maxWidth: 580,
              }}>
                {draft.text}
              </div>

              {/* Image hint if present */}
              {draft.imageHint && (
                <div style={{
                  padding: "12px 16px", background: C.blueSoft,
                  borderRadius: 6, marginBottom: 14, maxWidth: 580,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <Icons.image />
                  <span style={{ fontSize: 13, color: C.blue }}>{draft.imageHint}</span>
                </div>
              )}

              {/* Source — collapsible, with link to original */}
              <button onClick={() => setShowSource(s => ({ ...s, [draft.id]: !s[draft.id] }))}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  color: C.textGhost, fontSize: 12, fontFamily: F.sans, padding: 0,
                  marginBottom: showSource[draft.id] ? 0 : 20, transition: "color 0.15s",
                }}
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

              {/* Actions: Approve + New Draft */}
              <div style={{ display: "flex", gap: 10 }}>
                <Btn primary onClick={() => handleApprove(draft.id)}>
                  <Icons.check /> Approve
                </Btn>
                <Btn onClick={() => handleNewDraft(draft.id)}>
                  <Icons.refresh /> New Draft
                </Btn>
              </div>
            </div>
          );
        })}
      </div>

      {activeDrafts.length === 0 && (
        <div style={{ padding: "50px 0", animation: "fadeIn 0.3s ease" }}>
          <p style={{ fontFamily: F.serif, fontSize: 24, color: C.textSoft }}>All drafts reviewed.</p>
          <p style={{ fontSize: 13, color: C.textFaint, marginTop: 8 }}>{approvedDrafts.length} ready to post.</p>
        </div>
      )}

      {/* Approved */}
      {approvedDrafts.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Approved · {approvedDrafts.length} ready</p>
          {approvedDrafts.map(d => {
            const tc = getTopicColor(d.topic);
            const isExpanded = expandedApproved[d.id];
            return (
              <div key={d.id} style={{ borderBottom: `1px solid ${C.stroke}` }}>
                <div
                  onClick={() => setExpandedApproved(e => ({ ...e, [d.id]: !e[d.id] }))}
                  style={{
                    padding: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center",
                    cursor: "pointer", transition: "background 0.15s", borderRadius: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}40` }} />
                    <span style={{ fontSize: 14, color: C.textSoft }}>{d.text.split("\n")[0]}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Tag color={tc.fg} bg={tc.bg}>{d.topic}</Tag>
                    <span style={{ transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "flex", color: C.textGhost }}><Icons.chevRight /></span>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: "0 0 20px 18px", animation: "fadeIn 0.2s ease" }}>
                    <div style={{ fontSize: 14, color: C.text, lineHeight: 1.75, whiteSpace: "pre-wrap", marginBottom: 14, maxWidth: 560, borderLeft: `2px solid ${C.green}`, paddingLeft: 16 }}>
                      {d.text}
                    </div>
                    <Btn onClick={() => handleCopy(d)}>
                      {copied[d.id] ? <><Icons.check /> Copied</> : <><Icons.copy /> Copy to Clipboard</>}
                    </Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Post History */}
      <div style={{ marginTop: 48 }}>
        <button onClick={() => setShowHistory(!showHistory)}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, color: C.textGhost, fontSize: 12, fontFamily: F.sans, padding: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = C.textFaint}
          onMouseLeave={e => e.currentTarget.style.color = C.textGhost}
        >
          <span style={{ transform: showHistory ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "flex" }}><Icons.chevRight /></span>
          Post History
          <span style={{ fontFamily: F.mono, fontSize: 11 }}>{POST_HISTORY.length}</span>
        </button>
        {showHistory && (
          <div style={{ marginTop: 12, animation: "fadeIn 0.2s ease" }}>
            {POST_HISTORY.map(p => (
              <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
                <div style={{ padding: "12px 8px", borderBottom: `1px solid ${C.stroke}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", transition: "background 0.15s", borderRadius: 4, margin: "0 -8px" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
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
        )}
      </div>
      </>}
    </div>
  );
}

// ═══════════════════════════════════════════
// COMMENTS — Split layout sprint
// ═══════════════════════════════════════════

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
    postUrl: item.url || (item.external_id && item.external_id.includes('urn:') ? `https://www.linkedin.com/feed/update/${item.external_id}` : "#"),
    engagement: {
      likes: item.likes || 0,
      comments: item.comments || 0,
      age: ageStr,
    },
    comment: item.suggested_comment || "",
    snLead: item.sn_lead || false,
  };
}

function CommentsView() {
  const { comments: rawComments, loading, markDone } = useComments();
  const [copiedComment, setCopiedComment] = useState(false);
  const [localDone, setLocalDone] = useState({});

  const allComments = rawComments.map(mapApiComment);
  const active = allComments.filter(c => !localDone[c.id]);
  const current = active[0];
  const completed = localDone ? Object.keys(localDone).length : 0;
  const totalCount = allComments.length + completed;
  const wordCount = (text) => text.split(/\s+/).filter(w => w.length > 0).length;

  const handleCopyAndOpen = () => {
    if (!current) return;
    navigator.clipboard.writeText(current.comment).then(() => {
      setCopiedComment(true);
      setTimeout(() => {
        window.open(current.postUrl, "_blank");
        setCopiedComment(false);
        setLocalDone(d => ({ ...d, [current.id]: true }));
        markDone(current.id).catch(err => console.error('markDone failed:', err));
      }, 800);
    }).catch(() => {
      window.open(current.postUrl, "_blank");
      setLocalDone(d => ({ ...d, [current.id]: true }));
      markDone(current.id).catch(err => console.error('markDone failed:', err));
    });
  };

  const handleSkip = (id) => {
    setLocalDone(d => ({ ...d, [id]: true }));
    markDone(id).catch(err => console.error('markDone failed:', err));
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

  if (!current) return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <SectionTitle>Comments</SectionTitle>
      <div style={{ padding: "60px 0" }}>
        <p style={{ fontFamily: F.serif, fontSize: 24, color: C.textSoft }}>
          {totalCount === 0 ? "No comment opportunities yet" : "Sprint complete."}
        </p>
        <p style={{ fontSize: 13, color: C.textFaint, marginTop: 8 }}>
          {totalCount === 0 ? "Run the comment pipeline to find posts worth engaging with." : `${completed} comments this session.`}
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <SectionTitle sub={`${active.length} remaining · ${completed} done`}>Comments</SectionTitle>
        <div style={{ width: 120, marginBottom: 42 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost }}>{completed}/{totalCount}</span>
          </div>
          <div style={{ height: 2, background: C.stroke, borderRadius: 1, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${totalCount > 0 ? (completed / totalCount) * 100 : 0}%`, background: C.green, borderRadius: 1, transition: "width 0.4s ease" }} />
          </div>
        </div>
      </div>

      <div key={current.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, animation: "popIn 0.25s ease" }}>
        {/* Left: The post */}
        <div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{current.author}</span>
              {current.snLead && <Tag color={C.green} bg={C.greenSoft}>SN Lead</Tag>}
            </div>
            <span style={{ fontSize: 12, color: C.textFaint }}>{[current.title, current.company].filter(Boolean).join(" · ")}</span>
          </div>
          <div style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.75, fontStyle: "italic", paddingLeft: 16, borderLeft: `1px solid ${C.stroke}` }}>
            {current.post}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
            <span style={{ fontSize: 11, fontFamily: F.mono, color: C.coral }}>{current.engagement.likes} likes</span>
            <span style={{ fontSize: 11, fontFamily: F.mono, color: C.blue }}>{current.engagement.comments} comments</span>
            <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>{current.engagement.age} ago</span>
          </div>
        </div>

        {/* Right: Comment */}
        <div>
          <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            Suggested comment <span style={{ color: C.textGhost, textTransform: "none" }}>· {wordCount(current.comment)}w</span>
          </p>
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.75, padding: "18px 20px", background: C.goldGlow, borderRadius: 8, border: `1px solid rgba(200,169,110,0.1)`, marginBottom: 20 }}>
            {current.comment}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn primary onClick={handleCopyAndOpen}>
              {copiedComment ? <><Icons.check /> Copied — opening LinkedIn</> : <><Icons.external /> Copy &amp; Open on LinkedIn</>}
            </Btn>
            <Btn ghost onClick={() => handleSkip(current.id)}>Next</Btn>
          </div>
        </div>
      </div>

      {/* Queue */}
      {active.length > 1 && (
        <div style={{ marginTop: 40 }}>
          <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Queue</p>
          {active.slice(1, 4).map(c => (
            <div key={c.id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.stroke}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: C.textSoft, fontWeight: 500 }}>{c.author}</span>
                <span style={{ fontSize: 11, color: C.textGhost }}>· {c.title}</span>
                {c.snLead && <Tag color={C.green} bg={C.greenSoft}>SN</Tag>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, fontFamily: F.mono, color: C.coral }}>{c.engagement.likes}</span>
                <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>{c.engagement.age}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// OUTREACH
// ═══════════════════════════════════════════

function mapApiLead(item) {
  const daysAgo = item.surfaced_at
    ? Math.max(0, Math.round((Date.now() - new Date(item.surfaced_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  return {
    id: item.id,
    name: item.name || "Unknown",
    title: [item.title, item.company].filter(Boolean).join(", "),
    profileUrl: item.linkedin_url || "#",
    interaction: item.interaction_text || "",
    daysAgo,
    signal: item.signal_strength || "moderate",
    starter: item.conversation_starter || "",
  };
}

function OutreachView() {
  const { leads: rawLeads, loading, updateStatus } = useOutreach();
  const [copiedStarter, setCopiedStarter] = useState({});

  const active = rawLeads.map(mapApiLead);

  const handleOpenProfile = (lead) => {
    window.open(lead.profileUrl, "_blank");
  };

  const handleCopyMessage = (lead) => {
    navigator.clipboard.writeText(lead.starter).then(() => {
      setCopiedStarter(c => ({ ...c, [lead.id]: true }));
      setTimeout(() => setCopiedStarter(c => ({ ...c, [lead.id]: false })), 2000);
    }).catch(() => {});
  };

  const handleDismiss = async (id) => {
    try { await updateStatus(id, 'dismissed'); } catch (err) { console.error('Dismiss failed:', err); }
  };

  const handleMessaged = async (id) => {
    try { await updateStatus(id, 'messaged'); } catch (err) { console.error('Messaged failed:', err); }
  };

  if (loading) return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <SectionTitle>Outreach</SectionTitle>
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <p style={{ fontFamily: F.serif, fontSize: 20, color: C.textSoft }}>Loading leads...</p>
      </div>
    </div>
  );

  return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <SectionTitle sub={active.length > 0 ? `${active.length} people who engaged with your content` : "People who engaged with your content"}>Outreach</SectionTitle>
      {active.length > 0 && <p style={{ fontSize: 13, color: C.gold, marginBottom: 28 }}>People you message are 90% more likely to see your next post.</p>}

      {active.length === 0 && (
        <div style={{ padding: "60px 0" }}>
          <p style={{ fontFamily: F.serif, fontSize: 20, color: C.textSoft }}>No outreach leads yet</p>
          <p style={{ fontSize: 12, color: C.textFaint, marginTop: 8 }}>Leads surface here when people engage with your posts and comments.</p>
        </div>
      )}

      {active.map((lead, idx) => (
        <div key={lead.id} style={{ padding: "28px 0", borderBottom: `1px solid ${C.stroke}`, animation: `slideUp 0.3s ease ${idx * 0.06}s both` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <SignalDot strength={lead.signal} />
                <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{lead.name}</span>
                <Tag color={lead.signal === "strong" ? C.green : C.gold} bg={lead.signal === "strong" ? C.greenSoft : C.goldSoft}>{lead.signal}</Tag>
              </div>
              <span style={{ fontSize: 12, color: C.textFaint }}>{lead.title}</span>
            </div>
            <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>{lead.daysAgo}d</span>
          </div>

          {lead.interaction && (
            <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.6, fontStyle: "italic", paddingLeft: 16, borderLeft: `2px solid ${C.purple}`, marginBottom: 18 }}>
              {lead.interaction}
            </div>
          )}

          {lead.starter && (
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Suggested comment — edit in your voice</p>
              <div style={{ padding: "16px 18px", background: C.goldGlow, borderRadius: 8, border: `1px solid rgba(200,169,110,0.08)` }}>
                <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7 }}>{lead.starter}</p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <Btn primary onClick={() => handleOpenProfile(lead)}><Icons.external /> Open Profile</Btn>
            {lead.starter && (
              <Btn onClick={() => handleCopyMessage(lead)}>
                {copiedStarter[lead.id] ? <><Icons.check /> Copied</> : <><Icons.copy /> Copy Message</>}
              </Btn>
            )}
            <Btn ghost onClick={() => handleMessaged(lead.id)}>Messaged</Btn>
            <Btn ghost onClick={() => handleDismiss(lead.id)}>Dismiss</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// PERFORMANCE — Color-rich data display
// ═══════════════════════════════════════════

function PerformanceView() {
  return (
    <div style={{ animation: "enter 0.35s ease" }}>
      <SectionTitle sub="Last 30 days">Performance</SectionTitle>

      {/* Metrics — each has its own color */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: C.stroke, borderRadius: 8, overflow: "hidden", marginBottom: 48 }}>
        {PERF.stats.map((s, i) => (
          <div key={i} style={{ background: C.elevated, padding: "24px 20px", animation: `fadeIn 0.3s ease ${i * 0.06}s both` }}>
            <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>{s.label}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <span style={{ fontFamily: F.serif, fontSize: 30, color: C.text, fontWeight: 400, letterSpacing: "-0.02em" }}>{s.value}</span>
                <span style={{ fontSize: 12, color: C.green, marginLeft: 8, fontFamily: F.mono }}>{s.delta}</span>
              </div>
              <Spark data={s.spark} color={s.color} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, marginBottom: 48 }}>
        {/* Top posts */}
        <div>
          <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Top posts</p>
          {PERF.posts.map((p, i) => {
            const tc = getTopicColor(p.topic);
            return (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
                <div style={{ padding: "16px 8px", borderBottom: `1px solid ${C.stroke}`, animation: `slideUp 0.25s ease ${i * 0.06}s both`, cursor: "pointer", borderRadius: 4, margin: "0 -8px", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, marginRight: 16 }}>
                    <p style={{ fontSize: 14, color: C.text, lineHeight: 1.5, marginBottom: 6 }}>{p.text}</p>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: C.textGhost }}>{p.date}</span>
                      <Tag color={tc.fg} bg={tc.bg}>{p.topic}</Tag>
                      <span style={{ color: C.textGhost, display: "flex" }}><Icons.external /></span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ fontFamily: F.serif, fontSize: 22, color: C.gold }}>{p.mult}</span>
                    <p style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost, marginTop: 2 }}>{p.likes} · {p.comments}</p>
                  </div>
                </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* Topics — colored bars */}
        <div>
          <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>By topic</p>
          {PERF.topics.map((t, i) => {
            const tc = getTopicColor(t.name);
            const trendColor = t.trend === "up" ? C.green : t.trend === "down" ? C.coral : C.textFaint;
            const trendIcon = t.trend === "up" ? "↑" : t.trend === "down" ? "↓" : "—";
            return (
              <div key={i} style={{ padding: "12px 0", borderBottom: `1px solid ${C.stroke}`, animation: `slideUp 0.25s ease ${i * 0.04}s both` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{t.name}</span>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textFaint }}>{t.avg} avg · {t.count}</span>
                    <span style={{ fontSize: 12, color: trendColor, fontWeight: 600 }}>{trendIcon}</span>
                  </div>
                </div>
                <div style={{ height: 4, background: C.stroke, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${t.pct}%`, background: tc.fg, borderRadius: 2, transition: "width 1s ease", opacity: 0.7 }} />
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
          {[
            { label: "Total", value: PERF.commentImpact.total, color: C.gold },
            { label: "Replies", value: PERF.commentImpact.replies, color: C.blue },
            { label: "Profile clicks", value: PERF.commentImpact.clickRate, color: C.purple },
            { label: "Connections", value: PERF.commentImpact.connections, color: C.green },
          ].map((m, i) => (
            <div key={i} style={{ background: C.elevated, padding: "18px 16px", textAlign: "center" }}>
              <span style={{ fontFamily: F.serif, fontSize: 22, color: m.color }}>{m.value}</span>
              <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Log performance */}
      <Separator />
      <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Log performance</p>
      <p style={{ fontSize: 12, color: C.textFaint, marginBottom: 16 }}>After a post has been live for 48 hours, log engagement below.</p>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: C.textGhost, display: "block", marginBottom: 8, fontFamily: F.mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Post</label>
          <select style={{ width: "100%", background: C.surface, border: `1px solid ${C.stroke}`, borderRadius: 6, color: C.text, padding: "10px 14px", fontSize: 13, fontFamily: F.sans }}>
            <option>Select a recent post...</option>
            {POST_HISTORY.slice(0, 3).map((p, i) => <option key={i}>{p.text.substring(0, 55)}...</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: C.textGhost, display: "block", marginBottom: 8, fontFamily: F.mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Likes</label>
          <input placeholder="0" style={{ width: 68, background: C.surface, border: `1px solid ${C.stroke}`, borderRadius: 6, color: C.text, padding: "10px 12px", fontSize: 14, fontFamily: F.mono, textAlign: "center" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: C.textGhost, display: "block", marginBottom: 8, fontFamily: F.mono, textTransform: "uppercase", letterSpacing: "0.08em" }}>Comments</label>
          <input placeholder="0" style={{ width: 68, background: C.surface, border: `1px solid ${C.stroke}`, borderRadius: 6, color: C.text, padding: "10px 12px", fontSize: 14, fontFamily: F.mono, textAlign: "center" }} />
        </div>
        <Btn primary style={{ padding: "10px 20px" }}>Log</Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════

function ProfileView() {
  const [tab, setTab] = useState("bio");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Fetch profile from API on mount
  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setProfile(data); setLoading(false); })
      .catch(() => {
        // If no profile exists yet, start with empty defaults
        setProfile({});
        setLoading(false);
      });
  }, []);

  // Generic field updater
  const updateField = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  // Save profile to API
  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "bio", label: "Bio" }, { id: "icp", label: "ICP" },
    { id: "rules", label: "Post Rules" }, { id: "voice", label: "Voice" },
    { id: "history", label: "Post History" }, { id: "compliance", label: "Compliance" },
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
        {loading ? (
          <p style={{ color: C.textFaint, fontSize: 13, padding: "40px 0" }}>Loading profile...</p>
        ) : (
          <>
            {tab === "bio" && <BioForm profile={profile} updateField={updateField} onSave={saveProfile} saving={saving} saved={saved} />}
            {tab === "icp" && <ICPForm profile={profile} updateField={updateField} onSave={saveProfile} saving={saving} saved={saved} />}
            {tab === "rules" && <RulesForm profile={profile} updateField={updateField} onSave={saveProfile} saving={saving} saved={saved} />}
            {tab === "voice" && <VoiceForm profile={profile} updateField={updateField} onSave={saveProfile} saving={saving} saved={saved} />}
            {tab === "history" && <HistoryForm />}
            {tab === "compliance" && <ComplianceForm profile={profile} updateField={updateField} onSave={saveProfile} saving={saving} saved={saved} />}
          </>
        )}
      </div>
    </div>
  );
}

function SaveButton({ onSave, saving, saved }) {
  return (
    <div style={{ marginTop: 32, display: "flex", alignItems: "center", gap: 12 }}>
      <Btn primary onClick={onSave} style={{ opacity: saving ? 0.6 : 1 }}>
        {saving ? "Saving..." : saved ? <><Icons.check /> Saved</> : "Save"}
      </Btn>
      {saved && <span style={{ fontSize: 12, color: C.green, fontFamily: F.mono }}>Changes saved</span>}
    </div>
  );
}

function BioForm({ profile, updateField, onSave, saving, saved }) {
  return (<div style={{ animation: "fadeIn 0.2s ease" }}>
    <Field label="Full Name"><Input value={profile.name} onChange={v => updateField("name", v)} placeholder="Your full name" /></Field>
    <Field label="Firm"><Input value={profile.firm} onChange={v => updateField("firm", v)} placeholder="Your firm name" /></Field>
    <Field label="Title"><Input value={profile.title} onChange={v => updateField("title", v)} placeholder="Your professional title" /></Field>
    <Field label="Specialization"><Input value={profile.specialization} onChange={v => updateField("specialization", v)} placeholder="What you specialize in" /></Field>
    <Field label="Tagline" hint="Your LinkedIn headline or positioning statement"><Input value={profile.tagline} onChange={v => updateField("tagline", v)} placeholder="Your positioning statement" /></Field>
    <SaveButton onSave={onSave} saving={saving} saved={saved} />
  </div>);
}

const CONTENT_PREF_OPTIONS = [
  { id: "contrarian", label: "Contrarian takes", desc: "Challenge conventional wisdom with data. Drafts will lean into 'what everyone gets wrong' angles." },
  { id: "data", label: "Data-driven analysis", desc: "Lead with specific numbers, stats, and dollar amounts. Less opinion, more evidence." },
  { id: "anecdotes", label: "Personal anecdotes", desc: "Draw from real (anonymized) client scenarios. Builds trust through lived experience." },
  { id: "questions", label: "Provocative questions", desc: "Open with a question that stops the scroll. Drives comments and engagement." },
  { id: "frameworks", label: "Actionable frameworks", desc: "Step-by-step thinking tools your ICP can apply immediately. High save-rate format." },
  { id: "mythbusting", label: "Myth-busting", desc: "Name a common belief, then dismantle it. Strong hook potential for expertise topics." },
  { id: "timely", label: "Timely / news-reactive", desc: "React to market events, tax law changes, or trending financial topics. Rides existing attention." },
  { id: "vulnerable", label: "Vulnerable / personal", desc: "Share your own journey, mistakes, or behind-the-scenes. Humanizes the advisor brand." },
];

function ContentPreferences({ profile, updateField }) {
  // Parse stored preferences from profile (comma-separated string) or default
  const storedPrefs = (profile.content_preferences || "contrarian,data,anecdotes").split(",").map(s => s.trim()).filter(Boolean);
  const storedCustoms = (profile.custom_preferences || "").split("\n").filter(s => s.trim());

  const [selected, setSelected] = useState(new Set(storedPrefs));
  const [showCustom, setShowCustom] = useState(false);
  const [customs, setCustoms] = useState(storedCustoms);
  const [customText, setCustomText] = useState("");

  // Sync changes back to profile state
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
    <Field label="Content Preferences" hint="What types of content does your ICP engage with most? Select all that apply — this directly controls which draft formats and angles get generated.">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {CONTENT_PREF_OPTIONS.map(opt => {
          const active = selected.has(opt.id);
          return (
            <button key={opt.id} onClick={() => toggle(opt.id)} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "12px 14px", borderRadius: 6,
              background: active ? C.goldGlow : "transparent",
              border: `1px solid ${active ? "rgba(200,169,110,0.2)" : C.stroke}`,
              cursor: "pointer", textAlign: "left",
              transition: "all 0.15s ease",
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.surfaceHover; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 3, flexShrink: 0, marginTop: 1,
                border: `1.5px solid ${active ? C.gold : C.textGhost}`,
                background: active ? C.gold : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s ease",
              }}>
                {active && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.base} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
              </div>
              <div>
                <span style={{ fontSize: 13, fontWeight: 500, color: active ? C.text : C.textSoft, display: "block" }}>{opt.label}</span>
                <span style={{ fontSize: 12, color: C.textFaint, lineHeight: 1.5, marginTop: 2, display: "block" }}>{opt.desc}</span>
              </div>
            </button>
          );
        })}

        {/* Custom preferences */}
        {customs.map((c, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 6,
            background: C.goldGlow, border: `1px solid rgba(200,169,110,0.2)`,
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 3, flexShrink: 0,
              border: `1.5px solid ${C.gold}`, background: C.gold,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.base} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.text, flex: 1 }}>{c}</span>
            <button onClick={() => removeCustom(i)} style={{ background: "none", border: "none", color: C.textGhost, cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
          </div>
        ))}

        {/* Add your own */}
        {showCustom ? (
          <div style={{ padding: "12px 14px", borderRadius: 6, background: C.elevated, border: `1px solid ${C.stroke}`, animation: "fadeIn 0.15s ease" }}>
            <input
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              placeholder="e.g. Industry comparison benchmarks"
              onKeyDown={e => e.key === "Enter" && addCustom()}
              style={{
                width: "100%", background: "transparent", border: "none",
                borderBottom: `1px solid ${C.stroke}`, color: C.text,
                fontSize: 13, fontFamily: F.sans, padding: "8px 0",
              }}
              onFocus={e => e.target.style.borderBottomColor = C.gold}
              onBlur={e => e.target.style.borderBottomColor = C.stroke}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Btn primary onClick={addCustom} style={{ padding: "7px 16px", fontSize: 12 }}>Add</Btn>
              <Btn ghost onClick={() => { setShowCustom(false); setCustomText(""); }} style={{ padding: "7px 14px", fontSize: 12 }}>Cancel</Btn>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowCustom(true)} style={{
            padding: "10px 14px", borderRadius: 6,
            background: "transparent", border: `1px dashed ${C.stroke}`,
            color: C.textGhost, fontSize: 12, fontFamily: F.sans,
            cursor: "pointer", textAlign: "left", transition: "all 0.15s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.strokeHover; e.currentTarget.style.color = C.textFaint; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.stroke; e.currentTarget.style.color = C.textGhost; }}
          >
            + Add your own
          </button>
        )}
      </div>
      <p style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost, marginTop: 10 }}>
        {selected.size + customs.length} selected — drafts will favor these formats
      </p>
    </Field>
  );
}

function ICPForm({ profile, updateField, onSave, saving, saved }) {
  return (<div style={{ animation: "fadeIn 0.2s ease" }}>
    <Field label="Age Range">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Input value={profile.icp_age_min || ""} onChange={v => updateField("icp_age_min", v)} style={{ width: 60, textAlign: "center" }} placeholder="25" />
        <span style={{ color: C.textGhost }}>to</span>
        <Input value={profile.icp_age_max || ""} onChange={v => updateField("icp_age_max", v)} style={{ width: 60, textAlign: "center" }} placeholder="45" />
      </div>
    </Field>
    <Field label="Target Professions" hint="One per line"><Input multiline rows={4} value={profile.target_professions} onChange={v => updateField("target_professions", v)} placeholder="Software Engineers\nAttorneys (BigLaw)\nTech Employees" /></Field>
    <Field label="Pain Points" hint="What keeps your ICP up at night — one per line"><Input multiline rows={5} value={profile.pain_points} onChange={v => updateField("pain_points", v)} placeholder="Feel trapped on the W-2 treadmill\nEquity compensation anxiety\nWealth-building paralysis" /></Field>
    <ContentPreferences profile={profile} updateField={updateField} />
    <SaveButton onSave={onSave} saving={saving} saved={saved} />
  </div>);
}

function RulesForm({ profile, updateField, onSave, saving, saved }) {
  return (<div style={{ animation: "fadeIn 0.2s ease" }}>
    <Field label="Posts Per Week"><Input value={profile.posts_per_week || ""} onChange={v => updateField("posts_per_week", v)} style={{ width: 60, textAlign: "center" }} placeholder="4" /></Field>
    <Field label="Preferred Post Length"><Input value={profile.preferred_length} onChange={v => updateField("preferred_length", v)} placeholder="Under 200 words — short, punchy, scannable" /></Field>
    <Field label="Preferred Formats" hint="What structures you like"><Input multiline rows={3} value={profile.preferred_formats} onChange={v => updateField("preferred_formats", v)} placeholder="Contrarian hooks under 100 words\nData-driven analysis with specific numbers" /></Field>
    <Field label="Topics to Always Cover" hint="One per line"><Input multiline rows={5} value={profile.topics_always} onChange={v => updateField("topics_always", v)} placeholder="RSU/ISO/NSO taxation\nSolo 401(k) structures\nRoth conversion strategies" /></Field>
    <Field label="Topics to Never Cover" hint="One per line"><Input multiline rows={3} value={profile.topics_never} onChange={v => updateField("topics_never", v)} placeholder="Crypto/Bitcoin\nInsurance products\nSpecific stock picks" /></Field>
    <Field label="Tone & Voice Rules"><Input multiline rows={4} value={profile.tone_rules} onChange={v => updateField("tone_rules", v)} placeholder="Like a smart friend at a bar, not a compliance department\nShort, punchy sentences — no fluff" /></Field>
    <SaveButton onSave={onSave} saving={saving} saved={saved} />
  </div>);
}

function VoiceForm({ profile, updateField, onSave, saving, saved }) {
  const [showAdd, setShowAdd] = useState(false);
  return (<div style={{ animation: "fadeIn 0.2s ease" }}>
    <Field label="Post Voice Samples" hint="Your real LinkedIn posts — the AI learns your writing style from these">
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {["Your RSUs aren't a bonus...", "I make $350K and I'm broke...", "The S&P 500 at 22x earnings...", "Hot take: Your 401(k) match..."].map((s, i) => (
          <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${C.stroke}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: C.textSoft }}>{s}</span>
            <button style={{ background: "none", border: "none", color: C.textGhost, cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost, marginBottom: 12 }}>4 samples</p>
      {showAdd ? (<div><Input multiline rows={5} placeholder="Paste a LinkedIn post..." /><div style={{ display: "flex", gap: 8, marginTop: 10 }}><Btn primary>Add</Btn><Btn ghost onClick={() => setShowAdd(false)}>Cancel</Btn></div></div>)
        : <Btn onClick={() => setShowAdd(true)}>+ Add Sample</Btn>}
    </Field>
    <Separator />
    <Field label="Comment Voice Samples" hint="Comment style is different from post style — paste real comments">
      <p style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost, marginBottom: 12 }}>2 samples</p>
      <Btn>+ Add Sample</Btn>
    </Field>
    <Separator />
    <Field label="Voice Notes" hint="Free-form style rules, preferences, and guidelines that shape how AI generates your content. Write in your own words — these are fed directly into every draft and comment generation.">
      <Input multiline rows={8} value={profile.voice_notes} onChange={v => updateField("voice_notes", v)} placeholder="e.g. Never use exclamation marks. Always lead with a specific dollar amount or stat when possible. My humor is dry and deadpan — never use 'LOL' or emojis. Refer to my audience as 'high earners' not 'wealthy individuals'..." />
    </Field>
    <SaveButton onSave={onSave} saving={saving} saved={saved} />
  </div>);
}

function HistoryForm() {
  return (<div style={{ animation: "fadeIn 0.2s ease" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <p style={{ fontSize: 12, color: C.textFaint }}>Auto-synced from LinkedIn · Last sync 2h ago · {POST_HISTORY.length} posts</p>
      <Btn><Icons.sync /> Sync</Btn>
    </div>
    {POST_HISTORY.map(p => (
      <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
        <div style={{ padding: "14px 8px", borderBottom: `1px solid ${C.stroke}`, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", borderRadius: 4, margin: "0 -8px", transition: "background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          <span style={{ fontSize: 13, color: C.textSoft, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 16 }}>{p.text}</span>
          <div style={{ display: "flex", gap: 14, flexShrink: 0, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>{p.date}</span>
            <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textFaint }}>{p.likes} · {p.comments}</span>
            <span style={{ color: C.textGhost, display: "flex" }}><Icons.external /></span>
          </div>
        </div>
      </a>
    ))}
  </div>);
}

function ComplianceForm({ profile, updateField, onSave, saving, saved }) {
  return (<div style={{ animation: "fadeIn 0.2s ease" }}>
    <p style={{ fontSize: 13, color: C.gold, marginBottom: 24 }}>All generated content is checked against these rules before you see it.</p>
    <Field label="Firm Compliance Rules" hint="One rule per line"><Input multiline rows={10} value={profile.compliance_rules} onChange={v => updateField("compliance_rules", v)} placeholder='Never use the word "guarantee" or "guaranteed returns"\nNever make forward-looking statements about investment performance' /></Field>
    <Field label="Required Disclaimer Text"><Input multiline rows={3} value={profile.disclaimer_text} onChange={v => updateField("disclaimer_text", v)} placeholder="Opinions expressed are my own and do not reflect the views of..." /></Field>
    <Field label="Additional Compliance Notes"><Input multiline rows={3} value={profile.compliance_notes} onChange={v => updateField("compliance_notes", v)} placeholder="Any other compliance requirements, internal review processes, or firm-specific rules..." /></Field>
    <SaveButton onSave={onSave} saving={saving} saved={saved} />
  </div>);
}

// ═══════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════

function SettingsView() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState({});
  const [runResult, setRunResult] = useState({});

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => { setSettings(data); setLoading(false); })
      .catch(() => { setSettings({}); setLoading(false); });
  }, []);

  const updateField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRunPipeline = async (type) => {
    const endpoints = {
      "Content scrape": "/api/scrape/content",
      "Comment scrape": "/api/scrape/comments",
      "Post history sync": "/api/scrape/content", // reuse content endpoint for now
    };
    setRunning(r => ({ ...r, [type]: true }));
    setRunResult(r => ({ ...r, [type]: null }));
    try {
      const res = await fetch(endpoints[type], { method: "POST" });
      const data = await res.json();
      setRunResult(r => ({ ...r, [type]: res.ok ? "success" : "error" }));
      setTimeout(() => setRunResult(r => ({ ...r, [type]: null })), 4000);
    } catch (err) {
      setRunResult(r => ({ ...r, [type]: "error" }));
      setTimeout(() => setRunResult(r => ({ ...r, [type]: null })), 4000);
    } finally {
      setRunning(r => ({ ...r, [type]: false }));
    }
  };

  if (loading) return <div style={{ animation: "enter 0.35s ease", maxWidth: 540 }}><SectionTitle sub="Pipeline configuration and operational settings">Settings</SectionTitle><p style={{ color: C.textFaint, fontSize: 13 }}>Loading...</p></div>;

  return (
    <div style={{ animation: "enter 0.35s ease", maxWidth: 540 }}>
      <SectionTitle sub="Pipeline configuration and operational settings">Settings</SectionTitle>
      <Field label="Content Source Keywords" hint="One per line — drives trending content scraping"><Input multiline rows={5} value={settings.content_keywords} onChange={v => updateField("content_keywords", v)} placeholder="equity compensation\nRSU tax strategy\nwealth building high earners" /></Field>
      <Field label="Comment Target Keywords" hint="One per line — topics where your ICP engages"><Input multiline rows={5} value={settings.comment_keywords} onChange={v => updateField("comment_keywords", v)} placeholder="tech careers\nstartup culture\nBigLaw life" /></Field>
      <Field label="Non-Prospect Filter" hint="One per line — exclude from Outreach"><Input multiline rows={3} value={settings.non_prospect_filter} onChange={v => updateField("non_prospect_filter", v)} placeholder="Financial Advisor\nWealth Manager\nInsurance Agent" /></Field>
      <Field label="Sales Navigator Lead List">
        <div style={{ padding: "14px 0", borderBottom: `1px solid ${C.stroke}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: C.textSoft }}>{settings.lead_list_count || 0} leads · {settings.lead_list_updated || "Not uploaded"}</span><Btn>Upload CSV</Btn>
        </div>
      </Field>
      <SaveButton onSave={saveSettings} saving={saving} saved={saved} />
      <Separator />
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Pipeline</p>
        {[{ name: "Content scrape", time: "Today 6:00 AM" }, { name: "Comment scrape", time: "Today 7:00 AM" }, { name: "Post history sync", time: "Today 5:30 AM" }].map(p => (
          <div key={p.name} style={{ padding: "10px 0", borderBottom: `1px solid ${C.stroke}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: runResult[p.name] === "error" ? C.coral : C.green, boxShadow: `0 0 4px ${runResult[p.name] === "error" ? C.coral : C.green}40` }} />
              <span style={{ fontSize: 13, color: C.textSoft }}>{p.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, fontFamily: F.mono, color: C.textGhost }}>{p.time}</span>
              {runResult[p.name] === "success" ? (
                <span style={{ fontSize: 11, fontFamily: F.mono, color: C.green }}>✓ Done</span>
              ) : runResult[p.name] === "error" ? (
                <span style={{ fontSize: 11, fontFamily: F.mono, color: C.coral }}>✗ Error</span>
              ) : (
                <Btn ghost onClick={() => handleRunPipeline(p.name)} style={{ padding: "5px 12px", fontSize: 11, opacity: running[p.name] ? 0.5 : 1 }}>
                  {running[p.name] ? "Running..." : <><Icons.play /> Run</>}
                </Btn>
              )}
            </div>
          </div>
        ))}
      </div>
      <div>
        <p style={{ fontSize: 10, fontFamily: F.mono, color: C.textGhost, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Monthly cost</p>
        {[{ name: "Apify (scraping)", cost: "$49.00" }, { name: "Claude API (scoring + generation)", cost: "$22.40" }, { name: "Supabase (database)", cost: "$0.00" }].map(c => (
          <div key={c.name} style={{ padding: "8px 0", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: C.textSoft }}>{c.name}</span><span style={{ fontSize: 13, fontFamily: F.mono, color: C.textFaint }}>{c.cost}</span>
          </div>
        ))}
        <div style={{ padding: "12px 0", borderTop: `1px solid ${C.stroke}`, marginTop: 8, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>Total</span>
          <span style={{ fontSize: 14, fontFamily: F.mono, color: C.gold, fontWeight: 600 }}>$71.40/mo</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// LEFT RAIL — Expand on hover with labels
// ═══════════════════════════════════════════

const RAIL_COLLAPSED = 60;
const RAIL_EXPANDED = 180;

function Rail({ view, setView }) {
  const [expanded, setExpanded] = useState(false);
  const railWidth = expanded ? RAIL_EXPANDED : RAIL_COLLAPSED;

  const main = [
    { id: "posts", icon: Icons.posts, label: "Posts" },
    { id: "comments", icon: Icons.comments, label: "Comments" },
    { id: "outreach", icon: Icons.outreach, label: "Outreach" },
    { id: "performance", icon: Icons.performance, label: "Performance" },
  ];

  function NavItem({ id, icon: Ic, label }) {
    const active = view === id;
    const [h, setH] = useState(false);
    return (
      <button onClick={() => setView(id)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
        style={{
          width: "100%", height: 44, display: "flex", alignItems: "center",
          paddingLeft: 20, gap: 14,
          background: "none", border: "none", cursor: "pointer", position: "relative",
          color: active ? C.gold : h ? C.textSoft : C.textGhost, transition: "color 0.15s",
        }}>
        {active && <div style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 2, background: C.gold, borderRadius: "0 2px 2px 0", boxShadow: `0 0 8px ${C.gold}30` }} />}
        <Ic />
        {expanded && (
          <span style={{ fontSize: 13, fontFamily: F.sans, fontWeight: active ? 500 : 400, whiteSpace: "nowrap", opacity: expanded ? 1 : 0, transition: "opacity 0.15s" }}>
            {label}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        width: railWidth, height: "100vh", background: C.recessed,
        borderRight: `1px solid ${C.stroke}`, position: "fixed", left: 0, top: 0,
        display: "flex", flexDirection: "column", zIndex: 200,
        transition: "width 0.2s ease", overflow: "hidden",
      }}>
      <div style={{ width: "100%", height: 60, display: "flex", alignItems: "center", paddingLeft: 16, gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px rgba(200,169,110,0.15)`, flexShrink: 0 }}>
          <span style={{ fontFamily: F.serif, fontSize: 16, fontWeight: 500, color: C.base }}>P</span>
        </div>
        {expanded && (
          <span style={{ fontFamily: F.serif, fontSize: 17, fontWeight: 500, color: C.text, whiteSpace: "nowrap", opacity: expanded ? 1 : 0, transition: "opacity 0.15s" }}>The Pulse</span>
        )}
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 2 }}>{main.map(n => <NavItem key={n.id} {...n} />)}</div>
      <div style={{ flex: 1 }} />
      <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 2 }}>
        <NavItem id="profile" icon={Icons.user} label="Profile" />
        <NavItem id="settings" icon={Icons.settings} label="Settings" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// APP
// ═══════════════════════════════════════════

export default function App() {
  const [view, setView] = useState("posts");
  const views = { posts: PostsView, comments: CommentsView, outreach: OutreachView, performance: PerformanceView, profile: ProfileView, settings: SettingsView };
  const View = views[view];

  return (
    <div style={{ fontFamily: F.sans, color: C.text, background: C.base, minHeight: "100vh" }}>
      <Styles />
      <Rail view={view} setView={setView} />
      <main style={{ marginLeft: RAIL_W, minHeight: "100vh", overflow: "auto", maxHeight: "100vh" }}>
        <div style={{ maxWidth: view === "performance" || view === "comments" ? 860 : 680, margin: "0 auto", padding: "48px 40px 80px", transition: "max-width 0.3s ease" }}>
          <View key={view} />
        </div>
      </main>
    </div>
  );
}
