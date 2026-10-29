/* Resumiq — ATS & Job Match page */
(function () {
  "use strict";
  const { $, $$, esc, toast, store, rel } = window.RQ; const RS = window.RQ_RESUME, JD = window.RQ_JD;
  const P = new URLSearchParams(location.search);
  let src = "saved", fileText = "", A = null, an = null, filter = "all", deep = null;

  /* resume source */
  function fillSel() {
    const list = store.list("resume"), sel = $("#rs-sel");
    sel.innerHTML = list.map(d => `<option value="${esc(d.id)}">${esc(d.title)} · ${esc(rel(d.updated))}</option>`).join("");
    $("#rs-none").hidden = !!list.length; sel.hidden = !list.length;
    if (P.get("resume") && list.some(d => d.id === P.get("resume"))) sel.value = P.get("resume");
    if (!list.length && src === "saved") setSrc("paste");
  }
  function setSrc(t) { src = t; $$("#rs-tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === t)); $$("[data-p]").forEach(p => p.hidden = p.dataset.p !== t); }
  $$("#rs-tabs button").forEach(b => b.onclick = () => setSrc(b.dataset.t));
  $("#rs-file-b").onclick = () => $("#rs-file").click();
  $("#rs-file").onchange = async () => { const f = $("#rs-file").files[0]; if (!f) return; $("#rs-file-n").textContent = "Reading " + f.name + "…"; try { fileText = await window.RQ_IMPORT.readFile(f); $("#rs-file-n").innerHTML = `✓ <b>${esc(f.name)}</b> read (${RS.words(fileText)} words).`; } catch (e) { fileText = ""; $("#rs-file-n").innerHTML = `<span style="color:var(--bad)">${esc(e.message)}</span>`; } };
  $("#jd-txt").addEventListener("input", () => { const n = RS.words($("#jd-txt").value); $("#jd-n").textContent = n ? `${n} words${n < 60 ? " · paste the full description for a better match" : ""}` : ""; });
  function resumeInput() {
    if (src === "saved") { const d = store.get($("#rs-sel").value); return d ? { obj: RS.normalize(d.data), id: d.id, title: d.title } : null; }
    const t = src === "upload" ? fileText : $("#rs-txt").value.trim(); return t.length > 80 ? { text: t } : null;
  }
  const rText = (r) => r.obj ? RS.text(r.obj) : r.text;

  /* analyze */
  $("#go").onclick = () => {
    const err = (t) => $("#go-err").textContent = t || ""; err("");
    const r = resumeInput(); if (!r) return err(src === "saved" ? "Choose a resume." : src === "upload" ? "Upload your resume file first." : "Paste your resume text (at least a few lines).");
    const jd = $("#jd-txt").value.trim(); if (RS.words(jd) < 25) return err("Paste the full job description (at least a few lines).");
    A = { resume: r, jd, title: $("#jd-title").value.trim(), company: $("#jd-co").value.trim() };
    an = store.save({ kind: "analysis", title: "", data: { jd, title: A.title, company: A.company, resumeId: r.id || "", resumeTitle: r.title || "Pasted resume", resumeText: r.obj ? "" : r.text.slice(0, 20000), decisions: {} } });
    deep = null; run(true); RQ.track("job_match", A.title || "");
  };
  function run(first) {
    const d = an.data, res = JD.analyze(A.resume.obj || A.resume.text, d.jd, d.decisions);
    if (!d.title && res.title) d.title = res.title; if (!d.company && res.company) d.company = res.company;
    (deep && deep.extra || []).forEach(x => res.keywords.push(x));
    d.score = res.scores.overall; d.counts = res.counts; an = store.save({ id: an.id, kind: "analysis", title: (d.title || "Job") + (d.company ? " · " + d.company : ""), data: d });
    render(res); if (first) $("#out").scrollIntoView({ behavior: "smooth", block: "start" }); hist();
  }
  const col = (n) => n == null ? "var(--faint)" : n >= 75 ? "#16A34A" : n >= 50 ? "#D97706" : "#DC2626";
  function render(res) {
    const d = an.data, s = res.scores, W = JD.weights, y = res.years;
    const rows = res.keywords.filter(k => filter === "all" || k.status === filter);
    $("#out").innerHTML = `<div class="card card-pad">
      <div style="display:flex;gap:22px;align-items:center;flex-wrap:wrap"><div class="ring" style="--p:${s.overall};--c:${col(s.overall)}"><div><b>${s.overall}</b><span>match</span></div></div>
        <div style="flex:1;min-width:260px"><div class="eyebrow">Result</div><h2 style="margin:4px 0">${esc(d.title || "This job")}${d.company ? ` <span class="muted" style="font-weight:600">· ${esc(d.company)}</span>` : ""}</h2>
        <p class="muted" style="margin:0">${s.overall >= 75 ? "Strong match. Polish the gaps below and apply." : s.overall >= 50 ? "Partial match. Close the must-have gaps you truly have, then tailor." : "Low match. Check whether this role fits, or add real evidence for the must-haves."}</p></div></div>
      <div class="score-tiles" style="margin-top:18px">
        ${[["Must-have coverage", s.must, W.must, `${res.counts.must} must-have items`], ["Preferred coverage", s.pref, W.pref, `${res.counts.pref} nice-to-have items`], ["Evidence strength", s.evidence, W.evidence, "Proven in bullets vs only listed"], ["Experience fit", s.exp, W.exp, y.need ? `Needs ${esc(y.need.text)} · found ${y.have == null ? "?" : y.have + " yrs"}` : "No years requirement found"]].map(([a, v, w, sub]) => `<div class="t"><span>${a} · weight ${w}%</span><b style="color:${col(v)}">${v == null ? "n/a" : v + "%"}</b><span>${sub}</span></div>`).join("")}
      </div>
      <p class="small muted" style="margin:12px 0 0">How it's scored: must-haves ${W.must}%, preferred ${W.pref}%, evidence ${W.evidence}%, experience ${W.exp}% (parts that don't apply are left out and the rest re-weighted). "Strong" means the skill appears in your experience or project bullets; "weak" means it's only in skills or summary. This is a guide, not any employer's ATS.</p></div>
    <div class="card card-pad" style="margin-top:16px"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><h3 style="margin:0">Requirements (${res.keywords.length})</h3>
      <div class="seg">${[["all", "All"], ["missing", `Missing ${res.counts.missing}`], ["weak", `Weak ${res.counts.weak}`], ["strong", `Strong ${res.counts.strong}`]].map(([k, l]) => `<button type="button" class="chip ${filter === k ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}</div></div>
      <div class="tbl-wrap" style="margin-top:12px"><table class="tbl"><thead><tr><th>Requirement</th><th>Importance</th><th class="hide-s">Evidence</th><th>Status</th><th>What to do</th></tr></thead><tbody>
      ${rows.map(k => `<tr><td><b>${esc(k.k)}</b><div class="small muted">${esc(k.cat === "soft" ? "soft skill" : k.cat === "edu" ? "education" : k.cat === "cert" ? "certification" : "skill / tool")}</div></td><td><span class="badge ${k.imp === "must" ? "bad" : ""}">${k.imp === "must" ? "Must-have" : "Preferred"}</span></td><td class="hide-s small">${k.where.length ? esc(k.where.join(", ")) : "—"}</td>
        <td><span class="kw-st ${k.status}">${k.status === "strong" ? "● Strong" : k.status === "weak" ? "◐ Weak" : "○ Missing"}</span></td>
        <td class="small" style="min-width:220px">${esc(k.action)}${k.status === "missing" ? `<div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="chip ${k.decision === "have" ? "on" : ""}" data-dec="have" data-k="${esc(k.k)}">I have this</button><button type="button" class="chip ${k.decision === "no" ? "on" : ""}" data-dec="no" data-k="${esc(k.k)}">I don't</button></div>` : ""}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">Nothing in this filter.</td></tr>`}
      </tbody></table></div>
      ${res.keywords.length < 5 ? `<div class="note warn">Only a few requirements were recognised. Use "Deep read with Dexa" below for a fuller extraction.</div>` : ""}</div>
    <div class="card card-pad" style="margin-top:16px"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><div><h3 style="margin:0">Deep read with Dexa</h3><p class="small muted" style="margin:2px 0 0">AI reads the description like a recruiter: what the job really is, hidden requirements, and anything the rules missed.</p></div><button class="btn btn-ai" id="deep">✨ Read with Dexa</button></div><div id="deep-out">${deep ? deepHtml(deep) : ""}</div><div class="small muted" data-ai-left></div></div>
    <div class="card card-pad" style="margin-top:16px"><h3>Next steps</h3><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
      <button class="btn btn-primary" id="tailor">${A.resume.obj ? "✍️ Tailor a copy in Studio" : "✍️ Import & tailor in Studio"}</button>
      <a class="btn btn-ghost" href="/app#/cover-letter?a=${encodeURIComponent(an.id)}">✉️ Write a cover letter</a>
      <a class="btn btn-ghost" href="/app#/interview?a=${encodeURIComponent(an.id)}">🎤 Interview questions</a>
      <button class="btn btn-ghost" id="track">📌 Save to application tracker</button></div>
      <p class="small muted" style="margin:10px 0 0">Tailoring makes a copy, so your main resume stays unchanged.</p></div>`;
    $$("[data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; render(res); });
    $$("[data-dec]").forEach(b => b.onclick = () => { const k = b.dataset.k.toLowerCase(); an.data.decisions[k] = an.data.decisions[k] === b.dataset.dec ? "" : b.dataset.dec; run(); if (an.data.decisions[k] === "have") toast(`Add ${b.dataset.k} to Skills and, more importantly, to a bullet where you used it.`); });
    $("#deep").onclick = deepRead; $("#tailor").onclick = tailorFlow; $("#track").onclick = track;
    window.RQ.renderCredits();
  }
  function deepHtml(j) {
    const L = (t, a) => a && a.length ? `<div style="margin-top:10px"><b class="small">${t}</b><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${a.map(x => `<span class="badge">${esc(x)}</span>`).join("")}</div></div>` : "";
    return `<div style="margin-top:12px">${j.summary ? `<div class="note info">${esc(j.summary)}</div>` : ""}<div class="small muted">${[j.seniority && "Level: " + j.seniority, j.years && "Experience: " + j.years].filter(Boolean).map(esc).join(" · ")}</div>${L("Must-have", j.must)}${L("Preferred", j.preferred)}${L("Soft skills", j.soft)}${L("Education", j.education)}${L("Certifications", j.certifications)}
      ${j.responsibilities && j.responsibilities.length ? `<div style="margin-top:10px"><b class="small">Day-to-day</b><ul class="small" style="padding-left:18px;margin:6px 0 0">${j.responsibilities.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${j.extra && j.extra.length ? `<p class="small" style="margin-top:10px">➕ Added ${j.extra.length} requirement(s) the rules missed to the table above.</p>` : ""}</div>`;
  }
  async function deepRead() {
    const b = $("#deep"); b.disabled = true; b.innerHTML = '<span class="spin"></span> Reading…';
    try {
      const j = await window.RQ.ai("jd_extract", { jd: an.data.jd.slice(0, 9000) });
      const res0 = JD.analyze(A.resume.obj || A.resume.text, an.data.jd, an.data.decisions), known = new Set(res0.keywords.map(k => k.k.toLowerCase()));
      const v = A.resume.obj ? RS.text(A.resume.obj) : A.resume.text;
      j.extra = [].concat((j.must || []).map(x => [x, "must"]), (j.preferred || []).map(x => [x, "pref"])).filter(([x]) => x.split(/\s+/).length <= 4 && !known.has(x.toLowerCase())).slice(0, 12).map(([x, imp]) => { const hit = JD.has(v, x); return { k: x, cat: "skill", imp, status: hit ? "weak" : "missing", where: hit ? ["resume text"] : [], count: 1, decision: an.data.decisions[x.toLowerCase()] || "", action: hit ? `Found in your resume: make sure a bullet shows it.` : `Add only if you really have it.` }; });
      deep = j; if (!an.data.title && j.title) $("#jd-title").value = an.data.title = j.title; if (!an.data.company && j.company) an.data.company = j.company; run();
    } catch (e) { toast(e.message, "bad"); b.disabled = false; b.textContent = "✨ Read with Dexa"; }
  }
  async function tailorFlow() {
    let base = A.resume.obj;
    if (!base) { const b = $("#tailor"); b.disabled = true; b.innerHTML = '<span class="spin"></span> Importing…'; try { base = (await window.RQ_IMPORT.parse(A.resume.text)).resume; } catch (e) { toast(e.message, "bad"); b.disabled = false; return; } }
    const r = JSON.parse(JSON.stringify(base)); if (!r.targetRole && an.data.title) r.targetRole = an.data.title; r.tailoredFor = { jobId: an.id, title: an.data.title || "", company: an.data.company || "", baseId: A.resume.id || "", at: new Date().toISOString().slice(0, 10) };
    const d = store.save({ kind: "resume", title: `${(r.contact && r.contact.name) || "Resume"} — ${an.data.company || an.data.title || "tailored"}`, data: RS.normalize(r) });
    an.data.tailoredId = d.id; store.save({ id: an.id, kind: "analysis", title: an.title, data: an.data }); const ap = store.list("application").find(x => x.data.analysisId === an.id); if (ap) store.save({ id: ap.id, kind: "application", title: ap.title, data: Object.assign({}, ap.data, { resumeId: d.id }) });
    location.href = `/studio?id=${encodeURIComponent(d.id)}&jd=${encodeURIComponent(an.id)}&tab=job`;
  }
  function track() {
    const exists = store.list("application").find(x => x.data.analysisId === an.id); if (exists) return toast("Already in your tracker.");
    store.save({ kind: "application", title: (an.data.title || "Job") + (an.data.company ? " · " + an.data.company : ""), data: { role: an.data.title || "", company: an.data.company || "", status: "Saved", analysisId: an.id, resumeId: (an.data.tailoredId && store.get(an.data.tailoredId) ? an.data.tailoredId : A.resume.id) || "", score: an.data.score, link: "", notes: "", followUp: "", applied: "" } });
    toast("Saved to your application tracker.", "ok");
  }
  function hist() {
    const l = store.list("analysis").slice(0, 8); $("#hist-card").hidden = !l.length;
    $("#hist").innerHTML = l.map(x => `<div class="chk"><div class="tx"><b>${esc(x.title || "Job")}</b><span>${esc(x.data.resumeTitle || "")} · ${esc(rel(x.updated))}</span></div><span class="badge ${x.data.score >= 75 ? "ok" : x.data.score >= 50 ? "warn" : "bad"}">${x.data.score == null ? "–" : x.data.score}</span><a class="btn btn-ghost btn-sm" href="/job-match?a=${encodeURIComponent(x.id)}">Open</a></div>`).join("");
  }
  function loadAnalysis(id) {
    const x = store.get(id); if (!x || x.kind !== "analysis") return false;
    const d = x.data; $("#jd-txt").value = d.jd; $("#jd-title").value = d.title || ""; $("#jd-co").value = d.company || "";
    let r = null; const rd = d.resumeId && store.get(d.resumeId); if (rd) { r = { obj: RS.normalize(rd.data), id: rd.id, title: rd.title }; $("#rs-sel").value = rd.id; setSrc("saved"); } else if (d.resumeText) { r = { text: d.resumeText }; $("#rs-txt").value = d.resumeText; setSrc("paste"); }
    if (!r) return false; A = { resume: r, jd: d.jd }; an = x; run(); return true;
  }
  window.RQ_DEXA = { intro: "I can help you read this job description and decide what to change in your resume.", suggest: ["What does this job really want?", "Which gaps matter most?", "How do I show stakeholder management?", "Should I apply with this match?"],
    context: () => A ? `JOB DESCRIPTION:\n${an.data.jd.slice(0, 3500)}\n\nRESUME:\n${rText(A.resume).slice(0, 3500)}` : ($("#jd-txt").value ? "JOB DESCRIPTION:\n" + $("#jd-txt").value.slice(0, 4000) : "") };
  fillSel(); hist();
  if (P.get("a")) loadAnalysis(P.get("a"));
  store.subscribe(() => { const v = $("#rs-sel").value; fillSel(); if (v) $("#rs-sel").value = v; });
})();
