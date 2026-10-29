// Job alert e-mails. GET without a cron secret → status only.
// Vercel Cron calls GET /api/alerts daily with "Authorization: Bearer <CRON_SECRET>" (see vercel.json "crons").
// Needs: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, ADZUNA_APP_ID, ADZUNA_APP_KEY, RESEND_API_KEY, ALERT_FROM (e.g. "Resumiq <alerts@yourdomain.com>").
// Optional: SITE_URL (defaults to the request host). Alerts are the users' own rq_docs rows (kind 'analysis', data.cp = 'alert').
"use strict";
const L = require("./_lib.js");
const clean = (v, n) => String(v || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n || 160);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COUNTRIES = new Set(["us", "gb", "in", "ca", "au", "de", "fr", "nl", "sg", "za", "nz", "ie", "pl", "br", "at", "ch", "es", "it"]);
const SENIOR = /\b(senior|sr\.?|lead|principal|manager|head|director|architect|staff)\b/i;
const cfg = () => ({ live: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY), email: !!(process.env.RESEND_API_KEY && process.env.ALERT_FROM && L.SERVICE), cron: !!process.env.CRON_SECRET });

async function rest(path, opt) {
  const r = await fetch(L.SUPABASE_URL + "/rest/v1/" + path, Object.assign({ headers: { apikey: L.SERVICE, Authorization: "Bearer " + L.SERVICE, "Content-Type": "application/json" } }, opt || {}));
  if (!r.ok) throw new Error("db " + r.status + " " + (await r.text()).slice(0, 120)); return r.status === 204 ? null : r.json();
}
async function search(a, days) {
  const p = new URLSearchParams({ app_id: process.env.ADZUNA_APP_ID, app_key: process.env.ADZUNA_APP_KEY, results_per_page: "20", what: clean(a.q, 100), "content-type": "application/json", sort_by: "date", max_days_old: String(days) });
  if (a.loc) p.set("where", clean(a.loc, 100)); if (a.remote) p.set("what_or", "remote work from home"); if (a.fresher) p.set("what_exclude", "senior sr lead principal manager head director architect staff");
  const country = COUNTRIES.has(String(a.country || "").toLowerCase()) ? String(a.country).toLowerCase() : "in";
  const r = await fetch(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${p}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error("adzuna " + r.status);
  const j = await r.json();
  return (Array.isArray(j.results) ? j.results : []).map(x => ({ id: clean(x.id, 100), title: clean(x.title, 180), company: clean(x.company && x.company.display_name, 120), location: clean(x.location && x.location.display_name, 120), url: /^https?:\/\//i.test(String(x.redirect_url || "")) ? String(x.redirect_url) : "" }))
    .filter(x => x.title && x.url && (!a.fresher || !SENIOR.test(x.title)));
}
function mail(name, groups, site) {
  const rows = groups.map(g => `<h3 style="margin:22px 0 8px;font:700 16px Arial,sans-serif;color:#0f172a">${esc(g.a.q)}${g.a.loc ? " · " + esc(g.a.loc) : ""}${g.a.fresher ? " · fresher" : ""}</h3>` + g.jobs.slice(0, 10).map(j => `<div style="padding:10px 0;border-bottom:1px solid #e2e8f0;font:14px Arial,sans-serif"><a href="${esc(j.url)}" style="color:#5B4BF0;font-weight:700;text-decoration:none">${esc(j.title)}</a><br><span style="color:#64748b">${esc(j.company)}${j.location ? " · " + esc(j.location) : ""}</span></div>`).join("")).join("");
  return `<div style="max-width:600px;margin:0 auto;padding:20px;font:15px Arial,sans-serif;color:#0f172a"><p>Hi ${esc(name || "there")},</p><p>Here are new jobs matching your Resumiq alerts.</p>${rows}<p style="margin-top:22px"><a href="${esc(site)}/app#/alerts" style="background:#5B4BF0;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700">Open my alerts</a></p><p style="color:#94a3b8;font-size:12px;margin-top:24px">Jobs by Adzuna. Before applying, check the employer is genuine: real employers never ask you to pay a fee. To stop these e-mails, edit or delete the alert in Resumiq.</p></div>`;
}

module.exports = async (req, res) => {
  const C = cfg(), auth = String(req.headers.authorization || "");
  if (!C.cron || auth !== "Bearer " + process.env.CRON_SECRET) return L.send(res, 200, { ok: true, live: C.live, email: C.email && C.cron });
  if (!C.live || !C.email) return L.send(res, 503, { ok: false, message: "Alerts need ADZUNA_APP_ID, ADZUNA_APP_KEY, RESEND_API_KEY, ALERT_FROM and SUPABASE_SERVICE_ROLE_KEY." });
  const site = String(process.env.SITE_URL || ("https://" + (req.headers["x-forwarded-host"] || req.headers.host || "resumiq-pekm.vercel.app"))).replace(/\/$/, "");
  const monday = new Date(Date.now() + 5.5 * 3600e3).getUTCDay() === 1;
  let rows = []; try { rows = await rest("rq_docs?select=id,user_id,data&kind=eq.analysis&data->>cp=eq.alert&data->>email=eq.true&limit=2000"); } catch (e) { return L.send(res, 500, { ok: false, message: e.message }); }
  const byUser = {}; rows.forEach(r => { const a = r.data || {}; if (!a.q || (a.freq === "weekly" && !monday)) return; (byUser[r.user_id] = byUser[r.user_id] || []).push(r); });
  const ids = Object.keys(byUser); let profs = []; if (ids.length) { try { profs = await rest("profiles?select=id,email,name&id=in.(" + ids.map(encodeURIComponent).join(",") + ")"); } catch (e) { profs = []; } }
  const P = {}; profs.forEach(p => { P[p.id] = p; });
  let sent = 0, searched = 0, errors = 0; const MAX_SEARCH = +process.env.ALERT_MAX_SEARCHES || 300;
  for (const uid of ids) {
    const p = P[uid]; if (!p || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email || "")) continue;
    const groups = [];
    for (const r of byUser[uid].slice(0, 5)) {
      if (searched >= MAX_SEARCH) break; searched++;
      const a = r.data; let jobs = [];
      try { jobs = await search(a, a.freq === "weekly" ? 7 : 1); } catch (e) { errors++; continue; }
      const seen = new Set(Array.isArray(a.srvSeen) ? a.srvSeen : []); const fresh = jobs.filter(j => !seen.has(j.id));
      if (fresh.length) groups.push({ a, jobs: fresh });
      try { await rest("rq_docs?id=eq." + encodeURIComponent(r.id), { method: "PATCH", headers: { apikey: L.SERVICE, Authorization: "Bearer " + L.SERVICE, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ data: Object.assign({}, a, { srvSeen: [...new Set(jobs.map(j => j.id).concat([...seen]))].slice(0, 300), srvLast: new Date().toISOString().slice(0, 10) }) }) }); } catch (e) { errors++; }
    }
    if (!groups.length) continue;
    const n = groups.reduce((s, g) => s + Math.min(10, g.jobs.length), 0);
    try { const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.ALERT_FROM, to: [p.email], subject: `${n} new job${n > 1 ? "s" : ""} for “${groups[0].a.q}”`, html: mail(p.name, groups, site) }), signal: AbortSignal.timeout(12000) }); if (r.ok) sent++; else errors++; } catch (e) { errors++; }
  }
  return L.send(res, 200, { ok: true, users: ids.length, searched, sent, errors });
};
