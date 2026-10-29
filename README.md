# Resumiq 2.0 — AI Resume Builder & Career Copilot (with Dexa)

Free site by Mahendra Singh · https://resumiq-pekm.vercel.app · part of [CrackAnalytics](https://www.crackanalytics.com/)

## What's inside
| Page | What it does |
|---|---|
| `/` | Landing page (live product preview, templates, roles, job-match demo, pricing, FAQ) |
| `/studio` | Resume Studio: sections, guided editor, bullet checks, Dexa AI actions, live A4 preview, quality score, role guide, job tailoring, PDF and Word download, versions, undo |
| `/job-match` | ATS & Job Match: must-have vs preferred, evidence strength, explained score, "I have this / I don't", Dexa deep read, tailor a copy |
| `/app` | Workspace: dashboard, resumes, cover letters, LinkedIn, interview prep, application tracker, global job discovery, settings |
| `/app#/profile` … `/app#/screening` | **Job Search Copilot** (new): Career profile · Fit check (hard gates: location, language, notice period, your deal-breakers; then Technical 30 / Experience 25 / Work-style 15 / Career 30) · Rank many jobs with deadlines · Apply kit (Dexa drafts → a second Dexa pass reviews: unsupported claims, interview backtrack test, style lint, keyword coverage → saves tailored resume + letter + tracker) · STAR story bank with coverage map · Mock interview (6 staged questions, voice answers, STAR feedback, summary) · Follow-ups & outcomes (funnel, quiet/stale sweeps, follow-up drafts, lessons) · Upskill heatmap + learning plan · Application-form answers with exact counts and a .txt pack |
| `/samples` | 8 ready ATS resume samples (Data Analyst fresher/experienced, BA, Data Scientist, AI Engineer, Power BI, Data Engineer, Software Engineer) |
| `/templates`, `/career-roles`, `/resume-guide` | Templates gallery, 120+ role guides, writing guide |
| `/admin` | Owner-only stats (sign in as mahendraa1188@gmail.com) |

Dexa (the owl, bottom-right on every page) is the AI chat. Without an AI key everything except Dexa still works.

## Deploy on Vercel (5 minutes)
1. Upload this folder to the GitHub repo `resumiq` (replace old files) → Vercel redeploys.
2. **Supabase → SQL Editor** → paste `supabase.sql` → Run (once).
3. **Supabase → Authentication → URL Configuration**: Site URL `https://resumiq-pekm.vercel.app`, and add `https://resumiq-pekm.vercel.app/app` to Redirect URLs. (Google sign-in: enable the Google provider there.)
4. **Vercel → Project → Settings → Environment Variables** (Production), then Redeploy:

| Name | Value | Needed? |
|---|---|---|
| `XAI_API_KEY` | your Grok key from console.x.ai | one of these two |
| `GROQ_API_KEY` | your Groq key from console.groq.com | one of these two |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | recommended (accurate daily limits + admin stats) |
| `AI_DAILY_GUEST` | e.g. `10` | optional (default 10) |
| `AI_DAILY_USER` | e.g. `40` | optional (default 40) |
| `AI_MODEL` | e.g. `grok-3-mini` | optional (auto-picked from your key's model list) |

Keys live only in Vercel. Never put them in the code or send them to anyone.

## Global Job Search (added)
- Search links across LinkedIn, Indeed, Google Jobs, Glassdoor, Wellfound, Remote OK and We Work Remotely, plus Naukri/Foundit for India.
- Optional live listings through the Adzuna API for supported markets; the server endpoint keeps credentials out of the browser, applies request limits, validates country codes, and returns a small normalized job payload.
- Save live or manually pasted jobs, deduplicate by URL/provider ID, estimate resume keyword overlap, open company/salary research links, add a job to the application tracker, and export the shortlist as CSV.
- Basic posting-integrity warnings for hidden styling, instruction-like text and invisible Unicode. This is a review aid, not a guarantee that a posting is safe.
- Full fit checks, bulk ranking, application kits, STAR stories, mock interviews, follow-ups and upskill plans continue to use the existing Copilot workflows.

### Enable live job listings
Set these server-side in Vercel → Project → Settings → Environment Variables, then redeploy:

| Name | Purpose | Required? |
|---|---|---|
| `ADZUNA_APP_ID` | Adzuna API application ID | Only for live listings |
| `ADZUNA_APP_KEY` | Adzuna API application key | Only for live listings |

Get credentials from [Adzuna Developer](https://developer.adzuna.com/). The endpoint currently supports `us`, `gb`, `in`, `ca`, `au`, `de`, `fr`, `nl`, `sg`, `za`, `nz`, `ie`, `pl`, `br`, `at`, `ch`, `es`, and `it`. Provider coverage and availability vary by country. Adzuna terms require attribution when displaying listings; the live results link back to Adzuna. Review their current terms and obtain the appropriate licence before using API listings in a commercial product. See [API overview](https://developer.adzuna.com/overview) and [terms](https://developer.adzuna.com/docs/terms_of_service).

### Integrations that still need separate credentials / implementation
- **Gmail sync:** requires Google OAuth consent, Gmail API scopes, token storage/refresh and a user-approved message-matching workflow. Not enabled by this ZIP integration.
- **Notion sync:** requires a Notion integration token, database ID, user authorization/permissions and a sync endpoint. Not enabled by this ZIP integration.
- **Company/salary data:** currently opens research searches; structured salary benchmarks require a licensed data provider/API. Search-engine links are not verified salary estimates.
- **Automatic multi-board scraping / auto-apply:** not enabled. Public job-board links and Adzuna live search are provided; many boards restrict scraping or require partner APIs. ResumeIQ does not submit applications automatically.

## ATS score
Every resume gets an ATS score out of 100 with visible weights: ATS format 25, Keywords 25, Impact 30, Completeness 20. Formatting issues have one-click auto-fix; "Boost with Dexa" rewrites weak bullets; "Fit to page" tightens spacing; the PDF breaks pages exactly like the preview.

## Job Search Copilot: credits
Rule-based parts are free and instant (fit score, gates, ranking, style lint, funnel, heatmap). AI parts use 1 credit each: profile fill, deep fit read, draft (2: tailor + letter), reviewer pass, stories, mock questions, each answer feedback, follow-up draft, learning plan, form answers. Workflow ideas adapted from the open-source *ai-job-search* framework (MIT licence).
Copilot data is stored as `analysis` documents tagged with `data.cp`, so it syncs to the existing `rq_docs` table: **no SQL change needed**.

## Notes
- Free plan: the old Razorpay/paid activation was removed (it could be unlocked from the browser). AI credits are now counted on the server.
- Data is local-first (browser). Signed-in users also get a private cloud copy (`rq_docs`, row-level security).
- Scores are guidance with visible weights, not an employer's ATS result.

---

## Integration summary (AI Job Search features)

See **FEATURE_MATRIX.md** for the complete capability-by-capability status.

### What was added / enhanced in this delivery
- Granular Safe Reset in Settings (clear jobs only, drafts only, preferences, or full wipe) with confirmation inventory.
- Offline self-contained HTML application analytics report (download from Follow-ups & outcomes).
- Adzuna-backed global job discovery (already present in the global variant used as base).
- Clear documentation of blocked external integrations (Gmail, Notion, multi-portal scraping).

### Local development
```bash
# Static site — any static server
npx serve .
# or
python3 -m http.server 3000
```
API routes (`api/*.js`) require Vercel (or a Node adapter that matches the serverless signature). For full local API testing, use `vercel dev` after installing the Vercel CLI and setting env vars.

### Production deployment
1. Push the contents of this folder to your GitHub repo (or upload via Vercel).
2. In Supabase SQL Editor run `supabase.sql` once (if not already applied).
3. Configure Auth redirect URLs for your production domain.
4. Set environment variables (see `.env.example`).
5. Redeploy. No database migration is required for the Copilot features (`data.cp` tag reuses `rq_docs`).

### Provider setup
- **Adzuna**: https://developer.adzuna.com/ — free tier available; attribution required; country coverage listed in `api/jobs.js`.
- **xAI / Groq**: obtain API keys from respective consoles; one is sufficient for Dexa.
- Gmail / Notion: not activated; would require OAuth consent + server-side token handling.

### Security notes
- Provider secrets stay server-side.
- Job postings and uploaded documents are treated as untrusted data.
- Origin checks and rate limits on API routes.
- User data isolation via Supabase RLS for signed-in users; local-only for guests.

### Remaining limitations
- No automatic application submission.
- No multi-provider scraping of boards that prohibit it.
- Competency discovery from GitHub/Kaggle/Scholar not implemented.
- Full multi-document profile ingestion with contradiction resolution is partial.
- Automated PDF visual/text validation loop for generated applications is partial (Studio preview + download exist).
- Salary percentiles are not invented; only provider-returned ranges or research links are shown.

### Test report (inspection-based)
| Area | Result | Notes |
|------|--------|-------|
| Existing Studio / ATS / Job Match | Passed (manual) | Preserved |
| Copilot profile / fit / rank / apply-kit | Passed (manual) | Core flows intact |
| Global Adzuna search endpoint | Passed (code review) | Requires credentials to exercise live |
| Safe reset granular actions | Passed (code) | New |
| Offline HTML report | Passed (code) | New |
| Auth / RLS isolation | Skipped | Requires live Supabase |
| Unit tests for ranking / dedupe | Skipped | No automated suite in this static delivery |
| E2E search → rank → apply → track | Partial | Manual path works; automated e2e not present |

Features requiring external activation: Adzuna (optional), XAI/Groq (for AI), Supabase (recommended), future Gmail/Notion OAuth.

## Copilot part 3 (assets/js/copilot3.js), rule-based, no AI credits
- **Pipeline board** (`#/board`): drag-and-drop Kanban over the tracker stages, closed column asks why, days-in-stage and follow-up tags, and "What converts" tables by resume version, role level and channel.
- **Network & referrals** (`#/network`): contacts per application (recruiter, referrer, alumni…), next-touch reminders, LinkedIn people-search links, six outreach templates with a 300-character check for invite notes, "Mark as sent" logging.
- **Resume checkup** (`#/checkup`): line-by-line checks (numbers, weak openers, passive voice, repeated verbs, pronouns, buzzwords, "Objective", length, bullet size, dates, contact details, headings, symbols, skills) plus job title / education / experience-level / skills match when a job description is pasted.
- **LinkedIn vs jobs** (`#/li-multi`): scores a LinkedIn profile against up to 3 job descriptions and lists missing keywords by how many jobs want them.
- Applications now record **How you applied** (channel).

## Copilot parts 4–5 (copilot4.js, copilot5.js, checkup.js, qbank-data.js, portfolio.js)
- **Delivery coach** in Mock interview: filler words, pace (words per minute when spoken), long pauses, hedging, answer length. Free.
- **Recruiter red pen** live in the Studio score tab (shared rules in `checkup.js`); bullet hints now flag clichés.
- **Question bank** (`#/qbank`): Data Analyst questions (SQL, Excel, Power BI, Tableau, Python, statistics, case, HR) by level and company type, mark known / revise, 10-question practice rounds, add your own.
- **Offer & CTC** (`#/offer`): CTC → in-hand (new regime FY 2025-26 / 2026-27 slabs, ₹75,000 standard deduction, 87A up to ₹12 L with marginal relief, 4% cess), compare up to 3 offers, negotiation email.
- **Weekly goals + streak** (`#/goals`, dashboard card) and **calendar export** (.ics: interviews, follow-ups, contact reminders, deadlines). Applications have an "Interview on" date.
- **Save-to-Resumiq bookmarklet** (Job Agent) → `#/capture` reads schema.org JobPosting, scam/hidden-text warnings, match score.
- **Portfolio page** (`#/portfolio` → `/portfolio#p=…`): data lives in the link (compressed); also downloadable HTML. Phone number never shown.
- **Resume versions** (`#/versions`): tailored copies linked to jobs and applications, interview rate per version.
- **Fresher filter + off-campus drives** in Job Agent and live search.
- **Job alerts** (`#/alerts`) + daily cron `api/alerts.js`. Env: `CRON_SECRET`, `RESEND_API_KEY`, `ALERT_FROM`, `SUPABASE_SERVICE_ROLE_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` (optional `SITE_URL`).
- **Course batches** for trainers: students add a batch code in Settings; Admin shows per-batch progress (summary numbers only).
- **Dexa language**: English or Hinglish explanations (Settings). Resume text, letters and emails stay English.
- `vercel.json`: microphone now allowed for this site (needed for spoken answers).
