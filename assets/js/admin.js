/* Resumiq admin: owner-only usage overview (server checks the admin email) */
(function () {
  "use strict";
  const { $, esc } = window.RQ; const box = $("#adm");
  window.RQ.onAuth(async (u) => {
    if (!u) { box.innerHTML = `<div class="card card-pad"><p>Sign in with the owner account to view this page.</p><button class="btn btn-primary" onclick="RQ.authModal('signin')">Sign in</button></div>`; return; }
    if (u.email !== window.RQ.CFG.ADMIN_EMAIL) { box.innerHTML = `<div class="note bad">This page is only for the site owner.</div>`; return; }
    try {
      const t = await window.RQ.token(); const r = await fetch("/api/admin", { headers: { Authorization: "Bearer " + t } }); const j = await r.json();
      if (!j.ok) throw new Error(j.message || "Could not load stats.");
      const tile = (l, v) => `<div class="card card-pad"><div class="small muted">${esc(l)}</div><b style="font:800 30px var(--fh)">${v == null ? "—" : esc(String(v))}</b></div>`;
      box.innerHTML = `<div class="grid g4">${tile("Accounts", j.users)}${tile("Resumes (cloud)", j.docs && j.docs.resume)}${tile("Job matches (cloud)", j.docs && j.docs.analysis)}${tile("AI requests today", j.aiToday)}</div>
        <div class="card card-pad" style="margin-top:16px"><h3>AI setup</h3><p>Provider: <b>${esc(j.provider || "not configured")}</b> · Daily limits: guest ${esc(String(j.limits.guest))}, account ${esc(String(j.limits.user))}</p>${j.notes && j.notes.length ? `<ul class="small">${j.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}</div>
        ${j.recent && j.recent.length ? `<div class="card card-pad" style="margin-top:16px"><h3>Newest accounts</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Email</th><th>Name</th><th>Joined</th></tr></thead><tbody>${j.recent.map(p => `<tr><td>${esc(p.email)}</td><td>${esc(p.name || "")}</td><td class="small">${esc(window.RQ.fmtDay(p.created_at))}</td></tr>`).join("")}</tbody></table></div></div>` : ""}`;
    } catch (e) { box.innerHTML = `<div class="note bad">${esc(e.message)}</div>`; }
  });
})();
