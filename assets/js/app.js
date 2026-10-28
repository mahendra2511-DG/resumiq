/* Resumiq workspace (hash routes): dashboard, resumes, cover letters, LinkedIn, interview prep, applications, jobs, settings */
(function () {
  "use strict";
  const { $, $$, esc, toast, modal, closeModal, store, rel, fmtDay } = window.RQ; const RS = window.RQ_RESUME, RR = window.RQ_ROLES;
  const view = $("#view");
  const STATUSES = ["Saved", "Ready to Apply", "Applied", "Assessment", "Interview", "Offer", "Hired", "Rejected", "No response", "Withdrawn"];
  const STC = { Saved: "", "Ready to Apply": "info", Applied: "brand", Assessment: "warn", Interview: "warn", Offer: "ok", Hired: "ok", Rejected: "bad", "No response": "", Withdrawn: "" };
  const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const resumes = () => store.list("resume"), analyses = () => store.list("analysis");
  const scoreOf = (d) => { try { const r = RS.normalize(d.data); return RS.quality(r, 1).score; } catch (e) { return null; } };
  const download = (blob, name) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); };
  const copy = (t) => navigator.clipboard ? navigator.clipboard.writeText(t).then(() => toast("Copied", "ok"), () => toast("Couldn't copy. Select the text and copy it.", "bad")) : toast("Select the text and copy it.");
  const busy = (b, on, l) => { if (!b) return; if (on) { b.dataset.l = b.innerHTML; b.disabled = true; b.innerHTML = '<span class="spin"></span> ' + (l || "Dexa is writing…"); } else { b.disabled = false; b.innerHTML = b.dataset.l; } };
  const hl = (s) => esc(s).replace(/\[[^\]]+\]/g, y => `<span style="background:#FEF3C7;border-radius:4px;padding:0 3px">${y}</span>`);
  const head = (t, p, right) => `<div class="page-head"><div><h1 style="font-size:28px;margin:0">${t}</h1>${p ? `<p>${p}</p>` : ""}</div>${right || ""}</div>`;
  const empty = (ic, t, p, cta, card) => `<div class="empty${card ? " card" : ""}"><div class="ei">${ic}</div><b>${t}</b><p>${p}</p>${cta || ""}</div>`;
  const resumeSel = (id, sel) => { const l = resumes(); return l.length ? `<select class="select" id="${id}">${l.map(d => `<option value="${esc(d.id)}" ${d.id === sel ? "selected" : ""}>${esc(d.title)}</option>`).join("")}</select>` : `<div class="note warn">No resume yet. <a href="/studio">Build or import one</a> first; Dexa writes only from your real resume.</div>`; };
  const resumeText = (id) => { const d = store.get(id); return d ? RS.text(RS.normalize(d.data)) : ""; };
  const resumeObj = (id) => { const d = store.get(id); return d ? RS.normalize(d.data) : null; };
  const jobPicker = (pre) => { const l = analyses(); return `<label class="f" for="jp-sel">Job</label><select class="select" id="jp-sel"><option value="">Paste a job description…</option>${l.map(a => `<option value="${esc(a.id)}" ${a.id === pre ? "selected" : ""}>${esc(a.title || "Job")}</option>`).join("")}</select>
    <div id="jp-paste" ${pre ? "hidden" : ""} style="margin-top:10px"><div class="row"><div><label class="f" for="jp-title">Job title</label><input class="input" id="jp-title" placeholder="Data Analyst"></div><div><label class="f" for="jp-co">Company</label><input class="input" id="jp-co" placeholder="Company"></div></div><label class="f" for="jp-jd">Job description</label><textarea class="textarea" id="jp-jd" rows="6" placeholder="Paste the job description"></textarea></div>`; };
  const wireJob = () => { const s = $("#jp-sel"); if (s) s.onchange = () => { $("#jp-paste").hidden = !!s.value; }; };
  const jobVal = () => { const id = $("#jp-sel") && $("#jp-sel").value; if (id) { const a = store.get(id); return a ? { id, jd: a.data.jd, title: a.data.title, company: a.data.company } : null; } return { jd: ($("#jp-jd") || {}).value || "", title: ($("#jp-title") || {}).value || "", company: ($("#jp-co") || {}).value || "" }; };
  const qp = () => new URLSearchParams((location.hash.split("?")[1]) || "");

  /* ---------- dashboard ---------- */
  function dashboard() {
    const rs = resumes(), an = analyses().filter(a => !["global-search", "manual-job"].includes(a.data && a.data.source)), ap = store.list("application"), u = window.RQ.user;
    const due = ap.filter(a => a.data.followUp && a.data.followUp <= today() && !["Offer", "Hired", "Rejected", "No response", "Withdrawn"].includes(a.data.status));
    const cnt = STATUSES.map(s => [s, ap.filter(a => a.data.status === s).length]).filter(x => x[1]);
    view.innerHTML = head(`Hi${u ? " " + esc(window.RQ.displayName().split(" ")[0]) : ""} 👋`, "Pick up where you left off. Everything here is saved " + (store.cloud ? "to your account." : "in this browser" + (u ? "." : " — sign in to keep a cloud copy.")), `<span class="badge brand" data-ai-left></span>`) + `
      <div class="grid g4">${[["/studio", "✍️", "Build a resume", "Guided editor with live preview"], ["/job-match", "🎯", "Match a job", "Must-haves, gaps and fixes"], ["#/cover-letter", "✉️", "Cover letter", "Tailored to the job"], ["#/interview", "🎤", "Interview prep", "Questions + answer feedback"]].map(([h, i, t, d]) => `<a class="feature card" href="${h}" style="text-decoration:none;padding:18px"><div class="fi">${i}</div><h3 style="margin:8px 0 2px">${t}</h3><p class="muted small" style="margin:0">${d}</p></a>`).join("")}</div>
      ${(() => { const best = rs.map(d => [d, scoreOf(d)]).sort((x, y) => y[1] - x[1])[0]; const tips = ["Start every bullet with a strong verb: Built, Led, Automated, Reduced.", "One number per bullet beats three adjectives. Hours saved, users, % change, ₹.", "Tailor a copy of your resume for each important job: keep the main one clean.", "Freshers: two strong projects with links beat a long list of courses.", "Skills only in your skills list count as weak evidence. Show them in a bullet.", "Remove date of birth, photo, marital status and the declaration. They cost space.", "Read the job description twice: once for must-haves, once for the words they use.", "Follow up 5–7 days after applying with a short, specific note."]; const tip = tips[new Date().getDate() % tips.length]; const c = best ? (best[1] >= 80 ? "#16A34A" : best[1] >= 55 ? "#D97706" : "#DC2626") : "var(--line2)";
        return `<div class="grid g3" style="margin-top:18px"><div class="card card-pad" style="display:flex;gap:16px;align-items:center"><div class="ring" style="--p:${best ? best[1] : 0};--c:${c};width:96px;height:96px"><div><b style="font-size:24px">${best ? best[1] : "–"}</b><span>ATS</span></div></div><div><b>Best ATS score</b><p class="small muted" style="margin:4px 0 8px">${best ? "Best: " + esc(best[0].title) : "Build a resume to see its score."}</p>${best ? `<a class="btn btn-soft btn-sm" href="/studio?id=${encodeURIComponent(best[0].id)}">Improve it</a>` : `<a class="btn btn-primary btn-sm" href="/studio">Start</a>`}</div></div>
          <div class="card card-pad"><b>Your progress</b><div class="grid" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px">${[["Resumes", rs.length], ["Job matches", an.length], ["Applications", ap.length]].map(([l, n]) => `<div style="background:var(--soft);border-radius:12px;padding:10px;text-align:center"><b style="font:800 22px var(--fh);display:block">${n}</b><span class="small muted">${l}</span></div>`).join("")}</div></div>
          <div class="card card-pad" style="background:linear-gradient(135deg,#F5F3FF,#EEF4FF)"><b>💡 Tip of the day</b><p style="margin:8px 0 0;font-size:14.5px;color:var(--ink2)">${esc(tip)}</p></div></div>`; })()}
      <div class="grid g2" style="margin-top:18px">
        <div class="card card-pad"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Recent resumes</h3><a href="#/resumes" class="small">All →</a></div>${rs.length ? rs.slice(0, 4).map(d => { const s = scoreOf(d); return `<div class="chk"><div class="tx"><b>${esc(d.title)}</b><span>${esc((d.data || {}).targetRole || "")} · edited ${esc(rel(d.updated))}</span></div><span class="badge ${s >= 80 ? "ok" : s >= 55 ? "warn" : "bad"}" title="ATS score">${s == null ? "–" : s}</span><a class="btn btn-ghost btn-sm" href="/studio?id=${encodeURIComponent(d.id)}">Open</a></div>`; }).join("") : empty("📄", "No resumes yet", "Start with the guided setup or import your current resume.", `<a class="btn btn-primary" href="/studio">Build my resume</a> <a class="btn btn-ghost" href="/studio?import=1">Import</a>`)}</div>
        <div class="card card-pad"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Job matches</h3><a href="/job-match" class="small">New →</a></div>${an.length ? an.slice(0, 4).map(a => `<div class="chk"><div class="tx"><b>${esc(a.title || "Job")}</b><span>${esc(a.data.resumeTitle || "")} · ${esc(rel(a.updated))}</span></div><span class="badge ${a.data.score >= 75 ? "ok" : a.data.score >= 50 ? "warn" : "bad"}">${a.data.score == null ? "–" : a.data.score}</span><a class="btn btn-ghost btn-sm" href="/job-match?a=${encodeURIComponent(a.id)}">Open</a></div>`).join("") : empty("🎯", "No job matches yet", "Paste a job description to see must-have gaps.", `<a class="btn btn-primary" href="/job-match">Match a job</a>`)}</div>
      </div>
      <div class="grid g2" style="margin-top:18px">
        <div class="card card-pad"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Applications</h3><a href="#/applications" class="small">Tracker →</a></div>${cnt.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">${cnt.map(([s, n]) => `<span class="badge ${STC[s]}">${esc(s)}: ${n}</span>`).join("")}</div>` : `<p class="muted small" style="margin-top:8px">Track every application, its status and when to follow up.</p><a class="btn btn-soft btn-sm" href="#/applications">Add an application</a>`}</div>
        <div class="card card-pad"><h3 style="margin:0 0 6px">Follow-ups due</h3>${due.length ? due.map(a => `<div class="chk"><div class="tx"><b>${esc(a.title)}</b><span>Follow up ${esc(fmtDay(a.data.followUp))} · ${esc(a.data.status)}</span></div><a class="btn btn-ghost btn-sm" href="#/applications">Open</a></div>`).join("") : `<p class="muted small">Nothing due. Set a follow-up date on an application and it shows up here.</p>`}</div>
      </div>
      ${window.RQ_COPILOT ? window.RQ_COPILOT.dashCard() : ""}
      <div class="card card-pad" style="margin-top:18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap"><img src="/assets/img/dexa-avatar.svg" alt="" width="44" height="44"><div style="flex:1;min-width:220px"><b>Ask Dexa anything about your job search</b><div class="small muted">Resumes, job descriptions, interviews, LinkedIn. Dexa uses only your real experience.</div></div><button class="btn btn-ai" onclick="RQ.dexa.toggle(true)">🦉 Ask Dexa</button></div>`;
    window.RQ.renderCredits();
  }

  /* ---------- resumes ---------- */
  function resumesView() {
    const rs = resumes();
    view.innerHTML = head("Resumes", "Keep one main resume and a tailored copy for each important job.", `<div style="display:flex;gap:8px"><a class="btn btn-ghost" href="/studio?import=1">📥 Import</a><a class="btn btn-primary" href="/studio">＋ New resume</a></div>`) +
      (rs.length ? `<div class="grid g3">${rs.map(d => { const r = RS.normalize(d.data), s = RS.quality(r, 1).score; return `<div class="card card-pad"><div style="display:flex;justify-content:space-between;gap:10px"><div style="min-width:0"><b style="display:block;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.title)}</b><span class="small muted">${esc(r.targetRole || "No target role")} · ${esc((RR.LEVELS.find(l => l.id === r.level) || {}).t || "")}</span></div><span class="badge ${s >= 80 ? "ok" : s >= 55 ? "warn" : "bad"}" title="ATS score">${s}</span></div>
        <p class="small muted" style="margin:10px 0">Template: ${esc((RR.TEMPLATES.find(t => t.id === r.template) || {}).name || "")} · edited ${esc(rel(d.updated))}</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><a class="btn btn-primary btn-sm" href="/studio?id=${encodeURIComponent(d.id)}">Open</a><a class="btn btn-ghost btn-sm" href="/job-match?resume=${encodeURIComponent(d.id)}">Match a job</a><button class="btn btn-ghost btn-sm" data-dup="${esc(d.id)}">Duplicate</button><button class="btn btn-ghost btn-sm" data-del="${esc(d.id)}" aria-label="Delete ${esc(d.title)}">🗑</button></div></div>`; }).join("")}</div>`
        : empty("📄", "No resumes yet", "Build one with Dexa's guided setup or import a PDF/Word file.", `<a class="btn btn-primary" href="/studio">Build my resume</a>`, true));
    $$("[data-dup]").forEach(b => b.onclick = () => { const d = store.get(b.dataset.dup); store.save({ kind: "resume", title: d.title + " (copy)", data: JSON.parse(JSON.stringify(d.data)) }); toast("Duplicated", "ok"); route(); });
    $$("[data-del]").forEach(b => b.onclick = async () => { const d = store.get(b.dataset.del); if (await RQ.confirm(`Delete "${d.title}"? This can't be undone.`, "Delete", true)) { await store.remove(d.id); toast("Deleted"); route(); } });
  }

  /* ---------- cover letters ---------- */
  function coverView() {
    const saved = store.list("cover");
    view.innerHTML = head("Cover Letter Studio", "Dexa connects your real experience to what this job asks for. You edit, then send.", `<span class="badge brand" data-ai-left></span>`) + `<div class="grid g2" style="align-items:start">
      <div class="card card-pad"><label class="f">Resume</label>${resumeSel("cl-r")}<div style="height:12px"></div>${jobPicker(qp().get("a"))}
        <div class="row" style="margin-top:12px"><div><label class="f" for="cl-tone">Tone</label><select class="select" id="cl-tone"><option>professional</option><option>warm</option><option>confident</option><option>concise and direct</option></select></div><div><label class="f" for="cl-len">Length</label><select class="select" id="cl-len"><option value="short">Short (email)</option><option value="standard" selected>Standard</option><option value="detailed">Detailed</option></select></div></div>
        <label class="f" for="cl-mgr">Hiring manager (optional)</label><input class="input" id="cl-mgr" placeholder="e.g. Ms. Rao">
        <label class="f" for="cl-x" style="margin-top:12px">Anything to mention? (optional)</label><textarea class="textarea" id="cl-x" rows="2" placeholder="e.g. I use their app daily; I can join in 30 days"></textarea>
        <button class="btn btn-primary" id="cl-go" style="margin-top:14px">✨ Write cover letter</button></div>
      <div class="card card-pad" id="cl-out">${empty("✉️", "Your letter appears here", "It's editable. Dexa never adds experience you don't have.")}</div></div>
      ${saved.length ? `<div class="card card-pad" style="margin-top:18px"><h3>Saved letters</h3>${saved.map(c => `<div class="chk"><div class="tx"><b>${esc(c.title)}</b><span>${esc(rel(c.updated))}</span></div><button class="btn btn-ghost btn-sm" data-open="${esc(c.id)}">Open</button><button class="icon-btn" data-del="${esc(c.id)}" aria-label="Delete">🗑</button></div>`).join("")}</div>` : ""}`;
    wireJob(); window.RQ.renderCredits();
    const show = (c) => { $("#cl-out").innerHTML = `<label class="f" for="cl-sub">Subject</label><input class="input" id="cl-sub" value="${esc(c.subject || "")}"><label class="f" for="cl-txt" style="margin-top:12px">Letter</label><textarea class="textarea" id="cl-txt" rows="16">${esc(c.letter || "")}</textarea>${c.note ? `<p class="small muted">💡 ${esc(c.note)}</p>` : ""}<p class="small muted">Replace any [placeholder] before sending.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-primary btn-sm" id="cl-save">Save</button><button class="btn btn-ghost btn-sm" id="cl-copy">Copy</button><button class="btn btn-ghost btn-sm" id="cl-dl">Download .txt</button></div>`;
      $("#cl-copy").onclick = () => copy($("#cl-sub").value + "\n\n" + $("#cl-txt").value);
      $("#cl-dl").onclick = () => download(new Blob([$("#cl-txt").value], { type: "text/plain;charset=utf-8" }), "Cover letter - " + (c.title || "job").replace(/[\\/:*?"<>|]+/g, "") + ".txt");
      $("#cl-save").onclick = () => { c.subject = $("#cl-sub").value; c.letter = $("#cl-txt").value; const d = store.save({ id: c.id, kind: "cover", title: c.title || "Cover letter", data: { subject: c.subject, letter: c.letter, note: c.note } }); c.id = d.id; toast("Saved", "ok"); }; };
    $("#cl-go").onclick = async () => { const rid = $("#cl-r") && $("#cl-r").value; if (!rid) return toast("Create a resume first.", "bad"); const j = jobVal(); if (!j || RS.words(j.jd) < 20) return toast("Choose a saved job or paste the job description.", "bad");
      const b = $("#cl-go"); busy(b, true); const r = resumeObj(rid);
      try { const o = await RQ.ai("cover", { text: RS.text(r).slice(0, 6000), jd: j.jd.slice(0, 5000), title: j.title, company: j.company, name: r.contact.name, manager: $("#cl-mgr").value, tone: $("#cl-tone").value, length: $("#cl-len").value, extra: $("#cl-x").value }); o.title = [j.title, j.company].filter(Boolean).join(" · ") || "Cover letter"; show(o); RQ.track("cover_letter", j.title || ""); } catch (e) { toast(e.message, "bad"); } busy(b, false); window.RQ.renderCredits(); };
    $$("[data-open]").forEach(b => b.onclick = () => { const c = store.get(b.dataset.open); show(Object.assign({ id: c.id, title: c.title }, c.data)); });
    $$("[data-del]").forEach(b => b.onclick = async () => { if (await RQ.confirm("Delete this letter?", "Delete", true)) { await store.remove(b.dataset.del); route(); } });
  }

  /* ---------- LinkedIn ---------- */
  function linkedinView() {
    const last = window.RQ.ls.get("rq_li_last", null);
    view.innerHTML = head("LinkedIn Optimizer", "Headline, About and skills that match the roles you want, written from your resume.", `<span class="badge brand" data-ai-left></span>`) + `<div class="grid g2" style="align-items:start"><div class="card card-pad"><label class="f">Resume</label>${resumeSel("li-r")}
      <label class="f" for="li-role" style="margin-top:12px">Target role</label><input class="input" id="li-role" placeholder="Data Analyst">
      <label class="f" for="li-h" style="margin-top:12px">Current headline (optional)</label><input class="input" id="li-h" placeholder="Paste your LinkedIn headline">
      <label class="f" for="li-a" style="margin-top:12px">Current About (optional)</label><textarea class="textarea" id="li-a" rows="4"></textarea>
      <button class="btn btn-primary" id="li-go" style="margin-top:14px">✨ Optimise my profile</button>
      <div class="note info" style="margin-top:14px"><b>Quick wins:</b> a clear photo, a custom URL (linkedin.com/in/your-name), "Open to work" visible to recruiters, 5+ skills pinned, and a Featured project.</div></div>
      <div id="li-out">${last ? "" : `<div class="card card-pad">${empty("💼", "Suggestions appear here", "Pick a resume and target role, then let Dexa draft your profile.")}</div>`}</div></div>`;
    const rs = $("#li-r"); const setRole = () => { const r = rs && resumeObj(rs.value); if (r && !$("#li-role").value) $("#li-role").value = r.targetRole || ""; }; if (rs) { rs.onchange = () => { $("#li-role").value = ""; setRole(); }; setRole(); }
    const show = (o) => { $("#li-out").innerHTML = `<div class="card card-pad"><h3>Headline options</h3>${o.headlines.map(h => `<div class="chk"><div class="tx">${hl(h)} <span>${h.length}/220</span></div><button class="btn btn-ghost btn-sm" data-c="${esc(h)}">Copy</button></div>`).join("")}</div>
      <div class="card card-pad" style="margin-top:12px"><div style="display:flex;justify-content:space-between"><h3>About</h3><button class="btn btn-ghost btn-sm" data-c="${esc(o.about)}">Copy</button></div><p style="white-space:pre-wrap;font-size:14.5px">${hl(o.about)}</p></div>
      ${o.skills.length ? `<div class="card card-pad" style="margin-top:12px"><h3>Skills to pin</h3><div style="display:flex;flex-wrap:wrap;gap:6px">${o.skills.map(s => `<span class="badge brand">${esc(s)}</span>`).join("")}</div></div>` : ""}
      ${o.experience.length ? `<div class="card card-pad" style="margin-top:12px"><h3>Experience descriptions</h3>${o.experience.map(x => `<div class="chk"><div class="tx"><b>${esc(x.role)}</b><span style="white-space:pre-wrap;color:var(--ink2)">${hl(x.rewrite)}</span></div><button class="btn btn-ghost btn-sm" data-c="${esc(x.rewrite)}">Copy</button></div>`).join("")}</div>` : ""}
      ${o.tips.length ? `<div class="card card-pad" style="margin-top:12px"><h3>Profile tips</h3><ul class="small" style="padding-left:18px">${o.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}`; $$("[data-c]", $("#li-out")).forEach(b => b.onclick = () => copy(b.dataset.c)); };
    if (last) show(last);
    $("#li-go").onclick = async () => { const rid = rs && rs.value; if (!rid) return toast("Create a resume first.", "bad"); const b = $("#li-go"); busy(b, true);
      try { const o = await RQ.ai("linkedin", { text: resumeText(rid).slice(0, 7000), role: $("#li-role").value, headline: $("#li-h").value, about: $("#li-a").value }); window.RQ.ls.set("rq_li_last", o); show(o); } catch (e) { toast(e.message, "bad"); } busy(b, false); window.RQ.renderCredits(); };
    window.RQ.renderCredits();
  }

  /* ---------- interview ---------- */
  function interviewView() {
    const sets = store.list("interview");
    view.innerHTML = head("Interview Prep", "Questions based on your resume and the job, plus feedback on your practice answers (STAR method).", `<span class="badge brand" data-ai-left></span>`) + `<div class="card card-pad"><div class="grid g2"><div><label class="f">Resume</label>${resumeSel("iv-r")}<label class="f" for="iv-k" style="margin-top:12px">Question mix</label><select class="select" id="iv-k"><option value="behavioural, technical and resume-based">Mixed</option><option value="behavioural (HR)">HR & behavioural</option><option value="technical">Technical</option><option value="resume deep-dive">About my resume</option></select></div><div>${jobPicker(qp().get("a"))}</div></div>
      <button class="btn btn-primary" id="iv-go" style="margin-top:14px">✨ Generate questions</button><span class="small muted" style="margin-left:8px">Job is optional: leave the description empty for general questions.</span></div>
      <div id="iv-out" style="margin-top:18px"></div>
      ${sets.length ? `<div class="card card-pad" style="margin-top:18px"><h3>Saved question sets</h3>${sets.map(s => `<div class="chk"><div class="tx"><b>${esc(s.title)}</b><span>${s.data.questions.length} questions · ${esc(rel(s.updated))}</span></div><button class="btn btn-ghost btn-sm" data-open="${esc(s.id)}">Open</button><button class="icon-btn" data-del="${esc(s.id)}" aria-label="Delete">🗑</button></div>`).join("")}</div>` : ""}`;
    wireJob(); window.RQ.renderCredits();
    const show = (set) => { $("#iv-out").innerHTML = set.data.questions.map((q, i) => `<div class="card card-pad" style="margin-bottom:12px"><div style="display:flex;gap:10px;justify-content:space-between"><b>${i + 1}. ${esc(q.q)}</b><span class="badge">${esc(q.type || "")}</span></div>${q.why ? `<p class="small muted" style="margin:6px 0">Why they ask: ${esc(q.why)}</p>` : ""}
      <details><summary class="small" style="cursor:pointer;font-weight:600">Answer outline from your resume</summary><p class="small" style="white-space:pre-wrap;margin-top:6px">${hl(q.outline || "")}</p></details>
      <details style="margin-top:8px"><summary class="small" style="cursor:pointer;font-weight:600">Practice: write your answer, get feedback</summary><textarea class="textarea" rows="5" data-ans="${i}" style="margin-top:8px" placeholder="Write it as you'd say it. Situation, task, action, result.">${esc(q.mine || "")}</textarea><button class="btn btn-ai btn-sm" data-fb="${i}" style="margin-top:8px">✨ Get feedback</button><div data-fbo="${i}">${q.fb ? fbHtml(q.fb) : ""}</div></details></div>`).join("");
      $$("[data-fb]").forEach(b => b.onclick = async () => { const i = +b.dataset.fb, q = set.data.questions[i], a = $(`[data-ans="${i}"]`).value.trim(); if (RS.words(a) < 15) return toast("Write a fuller answer first (a few sentences).");
        busy(b, true, "Reviewing…"); try { q.fb = await RQ.ai("answer", { q: q.q, answer: a, role: set.data.role }); q.mine = a; store.save({ id: set.id, kind: "interview", title: set.title, data: set.data }); $(`[data-fbo="${i}"]`).innerHTML = fbHtml(q.fb); } catch (e) { toast(e.message, "bad"); } busy(b, false); window.RQ.renderCredits(); }); };
    const fbHtml = (f) => `<div class="note info" style="margin-top:10px"><b>Score ${f.score}/10</b> · STAR: ${["situation", "task", "action", "result"].map(k => `${f.star && f.star[k] ? "✓" : "✗"} ${k}`).join(" · ")}${f.good.length ? `<div style="margin-top:6px"><b>Good:</b> ${f.good.map(esc).join("; ")}</div>` : ""}${f.improve.length ? `<div><b>Improve:</b> ${f.improve.map(esc).join("; ")}</div>` : ""}${f.better ? `<div style="margin-top:6px"><b>Stronger version:</b><div style="white-space:pre-wrap">${hl(f.better)}</div></div>` : ""}</div>`;
    $("#iv-go").onclick = async () => { const rid = $("#iv-r") && $("#iv-r").value; if (!rid) return toast("Create a resume first.", "bad"); const j = jobVal() || {}; const r = resumeObj(rid); const b = $("#iv-go"); busy(b, true, "Preparing…");
      try { const o = await RQ.ai("questions", { text: RS.text(r).slice(0, 6000), jd: (j.jd || "").slice(0, 4000), role: j.title || r.targetRole, level: r.level, kind: $("#iv-k").value });
        const d = store.save({ kind: "interview", title: (j.title || r.targetRole || "Interview") + (j.company ? " · " + j.company : "") + " · " + new Date().toLocaleDateString("en-IN"), data: { role: j.title || r.targetRole, questions: o.questions } }); show(d); RQ.track("interview", j.title || r.targetRole || ""); } catch (e) { toast(e.message, "bad"); } busy(b, false); window.RQ.renderCredits(); };
    $$("[data-open]").forEach(b => b.onclick = () => show(store.get(b.dataset.open)));
    $$("[data-del]").forEach(b => b.onclick = async () => { if (await RQ.confirm("Delete this question set?", "Delete", true)) { await store.remove(b.dataset.del); route(); } });
  }

  /* ---------- applications ---------- */
  let apF = "All";
  function applicationsView() {
    const all = store.list("application"), list = all.filter(a => apF === "All" || a.data.status === apF);
    view.innerHTML = head("Application Tracker", "Every application in one place: status, dates, links and follow-ups.", `<button class="btn btn-primary" id="ap-add">＋ Add application</button>`) + `
      <div class="seg" style="margin-bottom:14px">${["All"].concat(STATUSES).map(s => `<button class="chip ${apF === s ? "on" : ""}" data-f="${esc(s)}">${esc(s)}${s === "All" ? ` ${all.length}` : all.filter(a => a.data.status === s).length ? " " + all.filter(a => a.data.status === s).length : ""}</button>`).join("")}</div>
      ${list.length ? `<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Role & company</th><th>Status</th><th class="hide-s">Applied</th><th class="hide-s">Follow up</th><th class="hide-s">Match</th><th></th></tr></thead><tbody>${list.map(a => { const d = a.data, late = d.followUp && d.followUp <= today() && !["Offer", "Rejected", "Withdrawn"].includes(d.status); return `<tr><td><b>${esc(d.role || "Role")}</b><div class="small muted">${esc(d.company || "")}${d.link ? ` · <a href="${esc(/^https?:/.test(d.link) ? d.link : "https://" + d.link)}" target="_blank" rel="noopener">posting ↗</a>` : ""}</div></td>
        <td><select class="select" data-st="${esc(a.id)}" style="padding:6px 8px;font-size:13px;width:auto" aria-label="Status">${STATUSES.map(s => `<option ${s === d.status ? "selected" : ""}>${s}</option>`).join("")}</select></td><td class="hide-s small">${esc(fmtDay(d.applied)) || "—"}</td><td class="hide-s small" style="${late ? "color:var(--bad);font-weight:700" : ""}">${esc(fmtDay(d.followUp)) || "—"}</td><td class="hide-s">${d.score == null ? "—" : `<span class="badge ${d.score >= 75 ? "ok" : d.score >= 50 ? "warn" : "bad"}">${d.score}</span>`}</td>
        <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-ed="${esc(a.id)}">Edit</button><button class="icon-btn" data-del="${esc(a.id)}" aria-label="Delete">🗑</button></td></tr>`; }).join("")}</tbody></table></div></div>` : empty("📌", apF === "All" ? "No applications yet" : "Nothing with this status", "Add jobs you plan to apply for, then move them along as you hear back.", `<button class="btn btn-primary" id="ap-add2">＋ Add application</button>`, true)}`;
    $$("[data-f]").forEach(b => b.onclick = () => { apF = b.dataset.f; route(); });
    [$("#ap-add"), $("#ap-add2")].forEach(b => b && (b.onclick = () => apEdit()));
    $$("[data-st]").forEach(s => s.onchange = () => { const a = store.get(s.dataset.st); a.data.status = s.value; if (s.value === "Applied" && !a.data.applied) { a.data.applied = today(); if (!a.data.followUp) a.data.followUp = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10); } store.save({ id: a.id, kind: "application", title: a.title, data: a.data }); toast("Status: " + s.value, "ok"); route(); });
    $$("[data-ed]").forEach(b => b.onclick = () => apEdit(store.get(b.dataset.ed)));
    $$("[data-del]").forEach(b => b.onclick = async () => { if (await RQ.confirm("Delete this application?", "Delete", true)) { await store.remove(b.dataset.del); route(); } });
  }
  function apEdit(a) {
    const d = a ? a.data : { role: "", company: "", status: "Saved", link: "", applied: "", followUp: "", notes: "", resumeId: "", salary: "", contact: "" };
    const m = modal(`<h3>${a ? "Edit application" : "Add application"}</h3><div class="row"><div><label class="f" for="a-role">Role</label><input class="input" id="a-role" value="${esc(d.role)}" placeholder="Data Analyst"></div><div><label class="f" for="a-co">Company</label><input class="input" id="a-co" value="${esc(d.company)}"></div></div>
      <div class="row"><div><label class="f" for="a-st">Status</label><select class="select" id="a-st">${STATUSES.map(s => `<option ${s === d.status ? "selected" : ""}>${s}</option>`).join("")}</select></div><div><label class="f" for="a-link">Job link</label><input class="input" id="a-link" value="${esc(d.link)}" placeholder="https://"></div></div>
      <div class="row"><div><label class="f" for="a-ap">Applied on</label><input class="input" type="date" id="a-ap" value="${esc(d.applied)}"></div><div><label class="f" for="a-fu">Follow up on</label><input class="input" type="date" id="a-fu" value="${esc(d.followUp)}"></div></div>
      <div class="row"><div><label class="f" for="a-rs">Resume used</label><select class="select" id="a-rs"><option value="">—</option>${resumes().map(r => `<option value="${esc(r.id)}" ${r.id === d.resumeId ? "selected" : ""}>${esc(r.title)}</option>`).join("")}</select></div><div><label class="f" for="a-ct">Recruiter / contact</label><input class="input" id="a-ct" value="${esc(d.contact || "")}"></div></div>
      <label class="f" for="a-n">Notes</label><textarea class="textarea" id="a-n" rows="3">${esc(d.notes)}</textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn btn-ghost" onclick="RQ.closeModal()">Cancel</button><button class="btn btn-primary" id="a-save">Save</button></div>`, { wide: true });
    $("#a-save", m).onclick = () => { const v = (id) => $(id, m).value.trim(); if (!v("#a-role") && !v("#a-co")) return toast("Add at least a role or company.", "bad");
      const nd = Object.assign({}, d, { role: v("#a-role"), company: v("#a-co"), status: v("#a-st"), link: v("#a-link"), applied: v("#a-ap"), followUp: v("#a-fu"), resumeId: v("#a-rs"), contact: v("#a-ct"), notes: v("#a-n") });
      store.save({ id: a ? a.id : undefined, kind: "application", title: [nd.role, nd.company].filter(Boolean).join(" · "), data: nd }); closeModal(); toast("Saved", "ok"); route(); };
  }

  /* ---------- global job discovery ---------- */
  const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const GLOBAL_COUNTRIES = [
    ["us", "United States"], ["gb", "United Kingdom"], ["in", "India"], ["ca", "Canada"], ["au", "Australia"],
    ["de", "Germany"], ["fr", "France"], ["nl", "Netherlands"], ["sg", "Singapore"], ["za", "South Africa"],
    ["nz", "New Zealand"], ["ie", "Ireland"], ["pl", "Poland"], ["br", "Brazil"], ["at", "Austria"], ["ch", "Switzerland"], ["es", "Spain"], ["it", "Italy"]
  ];
  const jobSources = (q, loc, country, remote) => {
    const e = encodeURIComponent, qq = q || "jobs", ll = loc || "";
    const indeedHost = ({us:"www.indeed.com",gb:"uk.indeed.com",in:"in.indeed.com",ca:"ca.indeed.com",au:"au.indeed.com",de:"de.indeed.com",fr:"fr.indeed.com",nl:"nl.indeed.com",sg:"sg.indeed.com",za:"za.indeed.com",nz:"nz.indeed.com",ie:"ie.indeed.com",pl:"pl.indeed.com",br:"br.indeed.com",at:"at.indeed.com",ch:"ch.indeed.com",es:"es.indeed.com",it:"it.indeed.com"})[country] || "www.indeed.com";
    const locPart = remote ? "Remote" : ll;
    const locQ = locPart ? " " + locPart : "";
    const sources = [
      { group: "Major portals", items: [
        ["LinkedIn", `https://www.linkedin.com/jobs/search/?keywords=${e(qq)}${locPart ? "&location=" + e(locPart) : ""}${remote ? "&f_WT=2" : ""}`],
        ["Indeed", `https://${indeedHost}/jobs?q=${e(qq)}${locPart ? "&l=" + e(locPart) : ""}`],
        ["Google Jobs", `https://www.google.com/search?q=${e(qq + " jobs" + locQ)}&ibp=htl;jobs`],
        ["Glassdoor", `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${e(qq)}${locPart ? "&locT=C&locKeyword=" + e(locPart) : ""}`]
      ]},
      { group: "Remote-friendly", items: [
        ["Remote OK", `https://remoteok.com/remote-${slug(qq)}-jobs`],
        ["We Work Remotely", `https://weworkremotely.com/remote-jobs/search?term=${e(qq)}`],
        ["Wellfound (AngelList)", `https://wellfound.com/jobs?query=${e(qq)}`]
      ]}
    ];
    if (country === "in") {
      sources.push({ group: "India portals", items: [
        ["Naukri", `https://www.naukri.com/${slug(qq)}-jobs${ll ? "-in-" + slug(ll) : ""}`],
        ["Foundit (Monster)", `https://www.foundit.in/srp/results?query=${e(qq)}${ll ? "&locations=" + e(ll) : ""}`],
        ["Shine", `https://www.shine.com/job-search/${slug(qq)}-jobs${ll ? "-in-" + slug(ll) : ""}`],
        ["Instahyre", `https://www.instahyre.com/search-jobs/?q=${e(qq)}`]
      ]});
    }
    if (country === "us" || country === "ca") {
      sources.push({ group: "North America", items: [
        ["ZipRecruiter", `https://www.ziprecruiter.com/jobs-search?search=${e(qq)}${locPart ? "&location=" + e(locPart) : ""}`],
        ["SimplyHired", `https://www.simplyhired.com/search?q=${e(qq)}${locPart ? "&l=" + e(locPart) : ""}`],
        ["Dice (tech)", `https://www.dice.com/jobs?q=${e(qq)}${locPart ? "&location=" + e(locPart) : ""}`]
      ]});
    }
    if (["gb","de","fr","nl","ie","pl","es","it","at","ch"].includes(country)) {
      sources.push({ group: "Europe", items: [
        ["Reed (UK)", `https://www.reed.co.uk/jobs/${slug(qq)}-jobs`],
        ["StepStone", `https://www.stepstone.com/jobs/${e(qq)}`],
        ["EURES", `https://ec.europa.eu/eures/portal/jv-se/home?lang=en&keyword=${e(qq)}`]
      ]});
    }
    if (country === "au" || country === "nz" || country === "sg") {
      sources.push({ group: "APAC", items: [
        ["Seek", `https://www.seek.com.au/jobs?keywords=${e(qq)}${locPart ? "&where=" + e(locPart) : ""}`],
        ["JobsDB", `https://www.jobsdb.com/jobs?keywords=${e(qq)}`]
      ]});
    }
    return sources;
  };
  const jobFit = (job, resume) => {
    const words = (s) => new Set(String(s || "").toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || []);
    const a = words(resume), b = [...words((job.title || "") + " " + (job.description || job.jd || ""))].filter(w => !["with","and","the","for","from","you","your","our","will","are","this","that","have","has","job","role","work","team","years","year","ability","experience","skills","required","preferred"].includes(w));
    if (!a.size || !b.length) return 0;
    let hits = 0; b.forEach(w => { if (a.has(w)) hits++; });
    return Math.round(Math.min(100, hits / Math.max(8, Math.min(24, b.length * .35)) * 100));
  };
  const safeHttpUrl = (u) => { try { const x = new URL(u); return ["http:","https:"].includes(x.protocol) ? x.href : ""; } catch (e) { return ""; } };
  function jobsView() {
    const docs = () => analyses().filter(a => a.data && (a.data.source === "global-search" || a.data.source === "manual-job" || a.data.jobUrl));
    view.innerHTML = `
      <div class="ja-hero">
        <div class="ja-hero-inner">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div>
              <span class="eyebrow" style="color:#c4b5fd">🦉 AI Job Agent</span>
              <h1 style="margin:8px 0 6px;font-size:26px;color:#fff;letter-spacing:-.02em">Find roles that match you</h1>
              <p style="margin:0;color:#c7d2fe;max-width:480px;font-size:14.5px">Enter a role and location. The agent builds portal searches for that market and can pull live listings.</p>
            </div>
            <span class="badge brand" data-ai-left style="background:rgba(255,255,255,.15);color:#e9e5ff"></span>
          </div>
          <div class="ja-search-card">
            <div class="row">
              <div><label class="f" for="gj-q">Job title or keywords</label><input class="input" id="gj-q" placeholder="Data Analyst, Product Manager, React Developer"></div>
              <div><label class="f" for="gj-country">Country / market</label><select class="select" id="gj-country">${GLOBAL_COUNTRIES.map(([v,n])=>`<option value="${v}" ${v==="in"?"selected":""}>${n}</option>`).join("")}</select></div>
            </div>
            <div class="row" style="margin-top:10px">
              <div><label class="f" for="gj-loc">City or region (optional)</label><input class="input" id="gj-loc" placeholder="Bengaluru, Mumbai, Delhi NCR, Remote"></div>
              <div><label class="f" for="gj-type">Work arrangement</label><select class="select" id="gj-type"><option value="any">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;align-items:center">
              <button class="btn btn-primary" id="gj-search" style="padding:12px 22px">🔍 Find jobs on portals</button>
              <button class="btn btn-soft" id="gj-live">🌐 Live listings</button>
              <span class="small" id="gj-live-note" style="color:var(--mute)">Checking…</span>
            </div>
          </div>
        </div>
      </div>
      <div id="gj-agent-tip" class="note info" style="margin:18px 0 0;display:none"></div>
      <div id="gj-sources" style="margin-top:16px"></div>
      <div id="gj-live-out" style="margin-top:16px"></div>
      <div class="grid g2" style="align-items:start;margin-top:22px">
        <div class="card card-pad"><h3 style="margin-top:0">Add a job posting</h3><p class="small muted">Paste a public job URL or the description. Suspicious hidden / instruction-like text is flagged before you use it.</p>
          <label class="f" for="gj-url">Job posting URL (optional)</label><input class="input" id="gj-url" placeholder="https://company.com/careers/job-id">
          <div class="row"><div><label class="f" for="gj-title">Job title</label><input class="input" id="gj-title" placeholder="Senior Data Analyst"></div><div><label class="f" for="gj-company">Company</label><input class="input" id="gj-company" placeholder="Company name"></div></div>
          <label class="f" for="gj-desc">Job description</label><textarea class="textarea" id="gj-desc" rows="5" placeholder="Paste the job description here…"></textarea>
          <div id="gj-integrity" class="small muted" style="margin:8px 0"></div><button class="btn btn-primary" id="gj-save">Save job & score fit</button>
        </div>
        <div class="card card-pad"><h3 style="margin-top:0">Your resume match</h3><p class="small muted">Select the resume for quick fit estimates. Scores are transparent keyword guidance, not an employer ATS result.</p>${resumeSel("gj-resume")}
          <div class="note" style="margin-top:14px">For a full evaluation, open a saved job in <b>Fit check</b> or <b>Job match</b>. ResumeIQ never submits applications automatically.</div>
        </div>
      </div>
      <div class="page-head" style="margin-top:28px"><div><h2 style="font-size:22px;margin:0">Saved opportunities</h2><p>Jobs from portal search or manual add. Duplicate URLs are detected.</p></div><button class="btn btn-ghost btn-sm" id="gj-export">Export CSV</button></div><div id="gj-saved"></div>`;
    fetch("/api/jobs").then(r=>r.json()).then(o=>{ const n=$("#gj-live-note"); if(n)n.textContent=o.configured?"Live listings enabled · Adzuna":"Live listings need Adzuna API credentials in Vercel."; }).catch(()=>{const n=$("#gj-live-note");if(n)n.textContent="Live listings unavailable; global job-board links still work.";});
    const drawSources = () => {
      const q = $("#gj-q").value.trim(), loc = $("#gj-loc").value.trim(), country = $("#gj-country").value, type = $("#gj-type").value;
      const remote = type === "remote";
      const groups = jobSources(q, loc, country, remote);
      const tip = $("#gj-agent-tip");
      if (!q) {
        $("#gj-sources").innerHTML = `<span class="small muted">Type a job title above. The agent will prepare portal searches for the selected country and location.</span>`;
        if (tip) tip.style.display = "none";
        return;
      }
      const countryName = (GLOBAL_COUNTRIES.find(c => c[0] === country) || [country, country])[1];
      const place = remote ? "remote roles" : (loc || countryName);
      if (tip) {
        tip.style.display = "block";
        tip.innerHTML = `<b>Job Agent ready.</b> Searching for <b>${esc(q)}</b> in <b>${esc(place)}</b>. Open the portal links below — each one is pre-filled with your query. Live Adzuna results appear when you click “Live listings”.`;
      }
      $("#gj-sources").innerHTML = groups.map(g => `
        <div class="ja-group">
          <div class="ja-group-title">${esc(g.group)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${g.items.map(([n,u]) => `<a class="ja-portal" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(n)} <span style="opacity:.55">↗</span></a>`).join("")}
          </div>
        </div>`).join("");
    };
    ["#gj-q","#gj-loc","#gj-country","#gj-type"].forEach(id=>$(id).addEventListener("input",drawSources)); drawSources();
    const resumeTextForFit = () => { const id = $("#gj-resume") && $("#gj-resume").value; return id ? resumeText(id) : ""; };
    const integrity = (s) => { const flags=[]; if(/display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0/i.test(s)) flags.push("possible hidden styling"); if(/ignore (all )?(previous|above) instructions|system prompt|reveal (the )?(system|secret)|send .*password/i.test(s)) flags.push("instruction-like text"); if(/[\u200B-\u200F\uFEFF]/.test(s)) flags.push("invisible Unicode characters"); return flags; };
    const refreshIntegrity = () => { const flags=integrity($("#gj-desc").value); $("#gj-integrity").innerHTML = flags.length ? `<span class="badge warn">Review posting: ${esc(flags.join(", "))}</span> Treat job text as untrusted; it will not be executed.` : $("#gj-desc").value.trim() ? `<span class="badge ok">Basic integrity check passed</span> Still verify the posting and employer before applying.` : ""; };
    $("#gj-desc").addEventListener("input",refreshIntegrity);
    const saveJob = (j) => {
      const url = safeHttpUrl(j.url || j.jobUrl || "");
      const duplicate = docs().find(d => (url && safeHttpUrl(d.data.jobUrl || d.data.url) === url) || (j.externalId && d.data.externalId === j.externalId));
      if (duplicate) { toast("This job is already saved."); return duplicate; }
      const title = String(j.title || "Untitled job").slice(0,180), company = String(j.company || "").slice(0,180), description = String(j.description || j.jd || "").slice(0,12000);
      const resumeId = $("#gj-resume") && $("#gj-resume").value || "";
      const score = resumeId ? jobFit({title,description}, resumeTextForFit()) : null;
      const d = store.save({kind:"analysis", title:[title,company].filter(Boolean).join(" · "), data:{source:j.source || "manual-job", externalId:j.externalId || "", jobUrl:url, url, title, company, jd:description, description, location:j.location || $("#gj-loc").value.trim(), country:j.country || $("#gj-country").value, salaryMin:j.salaryMin || null, salaryMax:j.salaryMax || null, salaryCurrency:j.salaryCurrency || "", posted:j.posted || "", resumeId, quickFit:score, savedAt:new Date().toISOString(), decisions:{}}});
      refreshSaved(); return d;
    };
    const addToTracker = (d) => { const exists=store.list("application").some(a=>a.data.analysisId===d.id || (d.data.jobUrl && a.data.link===d.data.jobUrl)); if(exists) return toast("Already in your application tracker."); store.save({kind:"application",title:d.title,data:{role:d.data.title,company:d.data.company,status:"Saved",analysisId:d.id,resumeId:d.data.resumeId||"",score:d.data.quickFit,link:d.data.jobUrl||"",notes:"Added from Global Job Search",followUp:"",applied:""}}); toast("Added to application tracker.","ok"); };
    const refreshSaved = () => {
      const list=docs().sort((a,b)=>String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||"")));
      $("#gj-saved").innerHTML = list.length ? `<div class="grid g2">${list.map(d=>{const x=d.data, url=safeHttpUrl(x.jobUrl||x.url), score=x.quickFit; return `<article class="card card-pad"><div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><div><h3 style="margin:0 0 4px">${esc(x.title||d.title)}</h3><div class="small muted">${esc(x.company||"Company not specified")} · ${esc(x.location||x.country||"Location not specified")}</div></div>${score!=null?`<span class="badge ${score>=70?"ok":score>=45?"brand":"warn"}">${score}% quick fit</span>`:""}</div>${x.salaryMin||x.salaryMax?`<p class="small" style="margin:8px 0">${esc(x.salaryCurrency||"")} ${x.salaryMin?Number(x.salaryMin).toLocaleString():"—"} – ${x.salaryMax?Number(x.salaryMax).toLocaleString():"—"}</p>`:""}<p class="small muted" style="margin:8px 0">${esc(String(x.jd||"").slice(0,230))}${String(x.jd||"").length>230?"…":""}</p><div style="display:flex;gap:6px;flex-wrap:wrap">${url?`<a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open posting ↗</a>`:""}<a class="btn btn-ghost btn-sm" href="https://www.google.com/search?q=${encodeURIComponent((x.company||"")+" company reviews")}" target="_blank" rel="noopener noreferrer">Company research ↗</a><a class="btn btn-ghost btn-sm" href="https://www.google.com/search?q=${encodeURIComponent((x.title||"")+" salary "+(x.country||""))}" target="_blank" rel="noopener noreferrer">Salary research ↗</a><button class="btn btn-ghost btn-sm" data-fit="${esc(d.id)}">Full fit check</button><button class="btn btn-primary btn-sm" data-track="${esc(d.id)}">Add to tracker</button><button class="btn btn-ghost btn-sm" data-remove="${esc(d.id)}">Remove</button></div></article>`}).join("")}</div>` : empty("🔎","No saved jobs yet","Search job boards above or paste a posting to start building your shortlist.","");
      $$("[data-track]").forEach(b=>b.onclick=()=>{const d=store.get(b.dataset.track);if(d)addToTracker(d);});
      $$("[data-fit]").forEach(b=>b.onclick=()=>{const d=store.get(b.dataset.fit);if(d){location.hash="#/fit";}});
      $$("[data-remove]").forEach(b=>b.onclick=async()=>{const d=store.get(b.dataset.remove);if(d && await RQ.confirm("Remove this saved job?","Remove job",true)){store.remove(d.id);refreshSaved();}});
    };
    $("#gj-search").onclick=()=>{if(!$("#gj-q").value.trim())return toast("Enter a job title or keyword first.","bad");drawSources();$("#gj-sources").scrollIntoView({behavior:"smooth",block:"nearest"});};
    $("#gj-live").onclick=async()=>{
      const q=$("#gj-q").value.trim(); if(!q)return toast("Enter a job title or keyword first.","bad");
      const b=$("#gj-live"); busy(b,true,"Searching listings…"); $("#gj-live-out").innerHTML="";
      try { const r=await fetch("/api/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:q,location:$("#gj-loc").value.trim(),country:$("#gj-country").value,remote:$("#gj-type").value==="remote"})}); const o=await r.json(); if(!r.ok||!o.ok)throw new Error(o.message||"Live job search is not configured.");
        const resume=resumeTextForFit(); const jobs=(o.jobs||[]).map(j=>({...j,quickFit:resume?jobFit({title:j.title,description:j.description},resume):null})).sort((a,b)=>(b.quickFit||0)-(a.quickFit||0));
        $("#gj-live-out").innerHTML=`<div class="note">${jobs.length} listings returned by <b>Adzuna</b>. Results are from the selected country; open the original posting for full details.</div>${jobs.length?`<p class="small muted" style="margin:10px 0 0"><a href="${esc(o.attribution&&o.attribution.url||"https://www.adzuna.com/")}" target="_blank" rel="noopener noreferrer">Jobs by Adzuna ↗</a></p><div class="grid g2" style="margin-top:12px">${jobs.map((j,i)=>`<article class="card card-pad" style="box-shadow:none"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(j.title)}</b>${j.quickFit!=null?`<span class="badge ${j.quickFit>=70?"ok":j.quickFit>=45?"brand":"warn"}">${j.quickFit}% fit</span>`:""}</div><p class="small muted" style="margin:5px 0">${esc(j.company||"Company not listed")} · ${esc(j.location||"")}</p>${j.salaryMin||j.salaryMax?`<p class="small" style="margin:4px 0">${esc(j.salaryCurrency||"")} ${j.salaryMin?Number(j.salaryMin).toLocaleString():"—"}–${j.salaryMax?Number(j.salaryMax).toLocaleString():"—"}</p>`:""}<p class="small muted">${esc(String(j.description||"").slice(0,220))}${String(j.description||"").length>220?"…":""}</p><div style="display:flex;gap:6px;flex-wrap:wrap"><a class="btn btn-ghost btn-sm" href="${esc(safeHttpUrl(j.url))}" target="_blank" rel="noopener noreferrer">Original listing ↗</a><button class="btn btn-primary btn-sm" data-live-save="${i}">Save job</button></div></article>`).join("")}</div>`:empty("🌍","No listings found","Try a broader title or another country.","")}`;
        $$("[data-live-save]").forEach(btn=>btn.onclick=()=>{const j=jobs[+btn.dataset.liveSave];saveJob({...j,source:"global-search",country:$("#gj-country").value});toast("Job saved to your shortlist.","ok");});
      } catch(e){ $("#gj-live-out").innerHTML=`<div class="note warn">${esc(e.message)}<br>Use the global job-board links while live search is not configured.</div>`; } finally {busy(b,false);}
    };
    $("#gj-save").onclick=()=>{const title=$("#gj-title").value.trim(), company=$("#gj-company").value.trim(), desc=$("#gj-desc").value.trim(), url=$("#gj-url").value.trim(); if(!title&&!desc&&!url)return toast("Add a title, URL or job description.","bad"); if(url&&!safeHttpUrl(url))return toast("Enter a valid http(s) URL.","bad"); if(!desc&&!url)return toast("Paste the job description or add the posting URL.","bad"); const flags=integrity(desc); if(flags.length&&!confirm("The posting contains suspicious text ("+flags.join(", ")+"). Save it anyway for manual review?"))return; saveJob({title:title||"Job posting",company,description:desc,url,source:"manual-job"}); toast("Job saved.","ok"); $("#gj-title").value="";$("#gj-company").value="";$("#gj-desc").value="";$("#gj-url").value="";refreshIntegrity(); };
    $("#gj-export").onclick=()=>{const rows=docs().map(d=>d.data), cols=["title","company","location","country","jobUrl","quickFit","salaryMin","salaryMax","salaryCurrency","posted","savedAt"]; const csv=[cols.join(","),...rows.map(r=>cols.map(k=>'"'+String(r[k]??"").replace(/"/g,'""').replace(/[\r\n]+/g," ")+'"').join(","))].join("\r\n"); download(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),"resumiq-global-jobs-"+today()+".csv");};
    refreshSaved(); window.RQ.renderCredits();
  }

  /* ---------- settings ---------- */
  function settingsView() {
    const u = window.RQ.user;
    view.innerHTML = head("Settings & data", "Your data, your control.") + `<div class="grid g2" style="align-items:start">
      <div class="card card-pad"><h3>Account</h3>${u ? `<p>Signed in as <b>${esc(u.email)}</b></p><p class="small muted">${store.cloud ? "✓ Cloud copy is on: your resumes sync to your account." : esc(store.cloudErr || "Cloud copy is not available right now; data is saved in this browser.")}</p><button class="btn btn-ghost" id="s-out">Sign out</button>` : `<p class="muted">You're using Resumiq as a guest. Everything is saved in this browser only. Create a free account to sync across devices and get more daily AI credits.</p><button class="btn btn-primary" id="s-in">Sign in / Create account</button>`}
        <h3 style="margin-top:22px">AI credits</h3><p class="small muted">Dexa AI is free with a daily limit (guests get fewer). Credits reset at midnight IST. Rule-based checks, the editor, job matching and downloads never use credits.</p><span class="badge brand" data-ai-left></span></div>
      <div class="card card-pad"><h3>Your data</h3><p class="small muted">${store.list().length} items saved (${resumes().length} resumes, ${analyses().filter(a => !["global-search", "manual-job"].includes(a.data && a.data.source)).length} job matches, ${analyses().filter(a => ["global-search", "manual-job"].includes(a.data && a.data.source)).length} saved jobs, ${store.list("application").length} applications).</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost" id="s-exp">⬇ Export everything (.json)</button><button class="btn btn-ghost" id="s-imp">⬆ Import a backup</button></div>
        <h3 style="margin-top:22px;color:var(--bad)">Danger zone / Safe reset</h3>
        <p class="small muted">Choose what to clear. Original uploaded documents and account identity are never deleted unless you choose full wipe. Export a backup first.</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
          <button class="btn btn-ghost" id="s-reset-jobs">Clear cached job results & shortlist only</button>
          <button class="btn btn-ghost" id="s-reset-drafts">Clear generated drafts (apply kits, letters) only</button>
          <button class="btn btn-ghost" id="s-reset-prefs">Reset search preferences & profile filters</button>
          <button class="btn btn-danger" id="s-wipe">Delete ALL workspace data</button>
        </div>
        <input type="file" id="s-file" accept=".json" hidden></div></div>`;
    if ($("#s-out")) $("#s-out").onclick = () => RQ.signOut(); if ($("#s-in")) $("#s-in").onclick = () => RQ.authModal("signup");
    $("#s-exp").onclick = () => download(new Blob([store.exportAll()], { type: "application/json" }), "resumiq-backup-" + today() + ".json");
    $("#s-imp").onclick = () => $("#s-file").click();
    $("#s-file").onchange = async () => { try { const j = JSON.parse(await $("#s-file").files[0].text()); const docs = Array.isArray(j.docs) ? j.docs : j.data && j.data.sections ? [{ kind: "resume", title: j.title || "Restored resume", data: j.data }] : null; if (!docs) throw 0; let n = 0; docs.forEach(d => { if (d && d.kind && d.data) { store.save({ id: store.get(d.id) ? undefined : d.id, kind: d.kind, title: d.title, data: d.data }); n++; } }); toast(`Imported ${n} item(s).`, "ok"); route(); } catch (e) { toast("That isn't a Resumiq backup file.", "bad"); } };
    const clearBy = async (pred, label) => {
      const all = store.list();
      const targets = all.filter(pred);
      if (!targets.length) return toast("Nothing matching to clear.", "ok");
      if (!(await RQ.confirm(`This will remove ${targets.length} item(s): ${label}. Continue?`, "Clear", true))) return;
      for (const d of targets) await store.remove(d.id);
      toast(`Cleared ${targets.length} item(s).`, "ok"); route();
    };
    $("#s-reset-jobs").onclick = () => clearBy(d => d.kind === "analysis" && d.data && ["global-search","manual-job","rank"].includes(d.data.source || d.data.cp), "cached jobs / shortlist / rank results");
    $("#s-reset-drafts").onclick = () => clearBy(d => (d.kind === "analysis" && d.data && (d.data.cp === "apply" || d.data.cp === "form")) || d.kind === "cover", "generated application drafts & cover letters");
    $("#s-reset-prefs").onclick = async () => {
      if (!(await RQ.confirm("Reset career-profile filters and search preferences to defaults? Your resume content is kept.", "Reset preferences", true))) return;
      const p = store.list("analysis").find(d => d.data && d.data.cp === "profile");
      if (p) await store.remove(p.id);
      toast("Preferences reset.", "ok"); route();
    };
    $("#s-wipe").onclick = async () => { if (!(await RQ.confirm("Delete ALL your Resumiq data (resumes, matches, applications, profile)? This can't be undone. Export a backup first if unsure.", "Delete everything", true))) return; await store.wipe(); Object.keys(localStorage).filter(k => /^rq_/.test(k)).forEach(k => localStorage.removeItem(k)); toast("All data deleted."); route(); };
    window.RQ.renderCredits();
  }

  /* ---------- router ---------- */
  const ROUTES = Object.assign({ dashboard, resumes: resumesView, "cover-letter": coverView, linkedin: linkedinView, interview: interviewView, applications: applicationsView, jobs: jobsView, settings: settingsView }, window.RQ_EXTRA_ROUTES || {});
  const TITLES = Object.assign({ dashboard: "Dashboard", resumes: "Resumes", "cover-letter": "Cover letters", linkedin: "LinkedIn", interview: "Interview prep", applications: "Applications", jobs: "Job Agent", settings: "Settings" }, window.RQ_EXTRA_TITLES || {});
  // helpers shared with the Job Search Copilot pages (copilot.js)
  window.RQ_APP = { view, head, empty, busy, copy, download, hl, today, resumes, analyses, resumeSel, resumeText, resumeObj, jobPicker, wireJob, jobVal, qp, STATUSES, STC, apEdit, route: () => route() };
  function route() {
    const r = (location.hash.replace(/^#\/?/, "").split("?")[0]) || "dashboard", f = ROUTES[r] || dashboard;
    $$("#side a[data-r]").forEach(a => a.classList.toggle("on", a.dataset.r === r)); document.title = (TITLES[r] || "Dashboard") + " — Resumiq";
    try { f(); } catch (e) { console.error(e); view.innerHTML = `<div class="note bad">Something went wrong loading this page. ${esc(e.message)}</div>`; }
  }
  window.addEventListener("hashchange", () => { route(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });
  window.RQ_DEXA = { intro: "I can help with resumes, job matches, cover letters, LinkedIn and interviews.", context: () => { const r = resumes()[0]; return r ? "User's latest resume:\n" + RS.text(RS.normalize(r.data)).slice(0, 4000) : ""; } };
  route();
  let t = 0; store.subscribe(() => { clearTimeout(t); t = setTimeout(() => { const r = location.hash.replace(/^#\/?/, "").split("?")[0] || "dashboard"; if (["dashboard", "resumes", "applications", "settings"].includes(r) && !document.activeElement.closest("#view input,#view textarea,#view select")) route(); }, 300); });
  window.RQ.onAuth(() => { const r = location.hash.replace(/^#\/?/, "").split("?")[0] || "dashboard"; if (["dashboard", "settings"].includes(r)) route(); });
})();
