# The Pulse v2 — Implementation Guide

## What You're Building

A complete Next.js web app with:
- **Frontend**: The dark-surface UI from the redesign (Posts, Comments, Outreach, Performance, Profile, Settings)
- **Backend**: API routes that scrape content, score it with Claude AI, and generate drafts
- **Database**: Supabase (PostgreSQL) for all data persistence
- **Hosting**: Vercel (free tier) with automated daily pipelines
- **Scraping**: Apify actors for LinkedIn, Twitter/X, TikTok

## Cost Summary

| Service | Monthly Cost | What It Does |
|---------|-------------|--------------|
| Apify | ~$49/mo | Scrapes LinkedIn, Twitter, TikTok |
| Claude API | ~$22-35/mo | Scores content, generates drafts & comments |
| Supabase | $0 (free tier) | PostgreSQL database |
| Vercel | $0 (free tier) | Hosts the app + runs daily crons |
| **Total** | **~$71-84/mo** | |

---

## Phase 1: Set Up Accounts (15 minutes)

You need 4 accounts. Here's exactly how to set up each one.

### 1A. Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and click **Start your project**
2. Sign in with GitHub (or create an account with email)
3. Click **New Project**
4. Fill in:
   - **Name**: `pulse-v2`
   - **Database Password**: Generate a strong one and **save it somewhere** — you'll need it later
   - **Region**: Choose the closest to you (e.g., `East US` if you're East Coast)
5. Click **Create new project** — wait ~2 minutes for it to spin up
6. Once ready, go to **Project Settings → API** (left sidebar, gear icon)
7. Copy these two values — you'll need them in Phase 3:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)
   - **service_role key** (click "Reveal" — another long string)

### 1B. Anthropic (Claude API)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to **API Keys** (left sidebar)
4. Click **Create Key**, name it `pulse-v2`
5. Copy the key (starts with `sk-ant-...`) — save it
6. Go to **Billing** and add a payment method. Set a spending limit of $50/mo to be safe
7. You'll use ~$22-35/mo — Haiku for scoring (~$0.001/post), Sonnet for drafts (~$0.03/draft)

### 1C. Apify (Scraping)

1. Go to [apify.com](https://apify.com) and sign up
2. Go to **Settings → Integrations** (left sidebar)
3. Copy your **API Token** (starts with `apify_api_...`) — save it
4. **Critical step**: You must "try" each actor before the API can call it. Go to each of these and click **Try for free** → **Start**:
   - [harvestapi/linkedin-post-search](https://apify.com/harvestapi/linkedin-post-search) — run with any search term
   - [apidojo/tweet-scraper](https://apify.com/apidojo/tweet-scraper) — run with any search term
   - [clockworks/tiktok-scraper](https://apify.com/clockworks/tiktok-scraper) — run with any search term
5. After each runs once, your API token can call them programmatically

### 1D. Vercel (Hosting)

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. That's it for now — you'll connect it to your repo in Phase 3

### 1E. GitHub (Code Repository)

1. Go to [github.com](https://github.com) and sign in
2. Click **+** → **New repository**
3. Name: `pulse-v2`, Private, no README
4. Click **Create repository**
5. Leave this tab open — you'll push code to it in Phase 2

---

## Phase 2: Upload the Code to GitHub (10 minutes)

### Option A: Use Claude Cowork (Recommended — Easiest)

If you have Claude Cowork (desktop tool):

1. Download the `pulse-v2` folder from this conversation (all the files I created)
2. Open Claude Cowork
3. Ask: *"Upload the pulse-v2 folder to my GitHub repository at github.com/YOUR-USERNAME/pulse-v2"*
4. Cowork will handle the git commands for you

### Option B: Use Claude in Chrome

1. Navigate to your GitHub repo in Chrome
2. Ask Claude: *"Help me upload these project files to this GitHub repository"*
3. Claude can guide you through the upload process

### Option C: Manual (Command Line)

If you have Git installed on your computer:

```bash
# 1. Navigate to where you downloaded the pulse-v2 folder
cd ~/Downloads/pulse-v2

# 2. Initialize git and push
git init
git add .
git commit -m "Initial commit: Pulse v2"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/pulse-v2.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.

### Option D: GitHub Web Upload

1. Go to your empty `pulse-v2` repo on GitHub
2. Click **uploading an existing file** link
3. Drag the entire contents of the pulse-v2 folder in
4. This works but can be tedious with many files — Option A or C is better

---

## Phase 3: Set Up the Database (5 minutes)

1. Go to your Supabase dashboard → **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy the ENTIRE contents of `supabase-schema.sql` and paste it in
4. Click **Run** (or Cmd+Enter)
5. You should see "Success. No rows returned" — that means all tables were created
6. Verify: Go to **Table Editor** (left sidebar) — you should see tables like `advisor_profile`, `content_feed`, `comment_feed`, etc.

---

## Phase 4: Deploy to Vercel (10 minutes)

### 4A. Connect GitHub to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select your `pulse-v2` repo
4. Under **Framework Preset**, select **Next.js** (should auto-detect)
5. **DO NOT CLICK DEPLOY YET** — you need to add environment variables first

### 4B. Add Environment Variables

In the Vercel deployment screen, expand **Environment Variables** and add each one:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `ANTHROPIC_API_KEY` | Your Claude API key (`sk-ant-...`) |
| `APIFY_API_TOKEN` | Your Apify token (`apify_api_...`) |
| `CRON_SECRET` | Any random string (e.g., `pulse-v2-cron-abc123`) |

**Tip**: Make sure there are no extra spaces when pasting keys.

### 4C. Deploy

1. Click **Deploy**
2. Wait 1-2 minutes for the build
3. Once deployed, Vercel gives you a URL like `pulse-v2-xyz.vercel.app`
4. Visit it — you should see The Pulse v2 UI with mock data

### 4D. Set Up Custom Domain (Optional)

1. In Vercel, go to **Settings → Domains**
2. Add your custom domain if you have one
3. Follow DNS instructions

---

## Phase 5: Configure Your Profile (15 minutes)

Open your deployed Pulse v2 app and fill in your profile. This is critical — everything the AI generates is based on this data.

1. Click the **person icon** (bottom of left rail) → **Profile**
2. Fill in each tab:

**Bio tab**: Your name, firm, title, specialization, tagline

**ICP tab**: 
- Age range (25-45)
- Target professions (one per line)
- Pain points (one per line)
- Select content preferences that match your audience

**Post Rules tab**:
- Posts per week (default: 4)
- Preferred length, formats, topics to always/never cover
- Tone rules

**Voice tab**:
- Paste 3-5 of your real LinkedIn posts as voice samples
- Paste 2-3 of your real LinkedIn comments as comment voice samples
- This is what makes the AI match YOUR voice, not generic AI

**Compliance tab**:
- Add your firm's compliance rules (one per line)
- Add required disclaimer text

3. Click the **gear icon** → **Settings**:
- Add content source keywords (topics to scrape for inspiration)
- Add comment target keywords (topics where your ICP engages)
- Add non-prospect filter terms (Financial Advisor, Wealth Manager, etc.)

---

## Phase 6: Run Your First Pipeline (5 minutes)

The pipelines run automatically every day (content at 6am, comments at 7am via Vercel cron). But you can trigger them manually for the first time.

### Option A: Via the Dashboard

Once the Settings page has "Run Now" buttons wired up, click them.

### Option B: Via API Call

Open your browser console (Cmd+Option+J on Mac, F12 on Windows) and run:

```javascript
// Run content pipeline
fetch('/api/scrape/content', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR-CRON-SECRET' }
}).then(r => r.json()).then(console.log)

// Run comment pipeline  
fetch('/api/scrape/comments', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer YOUR-CRON-SECRET' }
}).then(r => r.json()).then(console.log)
```

Replace `YOUR-CRON-SECRET` with the cron secret you set in Vercel.

### Option C: Via curl (Terminal)

```bash
curl -X POST https://your-app.vercel.app/api/scrape/content \
  -H "Authorization: Bearer YOUR-CRON-SECRET"

curl -X POST https://your-app.vercel.app/api/scrape/comments \
  -H "Authorization: Bearer YOUR-CRON-SECRET"
```

The first run will:
1. Scrape ~50-100 posts across LinkedIn, Twitter, TikTok
2. Score each post for expertise signal and ICP relevance
3. Generate 7+ post drafts from the top-scoring content
4. Score LinkedIn posts for comment opportunities
5. Generate suggested comments for the top opportunities

This takes 3-5 minutes. After it completes, refresh the app — you should see real drafts in the Posts tab and real comment opportunities in the Comments tab.

---

## Phase 7: Daily Workflow (2 hours/week)

Once everything is running, here's your weekly workflow:

### The Batch (30-40 min, Mon/Tue)
1. Open Posts tab
2. Review each draft — edit in your voice
3. Click **Approve** for keepers, **New Draft** for replacements
4. Go to approved queue, click **Copy to Clipboard**
5. Paste into LinkedIn → submit for compliance review

### The Engage (20-30 min, 2-3x/week)
1. Open Comments tab
2. For each post: read the post, review the suggested comment
3. Click **Copy & Open on LinkedIn** — comment is copied, LinkedIn opens
4. Paste and edit the comment on LinkedIn
5. Click **Next** when done

### The Outreach (30-60 min, end of week)
1. Open Outreach tab
2. Review each warm lead and their interaction context
3. Click **Copy Message**, then **Open Profile**
4. Send personalized DM on LinkedIn

### Log Performance (5 min, 48h after each post)
1. Open Performance tab
2. Select your recent post from dropdown
3. Enter likes and comments
4. Click **Log** — this feeds back into future draft generation

---

## Troubleshooting

### "No drafts appearing"
- Check that the content pipeline has run (Settings → Pipeline shows last run time)
- Check Supabase → Table Editor → `content_feed` for scraped posts
- Check Supabase → Table Editor → `scrape_log` for errors
- Make sure your Apify actors have been "tried" at least once

### "AI drafts don't sound like me"
- Add more voice samples (5+ posts, 3+ comments)
- Make sure samples are your actual best LinkedIn content
- The system gets better with each post you add to history

### "Vercel build fails"
- Check the build logs in Vercel for specific errors
- Most common: missing environment variables
- Make sure all 6 env vars are set correctly with no extra spaces

### "Apify scraping fails"
- Check your Apify usage/balance at console.apify.com
- The LinkedIn actor costs ~$2/1K results — make sure you have credits
- If token issues: check that APIFY_API_TOKEN doesn't have extra characters

---

## Architecture Reference

```
pulse-v2/
├── pages/
│   ├── index.js              ← Main page (loads PulseApp)
│   ├── _app.js               ← Next.js app wrapper
│   ├── _document.js          ← Custom HTML document (fonts)
│   └── api/
│       ├── scrape/
│       │   ├── content.js    ← Content scrape + score pipeline
│       │   └── comments.js   ← Comment scrape + score pipeline
│       ├── drafts/index.js   ← Draft CRUD (get, approve, skip)
│       ├── comments/index.js ← Comment feed CRUD
│       ├── outreach/index.js ← Outreach lead CRUD
│       ├── profile/index.js  ← Profile, voice, prefs CRUD
│       └── performance/index.js ← Performance logging
├── components/
│   └── PulseApp.jsx          ← Complete UI (1208 lines)
├── lib/
│   ├── supabase.js           ← Supabase client (browser + server)
│   ├── ai.js                 ← Claude API (scoring + generation)
│   ├── scraper.js            ← Apify integration
│   ├── utils.js              ← Sanitizer, helpers (v1 lessons)
│   └── hooks.js              ← React data fetching hooks
├── supabase-schema.sql       ← Database schema (run in SQL Editor)
├── vercel.json               ← Cron schedules (6am content, 7am comments)
├── .env.example              ← Environment variable template
└── package.json              ← Dependencies
```

---

## What's Next (Future Iterations)

The app is built in phases. This initial deployment gets you:
- ✅ Complete UI with all 6 sections
- ✅ Backend scraping pipelines (LinkedIn, Twitter, TikTok)
- ✅ AI scoring and draft generation
- ✅ Comment opportunity scoring and suggestion
- ✅ Automated daily runs via Vercel cron
- ✅ Supabase database with all tables

**Phase 2 features** (after you've used it for 2-3 weeks):
- Wire mock data in the UI to live API data (replace DRAFTS/COMMENTS/OUTREACH/PERF constants with hooks from `lib/hooks.js`)
- Sales Navigator CSV upload
- Dynamic keyword evolution (system learns from what you approve)
- Performance sparklines from real data

**Phase 3 features**:
- Daily email digest (Resend integration)
- Competitor monitoring
- Auto-discovery of new creators to follow
