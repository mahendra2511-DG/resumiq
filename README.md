# Resumiq 2.0 — AI Resume Builder & Career Copilot (with Dexa)

Free site by Mahendra Singh · https://resumiq.vercel.app · part of [CrackAnalytics](https://www.crackanalytics.com/)

## What's inside
| Page | What it does |
|---|---|
| `/` | Landing page (live product preview, templates, roles, job-match demo, pricing, FAQ) |
| `/studio` | Resume Studio: sections, guided editor, bullet checks, Dexa AI actions, live A4 preview, quality score, role guide, job tailoring, PDF and Word download, versions, undo |
| `/job-match` | ATS & Job Match: must-have vs preferred, evidence strength, explained score, "I have this / I don't", Dexa deep read, tailor a copy |
| `/app` | Workspace: dashboard, resumes, cover letters, LinkedIn, interview prep, application tracker, find jobs, settings |
| `/samples` | 8 ready ATS resume samples (Data Analyst fresher/experienced, BA, Data Scientist, AI Engineer, Power BI, Data Engineer, Software Engineer) |
| `/templates`, `/career-roles`, `/resume-guide` | Templates gallery, 120+ role guides, writing guide |
| `/admin` | Owner-only stats (sign in as mahendraa1188@gmail.com) |

Dexa (the owl, bottom-right on every page) is the AI chat. Without an AI key everything except Dexa still works.

## Deploy on Vercel (5 minutes)
1. Upload this folder to the GitHub repo `resumiq` (replace old files) → Vercel redeploys.
2. **Supabase → SQL Editor** → paste `supabase.sql` → Run (once).
3. **Supabase → Authentication → URL Configuration**: Site URL `https://resumiq.vercel.app`, and add `https://resumiq.vercel.app/app` to Redirect URLs. (Google sign-in: enable the Google provider there.)
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

## ATS score
Every resume gets an ATS score out of 100 with visible weights: ATS format 25, Keywords 25, Impact 30, Completeness 20. Formatting issues have one-click auto-fix; "Boost with Dexa" rewrites weak bullets; "Fit to page" tightens spacing; the PDF breaks pages exactly like the preview.

## Notes
- Free plan: the old Razorpay/paid activation was removed (it could be unlocked from the browser). AI credits are now counted on the server.
- Data is local-first (browser). Signed-in users also get a private cloud copy (`rq_docs`, row-level security).
- Scores are guidance with visible weights, not an employer's ATS result.
