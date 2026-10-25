/* Resumiq admin panel (owner only): login with admin username + password, then usage stats */
(function () {
  "use strict";
  const { $, $$, esc, toast } = window.RQ; const box = $("#adm"); const KEY = "rq_admin_t";
  const getT = () => { try { const v = JSON.parse(sessionStorage.getItem(KEY) || "null"); return v && v.exp > Date.now() ? v.t : null; } catch (e) { return null; } };
  const setT = (t) => { try { if (t) sessionStorage.setItem(KEY, JSON.stringify({ t, exp: Date.now() + 8 * 3600e3 })); else sessionStorage.removeItem(KEY); } catch (e) {} };
  const fmt = (n) => n == null ? "—" : Number(n).toLocaleString("en-IN");
  const when = (t) => { if (!t) return "—"; const d = new Date(t); return isNaN(d) ? "—" : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
  const KIND = { visit: "👀 Visited", resume_create: "📄 Created resume", sample_open: "⭐ Opened sample", download_pdf: "⬇ PDF download", download_docx: "⬇ Word download", job_match: "🎯 Job match", signup: "🆕 Signed up", login: "🔑 Logged in", ai: "✨ Used Dexa", cover_letter: "✉️ Cover letter", interview: "🎤 Interview prep", import: "📥 Import" };
  let D = null, uq = "", feedF = "all";

  function login(msg) {
    box.innerHTML = `<div class="card card-pad" style="max-width:420px;margin:30px auto"><div class="logo" style="margin-bottom:12px"><span class="logo-mark">R</span><span>Resumiq Admin</span></div>
      ${msg ? `<div class="note warn">${esc(msg)}</div>` : ""}<form id="al"><label class="f" for="al-u">Username</label><input class="input" id="al-u" autocomplete="username" required>
      <label class="f" for="al-p" style="margin-top:12px">Password</label><input class="input" id="al-p" type="password" autocomplete="current-password" required>
      <div class="err" id="al-e"></div><button class="btn btn-primary" style="width:100%" id="al-b">Log in</button></form></div>`;
    $("#al-u").focus();
    $("#al").onsubmit = async (e) => { e.preventDefault(); const b = $("#al-b"); b.disabled = true; b.innerHTML = '<span class="spin"></span> Checking…'; $("#al-e").textContent = "";
      try { const r = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user: $("#al-u").value, pass: $("#al-p").value }) }); const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.message || "Login failed."); setT(j.token); load(); }
      catch (x) { $("#al-e").textContent = x.message; b.disabled = false; b.textContent = "Log in"; } };
  }
  async function load() {
    const t = getT(); if (!t) return login();
    box.innerHTML = '<div class="skel" style="height:120px"></div><div class="skel" style="height:300px;margin-top:14px"></div>';
    try { const r = await fetch("/api/admin", { headers: { Authorization: "Bearer " + t } }); const j = await r.json().catch(() => ({}));
      if (r.status === 401) { setT(null); return login("Session expired. Please log in again."); } if (!j.ok) throw new Error(j.message || "Could not load stats."); D = j; render(); }
    catch (e) { box.innerHTML = `<div class="note bad">${esc(e.message)}</div><button class="btn btn-ghost" onclick="location.reload()">Retry</button>`; }
  }
  const tile = (l, v, sub) => `<div class="card card-pad adm-t"><div class="small muted">${esc(l)}</div><b>${v}</b>${sub ? `<div class="small muted">${sub}</div>` : ""}</div>`;
  const list = (title, arr, label) => `<div class="card card-pad"><h3 style="font-size:16px">${title}</h3>${arr && arr.length ? arr.map(x => { const max = arr[0].v || 1; return `<div class="adm-row"><span title="${esc(x.k)}">${esc(label ? label(x.k) : x.k)}</span><div class="bar"><i style="width:${Math.max(4, x.v / max * 100)}%"></i></div><b>${fmt(x.v)}</b></div>`; }).join("") : '<p class="small muted">No data yet.</p>'}</div>`;
  function chart(days) {
    const W = 760, Hh = 170, max = Math.max(1, ...days.map(d => d.visitors)), bw = W / days.length;
    return `<svg viewBox="0 0 ${W} ${Hh + 24}" class="adm-chart" role="img" aria-label="Unique visitors per day, last 30 days">
      ${[0, .5, 1].map(f => `<line x1="0" x2="${W}" y1="${Hh - f * Hh}" y2="${Hh - f * Hh}" stroke="#E2E8F0"/><text x="2" y="${Hh - f * Hh - 3}" font-size="10" fill="#94A3B8">${Math.round(f * max)}</text>`).join("")}
      ${days.map((d, i) => { const h = d.visitors / max * (Hh - 14); return `<g><rect x="${i * bw + 3}" y="${Hh - h}" width="${bw - 6}" height="${Math.max(h, d.visitors ? 2 : 0)}" rx="3" fill="#5B4BF0"><title>${d.day}: ${d.visitors} visitors, ${d.views} page views, ${d.downloads} downloads</title></rect><rect x="${i * bw}" y="0" width="${bw}" height="${Hh}" fill="transparent"><title>${d.day}: ${d.visitors} visitors, ${d.views} page views, ${d.downloads} downloads</title></rect>${i % 5 === 0 || i === days.length - 1 ? `<text x="${i * bw + bw / 2}" y="${Hh + 16}" font-size="10" fill="#64748B" text-anchor="middle">${d.day.slice(8)}/${d.day.slice(5, 7)}</text>` : ""}</g>`; }).join("")}</svg>`;
  }
  function render() {
    const d = D, k = d.kpi || {};
    const head = `<div class="page-head"><div><h1 style="font-size:28px;margin:0">Admin panel</h1><p>Who is using Resumiq. Last 30 days unless marked.</p></div><div style="display:flex;gap:8px"><button class="btn btn-ghost btn-sm" id="ad-r">↻ Refresh</button><button class="btn btn-ghost btn-sm" id="ad-o">Log out</button></div></div>`;
    const setup = `<div class="card card-pad" style="margin-bottom:16px"><b>Setup status</b><div class="small" style="margin-top:6px">Dexa AI: ${d.provider ? `<span class="badge ok">${esc(d.provider)} connected</span>` : '<span class="badge bad">not connected</span>'} · Usage tracking: ${d.service ? '<span class="badge ok">on</span>' : '<span class="badge bad">off</span>'} · AI limits: guest ${d.limits.guest}/day, account ${d.limits.user}/day</div>${d.notes && d.notes.length ? `<ul class="small" style="margin:8px 0 0;padding-left:18px;color:var(--warn)">${d.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul>` : ""}</div>`;
    if (!d.service || !d.kpi) { box.innerHTML = head + setup; wireTop(); return; }
    const users = d.users.filter(u => !uq || (u.name + " " + u.email + " " + u.roles.join(" ")).toLowerCase().includes(uq));
    const feed = d.recent.filter(e => feedF === "all" || (feedF === "users" ? !/^Guest/.test(e.who) : e.kind === feedF));
    box.innerHTML = head + setup + `
      <div class="adm-kpi">${tile("Visitors (30 days)", fmt(k.visitors30), `${fmt(k.visitorsToday)} today`)}${tile("Page views", fmt(k.views30), `${fmt(k.viewsToday)} today`)}${tile("Registered users", fmt(k.users), `+${fmt(k.newUsers7)} this week`)}${tile("Resumes created", fmt(k.resumesCreated30), `${fmt(k.resumesCloud)} saved in accounts`)}${tile("Downloads", fmt(k.pdf30 + k.docx30), `PDF ${fmt(k.pdf30)} · Word ${fmt(k.docx30)}`)}${tile("Dexa AI uses", fmt(k.ai30), `${fmt(k.aiToday)} today · ${fmt(k.jobMatches30)} job matches`)}</div>
      <div class="card card-pad" style="margin-top:16px"><h3 style="font-size:16px">Unique visitors per day</h3>${chart(d.daily)}<p class="small muted" style="margin:4px 0 0">Hover a bar for page views and downloads.</p></div>
      <div class="grid g3" style="margin-top:16px">${list("Came from", d.refs, x => x === "direct" ? "Direct / unknown" : x)}${list("Top pages", d.pages)}${list("Location", d.places)}</div>
      <div class="grid g2" style="margin-top:16px">${list("Device", d.devices)}${list("Dexa features used", d.ai)}</div>
      <div class="card card-pad" style="margin-top:16px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><h3 style="font-size:16px;margin:0">Registered users (${fmt(d.users.length)})</h3><div style="display:flex;gap:8px"><input class="input" id="ad-q" placeholder="Search name, email, role" value="${esc(uq)}" style="width:230px;padding:8px 10px"><button class="btn btn-ghost btn-sm" id="ad-csv">⬇ CSV</button></div></div>
        <div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Last active</th><th>Resumes</th><th class="hide-s">Target roles</th><th class="hide-s">Dexa (30d)</th><th class="hide-s">Downloads</th></tr></thead><tbody>
        ${users.slice(0, 300).map(u => `<tr><td><b>${esc(u.name || "—")}</b></td><td class="small">${esc(u.email)}</td><td class="small">${esc(when(u.joined))}</td><td class="small">${esc(when(u.last))}</td><td>${u.resumes}</td><td class="hide-s small">${esc(u.roles.join(", ") || "—")}</td><td class="hide-s">${u.ai}</td><td class="hide-s">${u.pdf + u.docx}</td></tr>`).join("") || '<tr><td colspan="8" class="muted">No users yet. Users appear here after they create an account.</td></tr>'}</tbody></table></div></div>
      <div class="card card-pad" style="margin-top:16px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><h3 style="font-size:16px;margin:0">Recent activity</h3><div class="seg">${[["all", "All"], ["users", "Signed-in users"], ["resume_create", "Resumes"], ["download_pdf", "PDF"], ["download_docx", "Word"], ["ai", "Dexa"], ["visit", "Visits"]].map(([kk, l]) => `<button class="chip ${feedF === kk ? "on" : ""}" data-ff="${kk}">${l}</button>`).join("")}</div></div>
        <div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>When</th><th>Who</th><th>What</th><th class="hide-s">Details</th><th class="hide-s">Where</th></tr></thead><tbody>
        ${feed.slice(0, 80).map(e => `<tr><td class="small" style="white-space:nowrap">${esc(when(e.ts))}</td><td class="small">${esc(e.who)}</td><td class="small">${esc(KIND[e.kind] || e.kind)}</td><td class="hide-s small">${esc(e.what)}${e.ref ? ` <span class="muted">· from ${esc(e.ref)}</span>` : ""}</td><td class="hide-s small">${esc([e.place, e.dev].filter(Boolean).join(" · "))}</td></tr>`).join("") || '<tr><td colspan="5" class="muted">Nothing yet.</td></tr>'}</tbody></table></div>
        <p class="small muted" style="margin:8px 0 0">Guests are shown by an anonymous browser id. Resume contents stay private; only counts, titles of roles and activity are shown.</p></div>`;
    wireTop();
    $("#ad-q").oninput = (e) => { uq = e.target.value.trim().toLowerCase(); const pos = e.target.selectionStart; render(); const q = $("#ad-q"); q.focus(); q.setSelectionRange(pos, pos); };
    $$("[data-ff]").forEach(b => b.onclick = () => { feedF = b.dataset.ff; render(); });
    $("#ad-csv").onclick = () => { const rows = [["Name", "Email", "Joined", "Last active", "Resumes", "Target roles", "Dexa uses (30d)", "PDF", "Word"]].concat(d.users.map(u => [u.name, u.email, u.joined || "", u.last || "", u.resumes, u.roles.join("; "), u.ai, u.pdf, u.docx]));
      const csv = rows.map(r => r.map(v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(",")).join("\n"); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = "resumiq-users.csv"; a.click(); };
  }
  function wireTop() { $("#ad-r").onclick = load; $("#ad-o").onclick = () => { setT(null); toast("Logged out."); login(); }; }
  load();
})();
