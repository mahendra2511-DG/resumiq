# ResumeIQ Feature Matrix: AI Job Search Integration

**Source projects inspected:**
- `resumiq-copilot` (base existing website)
- `resumiq-global-job-search` (enhanced variant with Adzuna global search)
- `ai-job-search-master` (original Claude Code / agent skills framework, MIT, primarily local Danish-market oriented)

**Integration approach:** Features from the original framework were adapted into the existing Resumiq web architecture (static HTML + client JS + Vercel serverless API + Supabase). Local agent commands (`/setup`, `/scrape`, etc.) become interactive web workflows under `/app#/...`. Existing Resume Builder, ATS checker, Job Match, Studio, templates, Dexa, auth, and data model are fully preserved. No starter-template replacement.

**Legend:**
- ✅ Implemented (production-ready in current codebase)
- 🟡 Partial (core UX present; advanced automation, multi-source, or external API incomplete)
- 🔴 Missing / Blocked (requires external credentials, OAuth, licensed data, or legal API access not present)
- ⚪ Intentionally excluded (documented reason)

| # | Original Capability | Resumiq Status | Implementation Notes | Remaining Gaps |
|---|---------------------|----------------|----------------------|----------------|
| 1 | Intelligent Candidate Profile Setup (`/setup`) | 🟡 Partial | Career Profile page (`/app#/profile`) with structured fields, AI fill from resume, edit sections, local + cloud sync via `rq_docs`. Import from resume PDF/Word via Studio. | Multi-document ingestion (LinkedIn export, certificates, portfolio, prior applications) with contradiction detection & targeted follow-up questions; source-document provenance & last-updated tracking; review-before-save UX for extracted data. Never invents facts (Dexa rule enforced). |
| 2 | Competency Discovery (`/expand`) | 🔴 Missing | No dedicated `/expand` flow. Skills extracted only from resume + user input. | GitHub / portfolio / Kaggle / Scholar / certificate connectors; evidence mapping; verified vs claimed vs inferred distinction; permission + rate-limit handling. |
| 3 | Automated Job Search Orchestration (`/setup` + `/scrape`) | 🟡 Partial | Global job discovery (`/app#/jobs`) with Adzuna live search (server-side, rate-limited, country-aware) + curated board links + manual URL/JD import. Normalization, basic dedupe by URL, save-to-shortlist. | Multi-provider framework (original Danish portals: Jobindex, Jobnet, Jobbank, Jobdanmark, Freehire, LinkedIn skill); full pagination/retry/expiry detection; official API adapters only. Scraping blocked by ToS/CAPTCHA policy. |
| 4 | Job Ranking & Eligibility Engine (`/rank`) | ✅ Implemented | Fit Check (hard gates: location, language, notice, deal-breakers) + weighted score (Technical 30 / Experience 25 / Work-style 15 / Career 30). Rank many jobs view with deadlines. Explainable factors, matching/missing skills. | Configurable user weights UI; bulk ranking history persistence; more granular transferable-skill mapping. |
| 5 | Application Generation & Independent Review (`/apply`) | ✅ Implemented | Apply Kit: Dexa drafts tailored resume + cover letter + form answers → second Dexa reviewer pass (unsupported claims, interview backtrack, style, keywords) → save + tracker. PDF/DOCX via existing Studio. Preview & approve required. | Full multi-iteration review loop until quality criteria; automated PDF text-extract + visual page render validation (pypdf-style); ATS parseability report on generated PDF. |
| 6 | Custom Templates (`/add-template`) | 🟡 Partial | Existing template gallery + Studio selection; sample generation & ATS checks. | User-upload / register new LaTeX/HTML templates with field validation, page-limit rules, sample verification. |
| 7 | Extensible Job Portal Connectors (`/add-portal`) | 🟡 Partial | Modular server endpoint pattern (`api/jobs.js`) for Adzuna. Provider interface concept documented. | Full adapter registry, validation tests, rate-limit per provider, configuration UI. Original 6 Danish portals are region-specific and mostly scraping-based → not ported (ToS / anti-bot). Replacement: Adzuna + public board links. |
| 8 | Application Outcome Management (`/outcome`) | ✅ Implemented | Tracker with statuses (Saved → Applied → Interview → Offer / Rejected / Withdrawn), notes, follow-ups, stale detection, funnel, lessons. Event-ish history via notes + followups array. Documents linked by resume version. | Richer status set (Recruiter contacted, Assessment, Closed); full event/interview-stage history table; automatic archive of exact PDF/DOCX used; rejection-reason taxonomy + analysis. |
| 9 | Gmail Integration | 🔴 Blocked | Documented as future. | Requires Google OAuth consent screen, Gmail API scopes (readonly), token storage/refresh on server, message classification, user confirmation before status change. Not implemented. |
| 10 | Notion Integration | 🔴 Blocked | Documented as future. | Requires Notion integration token + database selection + mapping + idempotent sync. Not implemented. |
| 11 | Skill-Gap Analysis & Learning Plan (`/upskill`) | ✅ Implemented | Upskill heatmap + personalized learning plan (Dexa). Progress tracking via profile skills. | Frequency/importance/confidence heatmap across shortlisted jobs; mandatory vs preferred distinction; project + resource recommendations with portfolio evidence links; market-demand signals. |
| 12 | Salary Benchmarking | 🟡 Partial | Research links + Adzuna salary ranges when present. Offline dataset upload concept noted. | Licensed salary datasets, sample-size / observation-date display, currency normalization with dated FX source, percentile estimates only from real data. No invention. |
| 13 | Offline Application Analytics | 🟡 Partial | CSV export of jobs/applications. Funnel view in Outcomes. | Self-contained single-file HTML report (embedded CSS/JS, filters, searchable table, funnel charts) that works offline. |
| 14 | Safe Reset (`/reset`) | 🟡 Partial | Settings → wipe all data (with confirm). Per-item delete. | Granular choices: search prefs / cached jobs / drafts / full workspace. Clear pre-confirmation inventory of what will be deleted. Preserve original uploaded documents option. |
| 15 | Persistent Storage & Security | ✅ Implemented | Local-first (IndexedDB/localStorage) + Supabase `rq_docs` with RLS for signed-in users. Server-side AI key & Adzuna credentials. Origin checks, rate limits, input sanitization. No secrets in client bundles. | Versioned migrations for any new tables; SSRF/XSS/injection hardening review on new endpoints; data export/deletion already present. |
| 16 | Existing ResumeIQ Preservation | ✅ Strictly followed | All original pages, routes, Studio, ATS, Job Match, Career Profile, Fit Check, Rank, Apply Kit, STAR, Mock Interview, Follow-ups, Upskill, templates, dashboard, branding, theme, auth, exports preserved. Backward-compatible data model (`data.cp` tag). | None. |
| 17 | Implementation & Testing | 🟡 Partial | Dependency-free static + Vercel functions. Manual verification of existing flows. | Full unit/integration/e2e suite (ranking, dedupe, eligibility, document validation, auth isolation, mocked providers) not automated in this delivery. |
| 18 | Final Deliverables | ✅ This package | Updated source ZIP, this matrix, file list, .env.example, provider docs, setup steps, limitations list. | Automated test report limited by environment. |

## Provider / External Service Summary

| Provider | Status | Notes |
|----------|--------|-------|
| Adzuna | ✅ Live (optional) | Official API. Set `ADZUNA_APP_ID` + `ADZUNA_APP_KEY`. Supported countries listed in code. Rate-limited server-side. |
| Danish portals (Jobindex, Jobnet, etc.) | ⚪ Excluded | Primarily scraping; ToS / anti-bot restrictions. Pattern preserved for future official APIs. |
| LinkedIn Jobs | 🔴 Blocked | No public search API suitable for this use; scraping prohibited. |
| Gmail / Notion | 🔴 Blocked | OAuth + consent required; not activated. |
| Salary data | 🟡 Research links only | No licensed dataset integrated. |
| GitHub / Kaggle / Scholar | 🔴 Not started | Would need user-authorized tokens + ToS-compliant clients. |

## Acceptance Status

ResumeIQ remains fully functional. Every original capability is classified above. Core user-facing career-copilot workflows (profile → fit → rank → apply-kit → track → upskill) are production-oriented adaptations of the original agent framework, running inside the existing Resumiq site without replacing it.
