// Owner-only stats. Needs SUPABASE_SERVICE_ROLE_KEY in Vercel for counts.
"use strict";
const L = require("./_lib"); const AI = require("./ai");
module.exports = async (req, res) => {
  if (!L.originOk(req)) return L.send(res, 403, { ok: false, message: "Not allowed." });
  const u = await L.userFrom(req);
  if (!u || u.email !== L.ADMIN_EMAIL) return L.send(res, 403, { ok: false, message: "Only the site owner can see this." });
  const P = AI.provider(); const out = { ok: true, provider: P ? P.name : null, limits: { guest: +process.env.AI_DAILY_GUEST || 10, user: +process.env.AI_DAILY_USER || 40 }, notes: [] };
  if (!P) out.notes.push("Add XAI_API_KEY (Grok) or GROQ_API_KEY in Vercel → Settings → Environment Variables, then redeploy.");
  if (!L.SERVICE) { out.notes.push("Add SUPABASE_SERVICE_ROLE_KEY in Vercel to see counts and keep AI limits accurate across servers."); return L.send(res, 200, out); }
  const H = { apikey: L.SERVICE, Authorization: "Bearer " + L.SERVICE, Prefer: "count=exact", Range: "0-0" };
  const count = async (q) => { try { const r = await fetch(L.SUPABASE_URL + "/rest/v1/" + q, { headers: H }); const cr = r.headers.get("content-range") || ""; const n = +(cr.split("/")[1]); return isNaN(n) ? null : n; } catch (e) { return null; } };
  out.users = await count("profiles?select=id");
  out.docs = { resume: await count("rq_docs?select=id&kind=eq.resume"), analysis: await count("rq_docs?select=id&kind=eq.analysis") };
  try { const r = await fetch(L.SUPABASE_URL + "/rest/v1/rq_usage?select=count&day=eq." + L.istDay(), { headers: { apikey: L.SERVICE, Authorization: "Bearer " + L.SERVICE } }); const a = r.ok ? await r.json() : []; out.aiToday = a.reduce((s, x) => s + (x.count || 0), 0); } catch (e) { out.aiToday = null; }
  try { const r = await fetch(L.SUPABASE_URL + "/rest/v1/profiles?select=email,name,created_at&order=created_at.desc&limit=15", { headers: { apikey: L.SERVICE, Authorization: "Bearer " + L.SERVICE } }); out.recent = r.ok ? await r.json() : []; } catch (e) { out.recent = []; }
  return L.send(res, 200, out);
};
