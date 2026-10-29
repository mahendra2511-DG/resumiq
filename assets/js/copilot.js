/* Resumiq — Job Search Copilot, part 1: career profile, fit check (gates + weighted dimensions), rank many jobs,
   Apply kit (drafter → reviewer). Workflow ideas adapted from the open-source "ai-job-search" framework (MIT).
   Pages register into the workspace router (app.js) through window.RQ_EXTRA_ROUTES. Everything is local-first. */
(function () {
  "use strict";
  const { $, $$, esc, toast, store, rel, fmtDay } = window.RQ;
  const A = () => window.RQ_APP, RS = () => window.RQ_RESUME, JD = () => window.RQ_JD;
  const lc = (s) => String(s || "").toLowerCase();
  const listOf = (t) => String(t || "").split(/\n|,|;/).map(x => x.trim()).filter(Boolean);
  const uniq = (a) => [...new Set(a)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ---------- storage: copilot docs live as kind "analysis" with data.cp ---------- */
  const cpList = (t) => store.list("cp:" + t);
  const cpSave = (t, title, data, id) => store.save({ id, kind: "analysis", title: title || t, data: Object.assign({}, data, { cp: t }) });
  const PROFILE0 = { status: "", targetRoles: "", sectors: "", companies: "", locations: "", workMode: "Any", relocate: "Maybe", noticeDays: "", languages: [["English", "Professional"]], expected: "", primarySkills: "", secondarySkills: "", strengths: "", growth: "", environment: "", energizing: "", draining: "", goals: "", dealbreakers: "" };
  const profileDoc = () => cpList("profile")[0] || null;
  const profile = () => Object.assign({}, PROFILE0, (profileDoc() || {}).data || {});
  const profileText = (p) => { p = p || profile(); const L = (k, t) => p[k] ? `${t}: ${listOf(p[k]).join(", ")}\n` : "";
    return (L("status", "Status") + L("targetRoles", "Target roles") + L("sectors", "Target sectors") + L("locations", "OK locations") + `Work mode: ${p.workMode}; relocate: ${p.relocate}${p.noticeDays ? "; notice " + p.noticeDays + " days" : ""}\n` + ((p.languages || []).length ? "Languages: " + p.languages.map(l => l[0] + " (" + l[1] + ")").join(", ") + "\n" : "") + L("primarySkills", "Primary skills") + L("secondarySkills", "Secondary skills") + L("strengths", "Strengths") + L("growth", "Growth areas") + L("environment", "Thrives in") + L("energizing", "Energizing tasks") + L("draining", "Draining tasks") + L("goals", "Career goals") + L("dealbreakers", "Deal-breakers")).trim(); };
  const profileFill = (p) => { const keys = ["targetRoles", "sectors", "locations", "primarySkills", "strengths", "environment", "energizing", "draining", "goals", "dealbreakers"]; return Math.round(keys.filter(k => String(p[k] || "").trim()).length / keys.length * 100); };

  /* ---------- fit engine (rule-based, instant, free; Dexa can add a deeper read) ---------- */
  const W = { technical: 30, experience: 25, culture: 15, career: 30 };   // location & language are gates, not weights
  const VERDICTS = [[75, "Strong fit", "ok", "Apply, and tailor everything."], [60, "Good fit", "brand", "Apply, and address the gaps in your cover letter."], [45, "Moderate fit", "warn", "Think it over: apply only if the role really matters to you."], [30, "Weak fit", "bad", "Probably skip, unless there's a strategic reason."], [0, "Poor fit", "bad", "Skip this one."]];
  const verdictOf = (n) => VERDICTS.find(v => n >= v[0]);
  const CITIES = ["bangalore", "bengaluru", "mumbai", "navi mumbai", "pune", "hyderabad", "chennai", "delhi", "new delhi", "gurgaon", "gurugram", "noida", "kolkata", "ahmedabad", "jaipur", "kochi", "cochin", "coimbatore", "indore", "chandigarh", "lucknow", "bhubaneswar", "nagpur", "mysore", "mysuru", "trivandrum", "thiruvananthapuram", "vadodara", "surat", "goa", "visakhapatnam", "bhopal", "dubai", "singapore", "london", "remote"];
  const LANGS = ["english", "hindi", "kannada", "tamil", "telugu", "marathi", "bengali", "gujarati", "malayalam", "punjabi", "odia", "urdu", "french", "german", "spanish", "japanese", "arabic", "mandarin", "korean", "portuguese", "italian", "dutch", "russian"];
  const LV = { basic: 1, conversational: 2, professional: 3, fluent: 4, native: 5 };
  const sentences = (t) => String(t || "").replace(/\s+/g, " ").split(/(?<=[.!?;•\n])\s+|\s[•·▪-]\s/).map(x => x.trim()).filter(Boolean);
  const quote = (jd, re) => { const s = sentences(jd).find(x => re.test(x)); return s ? "“" + (s.length > 160 ? s.slice(0, 157) + "…" : s) + "”" : ""; };
  function gates(jd, p) {
    const t = lc(jd), out = {};
    // location
    const remote = /\b(fully remote|100% remote|remote[- ]first|work from home|wfh|remote role|remote position)\b/.test(t);
    const hybrid = /\bhybrid\b/.test(t);
    const cities = CITIES.filter(c => c !== "remote" && new RegExp("\\b" + c + "\\b").test(t));
    const mine = listOf(p.locations).map(lc);
    if (remote && p.workMode !== "Office") out.location = ["PASS", "Remote role."];
    else if (!cities.length) out.location = ["FLAG", "The job doesn't say where. Check before applying."];
    else if (mine.some(m => cities.some(c => m.includes(c) || c.includes(m)))) out.location = ["PASS", "In a city you listed (" + cities.slice(0, 3).join(", ") + ")" + (hybrid ? ", hybrid." : ".")];
    else if (!mine.length) out.location = ["FLAG", "Job is in " + cities.slice(0, 3).join(", ") + ". Add your OK locations to your profile."];
    else if (p.relocate === "Yes") out.location = ["PASS", "Job is in " + cities.slice(0, 3).join(", ") + "; you're open to relocating."];
    else if (p.relocate === "No") out.location = ["FAIL", "Needs " + cities.slice(0, 3).join(", ") + " and you don't want to relocate. " + quote(jd, new RegExp(cities[0], "i"))];
    else out.location = ["FLAG", "Job is in " + cities.slice(0, 3).join(", ") + ", not in your list. Would you relocate?"];
    // language (only languages the ROLE needs, not the language the ad is written in)
    const have = new Map((p.languages || []).map(l => [lc(l[0]), LV[lc(l[1])] || 3]));
    const need = [];
    sentences(jd).forEach(s => { const sl = lc(s); if (!/(fluen|proficien|native|speak|spoken|written|verbal|communicat|knowledge of|command of|must know|language)/.test(sl)) return;
      LANGS.forEach(L => { if (new RegExp("\\b" + L + "\\b").test(sl) && !need.find(n => n[0] === L)) need.push([L, /native|mother tongue/.test(sl) ? 5 : /fluen|excellent|strong|proficien/.test(sl) ? 4 : /conversational|basic|working knowledge/.test(sl) ? 2 : 3, s]); }); });
    const fails = need.filter(n => !have.has(n[0])), low = need.filter(n => have.has(n[0]) && have.get(n[0]) < n[1]);
    out.language = !need.length ? ["PASS", "No special language requirement."] : fails.length ? ["FAIL", "Needs " + fails.map(n => n[0][0].toUpperCase() + n[0].slice(1)).join(", ") + ", which isn't in your profile. “" + fails[0][2].slice(0, 140) + "”"] : low.length ? ["FLAG", "Bar may be higher than your level for " + low.map(n => n[0][0].toUpperCase() + n[0].slice(1)).join(", ") + ". “" + low[0][2].slice(0, 140) + "” You decide."] : ["PASS", "You meet the language needs."];
    // notice period
    const m = t.match(/notice period (?:of )?(?:up to |less than |max(?:imum)? |within |below )?(\d{1,3}) ?days/) || t.match(/join(?:ing)? within (\d{1,3}) ?days/);
    const imm = /\bimmediate(ly)? (joiners?|joining|joinees?|start)\b|join immediately|immediate availability/.test(t);
    const nd = +p.noticeDays;
    out.notice = (imm || m) && p.noticeDays !== "" && !isNaN(nd) ? (imm && nd > 15 ? ["FLAG", "They want an immediate joiner; your notice is " + nd + " days."] : m && nd > +m[1] ? ["FLAG", "They want joining within " + m[1] + " days; yours is " + nd + "."] : ["PASS", "Your notice period fits."]) : ["PASS", imm || m ? "Add your notice period in your profile to check this." : "No joining constraint mentioned."];
    // deal-breakers the user listed
    const negated = (d) => { const e = lc(d).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return sentences(jd).filter(x => lc(x).includes(lc(d))).every(x => new RegExp("\\b(no|not|non|without|never|zero)\\b[^.]{0,25}" + e + "|" + e + "[^.]{0,20}\\b(not required|not needed|not applicable|not mandatory|none)\\b", "i").test(x)); };
    const hits = listOf(p.dealbreakers).filter(d => d.length > 2 && t.includes(lc(d)) && !negated(d));
    out.dealbreakers = hits.length ? ["FLAG", "Mentions your deal-breaker: " + hits.join(", ") + ". " + quote(jd, new RegExp(hits[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))] : ["PASS", "None of your deal-breakers found."];
    return out;
  }
  const words = (t) => uniq(lc(t).split(/[^a-z0-9+#.]+/).filter(w => w.length > 3 && !/^(with|from|that|this|have|will|your|work|team|role|good|able|into|also|more|than|their|they|them|what|when|which|years?|data)$/.test(w)));
  function headLine(jd) { let l = String(jd || "").split("\n").map(x => x.trim()).find(Boolean) || ""; if (l.length > 90) l = l.split(/[.!?;]\s/)[0]; if (l.length > 90) return {}; const m = l.match(/^(.+?)\s+(?:at|@|-|–|\|)\s+(.+?)(?:,|\(|$)/i); return m ? { title: m[1].trim(), company: m[2].trim() } : { title: l.replace(/[,(].*$/, "").trim() }; }
  function evalFit(r, jdText, p, meta) {
    p = p || profile(); meta = Object.assign({}, meta || {}); const hl = headLine(jdText); if (!meta.title) meta.title = hl.title || ""; if (!meta.company) meta.company = hl.company || "";
    const a = JD().analyze(r, jdText, {}), sc = a.scores, jt = lc(jdText);
    const tech = sc.must == null && sc.pref == null ? (sc.evidence == null ? 50 : sc.evidence) : Math.round((sc.must == null ? sc.pref : sc.must) * .75 + (sc.pref == null ? (sc.must == null ? 50 : sc.must) : sc.pref) * .25);
    const exp = sc.exp == null ? (sc.evidence == null ? 55 : Math.round(sc.evidence * .8 + 10)) : Math.round(sc.exp * .6 + (sc.evidence == null ? sc.exp : sc.evidence) * .4);
    const en = listOf(p.energizing).flatMap(words), dr = listOf(p.draining).flatMap(words), env = listOf(p.environment).flatMap(words);
    const enHit = en.filter(w => jt.includes(w)), drHit = dr.filter(w => jt.includes(w)), envHit = env.filter(w => jt.includes(w));
    const culture = (en.length || dr.length || env.length) ? clamp(58 + enHit.length * 7 + envHit.length * 5 - drHit.length * 10, 15, 95) : 60;
    const title = lc(meta.title || a.title || ""), roles = listOf(p.targetRoles).map(lc);
    const roleHit = roles.some(rr => rr && (title.includes(rr) || words(rr).filter(w => title.includes(w)).length >= Math.max(1, words(rr).length - 1)));
    const secHit = listOf(p.sectors).filter(s => jt.includes(lc(s))), coHit = listOf(p.companies).filter(c => lc(meta.company || "").includes(lc(c)) || jt.includes(lc(c)));
    const goalHit = listOf(p.goals).flatMap(words).filter(w => jt.includes(w));
    const career = (roles.length || listOf(p.goals).length || listOf(p.sectors).length) ? clamp(42 + (roleHit ? 28 : 0) + Math.min(2, secHit.length) * 8 + (coHit.length ? 10 : 0) + Math.min(4, goalHit.length) * 4, 10, 98) : 60;
    const scores = { technical: clamp(tech, 0, 100), experience: clamp(exp, 0, 100), culture, career };
    const overall = Math.round(Object.keys(W).reduce((s, k) => s + scores[k] * W[k], 0) / 100);
    const G = gates(jdText, p), failed = Object.values(G).some(g => g[0] === "FAIL");
    const must = a.keywords.filter(k => k.imp === "must"), pref = a.keywords.filter(k => k.imp === "pref");
    const strengths = must.filter(k => k.status === "strong").map(k => k.k).slice(0, 6), weakS = a.keywords.filter(k => k.status === "weak").map(k => k.k).slice(0, 6);
    const gaps = must.filter(k => k.status === "missing").map(k => k.k), prefGaps = pref.filter(k => k.status === "missing").map(k => k.k);
    const notes = { technical: `${a.counts.strong} skills proven in bullets, ${a.counts.weak} only listed, ${a.counts.missing} missing (${must.length} must-haves).`, experience: a.years.need ? `Job asks ${a.years.need.min}+ years; your resume shows about ${a.years.have == null ? "0" : a.years.have}.` : `Based on how much of the matched skills you prove with results.`, culture: (en.length || dr.length || env.length) ? `${enHit.length} energizing and ${envHit.length} environment words found${drHit.length ? `; ${drHit.length} draining (${uniq(drHit).slice(0, 3).join(", ")})` : ""}.` : "Fill your profile (energizing / draining tasks) to score this.", career: (roles.length || listOf(p.goals).length) ? `${roleHit ? "Matches a target role" : "Not one of your target roles"}${secHit.length ? "; target sector: " + secHit.join(", ") : ""}${coHit.length ? "; on your company list" : ""}.` : "Fill your profile (target roles, goals) to score this." };
    return { overall, verdict: failed ? ["Not a match", "Skip: a hard requirement fails.", "bad"] : (() => { const v = verdictOf(overall); return [v[1], v[3], v[2]]; })(), gates: G, failed, scores, notes, strengths, weak: weakS, gaps, prefGaps, years: a.years, analysis: { counts: a.counts, scores: a.scores, keywords: a.keywords.map(k => ({ k: k.k, imp: k.imp, status: k.status, cat: k.cat })) }, title: meta.title || a.title || "", company: meta.company || a.company || "" };
  }
  const dimRow = (k, label, sc, note) => `<div class="cp-dim"><div class="cp-dl"><b>${label}</b><span class="small muted">${W[k] ? W[k] + "% weight" : ""}</span></div><div class="cp-bar"><i style="width:${sc}%;background:${sc >= 75 ? "var(--ok)" : sc >= 50 ? "var(--warn)" : "var(--bad)"}"></i></div><b class="cp-dn">${sc}</b><div class="small muted cp-dnote">${esc(note || "")}</div></div>`;
  const gateBadge = (name, g) => `<div class="cp-gate ${g[0].toLowerCase()}"><b>${g[0] === "PASS" ? "✓" : g[0] === "FLAG" ? "!" : "✕"} ${name}</b><span>${esc(g[1])}</span></div>`;
  const ring = (n, label) => `<div class="ring" style="--p:${n};--c:${n >= 75 ? "#16A34A" : n >= 60 ? "#5B4BF0" : n >= 45 ? "#D97706" : "#DC2626"};width:104px;height:104px"><div><b style="font-size:26px">${n}</b><span>${label || "fit"}</span></div></div>`;
  const researchLinks = (co) => { const e = encodeURIComponent; co = co || ""; return [["Company website & news", `https://www.google.com/search?q=${e(co + " official site")}`], ["Reviews (AmbitionBox)", `https://www.google.com/search?q=${e(co + " reviews ambitionbox")}`], ["Reviews (Glassdoor)", `https://www.google.com/search?q=${e(co + " glassdoor reviews")}`], ["Team on LinkedIn", `https://www.linkedin.com/search/results/companies/?keywords=${e(co)}`], ["Recent news", `https://news.google.com/search?q=${e(co)}`]]; };
  const ASK = ["What are the main challenges in this role right now?", "How is time usually split across the listed responsibilities?", "Which skills matter most for success in this position?", "What does success look like in the first 6–12 months?"];

  /* ---------- shared CSS ---------- */
  const CSS = `.cp-sub{display:flex;gap:6px;flex-wrap:wrap;margin:-6px 0 16px}.cp-sub a{font:600 13px var(--fb);padding:7px 12px;border-radius:99px;border:1px solid var(--line);background:#fff;color:var(--ink2);text-decoration:none}.cp-sub a.on{background:var(--brand);border-color:var(--brand);color:#fff}
.cp-dim{display:grid;grid-template-columns:150px 1fr 40px;gap:4px 12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}.cp-dim:last-child{border:0}.cp-dl{display:flex;flex-direction:column}.cp-bar{height:9px;border-radius:99px;background:var(--soft);overflow:hidden}.cp-bar i{display:block;height:100%;border-radius:99px}.cp-dn{text-align:right;font:800 15px var(--fh)}.cp-dnote{grid-column:2/4}
.cp-gates{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin:12px 0}.cp-gate{border-radius:12px;padding:9px 11px;font-size:13px;border:1px solid var(--line);background:#fff;display:flex;flex-direction:column;gap:2px}.cp-gate.pass{background:var(--ok-bg);border-color:#BBF7D0}.cp-gate.flag{background:var(--warn-bg);border-color:#FDE68A}.cp-gate.fail{background:var(--bad-bg);border-color:#FECACA}.cp-gate span{color:var(--ink2)}
.cp-verdict{display:flex;gap:18px;align-items:center;flex-wrap:wrap}.cp-verdict h2{margin:0;font-size:24px}.cp-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.cp-tag{font:600 12px var(--fb);padding:4px 9px;border-radius:99px;background:var(--soft);color:var(--ink2)}.cp-tag.ok{background:var(--ok-bg);color:var(--ok)}.cp-tag.bad{background:var(--bad-bg);color:var(--bad)}.cp-tag.warn{background:var(--warn-bg);color:var(--warn)}
.cp-steps{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}.cp-steps span{font:600 12.5px var(--fb);padding:7px 12px;border-radius:99px;background:var(--soft);color:var(--mute)}.cp-steps span.on{background:var(--brand-soft);color:var(--brand-ink)}.cp-steps span.done{background:var(--ok-bg);color:var(--ok)}
.cp-tb{width:100%;border-collapse:collapse;font-size:13.5px}.cp-tb th,.cp-tb td{padding:9px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.cp-tb th{font:700 11px var(--fb);letter-spacing:.05em;text-transform:uppercase;color:var(--mute)}
.cp-check li{list-style:none;margin:5px 0}.cp-check{padding:0;margin:6px 0}.cp-check label{display:flex;gap:8px;align-items:flex-start;cursor:pointer}
.cp-lint{margin:0;padding-left:18px;font-size:13.5px}.cp-lint li{margin:4px 0}.cp-ok{color:var(--ok)}.cp-bad{color:var(--bad)}.cp-warn{color:var(--warn)}
.cp-heat td.h{font:700 13px var(--fb);text-align:center;border-radius:6px}.cp-story{border:1px solid var(--line);border-radius:14px;padding:14px;background:#fff;margin-bottom:10px}.cp-story h4{margin:0 0 6px;font-size:15.5px}.cp-story dl{display:grid;grid-template-columns:22px 1fr;gap:4px 8px;margin:6px 0;font-size:13.5px}.cp-story dt{font:800 13px var(--fh);color:var(--brand)}.cp-story dd{margin:0}
.cp-cov{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px}.cp-cov div{border-radius:10px;padding:8px 10px;font-size:12.5px;border:1px solid var(--line)}.cp-cov .y{background:var(--ok-bg);border-color:#BBF7D0}.cp-cov .n{background:var(--warn-bg);border-color:#FDE68A}
.cp-funnel{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.cp-funnel div{background:var(--soft);border-radius:12px;padding:10px;text-align:center}.cp-funnel b{display:block;font:800 22px var(--fh)}.cp-funnel small{display:block;color:var(--mute);font-size:11.5px}
.cp-q{border:1px solid var(--line);border-radius:14px;padding:14px;background:#fff}.cp-timer{font:800 20px var(--fh);color:var(--brand)}.cp-mini{font-size:12px;color:var(--mute)}
@media(max-width:700px){.cp-dim{grid-template-columns:110px 1fr 34px}.cp-funnel{grid-template-columns:repeat(3,1fr)}}`;
  function addCss() { if ($("#cp-css")) return; const s = document.createElement("style"); s.id = "cp-css"; s.textContent = CSS; document.head.appendChild(s); }
  const SUB = [["profile", "🧭 Profile"], ["fit", "🎯 Fit check"], ["shortlist", "🏁 Rank jobs"], ["apply", "📨 Apply kit"], ["stories", "⭐ STAR stories"], ["mock", "🎙️ Mock interview"], ["outcomes", "📈 Follow-ups"], ["upskill", "📚 Upskill"], ["screening", "📝 Form answers"]];
  const subnav = (on) => `<div class="cp-sub" role="navigation" aria-label="Job Search Copilot">${SUB.map(([r, t]) => `<a href="#/${r}" class="${r === on ? "on" : ""}">${t}</a>`).join("")}</div>`;
  const page = (on, title, sub, right) => { addCss(); return A().head(title, sub, right) + subnav(on); };
  let pending = null;   // a job handed from one page to another (e.g. shortlist → fit)
  const prefillJob = () => { if (!pending) return; const j = pending; pending = null; const sel = $("#jp-sel"); if (sel) { sel.value = ""; $("#jp-paste").hidden = false; } if ($("#jp-title")) $("#jp-title").value = j.title || ""; if ($("#jp-co")) $("#jp-co").value = j.company || ""; if ($("#jp-jd")) $("#jp-jd").value = j.jd || ""; };

  /* =========================== 1. Career profile =========================== */
  function profileView() {
    const p = profile(), d = profileDoc(), fill = profileFill(p);
    const ta = (k, label, ph, rows) => `<label class="f" for="pf-${k}">${label}</label><textarea class="textarea" id="pf-${k}" rows="${rows || 2}" placeholder="${esc(ph)}">${esc(p[k])}</textarea>`;
    const LV2 = ["Basic", "Conversational", "Professional", "Fluent", "Native"];
    A().view.innerHTML = page("profile", "Career profile", "Tell Resumiq what you want. Fit check, Apply kit and Form answers use it to judge jobs the way a career advisor would.", `<span class="badge brand" data-ai-left></span>`) + `
      <div class="grid g2" style="align-items:start">
      <div class="card card-pad"><div style="display:flex;gap:14px;align-items:center;margin-bottom:6px">${ring(fill, "done")}<div><b>${fill >= 80 ? "Great profile" : fill >= 40 ? "Almost there" : "Let's set you up"}</b><p class="small muted" style="margin:4px 0 8px">One item per line. Only you see this.${d ? " Saved " + esc(rel(d.updated)) + "." : ""}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${A().resumes().length ? `<select class="select" id="pf-r" style="width:auto;max-width:220px">${A().resumes().map(r => `<option value="${esc(r.id)}">${esc(r.title)}</option>`).join("")}</select><button class="btn btn-ai btn-sm" id="pf-ai">✨ Fill from my resume</button>` : `<a class="btn btn-soft btn-sm" href="/studio">Build a resume first</a>`}</div></div></div>
        <h3 style="margin-top:14px">What you're looking for</h3>
        <div class="row"><div><label class="f" for="pf-status">Where you are now</label><select class="select" id="pf-status">${["", "Student", "Fresher", "Working", "Between jobs", "Career switch"].map(o => `<option ${o === p.status ? "selected" : ""} value="${o}">${o || "Choose…"}</option>`).join("")}</select></div><div><label class="f" for="pf-noticeDays">Notice period (days)</label><input class="input" id="pf-noticeDays" type="number" min="0" max="180" value="${esc(p.noticeDays)}" placeholder="e.g. 30"></div></div>
        ${ta("targetRoles", "Target roles", "Data Analyst\nBusiness Analyst")}${ta("sectors", "Target sectors", "Fintech\nE-commerce")}${ta("companies", "Companies you'd love to join (optional)", "Swiggy\nRazorpay")}
        <div class="row"><div>${ta("locations", "Cities that work for you", "Bengaluru\nRemote")}</div><div><label class="f" for="pf-workMode">Work mode</label><select class="select" id="pf-workMode">${["Any", "Office", "Hybrid", "Remote"].map(o => `<option ${o === p.workMode ? "selected" : ""}>${o}</option>`).join("")}</select><label class="f" for="pf-relocate" style="margin-top:8px">Open to relocate?</label><select class="select" id="pf-relocate">${["Yes", "Maybe", "No"].map(o => `<option ${o === p.relocate ? "selected" : ""}>${o}</option>`).join("")}</select></div></div>
        <label class="f">Languages you can work in</label><div id="pf-langs">${(p.languages.length ? p.languages : [["", "Professional"]]).map((l, i) => `<div class="row" data-lang style="margin-bottom:6px"><div><input class="input" value="${esc(l[0])}" placeholder="Language" aria-label="Language"></div><div><select class="select" aria-label="Level">${LV2.map(o => `<option ${o === l[1] ? "selected" : ""}>${o}</option>`).join("")}</select></div></div>`).join("")}</div><button class="btn btn-ghost btn-sm" id="pf-addl" type="button">＋ Language</button>
        <label class="f" for="pf-expected" style="margin-top:10px">Expected CTC (optional, stays private)</label><input class="input" id="pf-expected" value="${esc(p.expected)}" placeholder="e.g. 6–8 LPA">
        ${ta("dealbreakers", "Deal-breakers (words that make you skip a job)", "night shift\nservice bond\nsales target")}</div>
      <div class="card card-pad"><h3>You, at work</h3>
        ${ta("primarySkills", "Primary skills (proven in your work)", "SQL\nPower BI")}${ta("secondarySkills", "Secondary skills (learning / basic)", "Python\nAzure")}
        ${ta("strengths", "Strengths, with proof", "Explaining numbers to non-technical people (weekly sales review)")}${ta("growth", "Growth areas (how you're working on them)", "Public speaking: present in every team demo")}
        ${ta("environment", "You do your best work when…", "clear goals, fast feedback, small team")}${ta("energizing", "Tasks that energize you", "building dashboards\nfinding the story in data", 3)}${ta("draining", "Tasks that drain you", "manual data entry\ncold calling", 2)}${ta("goals", "Career goals (next 1–3 years)", "Become a senior analyst in a product company\nLearn ML basics", 3)}
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-primary" id="pf-save">Save profile</button><a class="btn btn-ghost" href="#/fit">Next: check a job →</a></div>
        <div id="pf-sugg" style="margin-top:12px"></div></div></div>`;
    const read = () => { const v = (k) => ($("#pf-" + k) || {}).value || ""; const o = {}; Object.keys(PROFILE0).forEach(k => { if (k !== "languages") o[k] = v(k).trim(); }); o.languages = $$("[data-lang]").map(r => [r.querySelector("input").value.trim(), r.querySelector("select").value]).filter(l => l[0]); return o; };
    $("#pf-addl").onclick = () => { const r = document.createElement("div"); r.className = "row"; r.setAttribute("data-lang", ""); r.style.marginBottom = "6px"; r.innerHTML = `<div><input class="input" placeholder="Language" aria-label="Language"></div><div><select class="select" aria-label="Level">${LV2.map(o => `<option ${o === "Professional" ? "selected" : ""}>${o}</option>`).join("")}</select></div>`; $("#pf-langs").appendChild(r); };
    $("#pf-save").onclick = () => { const o = read(); cpSave("profile", "Career profile", o, d && d.id); toast("Profile saved", "ok"); profileView(); };
    const ai = $("#pf-ai"); if (ai) ai.onclick = async () => { const rid = $("#pf-r").value; A().busy(ai, true, "Reading…");
      try { const o = await RQ.ai("profile_draft", { text: A().resumeText(rid).slice(0, 7000) }); let n = 0;
        [["targetRoles", o.targetRoles], ["sectors", o.sectors], ["primarySkills", o.primarySkills], ["secondarySkills", o.secondarySkills], ["strengths", o.strengths], ["energizing", o.energizing], ["goals", o.goals]].forEach(([k, arr]) => { const el = $("#pf-" + k); if (el && !el.value.trim() && arr.length) { el.value = arr.join("\n"); el.style.background = "#F5F3FF"; n++; } });
        $("#pf-sugg").innerHTML = `<div class="note info">Dexa filled ${n} empty field${n === 1 ? "" : "s"} (shaded). Read them, fix anything that isn't you, then <b>Save profile</b>. Goals are suggestions only: keep the ones you really want.</div>`; } catch (e) { toast(e.message, "bad"); }
      A().busy(ai, false); RQ.renderCredits(); };
    RQ.renderCredits();
  }

  /* =========================== 2. Fit check =========================== */
  function fitHtml(F, ai, id) {
    const S = ai ? ai.scores : F.scores, N = ai ? ai.notes : F.notes;
    const overall = ai ? Math.round(Object.keys(W).reduce((s, k) => s + S[k] * W[k], 0) / 100) : F.overall;
    const failed = F.failed || (ai && (ai.location.verdict === "FAIL" || ai.language.verdict === "FAIL"));
    const v = failed ? ["Not a match", "Skip: a hard requirement fails.", "bad"] : (() => { const x = verdictOf(overall); return [x[1], x[3], x[2]]; })();
    const G = Object.assign({}, F.gates); if (ai) { G.location = [ai.location.verdict, ai.location.why || G.location[1]]; G.language = [ai.language.verdict, ai.language.why || G.language[1]]; }
    const exp = S.experience;
    return `<div class="card card-pad"><div class="cp-verdict">${ring(overall)}<div style="flex:1;min-width:220px"><span class="badge ${v[2]}">${esc(v[0])}</span>${ai ? ` <span class="badge brand">Dexa read</span>` : ` <span class="badge">Instant check</span>`}<h2 style="margin-top:6px">${esc(F.title || "This job")}${F.company ? " · " + esc(F.company) : ""}</h2><p class="muted" style="margin:4px 0 0">${esc(ai && ai.recommendation ? ai.recommendation : v[1])}</p></div></div>
      ${exp < 50 && !failed ? `<div class="note warn" style="margin-top:12px">Experience match is below 50. Getting this job would need heavy reframing of your experience. Apply only if you can honestly bridge the gap.</div>` : ""}
      <h3 style="margin-top:16px">Hard checks (before any score)</h3><div class="cp-gates">${gateBadge("Location", G.location)}${gateBadge("Language", G.language)}${gateBadge("Notice period", G.notice)}${gateBadge("Your deal-breakers", G.dealbreakers)}</div>
      <h3>Scores</h3>${dimRow("technical", "Technical skills", S.technical, N.technical)}${dimRow("experience", "Experience", S.experience, N.experience)}${dimRow("culture", "Work-style fit", S.culture, N.culture)}${dimRow("career", "Career alignment", S.career, N.career)}
      <p class="small muted" style="margin-top:8px">Overall = Technical 30% + Experience 25% + Work-style 15% + Career 30%. Location and language are pass/fail checks, not part of the score. 75+ strong · 60–74 good · 45–59 moderate · 30–44 weak.</p></div>
      <div class="grid g2" style="margin-top:14px;align-items:start"><div class="card card-pad"><h3>✅ Your strengths for this job</h3><div class="cp-tags">${(ai && ai.strengths.length ? ai.strengths : F.strengths).map(x => `<span class="cp-tag ok">${esc(x)}</span>`).join("") || '<span class="small muted">No must-have is proven in your bullets yet.</span>'}</div>
        ${F.weak.length ? `<p class="small" style="margin:10px 0 4px"><b>Listed but not proven:</b></p><div class="cp-tags">${F.weak.map(x => `<span class="cp-tag warn">${esc(x)}</span>`).join("")}</div>` : ""}
        <h3 style="margin-top:14px">🧩 Gaps to address</h3><div class="cp-tags">${(ai && ai.gaps.length ? ai.gaps : F.gaps.concat(F.prefGaps.map(x => x + " (preferred)"))).slice(0, 10).map(x => `<span class="cp-tag bad">${esc(x)}</span>`).join("") || '<span class="small muted">No must-have gaps found. 🎉</span>'}</div>
        ${ai && ai.stretch ? `<div class="note warn" style="margin-top:12px"><b>Don't claim:</b> ${esc(ai.stretch)}</div>` : ""}</div>
        <div class="card card-pad"><h3>🔎 Before you apply</h3><ul class="cp-check">${researchLinks(F.company || F.title).map(([t, u], i) => `<li><label><input type="checkbox" data-rc="${i}"> <span>${t} · <a href="${esc(u)}" target="_blank" rel="noopener">open ↗</a></span></label></li>`).join("")}<li><label><input type="checkbox" data-rc="5"> <span>Find someone in your network who knows the team</span></label></li></ul>
        <h3 style="margin-top:12px">📞 Worth a call to the recruiter?</h3><p class="small muted" style="margin:0 0 6px">Only if the job ad is unclear. The call is for gathering information, not pitching. Mention what you learned in your cover letter.</p><ul class="small" style="padding-left:18px;margin:0">${(ai && ai.askEmployer.length ? ai.askEmployer : ASK).map(q => `<li>${esc(q)}</li>`).join("")}</ul></div></div>
      <div class="card card-pad" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">${id ? `<a class="btn btn-primary" href="#/apply?f=${encodeURIComponent(id)}">📨 Build the Apply kit</a><button class="btn btn-ghost" data-track="${esc(id)}">📌 Add to tracker</button>` : ""}<a class="btn btn-ghost" href="#/upskill">📚 Plan to close the gaps</a>${!ai ? `<button class="btn btn-ai" id="fit-ai">✨ Deep read with Dexa</button>` : ""}</div>`;
  }
  function trackFit(id) { const f = store.get(id); if (!f) return; const ex = store.list("application").find(a => a.data.fitId === id); if (ex) return toast("Already in your tracker.");
    store.save({ kind: "application", title: [f.data.title, f.data.company].filter(Boolean).join(" · ") || "Job", data: { role: f.data.title || "", company: f.data.company || "", status: "Saved", link: "", applied: "", followUp: "", notes: "Fit " + f.data.score + "/100 (" + f.data.verdict + ")", resumeId: f.data.resumeId || "", salary: "", contact: "", fitId: id, fit: f.data.score, deadline: f.data.deadline || "" } }); toast("Added to your tracker", "ok"); }
  function fitView() {
    const saved = cpList("fit"), open = A().qp().get("id");
    A().view.innerHTML = page("fit", "Fit check", "Should you apply? Hard checks first (location, language, notice, deal-breakers), then a weighted score with honest gaps.", `<span class="badge brand" data-ai-left></span>`) + `
      ${profileFill(profile()) < 40 ? `<div class="note info" style="margin-bottom:14px">Fill your <a href="#/profile">career profile</a> first: work-style and career scores need it. Technical and experience scores work without it.</div>` : ""}
      <div class="card card-pad"><div class="grid g2"><div><label class="f">Your resume</label>${A().resumeSel("ft-r")}<label class="f" for="ft-dl" style="margin-top:10px">Application deadline (optional)</label><input class="input" type="date" id="ft-dl"></div><div>${A().jobPicker()}</div></div>
        <button class="btn btn-primary" id="ft-go" style="margin-top:14px">🎯 Check my fit</button> <span class="small muted">Instant and free. Dexa's deep read is optional.</span></div>
      <div id="ft-out" style="margin-top:16px"></div>
      ${saved.length ? `<div class="card card-pad" style="margin-top:16px"><h3>Saved fit checks</h3><div class="tbl-wrap"><table class="cp-tb"><thead><tr><th>Job</th><th>Fit</th><th class="hide-s">Checked</th><th></th></tr></thead><tbody>${saved.map(f => `<tr><td><b>${esc(f.data.title || "Job")}</b>${f.data.company ? `<div class="small muted">${esc(f.data.company)}</div>` : ""}</td><td><span class="badge ${f.data.score >= 75 ? "ok" : f.data.score >= 60 ? "brand" : f.data.score >= 45 ? "warn" : "bad"}">${f.data.score} · ${esc(f.data.verdict)}</span></td><td class="hide-s small">${esc(rel(f.updated))}</td><td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-open="${esc(f.id)}">Open</button><button class="icon-btn" data-del="${esc(f.id)}" aria-label="Delete">🗑</button></td></tr>`).join("")}</tbody></table></div></div>` : ""}`;
    A().wireJob(); prefillJob(); RQ.renderCredits();
    const show = (doc) => { const F = doc.data.F, ai = doc.data.ai; $("#ft-out").innerHTML = fitHtml(F, ai, doc.id);
      const rc = doc.data.rc || {}; $$("[data-rc]").forEach(c => { c.checked = !!rc[c.dataset.rc]; c.onchange = () => { const d = store.get(doc.id); d.data.rc = Object.assign({}, d.data.rc, { [c.dataset.rc]: c.checked }); store.save({ id: d.id, kind: "analysis", title: d.title, data: d.data }); }; });
      $$("[data-track]").forEach(b => b.onclick = () => trackFit(b.dataset.track));
      const ab = $("#fit-ai"); if (ab) ab.onclick = async () => { const d = store.get(doc.id); A().busy(ab, true, "Dexa is reading…");
        try { const o = await RQ.ai("fit", { text: A().resumeText(d.data.resumeId).slice(0, 6000), jd: d.data.jd.slice(0, 5000), title: d.data.title, company: d.data.company, profile: profileText() });
          d.data.ai = o; d.data.score = Math.round(Object.keys(W).reduce((s, k) => s + o.scores[k] * W[k], 0) / 100); d.data.verdict = (d.data.F.failed || o.location.verdict === "FAIL" || o.language.verdict === "FAIL") ? "Not a match" : verdictOf(d.data.score)[1];
          const nd = store.save({ id: d.id, kind: "analysis", title: d.title, data: d.data }); show(nd); RQ.track("fit_ai", d.data.title || ""); } catch (e) { toast(e.message, "bad"); A().busy(ab, false); } RQ.renderCredits(); };
      $("#ft-out").scrollIntoView({ behavior: "smooth", block: "start" }); };
    $("#ft-go").onclick = () => { const rid = $("#ft-r") && $("#ft-r").value; if (!rid) return toast("Create a resume first.", "bad"); const j = A().jobVal() || {}; if (String(j.jd || "").trim().split(/\s+/).length < 25) return toast("Paste the full job description (at least a few lines).", "bad");
      const r = A().resumeObj(rid), F = evalFit(r, j.jd, profile(), j);
      const doc = cpSave("fit", [F.title, F.company].filter(Boolean).join(" · ") || "Job", { F, jd: j.jd, title: F.title, company: F.company, resumeId: rid, analysisId: j.id || "", score: F.overall, verdict: F.verdict[0], deadline: $("#ft-dl").value, gaps: F.gaps, prefGaps: F.prefGaps, rc: {} });
      show(doc); RQ.track("fit", F.title || ""); };
    $$("[data-open]").forEach(b => b.onclick = () => show(store.get(b.dataset.open)));
    $$("[data-del]").forEach(b => b.onclick = async () => { if (await RQ.confirm("Delete this fit check?", "Delete", true)) { await store.remove(b.dataset.del); fitView(); } });
    if (open && store.get(open)) show(store.get(open));
  }

  /* =========================== 3. Rank many jobs =========================== */
  const daysTo = (d) => d ? Math.round((new Date(d + "T00:00:00") - new Date(A().today() + "T00:00:00")) / 864e5) : null;
  const dlBadge = (d) => { const n = daysTo(d); return n == null ? "" : n < 0 ? `<span class="badge bad" title="Deadline passed">⚠ passed</span>` : n <= 7 ? `<span class="badge warn" title="Deadline within 7 days">🔥 ${n === 0 ? "today" : n + "d"}</span>` : `<span class="badge">${esc(fmtDay(d))}</span>`; };
  function shortlistView() {
    const last = cpList("shortlist")[0], an = A().analyses();
    A().view.innerHTML = page("shortlist", "Rank jobs", "Paste several job descriptions and get them ranked by fit in one go, with hard checks, top gaps and deadlines. Free, no AI credits.") + `
      <div class="card card-pad"><div class="grid g2"><div><label class="f">Your resume</label>${A().resumeSel("sl-r")}</div><div><label class="f">Also include</label><label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" id="sl-an" ${an.length ? "checked" : "disabled"}> My saved job matches (${an.length})</label></div></div>
        <label class="f" for="sl-jd" style="margin-top:10px">Job descriptions: put a line with only <code>---</code> between jobs</label><textarea class="textarea" id="sl-jd" rows="9" placeholder="Data Analyst at Acme&#10;We are looking for… SQL, Power BI…&#10;---&#10;Business Analyst at Beta&#10;Requirements: …"></textarea>
        <button class="btn btn-primary" id="sl-go" style="margin-top:12px">🏁 Rank them</button> <label class="small" style="margin-left:10px"><input type="checkbox" id="sl-only"> Show only my shortlist (Good fit or better, no failed checks)</label></div>
      <div id="sl-out" style="margin-top:16px"></div>`;
    const draw = (S) => { const only = $("#sl-only").checked, rows = S.data.items.filter(x => !only || (x.score >= 60 && !x.failed));
      $("#sl-out").innerHTML = `<div class="card card-pad"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><h3 style="margin:0">${S.data.items.length} jobs ranked · ${S.data.items.filter(x => x.score >= 60 && !x.failed).length} on your shortlist</h3><span class="small muted">Ranked ${esc(rel(S.updated))}</span></div>
        <div class="tbl-wrap" style="margin-top:10px"><table class="cp-tb"><thead><tr><th>#</th><th>Job</th><th>Fit</th><th class="hide-s">Checks</th><th class="hide-s">Top gaps</th><th>Deadline</th><th></th></tr></thead><tbody>${rows.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.title || "Job " + (i + 1))}</b>${x.company ? `<div class="small muted">${esc(x.company)}</div>` : ""}</td><td><span class="badge ${x.failed ? "bad" : x.score >= 75 ? "ok" : x.score >= 60 ? "brand" : x.score >= 45 ? "warn" : "bad"}">${x.score}</span><div class="cp-mini">${esc(x.verdict)}</div></td>
          <td class="hide-s" style="white-space:nowrap">${Object.entries(x.gates).map(([k, g]) => `<span title="${esc(k + ": " + g[1])}">${g[0] === "PASS" ? "✅" : g[0] === "FLAG" ? "⚠️" : "⛔"}</span>`).join(" ")}</td><td class="hide-s small">${esc(x.gaps.slice(0, 3).join(", ") || "—")}</td>
          <td><input type="date" class="input" data-dl="${i}" value="${esc(x.deadline || "")}" style="padding:4px 6px;font-size:12px;width:130px" aria-label="Deadline"> ${dlBadge(x.deadline)}</td>
          <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-fit="${i}">Fit check</button><button class="btn btn-ghost btn-sm" data-trk="${i}">Track</button></td></tr>`).join("")}</tbody></table></div>
        <p class="small muted" style="margin-top:8px">✅ pass · ⚠️ check this · ⛔ hard fail (location, language, notice, your deal-breakers). Deadlines within 7 days show 🔥.</p></div>`;
      const idx = (i) => S.data.items.indexOf(rows[i]);
      $$("[data-dl]").forEach(inp => inp.onchange = () => { S.data.items[idx(+inp.dataset.dl)].deadline = inp.value; S = cpSave("shortlist", S.title, S.data, S.id); draw(S); });
      $$("[data-fit]").forEach(b => b.onclick = () => { const x = S.data.items[idx(+b.dataset.fit)]; pending = { jd: x.jd, title: x.title, company: x.company }; location.hash = "#/fit"; });
      $$("[data-trk]").forEach(b => b.onclick = () => { const x = S.data.items[idx(+b.dataset.trk)]; if (store.list("application").find(a => a.data.role === x.title && a.data.company === x.company)) return toast("Already in your tracker.");
        store.save({ kind: "application", title: [x.title, x.company].filter(Boolean).join(" · ") || "Job", data: { role: x.title, company: x.company, status: "Saved", link: "", applied: "", followUp: "", notes: "Fit " + x.score + "/100 (" + x.verdict + ")", resumeId: S.data.resumeId, salary: "", contact: "", fit: x.score, deadline: x.deadline || "" } }); toast("Added to your tracker", "ok"); }); };
    $("#sl-only").onchange = () => { const S = cpList("shortlist")[0]; if (S) draw(S); };
    $("#sl-go").onclick = () => { const rid = $("#sl-r") && $("#sl-r").value; if (!rid) return toast("Create a resume first.", "bad");
      const blocks = $("#sl-jd").value.split(/^\s*-{3,}\s*$/m).map(x => x.trim()).filter(x => x.split(/\s+/).length >= 25).map(jd => ({ jd, title: "", company: "" }));
      const fromAn = $("#sl-an").checked ? an.map(a => ({ jd: a.data.jd || "", title: a.data.title || a.title, company: a.data.company || "" })).filter(x => x.jd) : [];
      const jobs = blocks.concat(fromAn); if (!jobs.length) return toast("Paste at least one full job description, or include your saved job matches.", "bad");
      const r = A().resumeObj(rid), p = profile(), prevDl = new Map(((last && last.data.items) || []).map(x => [x.title + "|" + x.company, x.deadline]));
      const items = jobs.map(j => { const F = evalFit(r, j.jd, p, j); const t = F.title || j.title, c = F.company || j.company; return { title: t, company: c, jd: j.jd, score: F.overall, verdict: F.verdict[0], failed: F.failed, gates: F.gates, gaps: F.gaps, prefGaps: F.prefGaps, deadline: prevDl.get(t + "|" + c) || "" }; }).sort((a, b) => (a.failed - b.failed) || (b.score - a.score));
      const S = cpSave("shortlist", "Ranked jobs " + A().today(), { items, resumeId: rid }, last && last.id); draw(S); RQ.track("shortlist", String(items.length)); };
    if (last) draw(last);
  }

  /* =========================== 4. Apply kit: drafter → reviewer =========================== */
  const CLICHES = ["passionate", "hit the ground running", "leverage my", "leveraging my", "synergy", "synergies", "team player", "go-getter", "think outside the box", "results-driven", "results driven", "drive results", "detail-oriented", "hardworking", "hard-working", "dynamic", "self-starter", "best of breed", "value add", "i believe i would be a great fit", "perfect fit", "dream job", "fast learner", "quick learner"];
  const APOLOGY = ["i think i could", "i hope", "although i don't have", "although i do not have", "i may not", "i'm just", "i am just", "sorry", "i feel i might", "kindly consider", "humbly"];
  const GENERIC_OPEN = /^\s*(dear[^\n]*\n+)?\s*(i am writing to (apply|express)|i would like to apply|with reference to your (advertisement|job posting)|please find (attached|enclosed))/i;
  function lintDraft(letter, resumeTxt, jd, company, mustKw) {
    const L = lc(letter), out = [];
    const ed = (letter.match(/—|--/g) || []).length; out.push(ed ? ["bad", `${ed} em-dash${ed > 1 ? "es" : ""} (—). Use a comma or a full stop instead.`] : ["ok", "No em-dashes."]);
    const cl = CLICHES.filter(c => L.includes(c)); out.push(cl.length ? ["bad", "Clichés: " + cl.map(c => "“" + c + "”").join(", ") + ". Replace each with a specific example."] : ["ok", "No clichés found."]);
    const ap = APOLOGY.filter(c => L.includes(c)); out.push(ap.length ? ["warn", "Apologetic wording: " + ap.map(c => "“" + c + "”").join(", ") + ". Say what you bring, backed by an example."] : ["ok", "Confident tone (no apologetic wording)."]);
    out.push(GENERIC_OPEN.test(letter) ? ["warn", "Generic opening. Start with the role and one specific reason you fit this company."] : ["ok", "Opening is not a template line."]);
    const wc = (letter.match(/\S+/g) || []).length; out.push(wc > 420 ? ["bad", `${wc} words: longer than one page. Aim for 220–350.`] : wc < 120 ? ["warn", `${wc} words: very short. Fine for an email, thin for a letter.`] : ["ok", `${wc} words: fits on one page.`]);
    if (company) out.push(L.includes(lc(company)) ? ["ok", `Mentions ${company} by name.`] : ["warn", `Doesn't name ${company}. Add why this company specifically.`]);
    const nums = uniq((letter.match(/\b\d[\d,.]*\s?(%|\+|x|lakh|crore|k|users|hours|days|months)?/gi) || []).map(x => x.trim()).filter(x => x.replace(/\D/g, "").length && !/^(19|20)\d\d$/.test(x)));
    const R = lc(resumeTxt), unsup = nums.filter(n => !R.includes(lc(n).replace(/\s/g, "")) && !R.includes(lc(n)));
    out.push(unsup.length ? ["bad", "Numbers not found in your resume: " + unsup.slice(0, 6).join(", ") + ". Every number must be real."] : ["ok", nums.length ? "Every number also appears in your resume." : "No numbers to verify (one real result would help)."]);
    const cov = mustKw.map(k => [k, JD().has(letter + "\n" + resumeTxt, k)]), miss = cov.filter(c => !c[1]).map(c => c[0]);
    return { lint: out, covered: cov.filter(c => c[1]).map(c => c[0]), missing: miss, words: wc };
  }
  function applyView() {
    const fid = A().qp().get("f"), fdoc = fid ? store.get(fid) : null;
    const st = { step: 1, fit: fdoc, tail: null, cover: null, review: null, accepted: {} };
    A().view.innerHTML = page("apply", "Apply kit", "One job, done properly: check the fit, Dexa drafts tailored bullets and a cover letter, a second Dexa pass reviews them like a strict recruiter, then you save everything in one click.", `<span class="badge brand" data-ai-left></span>`) + `
      <div class="cp-steps" id="ak-steps"></div>
      <div class="card card-pad" id="ak-1"><h3>1 · Pick the job</h3>${fdoc ? `<div class="note info">From your fit check: <b>${esc(fdoc.data.title || "Job")}</b>${fdoc.data.company ? " at " + esc(fdoc.data.company) : ""} · fit ${fdoc.data.score}/100 (${esc(fdoc.data.verdict)}). <a href="#/apply">Pick another job</a></div><label class="f" style="margin-top:10px">Resume</label>${A().resumeSel("ak-r", fdoc.data.resumeId)}`
        : `<div class="grid g2"><div><label class="f">Resume</label>${A().resumeSel("ak-r")}</div><div>${A().jobPicker()}</div></div>`}
        <button class="btn btn-primary" id="ak-go1" style="margin-top:12px">Check fit & continue →</button><div id="ak-gate" style="margin-top:12px"></div></div>
      <div class="card card-pad" id="ak-2" style="margin-top:14px" hidden><h3>2 · Draft (Dexa writes)</h3><p class="small muted">Two drafts in one go: bullets tailored to this job (only your real experience) and a cover letter. Uses 2 AI credits.</p>
        <div class="row"><div><label class="f" for="ak-tone">Tone</label><select class="select" id="ak-tone"><option>professional</option><option>warm</option><option>confident</option><option>concise and direct</option></select></div><div><label class="f" for="ak-len">Letter length</label><select class="select" id="ak-len"><option value="short">Short (email)</option><option value="standard" selected>Standard</option><option value="detailed">Detailed</option></select></div></div>
        <label class="f" for="ak-x">Anything specific to mention? (e.g. what you learned from a call with the recruiter)</label><input class="input" id="ak-x" placeholder="optional">
        <button class="btn btn-ai" id="ak-go2" style="margin-top:12px">✨ Draft my application</button><div id="ak-draft" style="margin-top:14px"></div></div>
      <div class="card card-pad" id="ak-3" style="margin-top:14px" hidden><h3>3 · Review (a second, stricter pass)</h3><p class="small muted">Instant checks below update as you edit. Then let Dexa review it as a sceptical recruiter: unsupported claims, lines you couldn't defend in an interview, generic targeting.</p>
        <div id="ak-lint"></div><button class="btn btn-ai" id="ak-go3" style="margin-top:10px">🔎 Reviewer pass with Dexa</button><div id="ak-rev" style="margin-top:12px"></div></div>
      <div class="card card-pad" id="ak-4" style="margin-top:14px" hidden><h3>4 · Save & send</h3><div id="ak-final"></div></div>`;
    A().wireJob(); prefillJob(); RQ.renderCredits();
    const steps = () => { $("#ak-steps").innerHTML = ["Fit gate", "Draft", "Review", "Save"].map((t, i) => `<span class="${i + 1 < st.step ? "done" : i + 1 === st.step ? "on" : ""}">${i + 1 < st.step ? "✓ " : ""}${i + 1}. ${t}</span>`).join(""); [2, 3, 4].forEach(n => { $("#ak-" + n).hidden = st.step < n; }); };
    steps();
    const job = () => st.fit ? { jd: st.fit.data.jd, title: st.fit.data.title, company: st.fit.data.company } : st.job;
    $("#ak-go1").onclick = () => { const rid = $("#ak-r") && $("#ak-r").value; if (!rid) return toast("Create a resume first.", "bad"); st.rid = rid;
      if (!st.fit) { const j = A().jobVal() || {}; if (String(j.jd || "").split(/\s+/).length < 25) return toast("Paste the full job description.", "bad"); st.job = j; }
      const J = job(), F = evalFit(A().resumeObj(rid), J.jd, profile(), J); st.F = F; if (!J.title) J.title = F.title; if (!J.company) J.company = F.company;
      const ok = !F.failed && F.scores.experience >= 50;
      $("#ak-gate").innerHTML = `<div class="note ${F.failed ? "bad" : F.overall >= 60 ? "ok" : "warn"}"><b>Fit ${F.overall}/100 · ${esc(F.verdict[0])}.</b> ${esc(F.verdict[1])}${F.failed ? "<br>A hard check failed: " + esc(Object.entries(F.gates).filter(g => g[1][0] === "FAIL").map(g => g[0] + ": " + g[1][1]).join(" · ")) : ""}${F.scores.experience < 50 ? "<br>Experience match is below 50, so this would need heavy reframing." : ""}</div>${ok ? "" : `<label style="display:flex;gap:8px;margin-top:8px;font-size:14px"><input type="checkbox" id="ak-anyway"> I understand, continue anyway</label>`}`;
      const go = () => { st.step = 2; steps(); $("#ak-2").scrollIntoView({ behavior: "smooth" }); };
      if (ok) go(); else $("#ak-anyway").onchange = (e) => { if (e.target.checked) go(); }; };
    const resumeTxt = () => A().resumeText(st.rid);
    const drawDraft = () => { const T = st.tail, C = st.cover;
      $("#ak-draft").innerHTML = `${T ? `<h4>Tailored resume bullets <span class="small muted">(tick the ones to use)</span></h4>${T.summary ? `<div class="cp-q" style="margin-bottom:8px"><label style="display:flex;gap:8px"><input type="checkbox" data-acc="sum" ${st.accepted.sum !== false ? "checked" : ""}><span><b>Summary:</b> ${esc(T.summary)}</span></label></div>` : ""}${T.bullets.map((b, i) => `<div class="cp-q" style="margin-bottom:8px"><label style="display:flex;gap:8px"><input type="checkbox" data-acc="${i}" ${st.accepted[i] !== false ? "checked" : ""}><span><span class="small muted" style="text-decoration:line-through">${esc(b.original)}</span><br><b>${esc(b.proposed)}</b>${b.why ? `<br><span class="small muted">Supports: ${esc(b.why)}</span>` : ""}</span></label></div>`).join("")}${T.note ? `<div class="note warn">Honest gaps (don't fake these): ${esc(T.note)}</div>` : ""}` : ""}
        ${C ? `<h4 style="margin-top:14px">Cover letter</h4><label class="f" for="ak-sub">Subject / headline</label><input class="input" id="ak-sub" value="${esc(st.subject || C.subject)}"><textarea class="textarea" id="ak-letter" rows="14" style="margin-top:8px">${esc(st.letter || C.letter)}</textarea>${C.note ? `<p class="small muted">Personalise: ${esc(C.note)}</p>` : ""}` : ""}`;
      $$("[data-acc]").forEach(c => c.onchange = () => { st.accepted[c.dataset.acc] = c.checked; });
      const lt = $("#ak-letter"); if (lt) { const upd = () => { st.letter = lt.value; st.subject = $("#ak-sub").value; lint(); }; lt.oninput = upd; $("#ak-sub").oninput = upd; } };
    const lint = () => { if (!st.cover) return; const J = job(); const R = lintDraft(st.letter || st.cover.letter, resumeTxt(), J.jd, J.company, st.F.analysis.keywords.filter(k => k.imp === "must").map(k => k.k));
      st.lint = R; $("#ak-lint").innerHTML = `<div class="grid g2" style="align-items:start"><div><b>Writing check</b><ul class="cp-lint">${R.lint.map(([c, t]) => `<li class="cp-${c}">${c === "ok" ? "✓" : c === "warn" ? "!" : "✕"} <span style="color:var(--ink2)">${esc(t)}</span></li>`).join("")}</ul></div><div><b>Must-have keywords (resume + letter)</b><div class="cp-tags">${R.covered.map(k => `<span class="cp-tag ok">✓ ${esc(k)}</span>`).join("")}${R.missing.map(k => `<span class="cp-tag warn">${esc(k)}</span>`).join("")}</div><p class="small muted" style="margin-top:6px">Add a missing keyword only where it's true. Leave real gaps visible; never stuff keywords.</p></div></div>`; };
    $("#ak-go2").onclick = async () => { const b = $("#ak-go2"), J = job(); A().busy(b, true, "Drafting (2 steps)…");
      try { const r = A().resumeObj(st.rid); st.tail = await RQ.ai("tailor", { text: RS().text(r).slice(0, 8000), jd: J.jd.slice(0, 6000), role: J.title || r.targetRole, missing: st.F.weak.slice(0, 15) });
        st.cover = await RQ.ai("cover", { text: RS().text(r).slice(0, 7000), jd: J.jd.slice(0, 5000), title: J.title, company: J.company, name: (r.contact && r.contact.name) || "", tone: $("#ak-tone").value, length: $("#ak-len").value, extra: [$("#ak-x").value, profileText().slice(0, 600)].filter(Boolean).join("\n") });
        st.letter = st.cover.letter; st.subject = st.cover.subject; st.step = 3; steps(); drawDraft(); lint(); RQ.track("apply_draft", J.title || ""); } catch (e) { toast(e.message, "bad"); }
      A().busy(b, false); RQ.renderCredits(); };
    $("#ak-go3").onclick = async () => { const b = $("#ak-go3"), J = job(); A().busy(b, true, "Reviewing…");
      const draft = (st.tail ? "TAILORED SUMMARY: " + (st.tail.summary || "") + "\nTAILORED BULLETS:\n" + st.tail.bullets.filter((x, i) => st.accepted[i] !== false).map(x => "- " + x.proposed).join("\n") + "\n\n" : "") + "COVER LETTER:\n" + (st.subject || "") + "\n" + (st.letter || "");
      try { const o = await RQ.ai("apply_review", { text: draft.slice(0, 5000), resume: resumeTxt().slice(0, 5500), jd: J.jd.slice(0, 4000), title: J.title, company: J.company }); st.review = o; drawReview(); st.step = 4; steps(); finalCard(); } catch (e) { toast(e.message, "bad"); }
      A().busy(b, false); RQ.renderCredits(); };
    const drawReview = () => { const o = st.review;
      $("#ak-rev").innerHTML = `<div class="note ${o.verdict === "ready" ? "ok" : "warn"}"><b>${o.verdict === "ready" ? "Ready to send" : "Fix these first"}.</b> ${esc(o.summary)}</div>
        ${o.unsupported.length ? `<h4>Claims your resume doesn't support</h4><ul class="cp-lint">${o.unsupported.map(x => `<li class="cp-bad">✕ <span style="color:var(--ink2)">${esc(x)}</span></li>`).join("")}</ul>` : ""}
        ${o.stretches.length ? `<h4>Interview backtrack test</h4><p class="small muted">Could you explain each line in an interview without saying "well, what I actually meant was…"?</p>${o.stretches.map((x, i) => `<div class="cp-q" style="margin-bottom:8px"><span class="badge ${x.advice === "drop" ? "bad" : x.advice === "soften" ? "warn" : "ok"}">${x.advice}</span> <i>“${esc(x.line)}”</i><div class="small muted">${esc(x.why)}</div>${x.softer ? `<div class="small" style="margin-top:4px"><b>Safer:</b> ${esc(x.softer)} <button class="btn btn-ghost btn-sm" data-soft="${i}">Use this</button></div>` : ""}</div>`).join("")}` : ""}
        ${o.targeting.length ? `<h4>Targeting</h4><ul class="small" style="padding-left:18px">${o.targeting.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}${o.style.length ? `<h4>Style</h4><ul class="small" style="padding-left:18px">${o.style.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${o.headline ? `<div class="note info">Suggested headline: <b>${esc(o.headline)}</b> <button class="btn btn-ghost btn-sm" id="ak-hl">Use as subject</button></div>` : ""}`;
      $$("[data-soft]").forEach(b => b.onclick = () => { const x = st.review.stretches[+b.dataset.soft]; const lt = $("#ak-letter"); if (lt && lt.value.includes(x.line)) { lt.value = lt.value.replace(x.line, x.softer); st.letter = lt.value; lint(); toast("Replaced in your letter", "ok"); b.disabled = true; return; }
        const tb = st.tail && st.tail.bullets.find(t => t.proposed.includes(x.line) || x.line.includes(t.proposed)); if (tb) { tb.proposed = x.softer; drawDraft(); lint(); toast("Bullet softened", "ok"); } else A().copy(x.softer); });
      const hb = $("#ak-hl"); if (hb) hb.onclick = () => { st.subject = st.review.headline; const s = $("#ak-sub"); if (s) s.value = st.subject; toast("Subject updated", "ok"); }; };
    const finalCard = () => { const J = job();
      const checks = [["Fit checked before drafting", !!st.F], ["Bullets use only your real experience (reviewer found " + (st.review ? st.review.unsupported.length : "?") + " unsupported claims)", st.review && !st.review.unsupported.length], ["No em-dashes or clichés", st.lint && !st.lint.lint.slice(0, 2).some(l => l[0] === "bad")], ["Letter fits one page", st.lint && st.lint.words <= 420], ["Company named in the letter", st.lint && !st.lint.lint.some(l => /Doesn't name/.test(l[1]))], ["Every number is in your resume", st.lint && !st.lint.lint.some(l => /Numbers not found/.test(l[1]))]];
      $("#ak-final").innerHTML = `<ul class="cp-lint" style="margin-bottom:12px">${checks.map(([t, ok]) => `<li class="${ok ? "cp-ok" : "cp-warn"}">${ok ? "✓" : "!"} <span style="color:var(--ink2)">${esc(t)}</span></li>`).join("")}</ul>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" id="ak-save">💾 Save all (tailored resume + letter + tracker)</button><button class="btn btn-ghost" id="ak-copy">📋 Copy letter</button></div><div id="ak-done" style="margin-top:12px"></div>`;
      $("#ak-copy").onclick = () => A().copy((st.subject ? "Subject: " + st.subject + "\n\n" : "") + (st.letter || ""));
      $("#ak-save").onclick = () => { const base = store.get(st.rid); const r = JSON.parse(JSON.stringify(RS().normalize(base.data))); let n = 0;
        const norm = (x) => String(x || "").replace(/\*\*/g, "").replace(/^\s*[-•*–▪]\s*/, "").replace(/\s+/g, " ").trim().toLowerCase();
        if (st.tail) { if (st.tail.summary && st.accepted.sum !== false) r.summary = st.tail.summary;
          st.tail.bullets.forEach((t, i) => { if (st.accepted[i] === false) return; const o = norm(t.original); for (const k of ["experience", "projects"]) for (const e of r[k]) { const ls = String(e.bullets || "").split("\n"); const j = ls.findIndex(x => norm(x) === o); if (j >= 0) { ls[j] = t.proposed; e.bullets = ls.join("\n"); n++; return; } } }); }
        if (J.title) r.targetRole = J.title;
        const rd = store.save({ kind: "resume", title: `${(r.contact && r.contact.name) || "Resume"} — ${J.company || J.title || "tailored"}`, data: RS().normalize(r) });
        const cd = store.save({ kind: "cover", title: [J.title, J.company].filter(Boolean).join(" · ") || "Cover letter", data: { subject: st.subject || "", letter: st.letter || "", note: "" } });
        const ex = store.list("application").find(a => a.data.role === (J.title || "") && a.data.company === (J.company || ""));
        const ad = store.save({ id: ex && ex.id, kind: "application", title: [J.title, J.company].filter(Boolean).join(" · ") || "Job", data: Object.assign({ link: "", applied: "", followUp: "", salary: "", contact: "" }, ex ? ex.data : {}, { role: J.title || "", company: J.company || "", status: "Ready to Apply", resumeId: rd.id, coverId: cd.id, fit: st.F.overall, fitId: st.fit ? st.fit.id : (ex && ex.data.fitId) || "", notes: ((ex && ex.data.notes) || "") + (ex && ex.data.notes ? "\n" : "") + "Apply kit " + A().today() + ": fit " + st.F.overall + "/100" }) });
        $("#ak-done").innerHTML = `<div class="note ok">Saved. ${n} bullet${n === 1 ? "" : "s"} applied to a new tailored copy (your main resume is unchanged).<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><a class="btn btn-primary btn-sm" href="/studio?id=${encodeURIComponent(rd.id)}">Open tailored resume</a><a class="btn btn-ghost btn-sm" href="#/cover-letter">Cover letters</a><a class="btn btn-ghost btn-sm" href="#/applications">Tracker</a><a class="btn btn-ghost btn-sm" href="#/screening">Form answers for this job</a></div></div>`;
        RQ.track("apply_save", J.title || ""); }; };
  }

  /* ---------- register ---------- */
  window.RQ_CP = { SUB, cpList, cpSave, profile, profileText, profileFill, evalFit, verdictOf, page, addCss, listOf, uniq, lc, clamp, ring, W, dlBadge, daysTo, setPending: (j) => { pending = j; } };
  window.RQ_EXTRA_ROUTES = Object.assign(window.RQ_EXTRA_ROUTES || {}, { profile: profileView, fit: fitView, shortlist: shortlistView, apply: applyView });
  window.RQ_EXTRA_TITLES = Object.assign(window.RQ_EXTRA_TITLES || {}, { profile: "Career profile", fit: "Fit check", shortlist: "Rank jobs", apply: "Apply kit" });
})();
