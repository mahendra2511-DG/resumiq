// Owner-only admin panel API. Login with the admin username + password (only a salted scrypt hash is stored here).
// Stats need SUPABASE_SERVICE_ROLE_KEY in Vercel. Optional overrides: ADMIN_USER, ADMIN_PASS_HASH (s1$salt$hash), ADMIN_SECRET.
"use strict";
const crypto = require("crypto"); const L = require("./_lib"); const AI = require("./ai");
const ADMIN_USER = process.env.ADMIN_USER || "Mahendra";
const ADMIN_HASH = process.env.ADMIN_PASS_HASH || "s1$e1305965e7c18fb9b87cb3548fecb48d$4428a8ff01c756fdbad585c7f2c280bb0ea7abdf89a3a5e0124a870c5867f85c";
const SECRET = process.env.ADMIN_SECRET || L.SERVICE || crypto.randomBytes(32).toString("hex");
const b64 = (s) => Buffer.from(s).toString("base64url");
const sign = (p) => crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
function makeToken() { const p = b64(JSON.stringify({ a: 1, exp: Date.now() + 8 * 3600e3 })); return p + "." + sign(p); }
function tokenOk(t) { const [p, s] = String(t || "").split("."); if (!p || !s) return false; const good = sign(p); if (good.length !== s.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(s))) return false; try { return JSON.parse(Buffer.from(p, "base64url").toString()).exp > Date.now(); } catch (e) { return false; } }
function passOk(pw) { const [v, salt, h] = ADMIN_HASH.split("$"); if (v !== "s1" || !salt || !h) return false; const got = crypto.scryptSync(String(pw), salt, 32, { N: 16384, r: 8, p: 1 }); const want = Buffer.from(h, "hex"); return got.length === want.length && crypto.timingSafeEqual(got, want); }
const fails = new Map();
async function rest(q) { const r = await fetch(L.SUPABASE_URL + "/rest/v1/" + q, { headers: { apikey: L.SERVICE, Authorization: "Bearer " + L.SERVICE } }); if (!r.ok) throw new Error((await r.text()).slice(0, 200)); return r.json(); }
const top = (arr, n) => Object.entries(arr.reduce((m, k) => { if (k) m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, n || 10).map(([k, v]) => ({ k, v }));

async function stats() {
  const P = AI.provider(); const out = { ok: true, provider: P ? P.name : null, limits: { guest: +process.env.AI_DAILY_GUEST || 10, user: +process.env.AI_DAILY_USER || 40 }, service: !!L.SERVICE, notes: [] };
  if (!P) out.notes.push("Dexa AI is off: add XAI_API_KEY (Grok) or GROQ_API_KEY in Vercel → Settings → Environment Variables, then Redeploy.");
  if (!L.SERVICE) { out.notes.push("Add SUPABASE_SERVICE_ROLE_KEY in Vercel (Supabase → Project Settings → API → service_role) and Redeploy to see visitors and users."); return out; }
  const since = new Date(Date.now() - 30 * 864e5).toISOString(), today = L.istDay();
  const [ev, prof, docs, use] = await Promise.all([
    rest("rq_events?select=ts,day,kind,page,ref,vid,uid,email,dev,country,city,detail&ts=gte." + since + "&order=ts.desc&limit=20000").catch(e => { out.notes.push("Events table missing: run the latest supabase.sql. (" + e.message.slice(0, 80) + ")"); return []; }),
    rest("profiles?select=id,email,name,created_at&order=created_at.desc&limit=5000").catch(() => rest("profiles?select=id,email,name&limit=5000").catch(() => [])),
    rest("rq_docs?select=user_id,kind,title,updated_at,target:data->>targetRole&limit=20000").catch(() => []),
    rest("rq_usage?select=key,count&day=eq." + today).catch(() => [])]);
  const visits = ev.filter(e => e.kind === "visit"), vT = visits.filter(e => e.day === today);
  const k30 = (k) => ev.filter(e => e.kind === k).length;
  out.kpi = { visitors30: new Set(visits.map(e => e.vid || e.uid).filter(Boolean)).size, visitorsToday: new Set(vT.map(e => e.vid || e.uid).filter(Boolean)).size, views30: visits.length, viewsToday: vT.length,
    users: prof.length, newUsers7: prof.filter(p => p.created_at && Date.now() - new Date(p.created_at) < 7 * 864e5).length,
    resumesCloud: docs.filter(d => d.kind === "resume").length, resumesCreated30: k30("resume_create") + k30("sample_open"), pdf30: k30("download_pdf"), docx30: k30("download_docx"), ai30: k30("ai"), aiToday: use.filter(x => /^[ug]:/.test(x.key || "")).reduce((a, x) => a + (x.count || 0), 0), jobMatches30: k30("job_match") };
  const days = []; for (let i = 29; i >= 0; i--) { const d = new Date(Date.now() + 5.5 * 3600e3 - i * 864e5).toISOString().slice(0, 10); const dv = visits.filter(e => e.day === d); days.push({ day: d, visitors: new Set(dv.map(e => e.vid || e.uid).filter(Boolean)).size, views: dv.length, downloads: ev.filter(e => e.day === d && /^download_/.test(e.kind)).length }); }
  out.daily = days;
  out.pages = top(visits.map(e => (e.page || "/").split("?")[0]), 10); out.refs = top(visits.map(e => e.ref || "direct"), 10);
  out.devices = top(visits.map(e => e.dev), 5); out.places = top(visits.map(e => [e.city, e.country].filter(Boolean).join(", ") || null), 10);
  out.ai = top(ev.filter(e => e.kind === "ai").map(e => e.detail), 12);
  const byU = {}; prof.forEach(p => { byU[p.id] = { name: p.name || "", email: p.email || "", joined: p.created_at || null, last: p.created_at || null, resumes: 0, roles: new Set(), ai: 0, pdf: 0, docx: 0, visits: 0 }; });
  docs.forEach(d => { const u = byU[d.user_id]; if (!u) return; if (d.kind === "resume") { u.resumes++; if (d.target) u.roles.add(d.target); } if (d.updated_at && (!u.last || d.updated_at > u.last)) u.last = d.updated_at; });
  ev.forEach(e => { const u = e.uid && byU[e.uid]; if (!u) return; if (!u.last || e.ts > u.last) u.last = e.ts; if (e.kind === "ai") u.ai++; if (e.kind === "download_pdf") u.pdf++; if (e.kind === "download_docx") u.docx++; if (e.kind === "visit") u.visits++; });
  out.users = Object.values(byU).map(u => Object.assign(u, { roles: [...u.roles].slice(0, 4) })).sort((a, b) => String(b.last || "").localeCompare(String(a.last || "")));
  out.recent = ev.slice(0, 80).map(e => ({ ts: e.ts, who: e.email || (e.vid ? "Guest " + e.vid.slice(0, 6) : "Guest"), kind: e.kind, what: e.detail || e.page || "", place: [e.city, e.country].filter(Boolean).join(", "), dev: e.dev, ref: e.ref || "" }));
  return out;
}

module.exports = async (req, res) => {
  if (!L.originOk(req)) return L.send(res, 403, { ok: false, message: "Not allowed." });
  if (req.method === "POST") {
    const b = await L.body(req); const ip = L.hash(L.ipOf(req)); const f = fails.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - f.t > 15 * 60e3) { f.n = 0; f.t = Date.now(); }
    if (f.n >= 8 || (await L.bump("admlogin:" + ip, 30, 0)) >= 30) return L.send(res, 429, { ok: false, message: "Too many attempts. Try again in 15 minutes." });
    const ok = String(b.user || "").trim().toLowerCase() === ADMIN_USER.toLowerCase() && passOk(b.pass || "");
    if (!ok) { f.n++; fails.set(ip, f); await L.bump("admlogin:" + ip, 30, 1); return L.send(res, 401, { ok: false, message: "Wrong username or password." }); }
    fails.delete(ip); return L.send(res, 200, { ok: true, token: makeToken() });
  }
  const t = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tokenOk(t)) return L.send(res, 401, { ok: false, error: "login", message: "Please log in." });
  try { return L.send(res, 200, await stats()); } catch (e) { return L.send(res, 500, { ok: false, message: "Could not load stats: " + e.message }); }
};
