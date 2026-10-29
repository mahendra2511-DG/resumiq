/* Resumiq — Resume Studio: section navigator, guided editor with Dexa AI actions, live preview, quality score, role guide, job tailoring. */
(function () {
  "use strict";
  const { $, $$, esc, toast, modal, closeModal, store, debounce, ls } = window.RQ;
  const RS = window.RQ_RESUME, RR = window.RQ_ROLES;
  const P = new URLSearchParams(location.search);
  let doc = null, R = null, cur = "contact", hist = [], hi = -1, pages = 1, zoom = "fit", tab = "preview", jdDoc = null, lastSnap = 0;
  const openEnt = new Set(); let lastList = "";

  /* ---------- helpers ---------- */
  const L = () => RR.LEVELS.find(l => l.id === R.level) || RR.LEVELS[0];
  const G = () => RR.guide(R.targetRole);
  const secById = (id) => R.sections.find(s => s.id === id);
  const secOf = (type) => R.sections.find(s => s.type === type);
  const isMobile = () => window.matchMedia("(max-width:980px)").matches;
  const download = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); };
  const aiBusy = (btn, on, label) => { if (!btn) return; if (on) { btn.dataset.l = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span> ' + (label || "Dexa is working…"); } else { btn.disabled = false; btn.innerHTML = btn.dataset.l || btn.innerHTML; } };
  const aiErr = (e) => toast(e.code === "daily_limit" ? (e.message || "You've used today's free AI credits. They reset at midnight.") : e.message, "bad");
  const TIPS = {
    contact: "Name, a headline that matches the job you want, and how to reach you. Leave out photo, date of birth, marital status, religion and full address.",
    summary: "2–3 lines (40–60 words): who you are for this role, your strongest skills, and one real result. Skip clichés like \"hard-working team player\".",
    experience: "Most recent first. 3–5 bullets per role: action verb + what you did + the result, with a number when you have one. Only real facts.",
    projects: "Projects prove skills. For each: the problem, the tools, your part and the result. Add a GitHub or live link.",
    education: "Degree, college and years. Add CGPA/percentage if it helps; drop school (10th/12th) once you have a degree and experience.",
    skills: "Group skills (e.g. Analysis, Tools, Working style). List only what you can discuss in an interview; 6–30 is plenty.",
    certifications: "Only certifications that matter for this role, with issuer and month.",
    achievements: "Awards, rankings, recognitions, with a number or context (e.g. \"Top 5 of 120 interns\").",
    publications: "Title, venue and year.", languages: "e.g. English (fluent), Hindi (native).", volunteering: "Role, organisation and what you achieved.", interests: "Optional. Keep it short and genuine.",
  };

  /* ---------- history + autosave ---------- */
  const titleEl = $("#st-title"), savedEl = $("#st-saved");
  function pushNow() { if (!R) return; const s = JSON.stringify(R); if (s === hist[hi]) return; hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 80) hist.shift(); hi = hist.length - 1; undoState(); }
  const pushHist = debounce(pushNow, 600);
  function undoState() { $("#st-undo").disabled = hi <= 0; $("#st-redo").disabled = hi >= hist.length - 1; }
  const persist = debounce(() => {
    if (!doc) return; doc = store.save({ id: doc.id, kind: "resume", title: titleEl.value.trim() || "Untitled resume", data: R });
    savedEl.textContent = store.cloud ? "Saved to your account" : "Saved in this browser"; savedEl.title = new Date().toLocaleTimeString();
    if (Date.now() - lastSnap > 10 * 60 * 1000) { snapshot("Auto-save"); }
  }, 450);
  function changed(o) { o = o || {}; pushHist(); persist(); savedEl.textContent = "Saving…"; schedule(); if (o.editor) drawEditor(); }
  let raf = 0; function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { drawPreview(); drawNav(); drawSide(); }); }
  function undo(d) { pushNow(); const n = hi + d; if (n < 0 || n >= hist.length) return; hi = n; R = RS.normalize(JSON.parse(hist[hi])); persist(); undoState(); drawAll(); }
  const vKey = () => "rq_ver_" + doc.id;
  function snapshot(label) { if (!doc) return; const v = ls.get(vKey(), []); v.unshift({ t: new Date().toISOString(), label: label || "Saved version", data: R }); ls.set(vKey(), v.slice(0, 20)); lastSnap = Date.now(); }

  /* ---------- open / create ---------- */
  function open(d) {
    doc = d; R = RS.normalize(JSON.parse(JSON.stringify(d.data || {}))); titleEl.value = d.title || "Untitled resume";
    hist = [JSON.stringify(R)]; hi = 0; undoState(); lastSnap = Date.now();
    if (!cur || (cur !== "contact" && !secById(cur))) cur = "contact";
    if (P.get("jd")) { jdDoc = store.get(P.get("jd")); if (jdDoc) { $("#pv-jobtab").hidden = false; } }
    if (location.search.indexOf("id=" + d.id) < 0) history.replaceState(null, "", "/studio?id=" + encodeURIComponent(d.id) + (jdDoc ? "&jd=" + encodeURIComponent(jdDoc.id) : ""));
    savedEl.textContent = store.cloud ? "Saved to your account" : "Saved in this browser";
    drawAll(); if (jdDoc && P.get("tab") === "job") setTab("job");
  }
  function create(r, title) {
    r = RS.normalize(r); const d = store.save({ kind: "resume", title: title || ((r.targetRole || "My") + " resume"), data: r });
    RQ.track(r.fromSample ? "sample_open" : "resume_create", r.targetRole || "");
    cur = "contact"; openEnt.clear(); jdDoc = null; $("#pv-jobtab").hidden = true; if (tab === "job") setTab("preview");
    history.replaceState(null, "", "/studio?id=" + encodeURIComponent(d.id)); open(d); return d;
  }
  function drawAll() { drawNav(); drawEditor(); drawTools(); drawPreview(); drawSide(); }

  /* ---------- left: section navigator ---------- */
  function fill(type) {
    const c = R.contact, w = RS.words;
    switch (type) {
      case "contact": { const n = [c.name, c.email, c.phone, c.headline].filter(x => String(x || "").trim()).length; return n === 4 ? 2 : n ? 1 : 0; }
      case "summary": return w(R.summary) >= 20 ? 2 : w(R.summary) ? 1 : 0;
      case "experience": case "projects": { const a = R[type]; if (!a.length) return 0; return a.every(e => RS.lines(e.bullets).length >= 2) ? 2 : 1; }
      case "education": return R.education.some(e => e.degree && e.school) ? 2 : R.education.length ? 1 : 0;
      case "skills": { const n = R.skills.flatMap(g => String(g.items || "").split(",").filter(x => x.trim())).length; return n >= 6 ? 2 : n ? 1 : 0; }
      case "certifications": return R.certifications.some(x => x.name) ? 2 : 0;
      default: return String(R[type] || "").trim() ? 2 : 0;
    }
  }
const ICO = { contact: "👤", summary: "📝", experience: "💼", projects: "🧪", education: "🎓", skills: "🛠", certifications: "📜", achievements: "🏆", publications: "📚", languages: "🌐", volunteering: "🤝", interests: "✨" };
  function drawNav() {
    if (!R) { $("#st-nav").innerHTML = '<p class="small muted" style="padding:10px">Set up a resume to see its sections here.</p>'; return; }
    const nav = $("#st-nav"), dot = (n) => `<span class="st-dot ${n === 2 ? "ok" : n === 1 ? "half" : ""}" aria-hidden="true"></span>`;
    const missing = Object.keys(RS.SECTIONS).filter(t => !secOf(t));
    const vis = R.sections.filter(x => !x.hidden), done = [fill("contact")].concat(vis.map(x => fill(x.type))), pct = Math.round(done.reduce((a, v) => a + v, 0) / (done.length * 2) * 100);
    nav.innerHTML = `<div class="st-prog"><div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700"><span>Resume progress</span><span>${pct}%</span></div><div class="bar ${pct >= 80 ? "ok" : ""}" style="margin-top:6px"><i style="width:${pct}%"></i></div></div><h4>Sections</h4>
      <div class="st-sec ${cur === "contact" ? "on" : ""}" data-go="contact" tabindex="0" role="button">${dot(fill("contact"))}<span class="st-ic" aria-hidden="true">${ICO.contact}</span><span class="nm">Contact & headline</span></div>
      ${R.sections.map((s, i) => `<div class="st-sec ${cur === s.id ? "on" : ""} ${s.hidden ? "off" : ""}" data-go="${s.id}" tabindex="0" role="button" aria-label="${esc(s.title)}${s.hidden ? " (hidden)" : ""}">${dot(fill(s.type))}<span class="st-ic" aria-hidden="true">${ICO[s.type] || "•"}</span><span class="nm">${esc(s.title)}</span>
        <span class="ctl"><button type="button" data-mv="${i}:-1" title="Move up" aria-label="Move ${esc(s.title)} up" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" data-mv="${i}:1" title="Move down" aria-label="Move ${esc(s.title)} down" ${i === R.sections.length - 1 ? "disabled" : ""}>↓</button><button type="button" data-hide="${i}" title="${s.hidden ? "Show on resume" : "Hide from resume"}" aria-label="${s.hidden ? "Show" : "Hide"} ${esc(s.title)}">${s.hidden ? "◌" : "👁"}</button></span></div>`).join("")}
      ${missing.length ? `<div style="padding:8px 4px"><select class="select" id="st-add" aria-label="Add a section" style="font-size:13.5px;padding:8px 10px"><option value="">＋ Add a section…</option>${missing.map(t => `<option value="${t}">${RS.SECTIONS[t]}</option>`).join("")}</select></div>` : ""}
      <div class="card" style="margin:14px 4px 0;padding:12px;box-shadow:none">
        <div class="small muted">Target</div><div style="font-weight:700;font-size:14px">${esc(R.targetRole || "Not set")}</div><div class="small muted">${esc(L().t)} · ${L().pages} page${L().pages > 1 ? "s" : ""}</div>
        <button type="button" class="btn-link small" id="st-setup" style="margin-top:6px">Change role or level</button>
        <p class="small" style="margin:8px 0 0;color:var(--ink2)">💡 ${esc(L().tip)}</p></div>`;
    $$("[data-go]", nav).forEach(el => { const go = (e) => { if (e.target.closest("button")) return; cur = el.dataset.go; drawNav(); drawEditor(); if (isMobile()) setM("ed"); }; el.onclick = go; el.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(e); } }; });
    $$("[data-mv]", nav).forEach(b => b.onclick = () => { const [i, d] = b.dataset.mv.split(":").map(Number), j = i + d; if (j < 0 || j >= R.sections.length) return; const s = R.sections; [s[i], s[j]] = [s[j], s[i]]; changed(); drawNav(); });
    $$("[data-hide]", nav).forEach(b => b.onclick = () => { const s = R.sections[+b.dataset.hide]; s.hidden = !s.hidden; changed(); toast(s.hidden ? `${s.title} hidden from the resume` : `${s.title} shown`); });
    const add = $("#st-add"); if (add) add.onchange = () => { const t = add.value; if (!t) return; const s = { id: RS.uid(), type: t, title: RS.SECTIONS[t], hidden: false }; R.sections.push(s); cur = s.id; changed({ editor: true }); if (isMobile()) setM("ed"); };
    $("#st-setup").onclick = () => wizard({ edit: true });
  }

  /* ---------- center: editor ---------- */
  const ed = $("#ed");
  const fld = (label, attrs, val, o) => { o = o || {}; const id = "f" + Math.random().toString(36).slice(2, 8);
    if (o.type === "textarea") return `<div><label class="f" for="${id}">${label}</label><textarea class="textarea" id="${id}" ${attrs} rows="${o.rows || 4}" placeholder="${esc(o.ph || "")}">${esc(val)}</textarea>${o.help ? `<div class="help">${o.help}</div>` : ""}</div>`;
    if (o.type === "check") return `<div style="display:flex;align-items:flex-end;padding-bottom:10px"><label style="display:flex;gap:8px;align-items:center;font-size:14px;cursor:pointer"><input type="checkbox" ${attrs} ${val ? "checked" : ""}> ${label}</label></div>`;
    return `<div><label class="f" for="${id}">${label}</label><input class="input" id="${id}" ${attrs} type="${o.type || "text"}" value="${esc(val)}" placeholder="${esc(o.ph || "")}" ${o.dis ? "disabled" : ""}>${o.help ? `<div class="help">${o.help}</div>` : ""}</div>`; };
  const MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // month + year dropdowns (works in every browser; year alone is allowed)
  function monthFld(label, attrs, val, dis) {
    const m = /^(\d{4})(?:-(\d{2}))?/.exec(val || ""), y = m ? m[1] : "", mo = m && m[2] ? m[2] : "", now = new Date().getFullYear(), ys = []; for (let k = now + 6; k >= 1970; k--) ys.push(k);
    return `<div><label class="f">${label}</label><div class="mpick"><select class="select" ${attrs} data-part="m" ${dis ? "disabled" : ""} aria-label="${esc(label)} month"><option value="">Month</option>${MONS.map((n, i) => { const v = String(i + 1).padStart(2, "0"); return `<option value="${v}" ${v === mo ? "selected" : ""}>${n}</option>`; }).join("")}</select><select class="select" ${attrs} data-part="y" ${dis ? "disabled" : ""} aria-label="${esc(label)} year"><option value="">Year</option>${ys.map(v => `<option value="${v}" ${String(v) === y ? "selected" : ""}>${v}</option>`).join("")}</select></div></div>`;
  }
  function head(title, tip, extra, s) {
    return `<div class="ed-head"><div style="min-width:0;flex:1">${s ? `<input class="st-title" data-sectitle="${s.id}" value="${esc(s.title)}" aria-label="Section title" style="font-size:22px;font-weight:800;padding:2px 6px;margin-left:-6px;width:100%">` : `<h2>${esc(title)}</h2>`}<p>${esc(tip)}</p></div>${extra || ""}</div>`;
  }
  function drawEditor() {
    if (!R) return emptyState();
    if (cur === "contact") return contactEd();
    const s = secById(cur); if (!s) { cur = "contact"; return contactEd(); }
    const ctl = `<div style="display:flex;gap:6px;flex:none">${s.hidden ? `<span class="badge warn">Hidden</span>` : ""}<button type="button" class="btn btn-ghost btn-sm" id="sec-del" title="Remove this section">🗑</button></div>`;
    let h = head("", TIPS[s.type] || "", ctl, s);
    if (s.type === "summary") h += summaryEd();
    else if (["experience", "projects", "education", "certifications"].includes(s.type)) h += listEd(s.type);
    else if (s.type === "skills") h += skillsEd();
    else if (["languages", "interests"].includes(s.type)) h += `<div class="card card-pad">${fld(s.title, `data-txt="${s.type}"`, R[s.type], { ph: s.type === "languages" ? "English (fluent), Hindi (native)" : "e.g. Chess (state-level), long-distance running" })}</div>`;
    else h += `<div class="card card-pad">${fld("One item per line", `data-txt="${s.type}"`, R[s.type], { type: "textarea", rows: 6, ph: s.type === "achievements" ? "Ranked 2nd of 140 teams in a national hackathon (2024)" : "" })}</div>`;
    ed.innerHTML = h + pager(); wireEditor(s); wirePager();
  }
  const order = () => ["contact"].concat(R.sections.filter(x => !x.hidden).map(x => x.id));
  function pager() { const o = order(), i = o.indexOf(cur), nm = (k) => k === "contact" ? "Contact" : (secById(k) || {}).title; return `<div class="ed-pager">${i > 0 ? `<button type="button" class="btn btn-ghost" data-pg="${o[i - 1]}">← ${esc(nm(o[i - 1]))}</button>` : "<span></span>"}${i < o.length - 1 ? `<button type="button" class="btn btn-primary" data-pg="${o[i + 1]}">Next: ${esc(nm(o[i + 1]))} →</button>` : `<button type="button" class="btn btn-primary" data-pg="__score">Check ATS score →</button>`}</div><p class="small muted" style="text-align:center;margin-top:10px">Tip: wrap words in **double stars** to make them bold on the resume.</p>`; }
  function wirePager() { $$("[data-pg]", ed).forEach(b => b.onclick = () => { if (b.dataset.pg === "__score") { setTab("score"); if (isMobile()) setM("pv"); return; } cur = b.dataset.pg; drawNav(); drawEditor(); window.scrollTo(0, 0); $("#st-ed").scrollTop = 0; }); }
  function emptyState() { ed.innerHTML = `<div class="empty card" style="margin-top:40px"><div class="ei">📄</div><b>No resume open</b><p>Start a new resume with Dexa's setup, or import the one you have.</p><button class="btn btn-primary" id="es-new">Start a resume</button></div>`; $("#es-new").onclick = () => wizard(); }
  function contactEd() {
    const c = R.contact, g = G();
    ed.innerHTML = head("Contact & headline", TIPS.contact) + `<div class="card card-pad">
      <div class="row">${fld("Full name", 'data-c="name" autocomplete="name"', c.name, { ph: "Priya Sharma" })}${fld("Headline (job title you want)", 'data-c="headline"', c.headline, { ph: g.title || "Data Analyst" })}</div>
      <div class="row">${fld("Email", 'data-c="email" autocomplete="email"', c.email, { type: "email", ph: "priya.sharma@email.com" })}${fld("Phone", 'data-c="phone" autocomplete="tel"', c.phone, { type: "tel", ph: "+91 98xxx xxxxx" })}</div>
      <div class="row">${fld("City, Country", 'data-c="location"', c.location, { ph: "Pune, India" })}${fld("LinkedIn", 'data-c="linkedin"', c.linkedin, { ph: "linkedin.com/in/your-name" })}</div>
      <div class="row">${fld("Portfolio / website", 'data-c="portfolio"', c.portfolio, { ph: "yourname.github.io" })}${fld("GitHub (tech roles)", 'data-c="github"', c.github, { ph: "github.com/yourname" })}</div>
      <div class="note info">ℹ Don't add a photo, date of birth, marital status, religion, father's name or a declaration. Indian recruiters and ATS don't need them, and they take space from your results.</div></div>` + pager();
    wireEditor(null); wirePager();
  }
  function summaryEd() {
    const n = RS.words(R.summary), cl = ["team player", "hard working", "hardworking", "go-getter", "self-motivated", "result-oriented", "fast learner", "quick learner"].filter(x => R.summary.toLowerCase().includes(x));
    return `<div class="card card-pad">${fld("Professional summary", 'data-txt="summary" id="sum-ta"', R.summary, { type: "textarea", rows: 5, ph: G().summary })}
      <div class="help" id="sum-help">${n} words ${n && (n < 25 || n > 80) ? "· aim for 40–60" : ""}${cl.length ? ` · ⚠ clichés: ${esc(cl.join(", "))}` : ""}</div>
      <div class="ai-row"><button type="button" class="btn btn-ai btn-sm" id="sum-ai">✨ Write with Dexa</button><button type="button" class="btn btn-ghost btn-sm" id="sum-pat">Use the ${esc(G().title)} pattern</button>${R.summary ? `<button type="button" class="btn btn-ghost btn-sm" data-rw="summary">✨ Improve this</button>` : ""}<span class="small muted" data-ai-left style="align-self:center"></span></div></div>`;
  }
  const FIELDS = {
    experience: [["role", "Job title", "Data Analyst"], ["company", "Company", "Company name"], ["location", "Location", "City or Remote"], ["start", "Start", "", "month"], ["end", "End", "", "month"], ["current", "I currently work here", "", "check"], ["bullets", "Achievements, one per line", "", "bullets"]],
    projects: [["title", "Project name", "Sales Performance Dashboard"], ["tools", "Tools used", "SQL, Power BI"], ["link", "Link (GitHub / live)", "github.com/you/project"], ["date", "Month", "", "month"], ["bullets", "What you did and the result, one per line", "", "bullets"]],
    education: [["degree", "Degree / course", "B.Tech, Computer Science"], ["school", "College / university", "Institute name"], ["start", "Start", "", "month"], ["end", "End (or expected)", "", "month"], ["score", "CGPA / %", "CGPA 8.2"], ["location", "City", ""], ["details", "Highlights (optional, one per line)", "", "lines"]],
    certifications: [["name", "Certification", "Microsoft Power BI Data Analyst (PL-300)"], ["issuer", "Issuer", "Microsoft"], ["date", "Month", "", "month"]],
  };
  const entTitle = (t, e) => t === "experience" ? [e.role || "New role", e.company] : t === "projects" ? [e.title || "New project", e.tools] : t === "education" ? [e.degree || "New education", e.school] : [e.name || "New certification", e.issuer];
  function listEd(t) {
    const arr = R[t], F = FIELDS[t];
    if (lastList !== t + cur) { lastList = t + cur; if (arr.length && ![...openEnt].some(id => arr.some(e => e.id === id))) openEnt.add(arr[0].id); }
    const items = arr.map((e, i) => { const [a, b] = entTitle(t, e), dt = t === "experience" ? RS.span(e.start, e.end, e.current) : t === "education" ? RS.span(e.start, e.end) : RS.fmtMonth(e.date);
      const body = []; let row = [];
      F.forEach(([k, lab, ph, ty]) => {
        if (ty === "bullets" || ty === "lines") { if (row.length) { body.push(`<div class="row">${row.join("")}</div>`); row = []; }
          if (t === "projects" && ty === "bullets") body.push(`<div class="pj-ideas" data-pj="${i}">${pjHtml(i)}</div>`);
          body.push(fld(lab, `data-arr="${t}" data-i="${i}" data-f="${k}"`, e[k], { type: "textarea", rows: ty === "bullets" ? 5 : 3, ph: ty === "bullets" ? (G().patterns[0] || "") + "\n" + (G().patterns[1] || "") : "" }));
          if (ty === "bullets") body.push(`<ul class="blint" data-lint="${t}:${i}">${lintHtml(t, i)}</ul><div class="ai-row"><button type="button" class="btn btn-ai btn-sm" data-write="${t}:${i}">✨ Write bullets from my notes</button><div class="dd" data-pat><button type="button" class="btn btn-ghost btn-sm">Insert a pattern ▾</button><div class="dd-menu" style="min-width:340px">${G().patterns.map((p, k) => `<a href="#" data-ins="${t}:${i}:${k}"><span><b style="font-weight:500">${esc(p)}</b></span></a>`).join("")}</div></div></div>`);
          return; }
        row.push(ty === "check" ? fld(lab, `data-arr="${t}" data-i="${i}" data-f="${k}"`, e[k], { type: "check" }) : (ty === "month" ? monthFld(lab, `data-arr="${t}" data-i="${i}" data-f="${k}"`, e[k], k === "end" && e.current) : fld(lab, `data-arr="${t}" data-i="${i}" data-f="${k}"`, e[k], { ph })));
        if (row.length === 2) { body.push(`<div class="row">${row.join("")}</div>`); row = []; }
      }); if (row.length) body.push(`<div class="row">${row.join("")}</div>`);
      return `<div class="ent ${openEnt.has(e.id) ? "" : "closed"}" data-ent="${e.id}"><div class="ent-h" data-tog="${e.id}"><span aria-hidden="true">${openEnt.has(e.id) ? "▾" : "▸"}</span><div style="flex:1;min-width:0"><b style="display:block">${esc(a)}</b><span class="muted">${esc([b, dt].filter(Boolean).join(" · "))}</span></div>
        <span style="display:flex;gap:2px"><button type="button" class="icon-btn" data-emv="${t}:${i}:-1" aria-label="Move up" title="Move up" ${i ? "" : "disabled"}>↑</button><button type="button" class="icon-btn" data-emv="${t}:${i}:1" aria-label="Move down" title="Move down" ${i < arr.length - 1 ? "" : "disabled"}>↓</button><button type="button" class="icon-btn" data-edup="${t}:${i}" aria-label="Duplicate" title="Duplicate">⧉</button><button type="button" class="icon-btn" data-edel="${t}:${i}" aria-label="Delete" title="Delete">🗑</button></span></div>
        <div class="ent-b">${e.needsReview ? `<div class="note warn">Imported without AI: split this into separate roles and fill in titles, companies and dates.</div>` : ""}${body.join("")}</div></div>`; }).join("");
    return `${items || `<div class="empty card"><div class="ei">${t === "experience" ? "💼" : t === "projects" ? "🧪" : t === "education" ? "🎓" : "📜"}</div><b>Nothing here yet</b><p>${t === "experience" && ["student", "switcher"].includes(R.level) ? "Internships, freelance and part-time work count. No experience yet? Hide this section and lead with Projects." : "Add your first entry."}</p></div>`}
      <button type="button" class="btn btn-soft" id="ent-add">＋ Add ${t === "experience" ? "a role" : t === "projects" ? "a project" : t === "education" ? "education" : "a certification"}</button>
      ${t === "certifications" && certIdeas().length ? `<div class="note info" style="margin-top:16px"><b>Popular certifications for ${esc(G().title)}</b> <span class="small">(add one only after you have earned it)</span><ul style="margin:6px 0 0;padding-left:18px">${certIdeas().map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
      ${t === "projects" && G().projects.length ? `<div class="note info" style="margin-top:16px"><b>Project ideas for ${esc(G().title)}:</b><ul style="margin:6px 0 0;padding-left:18px">${G().projects.map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>` : ""}`;
  }
  const CERTS = { data: ["Microsoft Power BI Data Analyst (PL-300)", "Tableau Desktop Specialist", "Google Data Analytics Professional Certificate", "Microsoft Excel Expert (MO-201)", "Microsoft Fabric Analytics Engineer (DP-600)"], tech: ["AWS Certified Cloud Practitioner", "Microsoft Azure Fundamentals (AZ-900)", "Oracle Java SE Programmer", "Certified ScrumMaster (CSM)"], finance: ["NISM Series certifications", "CFA Level I", "Financial Modeling & Valuation Analyst (FMVA)"], sales: ["Google Ads Certification", "HubSpot Inbound Marketing", "Google Analytics Certification"], hr: ["SHRM-CP", "HR Analytics certificate"], design: ["Google UX Design Certificate", "Adobe Certified Professional"], ops: ["Lean Six Sigma Green Belt", "PMP / CAPM", "APICS CSCP"], health: ["ICH-GCP certificate", "Clinical Data Management certificate"], hospitality: ["Food Safety (FSSAI FoSTaC)", "Revenue Management certificate"], education: ["CTET / NET (as applicable)", "Instructional Design certificate"], support: ["ITIL 4 Foundation", "Zendesk Support Administrator"], other: ["AutoCAD Certified User", "Six Sigma Yellow Belt"] };
  const certIdeas = () => { const f = (G().family || {}).id; const have = R.certifications.map(c => String(c.name || "").toLowerCase()); return (CERTS[f] || []).filter(c => !have.some(h => h && c.toLowerCase().includes(h.slice(0, 12)))); };
  /* project helper: tool chips + bullet ideas from the tools (rules) + Dexa suggestions (AI) */
  const pjAI = {};
  function pjHtml(i) {
    const p = R.projects[i]; if (!p) return ""; const have = new Set(RS.lines(p.bullets).map(x => RS.plain(x).toLowerCase()));
    const tl = String(p.tools || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
    const chips = G().skills.filter(k => !tl.includes(k.toLowerCase())).slice(0, 12);
    const ideas = window.RQ_IDEAS ? window.RQ_IDEAS.forProject(p.tools, p.title, 14).filter(x => !have.has(x.text.toLowerCase())) : [];
    const ai = pjAI[p.id];
    return `<div class="pj-box"><div class="pj-h"><b>💡 Project helper</b><span class="small muted">Tick only what you really did, then fill the [placeholders] with your numbers.</span></div>
      ${chips.length ? `<div class="small" style="margin:8px 0 4px;font-weight:600">${tl.length ? "Used more tools? Add them:" : "Which tools did you use? Tap to add:"}</div><div class="pj-chips">${chips.map(k => `<button type="button" class="chip" data-pjtool="${i}" data-v="${esc(k)}">＋ ${esc(k)}</button>`).join("")}</div>` : ""}
      ${ideas.length ? `<div class="small" style="margin:12px 0 6px;font-weight:600">Ideas from your tools (${ideas.length})</div><div class="pj-list">${ideas.map((x, k) => `<label class="pj-it"><input type="checkbox" data-pjk="${k}"><span><span class="badge" style="font-size:10.5px;margin-right:6px">${esc(x.tool)}</span>${esc(x.text).replace(/\[[^\]]+\]/g, y => `<span class="phl">${y}</span>`)}</span></label>`).join("")}</div>` : `<p class="small muted" style="margin:10px 0 0">${tl.length ? "No ready ideas for these tools yet — ask Dexa below." : "Add the tools you used (above or in the Tools field) to get bullet ideas."}</p>`}
      ${ai && ai.bullets ? `<div class="small" style="margin:12px 0 6px;font-weight:600">✨ Dexa's suggestions for this project</div><div class="pj-list">${ai.bullets.map((x, k) => `<label class="pj-it"><input type="checkbox" data-pja="${k}"><span>${esc(x).replace(/\[[^\]]+\]/g, y => `<span class="phl">${y}</span>`)}</span></label>`).join("")}</div>${ai.questions && ai.questions.length ? `<div class="note info" style="margin-top:8px"><b>Answer these to fill the numbers:</b><ul style="margin:4px 0 0;padding-left:18px">${ai.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ul></div>` : ""}${ai.skills && ai.skills.length ? `<div class="small" style="margin:8px 0 4px">Skills this project shows (add to Skills if true):</div><div class="pj-chips">${ai.skills.map(k => `<button type="button" class="chip" data-addsk="${esc(k)}">＋ ${esc(k)}</button>`).join("")}</div>` : ""}` : ""}
      <div class="ai-row"><button type="button" class="btn btn-primary btn-sm" data-pjadd="${i}">Add ticked points to resume</button><button type="button" class="btn btn-ai btn-sm" data-pjai="${i}">✨ ${ai ? "More ideas" : "Suggest with Dexa"}</button><input class="input" data-pjnote="${i}" placeholder="Optional: what did you do? (Hinglish ok)" style="flex:1;min-width:180px;padding:7px 10px;font-size:13px" value="${esc((ai && ai.notes) || "")}"></div></div>`;
  }
  function refreshPj(i) { const box = $(`[data-pj="${i}"]`, ed); if (box) { box.innerHTML = pjHtml(i); wirePj(box, i); } }
  function wirePj(box, i) {
    const p = R.projects[i]; if (!p) return;
    $$("[data-pjtool]", box).forEach(b => b.onclick = () => { p.tools = [p.tools, b.dataset.v].filter(x => String(x || "").trim()).join(", "); const tf = $(`[data-arr="projects"][data-i="${i}"][data-f="tools"]`, ed); if (tf) tf.value = p.tools; changed(); refreshPj(i); });
    $$("[data-addsk]", box).forEach(b => b.onclick = () => { if (!R.skills.length) R.skills.push({ id: RS.uid(), name: "Core skills", items: "" }); const g = R.skills[0]; if (!g.items.toLowerCase().split(",").map(x => x.trim()).includes(b.dataset.addsk.toLowerCase())) g.items = [g.items, b.dataset.addsk].filter(x => String(x).trim()).join(", "); b.disabled = true; b.textContent = "✓ " + b.dataset.addsk; changed(); });
    const add = $("[data-pjadd]", box); if (add) add.onclick = () => {
      const have = new Set(RS.lines(p.bullets).map(x => RS.plain(x).toLowerCase())), ideas = window.RQ_IDEAS.forProject(p.tools, p.title, 14).filter(x => !have.has(x.text.toLowerCase()));
      const pick = $$("[data-pjk]", box).filter(c => c.checked).map(c => ideas[+c.dataset.pjk].text).concat($$("[data-pja]", box).filter(c => c.checked).map(c => pjAI[p.id].bullets[+c.dataset.pja]));
      if (!pick.length) return toast("Tick at least one point you actually did.");
      p.bullets = [p.bullets, ...pick].filter(x => String(x || "").trim()).join("\n"); changed({ editor: true }); toast(`Added ${pick.length} point(s). Now replace the [placeholders] with your real numbers.`, "ok");
    };
    const aib = $("[data-pjai]", box); if (aib) aib.onclick = async () => {
      if (!String(p.title || "").trim() && !String(p.tools || "").trim()) return toast("Add the project name and tools first.");
      const notes = ($("[data-pjnote]", box) || {}).value || ""; aiBusy(aib, true, "Thinking…");
      try { const j = await RQ.ai("project_ideas", { title: p.title, tools: p.tools, notes, role: R.targetRole, level: R.level, existing: RS.lines(p.bullets).slice(0, 8) });
        pjAI[p.id] = { bullets: (j.bullets || []).filter(Boolean).slice(0, 8), questions: (j.questions || []).slice(0, 4), skills: (j.skills || []).filter(k => !R.skills.some(g => String(g.items || "").toLowerCase().includes(String(k).toLowerCase()))).slice(0, 8), notes };
        refreshPj(i); } catch (e) { aiErr(e); aiBusy(aib, false); } RQ.renderCredits();
    };
  }
  function lintHtml(t, i) {
    const ls2 = RS.lines(R[t][i].bullets); if (!ls2.length) return "";
    return ls2.map((l, k) => { const is = RS.lint(l); return `<li class="${is.length ? "" : "ok"}"><span class="tx">${esc(l.length > 140 ? l.slice(0, 140) + "…" : l)}<span class="is">${is.length ? "⚠ " + esc(is.join(" · ")) : "✓ Strong bullet"}</span></span><button type="button" class="btn btn-ai btn-sm" data-rwl="${t}:${i}:${k}" title="Improve with Dexa" aria-label="Improve this bullet with Dexa">✨</button></li>`; }).join("");
  }
  function skillsEd() {
    const have = new Set(R.skills.flatMap(g => String(g.items || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean)));
    const sug = G().skills.concat(G().soft).filter(k => !have.has(k.toLowerCase())).slice(0, 18);
    const jobMiss = jdDoc ? jobAnalysis().keywords.filter(k => k.status === "missing" && k.cat !== "edu" && !have.has(k.k.toLowerCase())).slice(0, 12) : [];
    return `${R.skills.map((g, i) => `<div class="ent"><div class="ent-b" style="border:0;padding-top:14px"><div class="row" style="grid-template-columns:200px 1fr">${fld("Group name", `data-arr="skills" data-i="${i}" data-f="name"`, g.name, { ph: "e.g. Analysis" })}<div><label class="f">Skills (comma separated)</label><div style="display:flex;gap:6px"><textarea class="textarea" rows="2" data-arr="skills" data-i="${i}" data-f="items" placeholder="SQL, Excel, Power BI" aria-label="Skills in ${esc(g.name || "group")}">${esc(g.items)}</textarea><button type="button" class="icon-btn" data-edel="skills:${i}" aria-label="Delete group" title="Delete group">🗑</button></div></div></div></div></div>`).join("")}
      <div class="ai-row"><button type="button" class="btn btn-soft" id="ent-add">＋ Add a skill group</button><button type="button" class="btn btn-ai" id="sk-ai">✨ Group my skills with Dexa</button></div>
      ${sug.length ? `<div class="card card-pad" style="margin-top:16px"><b style="font-size:14px">Common skills for ${esc(G().title)}</b><p class="small muted" style="margin:2px 0 10px">Click to add, only if you can prove it in an interview.</p><div style="display:flex;flex-wrap:wrap;gap:6px">${sug.map(k => `<button type="button" class="chip" data-addsk="${esc(k)}">＋ ${esc(k)}</button>`).join("")}</div></div>` : ""}
      ${jobMiss.length ? `<div class="card card-pad" style="margin-top:12px;border-color:#FCD34D"><b style="font-size:14px">Missing for your target job</b><p class="small muted" style="margin:2px 0 10px">From the job description. Add only what is true.</p><div style="display:flex;flex-wrap:wrap;gap:6px">${jobMiss.map(k => `<button type="button" class="chip" data-addsk="${esc(k.k)}">＋ ${esc(k.k)}</button>`).join("")}</div></div>` : ""}`;
  }
  function wireEditor(s) {
    const on = (sel, f) => { const el = $(sel, ed); if (el) el.onclick = f; };
    if (s) on("#sec-del", async () => { const has = fill(s.type) > 0; if (has && !(await RQ.confirm(`Remove the ${s.title} section and its content?`, "Remove", true))) return; R.sections = R.sections.filter(x => x.id !== s.id); if (Array.isArray(R[s.type])) R[s.type] = []; else R[s.type] = ""; cur = "contact"; changed({ editor: true }); });
    on("#ent-add", () => { const t = s.type; const blankE = { experience: { role: "", company: "", location: "", start: "", end: "", current: false, bullets: "" }, projects: { title: "", tools: "", link: "", date: "", bullets: "" }, education: { degree: "", school: "", start: "", end: "", score: "", location: "", details: "" }, certifications: { name: "", issuer: "", date: "" }, skills: { name: "", items: "" } }[t];
      const e = Object.assign({ id: RS.uid() }, blankE); if (t === "experience" || t === "projects") R[t].unshift(e); else R[t].push(e); openEnt.add(e.id); changed({ editor: true }); setTimeout(() => { const f = $(`[data-ent="${e.id}"] input, [data-arr="skills"][data-i="${R.skills.length - 1}"]`, ed); if (f) f.focus(); }, 30); });
    $$("[data-tog]", ed).forEach(h => h.onclick = (e) => { if (e.target.closest("button")) return; const id = h.dataset.tog; openEnt.has(id) ? openEnt.delete(id) : openEnt.add(id); drawEditor(); });
    $$("[data-emv]", ed).forEach(b => b.onclick = () => { const [t, i, d] = b.dataset.emv.split(":"), a = R[t], x = +i, y = x + +d; if (y < 0 || y >= a.length) return; [a[x], a[y]] = [a[y], a[x]]; changed({ editor: true }); });
    $$("[data-edup]", ed).forEach(b => b.onclick = () => { const [t, i] = b.dataset.edup.split(":"); const c = JSON.parse(JSON.stringify(R[t][+i])); c.id = RS.uid(); R[t].splice(+i + 1, 0, c); openEnt.add(c.id); changed({ editor: true }); });
    $$("[data-edel]", ed).forEach(b => b.onclick = async () => { const [t, i] = b.dataset.edel.split(":"); const e = R[t][+i]; const empty = !Object.keys(e).some(k => k !== "id" && String(e[k] || "").trim() && e[k] !== false); if (!empty && !(await RQ.confirm("Delete this entry?", "Delete", true))) return; R[t].splice(+i, 1); changed({ editor: true }); toast("Deleted. Use Undo (↶) if that was a mistake."); });
    $$("[data-addsk]", ed).forEach(b => b.onclick = () => { if (!R.skills.length) R.skills.push({ id: RS.uid(), name: "Core skills", items: "" }); const g = R.skills[0]; g.items = [g.items, b.dataset.addsk].filter(x => String(x).trim()).join(", "); changed({ editor: true }); });
    $$("[data-pat]", ed).forEach(dd => { const b = dd.querySelector("button"); b.onclick = (e) => { e.stopPropagation(); $$(".dd.open", ed).forEach(x => x !== dd && x.classList.remove("open")); dd.classList.toggle("open"); }; });
    $$("[data-ins]", ed).forEach(a => a.onclick = (e) => { e.preventDefault(); const [t, i, k] = a.dataset.ins.split(":"); const it = R[t][+i]; it.bullets = [it.bullets, G().patterns[+k]].filter(x => String(x || "").trim()).join("\n"); changed({ editor: true }); toast("Pattern added. Replace each [placeholder] with your real facts."); });
    $$("[data-write]", ed).forEach(b => b.onclick = () => { const [t, i] = b.dataset.write.split(":"); writeBullets(t, +i); });
    $$("[data-pj]", ed).forEach(box => wirePj(box, +box.dataset.pj));
    on("#sk-ai", async () => { const b = $("#sk-ai", ed); if (RS.text(R).replace(/\s/g, "").length < 150) return toast("Add projects or experience first, so Dexa can see your skills."); aiBusy(b, true, "Grouping…");
      try { const j = await RQ.ai("skills_suggest", { text: RS.text(R).slice(0, 7000), role: R.targetRole }); const gs = j.groups || []; if (!gs.length) throw new Error("No skills found. Add more detail to your bullets.");
        const m = modal(`<h3>✨ Skill groups from your resume</h3><p class="small muted">Only skills that already appear in your resume. Review, then apply.</p>${gs.map(g => `<div class="card" style="padding:10px 12px;margin:8px 0;box-shadow:none"><b>${esc(g.name)}:</b> ${esc(g.items.join(", "))}</div>`).join("")}<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn btn-ghost" data-mode="add">Add missing to my groups</button><button class="btn btn-primary" data-mode="replace">Replace my skills section</button></div>`, { wide: true });
        $$("[data-mode]", m).forEach(x => x.onclick = () => { if (x.dataset.mode === "replace") R.skills = gs.map(g => ({ id: RS.uid(), name: g.name, items: g.items.join(", ") })); else { const have = new Set(R.skills.flatMap(g => String(g.items || "").split(",").map(v => v.trim().toLowerCase()))); gs.forEach(g => { const add = g.items.filter(v => !have.has(v.toLowerCase())); if (!add.length) return; const ex = R.skills.find(q => q.name.toLowerCase() === g.name.toLowerCase()); if (ex) ex.items = [ex.items, ...add].filter(Boolean).join(", "); else R.skills.push({ id: RS.uid(), name: g.name, items: add.join(", ") }); }); } closeModal(); changed({ editor: true }); toast("Skills updated.", "ok"); });
      } catch (e) { aiErr(e); } aiBusy(b, false); RQ.renderCredits(); });
    $$("[data-rwl]", ed).forEach(b => b.onclick = () => { const [t, i, k] = b.dataset.rwl.split(":"); const it = R[t][+i], ls2 = RS.lines(it.bullets); rewrite(ls2[+k], (v) => { const all = it.bullets.split("\n"); let n = -1; it.bullets = all.map(x => { if (x.replace(/^\s*[-•*–▪]\s*/, "").trim()) n++; return n === +k && x.replace(/^\s*[-•*–▪]\s*/, "").trim() === ls2[+k] ? v : x; }).join("\n"); changed({ editor: true }); }, entTitle(t, it).join(" at ")); });
    $$("[data-rw]", ed).forEach(b => b.onclick = () => rewrite(R.summary, (v) => { R.summary = v; changed({ editor: true }); }, "Professional summary"));
    on("#sum-ai", () => writeSummary($("#sum-ai", ed)));
    on("#sum-pat", () => { if (R.summary.trim() && !confirm("Replace your current summary with the pattern?")) return; R.summary = G().summary; changed({ editor: true }); toast("Fill each [placeholder] with your facts."); });
    window.RQ.renderCredits();
  }
  ed.addEventListener("input", (e) => {
    const t = e.target; if (!R) return;
    if (t.dataset.c) R.contact[t.dataset.c] = t.value;
    else if (t.dataset.txt) R[t.dataset.txt] = t.value;
    else if (t.dataset.sectitle) { const s = secById(t.dataset.sectitle); if (s) s.title = t.value || RS.SECTIONS[s.type]; }
    else if (t.dataset.arr) { const it = R[t.dataset.arr][+t.dataset.i]; if (!it) return; const f = t.dataset.f;
      if (t.dataset.part) { const box = t.closest(".mpick"), mm = box.querySelector('[data-part="m"]').value, yy = box.querySelector('[data-part="y"]').value; it[f] = yy ? (mm ? `${yy}-${mm}` : yy) : ""; if (mm && !yy) toast("Choose the year too."); }
      else it[f] = t.type === "checkbox" ? t.checked : t.value; if (it.needsReview && f === "role") delete it.needsReview;
      if (f === "current") { if (t.checked) it.end = ""; $$(`[data-arr="${t.dataset.arr}"][data-i="${t.dataset.i}"][data-f="end"]`, ed).forEach(endEl => { endEl.disabled = t.checked; if (t.checked) endEl.value = ""; }); }
      if (t.dataset.arr === "projects" && (f === "tools" || f === "title")) { clearTimeout(window.__pjT); window.__pjT = setTimeout(() => refreshPj(+t.dataset.i), 500); }
      if (f === "bullets") { const ul = $(`[data-lint="${t.dataset.arr}:${t.dataset.i}"]`, ed); if (ul) { ul.innerHTML = lintHtml(t.dataset.arr, +t.dataset.i); $$("[data-rwl]", ul).forEach(b => b.onclick = () => { const [a, i, k] = b.dataset.rwl.split(":"); const it2 = R[a][+i], ls2 = RS.lines(it2.bullets); rewrite(ls2[+k], (v) => { it2.bullets = it2.bullets.split("\n").map(x => x.replace(/^\s*[-•*–▪]\s*/, "").trim() === ls2[+k] ? v : x).join("\n"); changed({ editor: true }); }, entTitle(a, it2).join(" at ")); }); } }
      const h = t.closest(".ent"); if (h && ["role", "company", "title", "tools", "degree", "school", "name", "issuer", "start", "end", "date", "current"].includes(f)) { const tt = t.dataset.arr, e2 = R[tt][+t.dataset.i], [a, b] = entTitle(tt, e2), dt = tt === "experience" ? RS.span(e2.start, e2.end, e2.current) : tt === "education" ? RS.span(e2.start, e2.end) : RS.fmtMonth(e2.date); const hb = h.querySelector(".ent-h b"), hs = h.querySelector(".ent-h .muted"); if (hb) hb.textContent = a; if (hs) hs.textContent = [b, dt].filter(Boolean).join(" · "); }
    } else return;
    if (t.dataset.txt === "summary") { const hp = $("#sum-help", ed); if (hp) { const n = RS.words(R.summary); hp.textContent = `${n} words ${n && (n < 25 || n > 80) ? "· aim for 40–60" : ""}`; } }
    changed();
  });
  document.addEventListener("click", (e) => { if (!e.target.closest("[data-pat]")) $$("[data-pat].open").forEach(x => x.classList.remove("open")); });

  /* ---------- Dexa AI actions ---------- */
  const ACTIONS = [["improve", "Improve"], ["concise", "More concise"], ["impact", "Add impact"], ["grammar", "Fix grammar"], ["role", "Tailor to role"]];
  function rewrite(text, accept, where) {
    if (!text || !text.trim()) return toast("Write something first, then Dexa can improve it.");
    const m = modal(`<h3>✨ Improve with Dexa</h3><p class="small muted" style="margin-top:-4px">Dexa rewrites using only your facts. Anything it can't know appears as a <span style="background:#FEF3C7;padding:0 4px;border-radius:4px">[placeholder]</span> for you to fill.</p>
      <div class="cmp"><div class="o"><div class="small muted" style="margin-bottom:4px">Original</div>${esc(text)}</div></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin:14px 0">${ACTIONS.map(([k, l], i) => `<button type="button" class="chip ${i ? "" : "on"}" data-a="${k}">${l}</button>`).join("")}</div>
      <div id="rw-out" class="cmp"></div><div class="small muted" data-ai-left style="margin-top:10px"></div>`, { wide: true });
    const run = async (act) => { $$("[data-a]", m).forEach(b => b.classList.toggle("on", b.dataset.a === act)); const out = $("#rw-out", m); out.innerHTML = '<div class="skel" style="height:54px"></div><div class="skel" style="height:54px"></div>';
      try { const j = await RQ.ai("rewrite", { text, action: act, role: R.targetRole, level: R.level, where, jd: jdDoc ? String(jdDoc.data.jd || "").slice(0, 3000) : "" });
        const opts = (j.options || []).filter(Boolean).slice(0, 3); if (!opts.length) throw new Error("Dexa didn't return a suggestion. Try another action.");
        out.innerHTML = opts.map((o, i) => `<div class="p"><div>${esc(o).replace(/\[[^\]]+\]/g, x => `<span style="background:#FEF3C7;border-radius:4px;padding:0 3px">${x}</span>`)}</div><button type="button" class="btn btn-primary btn-sm" data-use="${i}">Use this</button></div>`).join("") + (j.note ? `<p class="small muted" style="margin:6px 0 0">💡 ${esc(j.note)}</p>` : "");
        $$("[data-use]", out).forEach(b => b.onclick = () => { accept(opts[+b.dataset.use]); closeModal(); toast("Updated. Undo with ↶ if needed.", "ok"); });
      } catch (e) { out.innerHTML = `<div class="note bad">${esc(e.message)}</div>`; } RQ.renderCredits(); };
    $$("[data-a]", m).forEach(b => b.onclick = () => run(b.dataset.a)); run("improve");
  }
  function writeBullets(t, i) {
    const it = R[t][i], [a, b] = entTitle(t, it);
    const m = modal(`<h3>✨ Write bullets from your notes</h3><p class="muted small">Describe what you did in ${esc(a)}${b ? " (" + esc(b) + ")" : ""}, in your own words. Hinglish is fine. Add numbers if you know them.</p>
      <textarea class="textarea" id="wb-n" rows="5" placeholder="e.g. har week sales report Excel me banata tha, phir Power BI dashboard banaya jo 12 managers use karte hain, report time 6 ghante se 1 ghanta ho gaya"></textarea>
      <div style="display:flex;gap:8px;align-items:center;margin-top:12px"><button class="btn btn-primary" id="wb-go">Write bullets</button><span class="small muted" data-ai-left></span></div><div id="wb-out" style="margin-top:14px"></div>`, { wide: true });
    RQ.renderCredits();
    $("#wb-go", m).onclick = async () => { const notes = $("#wb-n", m).value.trim(); if (notes.length < 15) return toast("Write a little more about what you did.");
      const btn = $("#wb-go", m); aiBusy(btn, true);
      try { const j = await RQ.ai("bullet", { notes, role: R.targetRole, title: a, org: b, level: R.level }); const bl = (j.bullets || []).filter(Boolean).slice(0, 6); if (!bl.length) throw new Error("No bullets came back. Add more detail and try again.");
        $("#wb-out", m).innerHTML = `<div class="cmp">${bl.map((x, k) => `<label class="p" style="cursor:pointer"><input type="checkbox" checked data-k="${k}" style="margin-top:3px"><div>${esc(x).replace(/\[[^\]]+\]/g, y => `<span style="background:#FEF3C7;border-radius:4px;padding:0 3px">${y}</span>`)}</div></label>`).join("")}</div>${j.note ? `<p class="small muted">💡 ${esc(j.note)}</p>` : ""}<button class="btn btn-primary" id="wb-add" style="margin-top:12px">Add selected bullets</button>`;
        $("#wb-add", m).onclick = () => { const pick = $$("[data-k]", m).filter(c => c.checked).map(c => bl[+c.dataset.k]); it.bullets = [it.bullets, ...pick].filter(x => String(x || "").trim()).join("\n"); closeModal(); changed({ editor: true }); toast("Bullets added. Fill any [placeholder] with real numbers.", "ok"); };
      } catch (e) { $("#wb-out", m).innerHTML = `<div class="note bad">${esc(e.message)}</div>`; } aiBusy(btn, false); RQ.renderCredits(); };
  }
  async function writeSummary(btn) {
    const txt = RS.text(R); if (txt.replace(/\s/g, "").length < 120) return toast("Add some experience, projects or skills first, so Dexa has facts to work with.");
    aiBusy(btn, true);
    try { const j = await RQ.ai("summary", { text: txt.slice(0, 7000), role: R.targetRole, level: R.level, jd: jdDoc ? String(jdDoc.data.jd || "").slice(0, 3000) : "" }); const opts = (j.options || []).filter(Boolean).slice(0, 3); if (!opts.length) throw new Error("No summary came back. Try again.");
      const m = modal(`<h3>✨ Summary options</h3><p class="small muted">Built only from what's in your resume. Pick one, then edit it to sound like you.</p><div class="cmp">${opts.map((o, i) => `<div class="p"><div>${esc(o)}</div><button class="btn btn-primary btn-sm" data-use="${i}">Use</button></div>`).join("")}</div>`, { wide: true });
      $$("[data-use]", m).forEach(b => b.onclick = () => { R.summary = opts[+b.dataset.use]; closeModal(); changed({ editor: true }); });
    } catch (e) { aiErr(e); } aiBusy(btn, false); RQ.renderCredits();
  }

  /* ---------- right: preview ---------- */
  const docEl = $("#pv-doc"), scaleEl = $("#pv-scale"), boxEl = $("#pv-box"), wrapEl = $("#pv-wrap");
  const ACCENTS = ["", "#B91C1C", "#1E3A8A", "#3B2DB8", "#0F766E", "#9D174D", "#B45309"];
  function drawTools() {
    if (!R) return; const t = $("#pv-tools"), tp = RR.TEMPLATES.find(x => x.id === R.template) || RR.TEMPLATES[0];
    t.innerHTML = `<div class="pv-row"><button type="button" class="btn btn-ghost btn-sm" id="pv-gal" title="Choose a template">🖼 ${esc(tp.name)} ▾</button>
        <label class="pv-ctl" title="Spacing">↕ <select id="pv-den" aria-label="Spacing">${[["normal", "Normal"], ["compact", "Compact"], ["tight", "Tight"]].map(([k, l]) => `<option value="${k}" ${R.density === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <button type="button" class="btn btn-soft btn-sm" id="pv-fit" title="Tighten spacing until it fits">⤓ Fit to ${L().pages} page${L().pages > 1 ? "s" : ""}</button>
        <span style="flex:1"></span><span class="badge" id="pv-pages"></span><button type="button" class="btn btn-ghost btn-sm" id="pv-zoom">${zoom === "fit" ? "100%" : "Fit"}</button></div>
      <div class="pv-row"><label class="pv-ctl"><input type="checkbox" id="pv-bold" ${R.bold !== false ? "checked" : ""}> Bold numbers & skills</label><label class="pv-ctl"><input type="checkbox" id="pv-head" ${R.showHeadline !== false ? "checked" : ""}> Job title under name</label>
        <span style="flex:1"></span><span style="display:flex;gap:5px;align-items:center" role="group" aria-label="Accent colour">${ACCENTS.map(c => `<button type="button" class="sw ${c === (R.accent || "") ? "on" : ""}" style="background:${c || (tp.acc || "#111827")}" data-acc="${c}" title="${c ? c : "Template default"}" aria-label="Accent ${c || "default"}"></button>`).join("")}</span></div>`;
    $("#pv-gal").onclick = gallery;
    $("#pv-den").onchange = (e) => { R.density = e.target.value; changed(); };
    $("#pv-fit").onclick = () => { const d = RS.fit(docEl, R, L().pages); if (d) { changed(); drawTools(); toast(d === "normal" ? "Already fits." : `Fits on ${L().pages} page${L().pages > 1 ? "s" : ""} with ${d} spacing.`, "ok"); } else { drawPreview(); toast("Still too long even with tight spacing. Trim older or weaker bullets (Dexa can make them concise).", "bad"); } };
    $("#pv-bold").onchange = (e) => { R.bold = e.target.checked; changed(); };
    $("#pv-head").onchange = (e) => { R.showHeadline = e.target.checked; changed(); };
    $$("[data-acc]", t).forEach(b => b.onclick = () => { R.accent = b.dataset.acc; changed(); drawTools(); });
    $("#pv-zoom").onclick = () => { zoom = zoom === "fit" ? "full" : "fit"; drawTools(); fit(); };
  }
  function gallery() {
    const m = modal(`<h3>Choose a template</h3><p class="small muted" style="margin-top:-4px">All templates are single-column with real text, so ATS can read them. Your content stays the same.</p><div class="grid g3" id="gal" style="margin-top:12px">${RR.TEMPLATES.map(t => `<button type="button" class="card tpl-card ${t.id === R.template ? "on" : ""}" data-t="${t.id}" style="text-align:left;font:inherit;${t.id === R.template ? "border:2px solid var(--brand)" : ""}"><div class="tpl-thumb" style="height:250px"><div class="doc" data-g="${t.id}"></div></div><div style="padding:10px 2px 2px"><b>${esc(t.name)}</b>${t.id === R.template ? ' <span class="badge brand">Current</span>' : ""}<div class="small muted">${esc(t.best)}</div></div></button>`).join("")}</div>`, { wide: true });
    $$("[data-g]", m).forEach(el => { const r = JSON.parse(JSON.stringify(R)); r.template = el.dataset.g; r.accent = ""; RS.mount(el, r, { nobreaks: true, quiet: true }); });
    requestAnimationFrame(() => $$(".tpl-thumb", m).forEach(th => { th.firstElementChild.style.transform = `scale(${th.clientWidth / 794})`; }));
    $$("[data-t]", m).forEach(b => b.onclick = () => { R.template = b.dataset.t; R.accent = ""; closeModal(); changed(); drawTools(); toast("Template: " + (RR.TEMPLATES.find(x => x.id === R.template) || {}).name, "ok"); });
  }
  function drawPreview() {
    if (!R) return; pages = RS.mount(docEl, R); fit();
    const pg = $("#pv-pages"); if (pg) { const lim = L().pages; pg.className = "badge " + (pages > lim ? "warn" : "ok"); pg.textContent = `${pages} page${pages > 1 ? "s" : ""} · target ${lim}`; pg.title = pages > lim ? "Longer than recommended for your level. Trim older or weaker bullets, or try the Compact template." : "Good length"; }
  }
  function fit() { const w = Math.max(200, wrapEl.clientWidth - 36), s = zoom === "fit" ? Math.min(1, w / 794) : 1; scaleEl.style.transform = `scale(${s})`; boxEl.style.width = 794 * s + "px"; boxEl.style.height = docEl.offsetHeight * s + "px"; wrapEl.style.overflowX = s < 1 ? "hidden" : "auto"; }
  window.addEventListener("resize", debounce(fit, 120));
  function setTab(t) { tab = t; $$("#pv-tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t)); $("#pv-preview").style.display = t === "preview" ? "flex" : "none"; ["score", "guide", "job"].forEach(k => { $(`#pv-${k}-pane`).hidden = t !== k; }); drawSide(); if (t === "preview") fit(); }
  $$("#pv-tabs button").forEach(b => b.onclick = () => setTab(b.dataset.t));
  $("#st-ats").onclick = () => { setTab("score"); if (isMobile()) setM("pv"); };
  function drawSide() {
    if (!R) return; const q = RS.quality(R, pages); const sc = $("#pv-score"); sc.textContent = q.score; sc.className = "badge " + (q.score >= 85 ? "ok" : q.score >= 65 ? "warn" : "bad");
    const at = $("#st-ats"); at.className = "st-ats " + (q.score >= 85 ? "ok" : q.score >= 65 ? "warn" : "bad"); $("#st-ats-n").textContent = q.score;
    if (tab === "score") { scorePane(q); redPen(); } if (tab === "guide") guidePane(); if (tab === "job") jobPane();
  }
  let review = null;
  const FIXL = { headings: "Rename to standard", order: "Sort by date", verbs: "Fix openers", punct: "Make consistent", symbols: "Remove symbols", personal: "Remove", fit: "Fit to page" };
  // live recruiter "red pen" (checkup.js): whole-resume checks the per-bullet hints can't see (pronouns in summary, buzzwords, Objective, dates, contact, headings…)
  function redPen() {
    const p = $("#pv-score-pane"); if (!p || !window.RQ_CHECK) return; let o; try { o = window.RQ_CHECK.checkup(R); } catch (e) { return; }
    const bad = o.checks.filter(c => c.ok < .99).sort((a, b) => b.w * (1 - b.ok) - a.w * (1 - a.ok));
    const d = document.createElement("div"); d.className = "card card-pad"; d.id = "pv-redpen"; d.style.marginTop = "14px";
    d.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><h3 style="margin:0">🖍 Recruiter red pen <span class="small muted" style="font-weight:500">updates as you type</span></h3><span class="badge ${o.score >= 80 ? "ok" : o.score >= 60 ? "warn" : "bad"}">${o.score}/100</span></div>
      ${bad.length ? `<ul style="margin:10px 0 0;padding-left:18px;font-size:13.5px;line-height:1.55">${bad.slice(0, 8).map(c => `<li><b>${esc(c.title)}</b>: ${esc(c.msg)}${c.ex && c.ex.length ? `<div class="small muted" style="margin-top:2px">e.g. ${c.ex[0]}</div>` : ""}</li>`).join("")}</ul>${bad.length > 8 ? `<p class="small muted" style="margin:6px 0 0">+${bad.length - 8} more in <a href="/app#/checkup">Resume checkup</a>.</p>` : ""}` : `<p class="cp-ok" style="margin:8px 0 0;color:var(--ok)">✓ All ${o.checks.length} recruiter checks pass.</p>`}`;
    const old = $("#pv-redpen"); if (old) old.remove(); p.appendChild(d);
  }
  function scorePane(q) {
    const p = $("#pv-score-pane"), color = q.score >= 85 ? "#16A34A" : q.score >= 65 ? "#D97706" : "#DC2626";
    const bad = q.checks.filter(c => c.part < .999).sort((a, b) => b.w * (1 - b.part) - a.w * (1 - a.part)), good = q.checks.filter(c => c.part >= .999 && c.w);
    const autos = [...new Set(bad.map(c => c.auto).filter(k => k && k !== "fit"))];
    p.innerHTML = `<div class="card card-pad"><div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap"><div class="ring" style="--p:${q.score};--c:${color}"><div><b>${q.score}</b><span>ATS score</span></div></div>
      <div style="flex:1;min-width:200px">${q.cats.map(c => `<div class="cat-row"><span>${esc(c.name)} <span class="muted small">(${c.weight}%)</span></span><div class="bar ${c.pct >= 85 ? "ok" : c.pct >= 60 ? "warn" : "bad"}"><i style="width:${c.pct}%"></i></div><b style="text-align:right">${c.pct}%</b></div>`).join("")}</div></div>
      <div class="note ${q.score >= 85 ? "ok" : q.score >= 65 ? "warn" : "bad"}" style="margin-bottom:0">${q.score >= 90 ? "Excellent: this resume is ATS-ready. Tailor a copy for each job to push the job-match score up too." : q.score >= 75 ? "Good. Fix the items below to reach 90+." : "Needs work. Start with the top items below; most can be fixed in a few minutes."}</div>
      ${autos.length ? `<button type="button" class="btn btn-primary btn-sm" id="fx-all" style="margin-top:10px">⚡ Auto-fix ${autos.length} formatting issue${autos.length > 1 ? "s" : ""}</button>` : ""}
      <p class="small muted" style="margin:10px 0 0">Checks how well applicant tracking systems can read your resume and how strong it looks for <b>${esc(R.targetRole || "your role")}</b>. It's guidance, not a real employer's ATS. For one job, use <a href="/job-match?resume=${encodeURIComponent(doc ? doc.id : "")}">Job Match</a>.</p></div>
      <div class="card card-pad" style="margin-top:12px"><b>${bad.length ? `To reach 100 (${bad.length})` : "All checks pass 🎉"}</b>${bad.map(c => `<div class="chk"><span class="ic">${c.part > 0 ? "◐" : "○"}</span><div class="tx">${esc(c.t)} ${c.w ? `<span class="badge" style="display:inline;font-size:10.5px">+${Math.max(1, Math.round(c.w * (1 - c.part)))}</span>` : ""}<span>${esc(c.fix)}</span></div>${c.auto ? `<button type="button" class="btn btn-soft btn-sm" data-afix="${c.auto}">${FIXL[c.auto] || "Fix"}</button>` : c.where ? `<button type="button" class="btn btn-ghost btn-sm" data-fix="${c.where}">Go</button>` : ""}</div>`).join("")}</div>
      <div class="card card-pad" style="margin-top:12px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><b>Boost with Dexa</b><div class="small muted">Rewrites weak bullets into result-first bullets. You approve each one.</div></div><button type="button" class="btn btn-ai btn-sm" id="bo-go">✨ Boost my bullets</button></div><div id="bo-out">${boostHtml()}</div></div>
      <div class="card card-pad" style="margin-top:12px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><b>Deep review with Dexa</b><div class="small muted">A recruiter-style read with specific fixes.</div></div><button type="button" class="btn btn-ai btn-sm" id="rv-go">✨ Review my resume</button></div><div id="rv-out">${review ? reviewHtml(review) : ""}</div><div class="small muted" data-ai-left></div></div>
      ${good.length ? `<details class="card card-pad" style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Passing (${good.length})</summary>${good.map(c => `<div class="chk"><span class="ic" style="color:var(--ok)">✓</span><div class="tx">${esc(c.t)}</div></div>`).join("")}</details>` : ""}`;
    $$("[data-fix]", p).forEach(b => b.onclick = () => goTo(b.dataset.fix));
    const doFix = (k) => { if (k === "fit") return $("#pv-fit") ? ($("#pv-fit").click(), drawSide()) : null; RS.autofix(R, k); changed({ editor: true }); };
    $$("[data-afix]", p).forEach(b => b.onclick = () => { doFix(b.dataset.afix); toast("Fixed. Undo with ↶ if you don't like it.", "ok"); });
    const fa = $("#fx-all", p); if (fa) fa.onclick = () => { autos.forEach(k => RS.autofix(R, k)); changed({ editor: true }); toast("Auto-fixed. Review the changes; undo with ↶.", "ok"); };
    $("#bo-go", p).onclick = boost; wireBoost(p);
    $("#rv-go", p).onclick = async () => { const b = $("#rv-go", p); if (RS.text(R).replace(/\s/g, "").length < 200) return toast("Add more content first."); aiBusy(b, true, "Reviewing…");
      try { review = await RQ.ai("review", { text: RS.text(R).slice(0, 9000), role: R.targetRole, level: R.level }); $("#rv-out", p).innerHTML = reviewHtml(review); } catch (e) { aiErr(e); } aiBusy(b, false); RQ.renderCredits(); };
    RQ.renderCredits();
  }
  let boostSt = null;
  const hlp = (x) => esc(x).replace(/\[[^\]]+\]/g, y => `<span style="background:#FEF3C7;border-radius:4px;padding:0 3px">${y}</span>`);
  function boostHtml() {
    if (!boostSt) return ""; if (boostSt.none) return '<p class="small" style="margin-top:10px">✓ No weak bullets found. Nice!</p>';
    const items = boostSt.items; if (!items.length) return '<p class="small muted">Dexa had no changes to suggest.</p>';
    return `<div class="cmp" style="margin-top:12px">${items.map((x, k) => `<div class="o"><div class="small muted">Before</div><div class="small">${esc(x.original)}</div><div class="small muted" style="margin-top:6px">After</div><div>${hlp(x.proposed)}</div><div style="margin-top:8px"><button class="btn btn-primary btn-sm" data-bo="${k}" ${x.done ? "disabled" : ""}>${x.done ? "✓ Applied" : "Use this"}</button></div></div>`).join("")}${items.some(x => !x.done) ? '<button class="btn btn-soft btn-sm" id="bo-all">Use all remaining</button>' : ""}</div><p class="small muted">Fill any [placeholder] with your real number before applying.</p>`;
  }
  function wireBoost(p) {
    if (!boostSt || !boostSt.items) return; const items = boostSt.items;
    const use = (x) => { if (x.done) return false; if (replaceBullet(x.original, x.proposed)) { x.done = true; return true; } return false; };
    $$("[data-bo]", p).forEach(bt => bt.onclick = () => { if (use(items[+bt.dataset.bo])) changed({ editor: true }); else toast("That bullet changed since. Copy the suggestion manually.", "bad"); });
    const all = $("#bo-all", p); if (all) all.onclick = () => { let n = 0; items.forEach(x => { if (use(x)) n++; }); changed({ editor: true }); toast(`Applied ${n} suggestion(s).`, "ok"); };
  }
  async function boost() {
    const weak = []; ["experience", "projects"].forEach(t => R[t].forEach((e) => RS.lines(e.bullets).forEach(l => { if (RS.lint(l).some(x => !/placeholder/i.test(x))) weak.push(RS.plain(l)); })));
    if (!weak.length) { boostSt = { none: true }; drawSide(); return; }
    const b = $("#bo-go"); aiBusy(b, true, "Boosting…");
    try { const j = await RQ.ai("boost", { bullets: weak.slice(0, 12), role: R.targetRole, level: R.level, text: RS.text(R).slice(0, 5000) }); boostSt = { items: (j.items || []).filter(x => x.original && x.proposed) }; drawSide(); }
    catch (e) { aiErr(e); aiBusy(b, false); } RQ.renderCredits();
  }
  function reviewHtml(j) {
    const li = (a) => (a || []).map(x => `<li>${esc(typeof x === "string" ? x : (x.issue ? x.issue + (x.fix ? " → " + x.fix : "") : JSON.stringify(x)))}</li>`).join("");
    return `<div style="margin-top:12px">${j.verdict ? `<div class="note info">${esc(j.verdict)}</div>` : ""}${(j.strengths || []).length ? `<b class="small">What works</b><ul class="small" style="padding-left:18px">${li(j.strengths)}</ul>` : ""}${(j.fixes || []).length ? `<b class="small">Fix next</b><ul class="small" style="padding-left:18px">${li(j.fixes)}</ul>` : ""}</div>`;
  }
  function goTo(where) { if (where === "contact") cur = "contact"; else { let s = secOf(where); if (!s) { s = { id: RS.uid(), type: where, title: RS.SECTIONS[where], hidden: false }; R.sections.push(s); changed(); } if (s.hidden) { s.hidden = false; changed(); } cur = s.id; } drawNav(); drawEditor(); if (isMobile()) setM("ed"); ed.scrollIntoView({ block: "start" }); }
  function guidePane() {
    const g = G(), p = $("#pv-guide-pane");
    p.innerHTML = `<div class="card card-pad"><div class="eyebrow">${esc(g.family ? g.family.icon + " " + g.family.name : "Role guide")}</div><h3 style="margin:6px 0 4px">${esc(g.title)}</h3><p class="small muted">${esc(L().t)}: ${esc(L().tip)}</p>
      <b class="small">Recruiters look for</b><ul class="small" style="padding-left:18px">${g.look.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <b class="small">Bullet patterns (fill with your facts)</b><div class="cmp" style="margin:6px 0 12px">${g.patterns.map(x => `<div class="p" style="padding:8px 10px"><div class="small">${esc(x)}</div><button type="button" class="btn btn-ghost btn-sm" data-copy="${esc(x)}">Copy</button></div>`).join("")}</div>
      ${g.mistakes.length ? `<b class="small">Common mistakes</b><ul class="small" style="padding-left:18px">${g.mistakes.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${g.skills.length ? `<b class="small">Core skills</b><div style="display:flex;flex-wrap:wrap;gap:5px;margin:6px 0 10px">${g.skills.map(k => `<span class="badge">${esc(k)}</span>`).join("")}</div>` : ""}
      <a class="btn btn-ghost btn-sm" href="/career-roles?role=${encodeURIComponent(g.title)}">Open full role guide →</a> <a class="btn btn-ghost btn-sm" href="/resume-guide">Resume writing guide</a></div>`;
    $$("[data-copy]", p).forEach(b => b.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy).then(() => toast("Copied. Paste into a bullet and fill the [placeholders]."), () => toast("Copy failed. Select and copy the text.")); });
  }
  function jobAnalysis() { return window.RQ_JD.analyze(R, jdDoc.data.jd || "", jdDoc.data.decisions || {}); }
  let tailor = null;
  function jobPane() {
    const p = $("#pv-job-pane"); if (!jdDoc) { p.innerHTML = `<div class="empty">No job attached. <a href="/job-match">Match this resume to a job</a>.</div>`; return; }
    const a = jobAnalysis(), gaps = a.keywords.filter(k => k.status !== "strong" && k.decision !== "no");
    p.innerHTML = `<div class="card card-pad"><div class="eyebrow">Tailoring for</div><h3 style="margin:4px 0">${esc(jdDoc.data.title || a.title || "Job")}${jdDoc.data.company ? " · " + esc(jdDoc.data.company) : ""}</h3>
      <div style="display:flex;gap:16px;align-items:center;margin-top:10px"><div class="ring" style="--p:${a.scores.overall};width:90px;height:90px;--c:${a.scores.overall >= 75 ? "#16A34A" : a.scores.overall >= 50 ? "#D97706" : "#DC2626"}"><div><b style="font-size:24px">${a.scores.overall}</b><span>match</span></div></div>
      <div class="small" style="flex:1">Must-have coverage <b>${a.scores.must == null ? "–" : a.scores.must + "%"}</b><br>Preferred <b>${a.scores.pref == null ? "–" : a.scores.pref + "%"}</b><br>Evidence strength <b>${a.scores.evidence == null ? "–" : a.scores.evidence + "%"}</b><br>Experience fit <b>${a.scores.exp == null ? "n/a" : a.scores.exp + "%"}</b></div></div>
      <p class="small muted" style="margin:10px 0 0">Updates live as you edit. <a href="/job-match?resume=${encodeURIComponent(doc.id)}&a=${encodeURIComponent(jdDoc.id)}">Open full analysis</a></p></div>
      <div class="card card-pad" style="margin-top:12px"><b>Gaps to close (${gaps.length})</b>${gaps.slice(0, 14).map(k => `<div class="chk"><span class="ic">${k.status === "weak" ? "◐" : "○"}</span><div class="tx">${esc(k.k)} <span class="badge ${k.imp === "must" ? "bad" : ""}" style="font-size:10.5px">${k.imp === "must" ? "must-have" : "preferred"}</span><span>${esc(k.action)}</span></div></div>`).join("") || '<p class="small muted">No gaps. Nice work.</p>'}</div>
      <div class="card card-pad" style="margin-top:12px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><b>Tailor with Dexa</b><div class="small muted">Rewrites your summary and bullets toward this job using only your real experience.</div></div><button class="btn btn-ai btn-sm" id="tl-go">✨ Suggest edits</button></div><div id="tl-out">${tailor ? tailorHtml(tailor) : ""}</div><div class="small muted" data-ai-left></div></div>`;
    const go = $("#tl-go", p); go.onclick = async () => { aiBusy(go, true, "Tailoring…");
      try { tailor = await RQ.ai("tailor", { text: RS.text(R).slice(0, 8000), jd: String(jdDoc.data.jd || "").slice(0, 6000), role: R.targetRole, missing: gaps.filter(k => k.decision === "have" || k.status === "weak").map(k => k.k).slice(0, 15) }); $("#tl-out", p).innerHTML = tailorHtml(tailor); wireTailor(p); } catch (e) { aiErr(e); } aiBusy(go, false); RQ.renderCredits(); };
    wireTailor(p); RQ.renderCredits();
  }
  function tailorHtml(j) {
    const hl = (s) => esc(s).replace(/\[[^\]]+\]/g, y => `<span style="background:#FEF3C7;border-radius:4px;padding:0 3px">${y}</span>`);
    return `<div class="cmp" style="margin-top:12px">${j.summary ? `<div class="o"><div class="small muted">Suggested summary</div>${hl(j.summary)}<div style="margin-top:8px"><button class="btn btn-primary btn-sm" data-tsum ${j.sumDone ? "disabled" : ""}>${j.sumDone ? "✓ Applied" : "Use summary"}</button></div></div>` : ""}
      ${(j.bullets || []).map((b, i) => `<div class="o"><div class="small muted">Original</div><div class="small">${esc(b.original || "")}</div><div class="small muted" style="margin-top:6px">Suggested</div><div>${hl(b.proposed || "")}</div>${b.why ? `<div class="small muted" style="margin-top:4px">Why: ${esc(b.why)}</div>` : ""}<div style="margin-top:8px"><button class="btn btn-primary btn-sm" data-tb="${i}" ${b.done ? "disabled" : ""}>${b.done ? "✓ Applied" : "Accept"}</button></div></div>`).join("")}
      ${j.note ? `<p class="small muted">💡 ${esc(j.note)}</p>` : ""}</div>`;
  }
  function wireTailor(p) {
    if (!tailor) return;
    const s = $("[data-tsum]", p); if (s) s.onclick = () => { R.summary = tailor.summary; tailor.sumDone = true; changed(); s.textContent = "✓ Applied"; s.disabled = true; };
    $$("[data-tb]", p).forEach(b => b.onclick = () => { const t = tailor.bullets[+b.dataset.tb]; if (replaceBullet(t.original, t.proposed)) { t.done = true; b.textContent = "✓ Applied"; b.disabled = true; changed(); } else toast("Couldn't find that bullet (it may have changed). Copy the suggestion manually.", "bad"); });
  }
  function replaceBullet(orig, next) {
    const n = (x) => String(x || "").replace(/\*\*/g, "").replace(/^\s*[-•*–▪]\s*/, "").replace(/\s+/g, " ").trim().toLowerCase(); const o = n(orig); if (!o) return false;
    for (const t of ["experience", "projects"]) for (const e of R[t]) { const ls2 = String(e.bullets || "").split("\n"); const k = ls2.findIndex(x => n(x) === o); if (k >= 0) { ls2[k] = next; e.bullets = ls2.join("\n"); return true; } }
    return false;
  }

  /* ---------- wizard (new resume / change target) ---------- */
  function wizard(o) {
    o = o || {}; const st = { role: o.edit ? R.targetRole : "", level: o.edit ? R.level : "student", start: "blank" };
    const recent = store.list("resume").slice(0, 4);
    const m = modal(`<div class="eyebrow">${o.edit ? "Target" : "New resume"}</div><h2 style="margin:4px 0 6px">${o.edit ? "Change target role & level" : "Let's set up your resume"}</h2><p class="muted">Dexa uses this to suggest sections, keywords and bullet patterns for your role.</p>
      <label class="f" for="wz-role">1. What job are you applying for?</label><input class="input" id="wz-role" autocomplete="off" placeholder="e.g. Data Analyst, Business Analyst, AI Engineer, Project Manager" value="${esc(st.role)}"><div class="sugg" id="wz-sugg" hidden></div>
      <label class="f" style="margin-top:16px">2. Your experience level</label><div class="wz-cards" id="wz-lv">${RR.LEVELS.map(l => `<button type="button" class="wz-card ${l.id === st.level ? "on" : ""}" data-lv="${l.id}"><b>${esc(l.t)}</b><span>${l.pages} page${l.pages > 1 ? "s" : ""}</span></button>`).join("")}</div>
      ${o.edit ? "" : `<label class="f" style="margin-top:16px">3. How do you want to start?</label><div class="wz-cards" id="wz-st"><button type="button" class="wz-card on" data-st="blank"><b>✍️ Start fresh</b><span>Guided, section by section</span></button><button type="button" class="wz-card" data-st="file"><b>📄 Import a file</b><span>PDF or Word (.docx)</span></button><button type="button" class="wz-card" data-st="paste"><b>📋 Paste text</b><span>From any old resume</span></button><button type="button" class="wz-card" data-st="sample"><b>⭐ Start from a sample</b><span>ATS-ready example to edit</span></button>${recent.length ? `<button type="button" class="wz-card" data-st="copy"><b>⧉ Copy existing</b><span>${esc(recent[0].title)}</span></button>` : ""}</div><div id="wz-paste" hidden style="margin-top:10px"><textarea class="textarea" id="wz-txt" rows="7" placeholder="Paste your resume text here"></textarea></div>`}
      <div class="err" id="wz-err"></div>
      <div style="display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:18px;flex-wrap:wrap">${!o.edit && recent.length ? `<span class="small muted">Or continue: ${recent.slice(0, 3).map(d => `<a href="/studio?id=${encodeURIComponent(d.id)}">${esc(d.title)}</a>`).join(" · ")}</span>` : "<span></span>"}<button class="btn btn-primary" id="wz-go">${o.edit ? "Save" : "Create my resume →"}</button></div>`, { wide: true, sticky: !doc });
    const inp = $("#wz-role", m), sg = $("#wz-sugg", m); let si = -1;
    const showS = () => { const q = inp.value.trim(); const res = RR.search(q, 8); if (!q || (res.length === 1 && res[0].title.toLowerCase() === q.toLowerCase())) { sg.hidden = true; return; } sg.hidden = !res.length; si = -1; sg.innerHTML = res.map(r => `<button type="button" data-r="${esc(r.title)}">${esc(r.title)}<small>${esc(r.familyName)}</small></button>`).join(""); $$("[data-r]", sg).forEach(b => b.onmousedown = (e) => { e.preventDefault(); inp.value = b.dataset.r; sg.hidden = true; }); };
    inp.oninput = showS; inp.onfocus = showS; inp.onblur = () => setTimeout(() => sg.hidden = true, 120);
    inp.onkeydown = (e) => { const bs = $$("button", sg); if (sg.hidden || !bs.length) return; if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); si = (si + (e.key === "ArrowDown" ? 1 : -1) + bs.length) % bs.length; bs.forEach((b, i) => b.classList.toggle("on", i === si)); } if (e.key === "Enter" && si >= 0) { e.preventDefault(); inp.value = bs[si].dataset.r; sg.hidden = true; } };
    $$("[data-lv]", m).forEach(b => b.onclick = () => { st.level = b.dataset.lv; $$("[data-lv]", m).forEach(x => x.classList.toggle("on", x === b)); });
    $$("[data-st]", m).forEach(b => b.onclick = () => { st.start = b.dataset.st; $$("[data-st]", m).forEach(x => x.classList.toggle("on", x === b)); $("#wz-paste", m).hidden = st.start !== "paste"; });
    $("#wz-go", m).onclick = async () => {
      const role = inp.value.trim(), f = RR.find(role); const err = (t) => $("#wz-err", m).textContent = t;
      if (role.length < 2) return err("Type the job title you're applying for (any role works).");
      const title = f ? f.title : role.replace(/\b\w/g, c => c.toUpperCase());
      if (o.edit) { const old = R.level; R.targetRole = title; R.level = st.level; if (!R.contact.headline) R.contact.headline = title; if (old !== st.level && await RQ.confirm("Reorder sections for this level? (Recommended)", "Reorder")) { const ord = (RR.LEVELS.find(l => l.id === st.level) || {}).order || []; R.sections.sort((a, b) => (ord.indexOf(a.type) + 1 || 99) - (ord.indexOf(b.type) + 1 || 99)); } closeModal(); changed({ editor: true }); drawTools(); return; }
      const base = (r) => { r.targetRole = title; r.level = st.level; r.template = RR.guide(title).template || "modern"; if (!r.contact.headline) r.contact.headline = title; const ord = (RR.LEVELS.find(l => l.id === st.level) || {}).order || []; r.sections = ord.filter(t => !RS.OPTIONAL.includes(t) || t === "achievements" || (Array.isArray(r[t]) ? r[t].length : String(r[t] || "").trim())).map(t => ({ id: RS.uid(), type: t, title: RS.SECTIONS[t], hidden: false })); return r; };
      if (st.start === "sample") { const SM = window.RQ_SAMPLES, fam = (RR.find(title) || {}).family; const pick = SM.list.find(x => x.role.toLowerCase() === title.toLowerCase() && (st.level === "student") === (x.level === "student")) || SM.list.find(x => x.role.toLowerCase() === title.toLowerCase()) || SM.list.find(x => (RR.find(x.role) || {}).family === fam) || SM.list[0];
        const r = SM.build(pick.id); r.targetRole = title; r.level = st.level; r.contact.headline = title; closeModal(); create(r, title + " resume (from sample)"); sampleNote(); return; }
      if (st.start === "blank") { closeModal(); create(base(RS.blank({ targetRole: title, level: st.level }))); toast("Start with your contact details, then work down the list.", "ok"); return; }
      if (st.start === "copy") { const src = recent[0]; const r = RS.normalize(JSON.parse(JSON.stringify(src.data))); r.targetRole = title; r.level = st.level; if (r.contact.headline === src.data.targetRole) r.contact.headline = title; closeModal(); create(r, title + " resume"); return; }
      const btn = $("#wz-go", m);
      const finish = async (text) => { aiBusy(btn, true, "Reading your resume…"); try { const res = await window.RQ_IMPORT.parse(text); const r = base(res.resume); closeModal(); create(r, title + " resume"); importReview(res, text); } catch (e) { err(e.message); } aiBusy(btn, false); };
      if (st.start === "paste") return finish($("#wz-txt", m).value);
      pickFile(".pdf,.docx,.txt", async (file) => { aiBusy(btn, true, "Reading file…"); try { const text = await window.RQ_IMPORT.readFile(file); aiBusy(btn, false); finish(text); } catch (e) { aiBusy(btn, false); err(e.message); } });
    };
  }
  function sampleNote() { modal(`<h3>⭐ Sample loaded</h3><p>This is a complete, ATS-ready example. <b>Replace every name, company, date and number with your own real details</b> — never send the sample facts as yours.</p><p class="small muted">Tip: go section by section with “Next →”. Keep the structure; change the facts.</p><button class="btn btn-primary" onclick="RQ.closeModal()">Start editing</button>`); }
  function importReview(res, text) {
    const c = (k) => Array.isArray(R[k]) ? R[k].length : 0;
    modal(`<h3>${res.ai ? "✅ Imported with Dexa" : "📄 Imported"}</h3><p class="muted">${res.ai ? "Dexa split your resume into sections. Please review each one: imports can miss or misread details." : esc(R.importNote || "") + (res.why ? " (" + esc(res.why) + ")" : "")}</p>
      <div class="grid g3" style="gap:8px;margin:12px 0">${[["Experience", c("experience")], ["Projects", c("projects")], ["Education", c("education")], ["Skill groups", c("skills")], ["Certifications", c("certifications")], ["Summary", R.summary ? "✓" : "–"]].map(([a, b]) => `<div class="card" style="padding:10px;text-align:center;box-shadow:none"><b style="font-size:20px">${b}</b><div class="small muted">${a}</div></div>`).join("")}</div>
      <details><summary class="small" style="cursor:pointer">Show the original text</summary><pre style="white-space:pre-wrap;font-size:12px;max-height:240px;overflow:auto;background:var(--soft);padding:10px;border-radius:10px">${esc(text.slice(0, 8000))}</pre></details>
      <button class="btn btn-primary" style="margin-top:14px" onclick="RQ.closeModal()">Review in the editor</button>`, { wide: true });
  }
  function pickFile(accept, cb) { const f = $("#st-file"); f.value = ""; f.accept = accept; f.onchange = () => { if (f.files[0]) cb(f.files[0]); }; f.click(); }

  /* ---------- top bar actions ---------- */
  titleEl.addEventListener("input", () => { if (doc) { persist(); savedEl.textContent = "Saving…"; } });
  $("#st-undo").onclick = () => undo(-1); $("#st-redo").onclick = () => undo(1);
  document.addEventListener("keydown", (e) => { const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName); if (!(e.ctrlKey || e.metaKey) || typing) return; const k = e.key.toLowerCase(); if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(-1); } else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); undo(1); } });
  const more = $("#st-more"), moreB = more.querySelector("button");
  moreB.onclick = (e) => { e.stopPropagation(); const o = !more.classList.contains("open"); more.classList.toggle("open", o); moreB.setAttribute("aria-expanded", String(o)); };
  document.addEventListener("click", (e) => { if (!more.contains(e.target)) more.classList.remove("open"); });
  $$("[data-act]", more).forEach(a => a.onclick = (e) => { const act = a.dataset.act; if (act === "match") { if (doc) a.href = "/job-match?resume=" + encodeURIComponent(doc.id); return; } e.preventDefault(); more.classList.remove("open"); ACT[act] && ACT[act](); });
  const ACT = {
    new: () => wizard(),
    import: () => { const m = modal(`<h3>Import a resume</h3><p class="muted">Creates a new resume from your file. Your current resume stays as it is.</p><div class="wz-cards"><button class="wz-card" data-i="file"><b>📄 PDF or Word</b><span>.pdf, .docx, .txt</span></button><button class="wz-card" data-i="paste"><b>📋 Paste text</b><span>Copy from anywhere</span></button></div><div id="im-p" hidden style="margin-top:12px"><textarea class="textarea" id="im-t" rows="8" placeholder="Paste your resume text"></textarea><button class="btn btn-primary" id="im-go" style="margin-top:10px">Import</button></div><div class="err" id="im-err"></div>`);
      const go = async (text, btn) => { aiBusy(btn, true, "Reading…"); try { const res = await window.RQ_IMPORT.parse(text); const r = RS.normalize(res.resume); r.targetRole = R ? R.targetRole : ""; r.level = R ? R.level : "early"; r.template = R ? R.template : "modern"; if (!r.contact.headline) r.contact.headline = r.targetRole; closeModal(); create(r, (r.contact.name || "Imported") + " resume"); importReview(res, text); } catch (e) { $("#im-err", m).textContent = e.message; } aiBusy(btn, false); };
      $("[data-i=paste]", m).onclick = () => { $("#im-p", m).hidden = false; $("#im-t", m).focus(); }; $("#im-go", m).onclick = () => go($("#im-t", m).value, $("#im-go", m));
      $("[data-i=file]", m).onclick = () => pickFile(".pdf,.docx,.txt", async (file) => { const b = $("[data-i=file]", m); try { const t = await window.RQ_IMPORT.readFile(file); go(t, b); } catch (e) { $("#im-err", m).textContent = e.message; } }); },
    dup: () => { if (!doc) return; const d = store.save({ kind: "resume", title: (titleEl.value || "Resume") + " (copy)", data: JSON.parse(JSON.stringify(R)) }); toast("Duplicated. You're now editing the copy.", "ok"); location.href = "/studio?id=" + encodeURIComponent(d.id); },
    version: () => { if (!doc) return; const draw = () => { const v = ls.get(vKey(), []); m.innerHTML = `<button type="button" class="icon-btn modal-x" aria-label="Close" onclick="RQ.closeModal()">✕</button><h3>Versions</h3><p class="muted small">Saved in this browser for this resume (last 20). Auto-saves every 10 minutes while you edit.</p><div style="display:flex;gap:8px"><input class="input" id="vn" placeholder="Name this version, e.g. Before tailoring for Amazon"><button class="btn btn-primary" id="vs">Save</button></div>
        <div style="margin-top:14px">${v.length ? v.map((x, i) => `<div class="chk"><div class="tx"><b>${esc(x.label)}</b><span>${esc(RQ.rel(x.t))} · ${esc((x.data.contact || {}).headline || "")}</span></div><button class="btn btn-ghost btn-sm" data-rs="${i}">Restore</button><button class="icon-btn" data-dv="${i}" aria-label="Delete version">🗑</button></div>`).join("") : '<p class="small muted">No versions yet.</p>'}</div>`;
        $("#vs", m).onclick = () => { snapshot($("#vn", m).value.trim() || "Saved version"); toast("Version saved", "ok"); draw(); };
        $$("[data-rs]", m).forEach(b => b.onclick = () => { snapshot("Before restore"); R = RS.normalize(JSON.parse(JSON.stringify(ls.get(vKey(), [])[+b.dataset.rs].data))); closeModal(); changed(); drawAll(); toast("Version restored. Your previous state was saved as a version.", "ok"); });
        $$("[data-dv]", m).forEach(b => b.onclick = () => { const v = ls.get(vKey(), []); v.splice(+b.dataset.dv, 1); ls.set(vKey(), v); draw(); }); }; const m = modal(""); draw(); },
    setup: () => wizard({ edit: true }),
  };
  async function phOk() { const n = (RS.text(R).match(/\[[^\]]+\]/g) || []).length; if (!n) return true; return RQ.confirm(`Your resume still has ${n} [placeholder]${n > 1 ? "s" : ""} (highlighted in yellow). Recruiters will see them. Download anyway?`, "Download anyway"); }
  $("#st-docx").onclick = async () => { if (!R || !(await phOk())) return; const b = $("#st-docx"); aiBusy(b, true, "Word…"); try { download(await RS.docx(R), RS.fileName(R, "docx")); RQ.track("download_docx", R.targetRole || ""); } catch (e) { toast(e.message, "bad"); } aiBusy(b, false); };
  $("#st-pdf").onclick = async () => {
    if (!R || !(await phOk())) return; const pr = $("#print-root"); pr.innerHTML = '<div class="doc"></div>'; RS.mount(pr.firstChild, R, { nobreaks: true, quiet: true }); pr.firstChild.style.minHeight = "";
    let ps = document.getElementById("rq-page-css"); if (!ps) { ps = document.createElement("style"); ps.id = "rq-page-css"; document.head.appendChild(ps); } ps.textContent = RS.printCSS(docEl);
    const t0 = document.title; document.title = RS.fileName(R, "pdf").replace(/\.pdf$/, ""); document.body.classList.add("printing");
    const done = () => { document.body.classList.remove("printing"); document.title = t0; pr.innerHTML = ""; window.removeEventListener("afterprint", done); };
    RQ.track("download_pdf", R.targetRole || "");
    window.addEventListener("afterprint", done); setTimeout(() => { window.print(); setTimeout(() => { if (document.body.classList.contains("printing")) done(); }, 1500); }, 60);
  };

  /* ---------- mobile tabs ---------- */
  function setM(k) { $$("#st-mtabs button").forEach(b => b.classList.toggle("on", b.dataset.m === k)); ["nav", "ed", "pv"].forEach(x => $("#st-" + x).classList.toggle("m-on", x === k)); if (k === "pv") setTimeout(fit, 30); window.scrollTo(0, 0); }
  $$("#st-mtabs button").forEach(b => b.onclick = () => setM(b.dataset.m));
  if (isMobile()) setM("ed");

  /* ---------- Dexa context ---------- */
  window.RQ_DEXA = { intro: "I can see the resume you're editing. Ask me to improve a bullet, write a summary, or explain what recruiters want for your role.",
    suggest: ["How can I raise my ATS score?", "What's the weakest part of my resume?", "Write 3 bullets for my latest role", "Which skills should I add for my target role?", "Is my resume the right length?"],
    context: () => R ? `Target role: ${R.targetRole || "not set"}; level: ${L().t}; ATS score ${RS.quality(R, pages).score}/100.\nRESUME:\n${RS.text(R).slice(0, 6000)}` : "" };

  /* ---------- boot ---------- */
  function boot() {
    const id = P.get("id"); const d = id && store.get(id);
    if (d && d.kind === "resume") return open(d);
    const tpl = P.get("template"), role = P.get("role");
    drawAll();
    if (P.get("import") === "1") return ACT.import();
    if (P.get("sample") && window.RQ_SAMPLES) { const r = window.RQ_SAMPLES.build(P.get("sample")); if (r) { create(r, (window.RQ_SAMPLES.list.find(x => x.id === P.get("sample")) || {}).title + " (sample)"); sampleNote(); return; } }
    wizard(); if (role) { const i = $("#wz-role"); if (i) i.value = role; }
    if (tpl) window.__rqTpl = tpl;
  }
  const _create = create; create = function (r, t) { if (window.__rqTpl && RR.TEMPLATES.some(x => x.id === window.__rqTpl)) { r.template = window.__rqTpl; window.__rqTpl = null; } return _create(r, t); }; // eslint-disable-line no-func-assign
  boot();
  // a signed-in user's cloud docs may arrive after boot
  store.subscribe(() => { if (!doc && P.get("id")) { const d = store.get(P.get("id")); if (d) { closeModal(); open(d); } } else if (doc) { savedEl.textContent = store.cloud ? "Saved to your account" : "Saved in this browser"; } });
})();
