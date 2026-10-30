/* Resumiq — feature launcher: light-coloured cards for every main tool, grouped, searchable, one click to start.
   Used on the workspace dashboard (with live counts) and on the home page. window.RQ_LAUNCH.mount(el, { counts: true|false, compact }) */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const G = [
    ["build", "Build", "✍️", "#F3F0FF", "#6D5DF5", "#E4DEFF"],
    ["find", "Find jobs", "🔎", "#EAF4FF", "#2563EB", "#D4E6FF"],
    ["apply", "Apply & track", "📌", "#E9F9F1", "#0E8A60", "#CDEFDF"],
    ["interview", "Interview", "🎤", "#FFF4E8", "#C2620A", "#FFE2C4"],
    ["grow", "Offer & growth", "💰", "#FFF0F4", "#D23B63", "#FFD9E3"]];
  // [group, href (in app), icon, title, what it does, search words, count key]
  const F = [
    ["build", "/studio", "📄", "Resume Studio", "Build or edit your resume with live preview and ATS score", "resume cv build editor template pdf word", "resumes"],
    ["build", "#/checkup", "🩺", "Resume checkup", "Recruiter red-pen review, line by line. Free", "check review score ats mistakes", "checkup"],
    ["build", "#/versions", "🧬", "Resume versions", "Tailored copy per job, see which version gets interviews", "tailor copy version", "versions"],
    ["build", "#/cover-letter", "✉️", "Cover letter", "A letter for this job from your real experience", "cover letter email", "covers"],
    ["build", "#/linkedin", "💼", "LinkedIn optimizer", "Headline, About and skills that recruiters search", "linkedin profile headline about", ""],
    ["build", "#/li-multi", "🔗", "LinkedIn vs 3 jobs", "Missing keywords across your target jobs", "linkedin keywords compare", ""],
    ["build", "#/portfolio", "🌐", "Portfolio page", "Share your dashboards and projects with one link", "portfolio projects website tableau power bi", "portfolio"],
    ["find", "#/jobs", "🔍", "Job Agent", "Search Naukri, LinkedIn, Indeed and more in one go", "job search naukri linkedin indeed fresher off campus", "saved"],
    ["find", "/job-match", "🎯", "Job match", "Paste a job, see must-haves, gaps and fixes", "ats match job description jd keywords", "matches"],
    ["find", "#/fit", "✅", "Fit check", "Should I apply? Skills, location, notice, deal-breakers", "fit apply should eligibility", ""],
    ["find", "#/shortlist", "🏁", "Rank jobs", "Compare several jobs and pick the best ones", "rank compare shortlist", ""],
    ["find", "#/alerts", "🔔", "Job alerts", "New matching jobs every morning", "alert email notification new jobs", "alerts"],
    ["find", "#/profile", "🧭", "Career profile", "Your target roles, cities, salary and deal-breakers", "profile preferences goals career", ""],
    ["apply", "#/board", "🗂", "Pipeline board", "Drag applications from Saved to Offer", "kanban tracker board pipeline status", "apps"],
    ["apply", "#/apply", "📨", "Apply kit", "Tailored summary, letter and answers, checked for honesty", "apply kit application", ""],
    ["apply", "#/screening", "📝", "Form answers", "Answers for “Why this company?” and other form questions", "form screening questions answers", ""],
    ["apply", "#/network", "🤝", "Network & referrals", "Contacts, referral messages and reminders", "referral network contacts recruiter message", "contacts"],
    ["apply", "#/outcomes", "📈", "Follow-ups", "Polite follow-ups and what's working for you", "follow up outcome results analytics", "due"],
    ["interview", "#/interview", "🎤", "Interview prep", "Questions from your resume and the job, with feedback", "interview questions prepare", ""],
    ["interview", "#/mock", "🎙️", "Mock interview", "Practise aloud: STAR feedback plus fillers and pace", "mock practice speak voice", "mocks"],
    ["interview", "#/qbank", "📚", "Question bank", "SQL, Excel, Power BI, Tableau, Python, HR questions", "sql excel power bi tableau python questions bank", "qbank"],
    ["interview", "#/stories", "⭐", "STAR stories", "4–6 real stories that answer most questions", "star stories behavioural tell me about", "stories"],
    ["grow", "#/offer", "💰", "Offer & CTC", "CTC to in-hand salary, compare offers, negotiate", "salary ctc offer in hand tax negotiate", "offers"],
    ["grow", "#/upskill", "📚", "Upskill plan", "What to learn next, in what order, with projects", "learn skills course upskill", ""],
    ["grow", "#/goals", "🎯", "Weekly goals", "Weekly targets, streak and calendar reminders", "goals streak calendar weekly", "goals"]];
  const CSS = `.ln-top{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:12px}
.ln-s{position:relative;flex:1;min-width:220px;max-width:420px}.ln-s input{width:100%;padding:10px 14px 10px 38px;border:1px solid var(--line,#E2E8F0);border-radius:12px;font:inherit;font-size:14.5px;background:#fff}.ln-s span{position:absolute;left:13px;top:50%;transform:translateY(-50%);opacity:.55}
.ln-tabs{display:flex;gap:6px;flex-wrap:wrap}.ln-tabs button{border:1px solid var(--line,#E2E8F0);background:#fff;border-radius:99px;padding:6px 12px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer;color:var(--ink2,#334155)}.ln-tabs button.on{background:var(--ink,#0f172a);color:#fff;border-color:transparent}
.ln-g{margin-top:16px}.ln-gh{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;font-family:inherit;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px}
.ln-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,215px),1fr));gap:12px}
.ln-c{position:relative;display:flex;flex-direction:column;gap:4px;padding:14px 14px 12px;border-radius:14px;text-decoration:none!important;color:var(--ink,#0f172a);border:1px solid transparent;transition:transform .15s,box-shadow .15s,border-color .15s;min-height:118px}
.ln-c:hover,.ln-c:focus-visible{transform:translateY(-2px);box-shadow:0 10px 24px -14px rgba(15,23,42,.35)}.ln-c:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.ln-c .i{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;font-size:19px;background:#fff;box-shadow:0 1px 2px rgba(15,23,42,.06);margin-bottom:4px}
.ln-c b{font-size:15px;line-height:1.3}.ln-c p{margin:0;font-size:13px;line-height:1.4;color:#475569}.ln-c .go{margin-top:auto;padding-top:6px;font-size:12.5px;font-weight:700}
.ln-c .ct{position:absolute;top:12px;right:12px;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:99px;background:#fff}
.ln-empty{padding:18px;text-align:center;color:#64748b;font-size:14px}
@media(max-width:560px){.ln-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ln-c{min-height:0;padding:12px}.ln-c p{display:none}.ln-c b{font-size:14px}.ln-c .go{display:none}.ln-c .ct{top:8px;right:8px}}`;
  let cssOn = false; const css = () => { if (cssOn) return; cssOn = true; const s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); };

  function counts() {
    const R = window.RQ, S = R && R.store; if (!S) return {}; const L = (k) => S.list(k), cp = (t) => S.list("cp:" + t), t = new Date().toISOString().slice(0, 10);
    const apps = L("application"), saved = L("analysis").filter(a => a.data && (a.data.source === "global-search" || a.data.source === "manual-job"));
    const due = apps.filter(a => a.data.followUp && a.data.followUp <= t && !["Offer", "Hired", "Rejected", "No response", "Withdrawn", "Saved", "Ready to Apply"].includes(a.data.status)).length;
    const q = cp("qbank")[0], known = q ? Object.values(q.data.marks || {}).filter(v => v === "known").length : 0, ck = cp("checkup")[0], off = cp("offers")[0];
    const n = (x, w) => x ? x + " " + w : "";
    let goals = ""; try { const C = window.RQ_CP4; if (C) { const s = C.streak(C.activity()); goals = s ? "🔥 " + s + (s === 1 ? " day" : " days") : ""; } } catch (e) {}
    return { resumes: n(L("resume").length, "saved"), checkup: ck ? ck.data.score + "/100" : "", versions: n(L("resume").filter(r => r.data && r.data.tailoredFor).length, "tailored"), covers: n(L("cover").length, "saved"),
      portfolio: cp("portfolio").length ? "Ready" : "", saved: n(saved.length, "saved"), matches: n(L("analysis").filter(a => a.data && !a.data.cp && !a.data.source).length, "done"), alerts: n(cp("alert").length, "on"),
      apps: n(apps.length, apps.length === 1 ? "job" : "jobs"), contacts: n(cp("contact").length, "people"), due: due ? due + " due" : "", mocks: n(cp("mock").length, "done"),
      qbank: known ? known + " known" : "", stories: n(cp("story").length, "stories"), offers: off ? n((off.data.offers || []).length, "offers") : "", goals, _due: due };
  }
  function mount(el, opt) {
    if (!el) return; css(); opt = opt || {}; const inApp = !!opt.inApp, K = opt.counts ? counts() : {};
    let tab = "all", q = ""; try { tab = localStorage.getItem("rq_ln_tab") || "all"; } catch (e) {}
    const href = (h) => inApp ? h : (h[0] === "#" ? "/app" + h : h);
    el.innerHTML = `<div class="ln-top"><label class="ln-s"><span aria-hidden="true">🔎</span><input type="search" id="ln-q" placeholder="What do you want to do? e.g. salary, SQL questions, referral" aria-label="Search features"></label>
      <div class="ln-tabs" role="tablist" aria-label="Feature groups"><button type="button" data-t="all">All</button>${G.map(g => `<button type="button" data-t="${g[0]}">${g[2]} ${esc(g[1])}</button>`).join("")}</div></div><div id="ln-body"></div>`;
    const draw = () => { const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      const hit = (f) => !words.length || words.every(w => (f[3] + " " + f[4] + " " + f[5]).toLowerCase().includes(w));
      const groups = G.filter(g => tab === "all" || q || g[0] === tab).map(g => [g, F.filter(f => f[0] === g[0] && hit(f))]).filter(x => x[1].length);
      el.querySelector("#ln-body").innerHTML = groups.length ? groups.map(([g, fs]) => `<div class="ln-g"><h3 class="ln-gh" style="color:${g[4]}">${g[2]} ${esc(g[1])}</h3><div class="ln-grid">${fs.map(f => { const c = f[6] && K[f[6]];
        return `<a class="ln-c" href="${esc(href(f[1]))}" style="background:${g[3]};border-color:${g[5]}" data-f="${esc(f[1])}"><span class="i">${f[2]}</span>${c ? `<span class="ct" style="color:${g[4]}">${esc(c)}</span>` : ""}<b>${esc(f[3])}</b><p>${esc(f[4])}</p><span class="go" style="color:${g[4]}">Open →</span></a>`; }).join("")}</div></div>`).join("")
        : `<div class="ln-empty">No feature matches “${esc(q)}”. Try “resume”, “jobs”, “interview” or “salary”, or ask Dexa.</div>`;
      el.querySelectorAll("[data-t]").forEach(b => { const on = !q && b.dataset.t === tab; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); }); };
    el.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { tab = b.dataset.t; q = ""; el.querySelector("#ln-q").value = ""; try { localStorage.setItem("rq_ln_tab", tab); } catch (e) {} draw(); });
    el.querySelector("#ln-q").oninput = (e) => { q = e.target.value.trim(); draw(); };
    draw();
  }
  window.RQ_LAUNCH = { mount, FEATURES: F, GROUPS: G, counts };
})();
