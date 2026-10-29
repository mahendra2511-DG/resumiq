/* Resumiq — Job Search Copilot, part 3 (ideas taken from Huntr, Teal, Jobscan, Resume Worded and job-search CRMs):
   🗂 Pipeline board (drag cards between stages) + what converts (resume version, role level, channel)
   🤝 Network: contacts & referrals per application, outreach templates, follow-up reminders
   🩺 Resume checkup: line-by-line rule checks (pronouns, buzzwords, passive voice, dates, metrics…) + job title / education / level match
   🔗 LinkedIn vs 3 jobs: score a LinkedIn profile against up to three target job descriptions
   Everything is rule-based and local-first: no AI credits used. Needs copilot.js (window.RQ_CP). */
(function () {
  "use strict";
  const { $, $$, esc, toast, store, fmtDay, modal, closeModal } = window.RQ;
  const A = () => window.RQ_APP, C = window.RQ_CP, RS = () => window.RQ_RESUME, JD = () => window.RQ_JD;
  const { cpList, cpSave, lc, uniq } = C;
  const wc = (t) => (String(t || "").match(/\S+/g) || []).length;
  const todayS = () => new Date().toISOString().slice(0, 10);
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const daysSince = (s) => { if (!s) return null; const t = Date.parse(String(s).slice(0, 10)); return isNaN(t) ? null : Math.floor((Date.now() - t) / 864e5); };
  const apps = () => store.list("application");
  const appById = (id) => apps().find(a => a.id === id);
  const myName = () => { try { const p = C.profile && C.profile(); const n = p && p.data && (p.data.name || ""); if (n) return n; } catch (e) {} const r = A().resumes()[0]; return (r && r.data && r.data.contact && r.data.contact.name) || "[Your name]"; };
  const myRole = () => { const r = A().resumes()[0]; return (r && r.data && (r.data.targetRole || (r.data.contact || {}).headline)) || "[your target role]"; };

  const CSS = `.kb{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(230px,1fr);gap:12px;overflow-x:auto;padding-bottom:10px;scroll-snap-type:x proximity}
.kb-col{background:var(--soft);border:1px solid var(--line);border-radius:var(--r);padding:10px;min-height:220px;scroll-snap-align:start;display:flex;flex-direction:column;gap:8px}
.kb-col.over{outline:2px dashed var(--brand);outline-offset:-4px;background:var(--brand-soft)}
.kb-h{display:flex;justify-content:space-between;align-items:center;font:700 13px var(--fh);color:var(--ink);padding:2px 4px 6px}
.kb-h .n{font:600 12px var(--fb);color:var(--mute);background:var(--card);border:1px solid var(--line);border-radius:99px;padding:1px 8px}
.kb-c{background:var(--card);border:1px solid var(--line);border-radius:var(--r-sm);padding:10px;box-shadow:var(--sh);cursor:grab;font-size:13px}
.kb-c:active{cursor:grabbing}.kb-c.drag{opacity:.45}.kb-c b{display:block;font-size:13.5px;color:var(--ink)}.kb-c .co{color:var(--mute);font-size:12.5px}
.kb-c .meta{display:flex;gap:5px;flex-wrap:wrap;margin:7px 0}.kb-c .meta span{font-size:11.5px;padding:1px 7px;border-radius:99px;background:var(--soft);color:var(--ink2)}
.kb-c .meta .due{background:var(--warn-bg);color:var(--warn)}.kb-c .meta .late{background:var(--bad-bg);color:var(--bad)}
.kb-c .act{display:flex;gap:4px;flex-wrap:wrap;align-items:center}.kb-c select{padding:4px 6px;font-size:12px;width:auto;max-width:100%}
.kb-empty{font-size:12px;color:var(--faint);text-align:center;padding:16px 4px;border:1px dashed var(--line2);border-radius:var(--r-sm)}
.ck-sc{display:flex;gap:18px;align-items:center;flex-wrap:wrap}.ck-cat{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;flex:1}
.ck-cat div{border:1px solid var(--line);border-radius:var(--r-sm);padding:10px}.ck-cat b{font-size:20px;display:block}.ck-cat span{font-size:12px;color:var(--mute)}
.ck-row{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line)}.ck-row:last-child{border-bottom:0}
.ck-ic{flex:0 0 22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700}
.ck-ic.ok{background:var(--ok-bg);color:var(--ok)}.ck-ic.warn{background:var(--warn-bg);color:var(--warn)}.ck-ic.bad{background:var(--bad-bg);color:var(--bad)}
.ck-row .tx{flex:1;min-width:0}.ck-row .tx b{font-size:14px}.ck-row .tx p{margin:3px 0 0;font-size:13px;color:var(--ink2)}
.ck-ex{margin:6px 0 0;padding:0;list-style:none}.ck-ex li{font-size:12.5px;background:var(--soft);border-radius:6px;padding:5px 8px;margin-top:4px;color:var(--ink2);overflow-wrap:anywhere}
.ck-ex mark{background:var(--warn-bg);color:var(--ink);padding:0 2px;border-radius:3px}
.nt-tpl{border:1px solid var(--line);border-radius:var(--r-sm);padding:12px;margin-top:10px}.nt-tpl textarea{font-size:13px}
.li3{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.kwc{display:inline-block;font-size:12px;padding:2px 8px;border-radius:99px;margin:2px;border:1px solid var(--line)}.kwc.ok{background:var(--ok-bg);color:var(--ok);border-color:transparent}.kwc.miss{background:var(--bad-bg);color:var(--bad);border-color:transparent}
.kb-ins{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:16px;align-items:start}
@media(max-width:640px){.kb{grid-auto-columns:82%}}`;
  let cssOn = false; const css = () => { if (cssOn) return; cssOn = true; const s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); };
  const page = (on, title, sub, right) => { css(); return C.page(on, title, sub, right); };

  /* ======================= shared: stage reach + role level ======================= */
  const SENT = ["Applied", "Assessment", "Interview", "Offer", "Hired", "Rejected", "No response"];
  const reachedInt = (a) => { const s = a.data.status, st = ((a.data.outcome || {}).stages || []).map(lc); return ["Interview", "Offer", "Hired"].includes(s) || st.some(x => /interview|offer|hr|technical|final/.test(x)); };
  const replied = (a) => reachedInt(a) || a.data.status === "Assessment" || ((a.data.outcome || {}).stages || []).length > 0;
  const levelOf = (t) => window.RQ_CHECK.levelOf(t);

  /* ================================ 🗂 Pipeline board ================================ */
  const COLS = ["Saved", "Ready to Apply", "Applied", "Assessment", "Interview", "Offer", "Hired"], CLOSED = ["Rejected", "No response", "Withdrawn"];
  const setStatus = (a, s) => { if (!a || a.data.status === s) return; const d = Object.assign({}, a.data, { status: s, stageAt: todayS() }); if (s === "Applied" && !d.applied) d.applied = todayS(); if (s === "Applied" && !d.followUp) d.followUp = addDays(7); store.save({ id: a.id, kind: "application", title: a.title, data: d }); };
  const contactsFor = (id) => cpList("contact").filter(c => c.data.appId === id);
  function card(a) {
    const d = a.data, inStage = daysSince(d.stageAt || d.applied || a.updated || a.created), fu = d.followUp ? daysSince(d.followUp) : null, nc = contactsFor(a.id).length, score = d.score != null ? d.score : d.fit;
    return `<div class="kb-c" draggable="true" data-id="${esc(a.id)}" tabindex="0" aria-label="${esc(a.title)}, ${esc(d.status)}"><b>${esc(d.role || a.title || "Role")}</b><span class="co">${esc(d.company || "Company not set")}</span>
      <div class="meta">${score != null && score !== "" ? `<span>${esc(score)}% match</span>` : ""}${inStage != null ? `<span title="Days in this stage">${inStage}d here</span>` : ""}${fu != null && !CLOSED.includes(d.status) && !["Offer", "Hired", "Saved", "Ready to Apply"].includes(d.status) ? `<span class="${fu > 0 ? "late" : fu === 0 ? "due" : ""}">${fu > 0 ? "Follow-up " + fu + "d late" : fu === 0 ? "Follow up today" : "Follow up " + esc(fmtDay(d.followUp))}</span>` : ""}${nc ? `<span>🤝 ${nc}</span>` : ""}${d.channel ? `<span>${esc(d.channel)}</span>` : ""}${CLOSED.includes(d.status) ? `<span>${esc(d.status)}</span>` : ""}</div>
      <div class="act"><select class="select" data-mv="${esc(a.id)}" aria-label="Move to stage">${COLS.concat(CLOSED).map(s => `<option ${s === d.status ? "selected" : ""}>${s}</option>`).join("")}</select><button class="btn btn-ghost btn-sm" data-ed="${esc(a.id)}">Edit</button><a class="btn btn-ghost btn-sm" href="#/network?app=${esc(a.id)}" title="Contacts & outreach">🤝</a>${d.company ? `<a class="btn btn-ghost btn-sm" href="https://www.google.com/search?q=${encodeURIComponent(d.company + " company culture reviews news")}" target="_blank" rel="noopener noreferrer" title="Research the company">🏢</a>` : ""}</div></div>`;
  }
  function convTable(title, rows) {
    if (!rows.length) return "";
    return `<div style="min-width:0"><h4 style="margin:0 0 6px">${esc(title)}</h4><div class="tbl-wrap"><table class="cp-tb"><thead><tr><th>${esc(title.replace(/^By /, ""))}</th><th>Sent</th><th>Replies</th><th>Interviews</th><th>Interview rate</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v[0]}</td><td>${v[1]}</td><td>${v[2]}</td><td><b>${v[0] ? Math.round(v[2] / v[0] * 100) + "%" : "–"}</b></td></tr>`).join("")}</tbody></table></div></div>`;
  }
  function insights() {
    const sent = apps().filter(a => SENT.includes(a.data.status)); if (!sent.length) return `<p class="small muted">Once you move cards to <b>Applied</b> and beyond, this shows which resume version, role level and channel actually get you interviews.</p>`;
    const group = (f) => { const m = {}; sent.forEach(a => { const k = f(a) || "Not recorded"; const x = m[k] = m[k] || [0, 0, 0]; x[0]++; if (replied(a)) x[1]++; if (reachedInt(a)) x[2]++; }); return Object.entries(m).sort((a, b) => b[1][0] - a[1][0]); };
    const rname = (id) => { const r = id && store.get(id); return r ? r.title : ""; };
    const byR = group(a => rname(a.data.resumeId)), byL = group(a => levelOf(a.data.role || a.title)), byC = group(a => a.data.channel);
    const best = byC.filter(([k, v]) => k !== "Not recorded" && v[0] >= 3).sort((a, b) => b[1][2] / b[1][0] - a[1][2] / a[1][0])[0];
    return `${sent.length < 8 ? `<p class="small muted" style="margin-top:0">${sent.length} sent so far. Patterns get trustworthy after about 8–10; treat these as early hints.</p>` : ""}${best ? `<div class="note info" style="margin:0 0 12px"><b>${esc(best[0])}</b> is your best channel so far: ${Math.round(best[1][2] / best[1][0] * 100)}% of those applications reached an interview.</div>` : ""}
      <div class="kb-ins">${convTable("By resume version", byR)}${convTable("By role level", byL)}${convTable("By channel", byC)}</div>
      ${byC.some(([k]) => k === "Not recorded") ? `<p class="small muted" style="margin-bottom:0">Tip: set <b>How you applied</b> when you edit an application, so channel results become useful.</p>` : ""}`;
  }
  function boardView() {
    const all = apps(), closed = all.filter(a => CLOSED.includes(a.data.status));
    const open = all.filter(a => !CLOSED.includes(a.data.status)), dueN = open.filter(a => a.data.followUp && daysSince(a.data.followUp) >= 0 && !["Offer", "Hired", "Saved", "Ready to Apply"].includes(a.data.status)).length;
    A().view.innerHTML = page("board", "Pipeline board", "Drag a card to move it to the next stage, or use its menu. Moving to Applied stamps today's date and sets a follow-up in 7 days.", `<a class="btn btn-ghost" href="#/applications">☰ Table view</a> <button class="btn btn-primary" id="kb-add">＋ Add application</button>`) + `
      ${dueN ? `<div class="note warn" style="margin-bottom:12px">⏰ ${dueN} follow-up${dueN > 1 ? "s are" : " is"} due. Look for the orange and red tags, or open <a href="#/outcomes">Follow-ups</a> for ready-to-send messages.</div>` : ""}
      ${all.length ? `<div class="kb" id="kb">${COLS.map(s => { const l = all.filter(a => a.data.status === s); return `<section class="kb-col" data-col="${esc(s)}" aria-label="${esc(s)}"><div class="kb-h">${esc(s)}<span class="n">${l.length}</span></div>${l.map(card).join("") || `<div class="kb-empty">Drop here</div>`}</section>`; }).join("")}
        <section class="kb-col" data-col="__closed" aria-label="Closed"><div class="kb-h">Closed<span class="n">${closed.length}</span></div>${closed.map(card).join("") || `<div class="kb-empty">Rejected, no response, withdrawn</div>`}</section></div>`
        : A().empty("🗂", "Your board is empty", "Add the jobs you are interested in. Save them from the Job Agent or add one here.", `<button class="btn btn-primary" id="kb-add2">＋ Add application</button>`)}
      <div class="card card-pad" style="margin-top:18px"><h3 style="margin-top:0">📊 What converts for you</h3>${insights()}</div>`;
    const add = () => A().apEdit(); if ($("#kb-add")) $("#kb-add").onclick = add; if ($("#kb-add2")) $("#kb-add2").onclick = add;
    $$("[data-ed]").forEach(b => b.onclick = () => A().apEdit(appById(b.dataset.ed)));
    $$("[data-mv]").forEach(s => s.onchange = () => { setStatus(appById(s.dataset.mv), s.value); toast("Moved to " + s.value, "ok"); boardView(); });
    let dragId = null;
    $$(".kb-c").forEach(c => { c.addEventListener("dragstart", (e) => { dragId = c.dataset.id; c.classList.add("drag"); try { e.dataTransfer.setData("text/plain", dragId); e.dataTransfer.effectAllowed = "move"; } catch (x) {} }); c.addEventListener("dragend", () => c.classList.remove("drag")); });
    $$(".kb-col").forEach(col => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("over"); });
      col.addEventListener("dragleave", () => col.classList.remove("over"));
      col.addEventListener("drop", (e) => { e.preventDefault(); col.classList.remove("over"); const id = dragId || (e.dataTransfer && e.dataTransfer.getData("text/plain")); const a = appById(id); if (!a) return;
        const to = col.dataset.col;
        if (to === "__closed") { if (CLOSED.includes(a.data.status)) return; const m = modal(`<h3>Close “${esc(a.title)}”</h3><p class="small muted">What happened?</p><div style="display:flex;gap:8px;flex-wrap:wrap">${CLOSED.map(s => `<button class="btn btn-ghost" data-cl="${esc(s)}">${esc(s)}</button>`).join("")}</div>`); $$("[data-cl]", m).forEach(b => b.onclick = () => { setStatus(a, b.dataset.cl); closeModal(); toast("Closed as " + b.dataset.cl, "ok"); boardView(); }); return; }
        setStatus(a, to); toast("Moved to " + to, "ok"); boardView(); });
    });
  }

  /* ============================ 🤝 Network & referrals ============================ */
  const KINDS = ["Recruiter", "Hiring manager", "Referral (employee)", "Alumni", "Peer in the role", "Other"];
  const CST = ["To contact", "Messaged", "Replied", "Referred me", "Met / called", "No reply"];
  const TPL = [
    ["referral", "Ask for a referral", "LinkedIn / email", (c, a) => `Hi ${c.first},\n\nI hope you're doing well. I'm ${myName()}, a ${myRole()}. I'm applying for the ${a.role} role at ${a.company}${a.link ? " (" + a.link + ")" : ""} and I think my experience fits it well: [one line: your strongest matching result].\n\nWould you be comfortable referring me, or telling me who the right person is? I've attached my resume and I'm happy to send a short summary you can forward.\n\nThank you for your time,\n${myName()}`],
    ["note", "Connection note (300 chars)", "LinkedIn invite", (c, a) => `Hi ${c.first}, I'm ${myName()}, a ${myRole()} interested in the ${a.role} role at ${a.company}. I'd value 10 minutes to learn how your team works. Thank you!`],
    ["recruiter", "Message a recruiter", "LinkedIn / email", (c, a) => `Hi ${c.first},\n\nI applied for the ${a.role} role at ${a.company}${a.applied ? " on " + fmtDay(a.applied) : ""}. In my current work I [one result with a number, e.g. "built a Power BI dashboard used by 14 managers"], which matches what the role asks for.\n\nCould you tell me where my application stands, or whether there's anything else I can send?\n\nBest regards,\n${myName()}`],
    ["info", "Ask for an informational chat", "LinkedIn / email", (c, a) => `Hi ${c.first},\n\nI'm ${myName()}, exploring ${a.role || myRole()} roles. I saw you work at ${a.company || "[company]"} and I'd love to hear how you got into the role and what the work is really like.\n\nWould you have 15 minutes for a quick call this week or next? I'm happy to work around your schedule.\n\nThanks,\n${myName()}`],
    ["thanks", "Thank-you after an interview", "Email, same day", (c, a) => `Hi ${c.first},\n\nThank you for your time today discussing the ${a.role} role. I especially enjoyed talking about [one specific topic from the interview].\n\nOur conversation made me even more interested in joining ${a.company}. If it helps, I can share [a sample / portfolio link] related to what we discussed.\n\nBest regards,\n${myName()}`],
    ["follow", "Polite follow-up (no reply)", "Email, 7–10 days later", (c, a) => `Hi ${c.first},\n\nI'm following up on my application for the ${a.role} role at ${a.company}. I'm still very interested and would welcome the chance to talk.\n\nPlease let me know if you need anything else from me.\n\nThank you,\n${myName()}`]];
  const first = (n) => String(n || "").trim().split(/\s+/)[0] || "[Name]";
  function contactEdit(c, appId) {
    const x = c ? c.data : { name: "", kind: "Recruiter", company: "", title: "", appId: appId || "", url: "", email: "", how: "", status: "To contact", last: "", next: "", notes: "" };
    if (!c && appId) { const a = appById(appId); if (a) x.company = a.data.company || ""; }
    const m = modal(`<h3>${c ? "Edit contact" : "Add a contact"}</h3><div class="row"><div><label class="f" for="nt-n">Name</label><input class="input" id="nt-n" value="${esc(x.name)}" placeholder="Priya Sharma"></div><div><label class="f" for="nt-k">Who are they?</label><select class="select" id="nt-k">${KINDS.map(k => `<option ${k === x.kind ? "selected" : ""}>${k}</option>`).join("")}</select></div></div>
      <div class="row"><div><label class="f" for="nt-co">Company</label><input class="input" id="nt-co" value="${esc(x.company)}"></div><div><label class="f" for="nt-ti">Their job title</label><input class="input" id="nt-ti" value="${esc(x.title)}" placeholder="Talent Acquisition, Analytics Manager…"></div></div>
      <div class="row"><div><label class="f" for="nt-ap">Linked application</label><select class="select" id="nt-ap"><option value="">— none —</option>${apps().map(a => `<option value="${esc(a.id)}" ${a.id === x.appId ? "selected" : ""}>${esc(a.title)}</option>`).join("")}</select></div><div><label class="f" for="nt-st">Status</label><select class="select" id="nt-st">${CST.map(k => `<option ${k === x.status ? "selected" : ""}>${k}</option>`).join("")}</select></div></div>
      <div class="row"><div><label class="f" for="nt-u">LinkedIn URL</label><input class="input" id="nt-u" value="${esc(x.url)}" placeholder="https://linkedin.com/in/…"></div><div><label class="f" for="nt-e">Email</label><input class="input" id="nt-e" type="email" value="${esc(x.email)}"></div></div>
      <div class="row"><div><label class="f" for="nt-la">Last contacted</label><input class="input" type="date" id="nt-la" value="${esc(x.last)}"></div><div><label class="f" for="nt-nx">Next follow-up</label><input class="input" type="date" id="nt-nx" value="${esc(x.next)}"></div></div>
      <label class="f" for="nt-h">How you know them</label><input class="input" id="nt-h" value="${esc(x.how)}" placeholder="Same college, met at a meetup, cold outreach…">
      <label class="f" for="nt-no">Notes</label><textarea class="textarea" id="nt-no" rows="2">${esc(x.notes)}</textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn btn-ghost" onclick="RQ.closeModal()">Cancel</button><button class="btn btn-primary" id="nt-save">Save contact</button></div>`, { wide: true });
    $("#nt-save", m).onclick = () => { const v = (id) => $(id, m).value.trim(); if (!v("#nt-n")) return toast("Add their name.", "bad"); const u = v("#nt-u"); if (u && !/^https?:\/\//i.test(u)) return toast("LinkedIn URL should start with https://", "bad");
      cpSave("contact", v("#nt-n"), { name: v("#nt-n"), kind: v("#nt-k"), company: v("#nt-co"), title: v("#nt-ti"), appId: v("#nt-ap"), url: u, email: v("#nt-e"), how: v("#nt-h"), status: v("#nt-st"), last: v("#nt-la"), next: v("#nt-nx"), notes: v("#nt-no"), log: (x.log || []) }, c && c.id); closeModal(); toast("Contact saved", "ok"); networkView(); };
  }
  function tplModal(c) {
    const a = (c.data.appId && appById(c.data.appId) || {}).data || { role: myRole(), company: c.data.company || "[company]", link: "", applied: "" };
    const ctx = { first: first(c.data.name) }, A2 = Object.assign({ role: myRole(), company: c.data.company || "[company]" }, a);
    const pick = c.data.kind === "Recruiter" ? "recruiter" : c.data.kind === "Referral (employee)" ? "referral" : c.data.kind === "Hiring manager" ? "note" : "info";
    const m = modal(`<h3>Message ${esc(c.data.name)}</h3><p class="small muted" style="margin-top:-4px">Fill the [brackets] with your own facts before sending. Resumiq never sends messages for you.</p>
      <div class="seg" style="margin:8px 0">${TPL.map(([k, n]) => `<button class="chip ${k === pick ? "on" : ""}" data-tp="${k}">${esc(n)}</button>`).join("")}</div><div id="tp-box"></div>`, { wide: true });
    const draw = (k) => { const t = TPL.find(x => x[0] === k); const body = t[3](ctx, A2); $$("[data-tp]", m).forEach(b => b.classList.toggle("on", b.dataset.tp === k));
      $("#tp-box", m).innerHTML = `<div class="nt-tpl"><div class="small muted" style="margin-bottom:6px">${esc(t[2])}</div><textarea class="textarea" id="tp-t" rows="${Math.min(14, body.split("\n").length + 2)}">${esc(body)}</textarea><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap"><span class="small" id="tp-n"></span><div style="display:flex;gap:6px"><button class="btn btn-ghost btn-sm" id="tp-c">Copy</button>${c.data.email ? `<a class="btn btn-ghost btn-sm" id="tp-m" href="#">Open in email</a>` : ""}<button class="btn btn-primary btn-sm" id="tp-log">Mark as sent</button></div></div></div>`;
      const cnt = () => { const n = $("#tp-t", m).value.length; $("#tp-n", m).innerHTML = k === "note" ? (n <= 300 ? `<span class="cp-ok">✓ ${n}/300: fits a LinkedIn invite note</span>` : `<span class="cp-warn">${n}/300: too long for an invite note</span>`) : `<span class="muted">${wc($("#tp-t", m).value)} words</span>`; };
      $("#tp-t", m).oninput = cnt; cnt();
      $("#tp-c", m).onclick = () => A().copy($("#tp-t", m).value);
      if ($("#tp-m", m)) $("#tp-m", m).onclick = (e) => { e.preventDefault(); location.href = "mailto:" + encodeURIComponent(c.data.email) + "?subject=" + encodeURIComponent((A2.role || "") + " role at " + (A2.company || "")) + "&body=" + encodeURIComponent($("#tp-t", m).value); };
      $("#tp-log", m).onclick = () => { const d = Object.assign({}, c.data, { status: c.data.status === "To contact" ? "Messaged" : c.data.status, last: todayS(), next: c.data.next && daysSince(c.data.next) < 0 ? c.data.next : addDays(k === "thanks" ? 7 : 5), log: (c.data.log || []).concat([{ d: todayS(), t: t[1] }]).slice(-20) }); cpSave("contact", c.title, d, c.id); closeModal(); toast("Logged. Follow-up set for " + fmtDay(d.next), "ok"); networkView(); }; };
    $$("[data-tp]", m).forEach(b => b.onclick = () => draw(b.dataset.tp)); draw(pick);
  }
  function networkView() {
    const q = new URLSearchParams((location.hash.split("?")[1]) || ""), only = q.get("app") || "";
    const all = cpList("contact"), list = all.filter(c => !only || c.data.appId === only).sort((a, b) => String(a.data.next || "9999").localeCompare(String(b.data.next || "9999")));
    const due = all.filter(c => c.data.next && daysSince(c.data.next) >= 0 && !["No reply"].includes(c.data.status));
    const oa = only && appById(only), co = oa ? oa.data.company : "";
    const ref = all.filter(c => c.data.status === "Referred me").length, rep = all.filter(c => ["Replied", "Referred me", "Met / called"].includes(c.data.status)).length, msg = all.filter(c => c.data.status !== "To contact").length;
    const li = (k) => "https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent(k);
    A().view.innerHTML = page("network", "Network & referrals", "Referrals are one of the strongest ways into a company. Keep every recruiter, referrer and alumni contact here, linked to the job, with a reminder for the next touch.", `<button class="btn btn-primary" id="nt-add">＋ Add contact</button>`) + `
      <div class="grid g3" style="margin-bottom:16px"><div class="card card-pad"><div class="small muted">Contacts</div><b style="font-size:24px">${all.length}</b></div><div class="card card-pad"><div class="small muted">Reply rate</div><b style="font-size:24px">${msg ? Math.round(rep / msg * 100) + "%" : "–"}</b><div class="small muted">${rep} of ${msg} messaged</div></div><div class="card card-pad"><div class="small muted">Referrals</div><b style="font-size:24px">${ref}</b></div></div>
      ${due.length ? `<div class="card card-pad" style="margin-bottom:16px"><h3 style="margin-top:0">⏰ Reach out today (${due.length})</h3>${due.map(c => `<div class="chk"><div class="tx"><b>${esc(c.data.name)}</b><span>${esc(c.data.kind)}${c.data.company ? " · " + esc(c.data.company) : ""} · due ${esc(fmtDay(c.data.next))}</span></div><button class="btn btn-primary btn-sm" data-msg="${esc(c.id)}">✉ Write message</button></div>`).join("")}</div>` : ""}
      ${oa ? `<div class="note info" style="margin-bottom:12px">Showing contacts for <b>${esc(oa.title)}</b>. <a href="#/network">Show all</a></div>
        <div class="card card-pad" style="margin-bottom:16px"><h3 style="margin-top:0">Find people at ${esc(co || "this company")}</h3><p class="small muted">Opens a LinkedIn people search. Pick 2–3 people: one recruiter, one person in the role, one alumnus.</p><div style="display:flex;gap:8px;flex-wrap:wrap">${co ? [["Recruiters", co + " recruiter talent acquisition"], ["People in this role", co + " " + (oa.data.role || "")], ["Hiring managers", co + " " + (oa.data.role || "").replace(/\b(junior|senior|sr|jr|intern)\b/ig, "") + " manager"]].map(([n, k]) => `<a class="btn btn-ghost btn-sm" href="${esc(li(k))}" target="_blank" rel="noopener noreferrer">${esc(n)} ↗</a>`).join("") : `<span class="small muted">Add the company name to this application first.</span>`}</div></div>` : ""}
      ${list.length ? `<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Person</th><th class="hide-s">Job</th><th>Status</th><th class="hide-s">Next touch</th><th></th></tr></thead><tbody>${list.map(c => { const x = c.data, a = x.appId && appById(x.appId), late = x.next && daysSince(x.next) > 0; return `<tr><td><b>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.name)}</a>` : esc(x.name)}</b><div class="small muted">${esc(x.kind)}${x.title ? " · " + esc(x.title) : ""}${x.company ? " · " + esc(x.company) : ""}</div></td><td class="hide-s small">${a ? esc(a.title) : "—"}</td><td><span class="badge ${x.status === "Referred me" ? "ok" : x.status === "Replied" || x.status === "Met / called" ? "brand" : x.status === "No reply" ? "" : "info"}">${esc(x.status)}</span></td><td class="hide-s small ${late ? "cp-warn" : ""}">${x.next ? esc(fmtDay(x.next)) + (late ? " (late)" : "") : "—"}</td><td style="white-space:nowrap"><button class="btn btn-primary btn-sm" data-msg="${esc(c.id)}">✉</button> <button class="btn btn-ghost btn-sm" data-ce="${esc(c.id)}">Edit</button><button class="icon-btn" data-cd="${esc(c.id)}" aria-label="Delete contact">🗑</button></td></tr>`; }).join("")}</tbody></table></div></div>`
        : A().empty("🤝", only ? "No contacts for this job yet" : "No contacts yet", "Add a recruiter, an employee who could refer you, or an alumnus at a company you like. Then use a ready message to reach out.", `<button class="btn btn-primary" id="nt-add2">＋ Add contact</button>`)}
      <div class="card card-pad" style="margin-top:16px"><h3 style="margin-top:0">Good outreach habits</h3><ul class="small" style="margin:0;padding-left:18px;line-height:1.7"><li>Message 2–3 people per job you really want: a recruiter, someone in the role, and an alumnus.</li><li>Keep the first message short and specific. Ask for advice or 10 minutes, not a job.</li><li>Follow up once after 5–7 days, then stop. Mark them “No reply” and move on.</li><li>Send a thank-you on the same day as every interview.</li></ul></div>`;
    const add = () => contactEdit(null, only); $("#nt-add").onclick = add; if ($("#nt-add2")) $("#nt-add2").onclick = add;
    $$("[data-ce]").forEach(b => b.onclick = () => contactEdit(store.get(b.dataset.ce)));
    $$("[data-msg]").forEach(b => b.onclick = () => tplModal(store.get(b.dataset.msg)));
    $$("[data-cd]").forEach(b => b.onclick = async () => { if (await RQ.confirm("Delete this contact?", "Delete", true)) { store.remove(b.dataset.cd); networkView(); } });
  }

  /* ============================== 🩺 Resume checkup ============================== */
  const checkup = (r, jd) => window.RQ_CHECK.checkup(r, jd);
  function checkupView() {
    const last = cpList("checkup")[0], lr = last && last.data;
    A().view.innerHTML = page("checkup", "Resume checkup", "A line-by-line review like a recruiter's red pen: impact, language, length, format, and (with a job description) title, education, level and skills match. Free, no AI credits.") + `
      <div class="card card-pad"><div class="row"><div><label class="f" for="ck-r">Resume</label>${A().resumeSel("ck-r", lr && lr.resumeId)}</div><div><label class="f" for="ck-jd">Job description (optional, adds a job-match section)</label><textarea class="textarea" id="ck-jd" rows="3" placeholder="Paste the job description…">${esc((lr && lr.jd) || "")}</textarea></div></div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-primary" id="ck-go">🩺 Run checkup</button><span class="small muted" style="align-self:center">Rule-based and instant. Fix in the <a href="/studio">Studio</a>, then run again.</span></div></div><div id="ck-out" style="margin-top:16px"></div>`;
    const run = () => { const id = $("#ck-r") && $("#ck-r").value; if (!id) return toast("Create a resume first.", "bad"); const r = A().resumeObj(id); if (!r) return; const jd = $("#ck-jd").value; const o = checkup(r, jd);
      const col = (p) => p >= 80 ? "ok" : p >= 55 ? "warn" : "bad", ic = (x) => x.ok >= .99 ? ["ok", "✓"] : x.ok >= .5 ? ["warn", "!"] : ["bad", "✕"];
      const order = ["Job match", "Impact", "Language", "Brevity", "Format"], cs = o.checks.slice().sort((a, b) => (a.ok >= .99) - (b.ok >= .99) || order.indexOf(a.cat) - order.indexOf(b.cat) || b.w - a.w);
      $("#ck-out").innerHTML = `<div class="card card-pad"><div class="ck-sc">${C.ring ? C.ring(o.score) : `<b style="font-size:34px">${o.score}</b>`}<div class="ck-cat">${o.cats.map(([k, p]) => `<div><b class="cp-${p >= 80 ? "ok" : "warn"}">${p}</b><span>${esc(k)}</span></div>`).join("")}</div></div>
        <p class="small muted" style="margin:12px 0 0">${o.checks.filter(x => x.ok >= .99).length} of ${o.checks.length} checks passed${o.jm ? " · matched against “" + esc(o.jm.title) + "”" : ""}. Weights are fixed and shown in the order of what to fix first.</p></div>
        <div class="card card-pad" style="margin-top:14px">${cs.map(x => { const [k, s] = ic(x); return `<div class="ck-row"><span class="ck-ic ${k}" aria-hidden="true">${s}</span><div class="tx"><b>${esc(x.title)}</b> <span class="small muted">· ${esc(x.cat)}</span><p>${esc(x.msg)}</p>${x.ok < .99 && x.ex.length ? `<ul class="ck-ex">${x.ex.map(e => `<li>${e}</li>`).join("")}</ul>` : ""}</div></div>`; }).join("")}</div>`;
      cpSave("checkup", "Resume checkup", { resumeId: id, jd: jd.slice(0, 8000), score: o.score, at: todayS() }, last && last.id); };
    $("#ck-go").onclick = run; if (lr && $("#ck-r")) run();
  }

  /* ========================== 🔗 LinkedIn vs 3 target jobs ========================== */
  function liView() {
    const sv = (cpList("limulti")[0] || {}), x = sv.data || { head: "", about: "", skills: "", exp: "", jds: ["", "", ""] };
    const r = A().resumes()[0], rd = r && RS().normalize(r.data);
    A().view.innerHTML = page("li-multi", "LinkedIn vs 3 target jobs", "Recruiters search LinkedIn by keywords. Paste your profile and up to three job descriptions you want; see which keywords your profile is missing across all of them.") + `
      <div class="grid g2" style="align-items:start"><div class="card card-pad"><h3 style="margin-top:0">Your LinkedIn profile</h3>${rd ? `<button class="btn btn-ghost btn-sm" id="li-fill" style="margin-bottom:6px">Fill from my latest resume</button>` : ""}
        <label class="f" for="li-h">Headline <span class="small muted" id="li-hn"></span></label><input class="input" id="li-h" value="${esc(x.head)}" maxlength="300" placeholder="Data Analyst | SQL · Power BI · Python | Turning sales data into decisions">
        <label class="f" for="li-a">About</label><textarea class="textarea" id="li-a" rows="5">${esc(x.about)}</textarea>
        <label class="f" for="li-e">Experience (titles + descriptions)</label><textarea class="textarea" id="li-e" rows="4">${esc(x.exp)}</textarea>
        <label class="f" for="li-s">Skills (comma separated)</label><textarea class="textarea" id="li-s" rows="2">${esc(x.skills)}</textarea></div>
        <div class="card card-pad"><h3 style="margin-top:0">Target jobs</h3>${[0, 1, 2].map(i => `<label class="f" for="li-j${i}">Job ${i + 1}${i ? " (optional)" : ""}</label><textarea class="textarea" id="li-j${i}" rows="4" placeholder="Paste a job description…">${esc((x.jds || [])[i] || "")}</textarea>`).join("")}
          <button class="btn btn-primary" id="li-go" style="margin-top:12px">🔗 Score my profile</button></div></div><div id="li-out" style="margin-top:16px"></div>`;
    const hn = () => { const n = $("#li-h").value.length; $("#li-hn").textContent = `${n}/220`; $("#li-hn").className = "small " + (n > 220 ? "cp-warn" : "muted"); }; $("#li-h").oninput = hn; hn();
    if ($("#li-fill")) $("#li-fill").onclick = () => { const c = rd.contact || {}; $("#li-h").value = c.headline || rd.targetRole || ""; $("#li-a").value = rd.summary || ""; $("#li-e").value = (rd.experience || []).map(e => [e.role + (e.company ? " at " + e.company : ""), String(e.bullets || "")].join("\n")).join("\n\n"); $("#li-s").value = [].concat(...(rd.skills || []).map(s => String(s.items || "").split(/,|\n/))).map(s => s.trim()).filter(Boolean).join(", "); hn(); toast("Filled from your resume. Edit it to match your real LinkedIn.", "ok"); };
    $("#li-go").onclick = () => {
      const P = { head: $("#li-h").value, about: $("#li-a").value, exp: $("#li-e").value, skills: $("#li-s").value }, jds = [0, 1, 2].map(i => $("#li-j" + i).value.trim()).filter(t => t.length > 60);
      if (!jds.length) return toast("Paste at least one job description.", "bad"); if (!(P.head + P.about + P.skills).trim()) return toast("Add your headline, About or skills first.", "bad");
      const all = [P.head, P.about, P.exp, P.skills].join("\n"), J = jds.map(t => JD().parseJD(t));
      const per = J.map((j, i) => { const kw = j.keywords; const ok = kw.filter(k => JD().has(all, k.k)); return { i, title: j.title || ("Job " + (i + 1)), kw, ok, pct: kw.length ? Math.round(ok.length / kw.length * 100) : 0 }; });
      const freq = {}; per.forEach(p => p.kw.forEach(k => { const key = lc(k.k); const f = freq[key] = freq[key] || { k: k.k, n: 0, must: false, soft: k.cat === "soft" }; f.n++; if (k.imp === "must") f.must = true; }));
      const missing = Object.values(freq).filter(f => !JD().has(all, f.k)).sort((a, b) => b.n - a.n || b.must - a.must);
      const inHead = Object.values(freq).filter(f => f.n >= Math.min(2, per.length) && !f.soft).sort((a, b) => b.n - a.n).slice(0, 4).filter(f => !JD().has(P.head, f.k));
      const sk = P.skills.split(/,|\n/).map(s => s.trim()).filter(Boolean), abW = wc(P.about);
      const checks = [[P.head.length > 0 && P.head.length <= 220, `Headline is ${P.head.length} characters (LinkedIn allows 220).`], [inHead.length === 0, inHead.length ? `Put your top shared keywords in the headline: ${inHead.map(f => f.k).join(", ")}.` : "Headline has your most-wanted keywords."], [abW >= 120 && abW <= 400, `About is ${abW} words. Aim for 150–300: who you are, proof with numbers, what you want.`], [sk.length >= 10, `${sk.length} skills listed. LinkedIn allows up to 100; add 15–30 relevant ones so recruiter searches find you.`], [/\d/.test(P.about + P.exp), /\d/.test(P.about + P.exp) ? "Your profile includes numbers. Good." : "Add numbers to About / Experience (users, %, hours saved)."]];
      const avg = Math.round(per.reduce((s, p) => s + p.pct, 0) / per.length);
      $("#li-out").innerHTML = `<div class="card card-pad"><div class="ck-sc">${C.ring ? C.ring(avg) : `<b style="font-size:34px">${avg}</b>`}<div class="ck-cat">${per.map(p => `<div><b class="cp-${p.pct >= 70 ? "ok" : "warn"}">${p.pct}%</b><span>${esc(p.title)} · ${p.ok.length}/${p.kw.length} keywords</span></div>`).join("")}</div></div></div>
        <div class="grid g2" style="margin-top:14px;align-items:start"><div class="card card-pad"><h3 style="margin-top:0">Missing keywords (most wanted first)</h3>${missing.length ? `<p class="small muted" style="margin-top:-4px">The number shows how many of your target jobs ask for it. Add only what you genuinely have: skills list first, then a line in About or Experience.</p>${missing.slice(0, 30).map(f => `<span class="kwc miss">${esc(f.k)}${per.length > 1 ? " ×" + f.n : ""}${f.must ? " · must" : ""}</span>`).join("")}` : `<p class="cp-ok">Your profile covers every keyword we found. 🎉</p>`}
          <h4 style="margin:14px 0 6px">Already covered</h4>${Object.values(freq).filter(f => JD().has(all, f.k)).map(f => `<span class="kwc ok">${esc(f.k)}</span>`).join("") || `<span class="small muted">None yet.</span>`}</div>
          <div class="card card-pad"><h3 style="margin-top:0">Profile checks</h3>${checks.map(([ok, t]) => `<div class="ck-row"><span class="ck-ic ${ok ? "ok" : "warn"}">${ok ? "✓" : "!"}</span><div class="tx"><p style="margin:0">${esc(t)}</p></div></div>`).join("")}<p class="small muted" style="margin-bottom:0">For a headline and About rewrite, use <a href="#/linkedin">LinkedIn</a> (Dexa AI).</p></div></div>`;
      cpSave("limulti", "LinkedIn vs jobs", { head: P.head, about: P.about, exp: P.exp, skills: P.skills, jds: [0, 1, 2].map(i => $("#li-j" + i).value.slice(0, 8000)), score: avg }, sv.id);
    };
    if (sv.id && (x.jds || []).some(Boolean)) $("#li-go").click();
  }

  C.SUB.splice(C.SUB.findIndex(s => s[0] === "outcomes"), 0, ["board", "🗂 Board"], ["network", "🤝 Network"]);
  C.SUB.push(["checkup", "🩺 Checkup"], ["li-multi", "🔗 LinkedIn vs jobs"]);
  window.RQ_EXTRA_ROUTES = Object.assign(window.RQ_EXTRA_ROUTES || {}, { board: boardView, network: networkView, checkup: checkupView, "li-multi": liView });
  window.RQ_EXTRA_TITLES = Object.assign(window.RQ_EXTRA_TITLES || {}, { board: "Pipeline board", network: "Network & referrals", checkup: "Resume checkup", "li-multi": "LinkedIn vs jobs" });
  window.RQ_CP3 = { checkup, levelOf };
})();
