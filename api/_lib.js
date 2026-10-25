// Shared server helpers for Resumiq API functions (Vercel Node runtime).
// Secrets come only from environment variables. Nothing secret is stored in this repository.
"use strict";
const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://huskawxfnbsriulcrvsx.supabase.co";
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1c2thd3hmbmJzcml1bGNydnN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NjA0MTcsImV4cCI6MjA5NTUzNjQxN30.mj8IyY7Rcfh8V7mhEtbVXMrpxHzIIAr-OLOIMHKd5TQ";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "mahendraa1188@gmail.com").toLowerCase();

function send(res, code, obj) { res.statusCode = code; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(obj)); }
async function body(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return new Promise((resolve) => { let d = ""; req.on("data", c => { d += c; if (d.length > 200000) { d = ""; req.destroy(); } }); req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch (e) { resolve({}); } }); req.on("error", () => resolve({})); });
}
// Only accept browser calls from our own site (plus optional ALLOWED_ORIGINS, comma separated)
function originOk(req) {
  const o = req.headers.origin; if (!o) return true; // same-origin GETs / server tools
  let host; try { host = new URL(o).host; } catch (e) { return false; }
  if (host === req.headers.host || host === req.headers["x-forwarded-host"]) return true;
  const extra = String(process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  return extra.some(e => { try { return new URL(e).host === host; } catch (x) { return e === host; } }) || /^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/.test(host);
}
const ipOf = (req) => String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "0").split(",")[0].trim();
const hash = (s) => crypto.createHash("sha256").update(String(process.env.RQ_SALT || "resumiq") + "|" + s).digest("hex").slice(0, 32);
const istDay = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

// Verify a Supabase access token by asking Supabase who it belongs to (cached for 5 minutes)
const tokCache = new Map();
async function userFrom(req) {
  const a = String(req.headers.authorization || ""); const m = /^Bearer\s+(.+)$/i.exec(a); if (!m) return null;
  const t = m[1].trim(); if (t.length < 20) return null; const c = tokCache.get(t);
  if (c && c.exp > Date.now()) return c.user;
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", { headers: { apikey: SUPABASE_ANON, Authorization: "Bearer " + t } });
    const u = r.ok ? await r.json() : null; const user = u && u.id ? { id: u.id, email: String(u.email || "").toLowerCase() } : null;
    tokCache.set(t, { user, exp: Date.now() + 5 * 60e3 }); if (tokCache.size > 2000) tokCache.delete(tokCache.keys().next().value);
    return user;
  } catch (e) { return null; }
}

// Daily usage counter: Supabase (service role) → Upstash Redis REST → in-memory fallback
const mem = new Map();
async function bump(key, limit, delta) {
  delta = delta || 1; const day = istDay();
  if (SERVICE) {
    try {
      const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/rq_bump_usage", { method: "POST", headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json" }, body: JSON.stringify({ p_key: key, p_day: day, p_delta: delta, p_limit: limit }) });
      if (r.ok) { const n = await r.json(); if (typeof n === "number") return n; }
    } catch (e) {}
  }
  const U = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL, T = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (U && T) {
    try {
      const k = `rq:use:${day}:${key}`;
      const r = await fetch(U.replace(/\/$/, "") + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + T, "Content-Type": "application/json" }, body: JSON.stringify([["INCRBY", k, String(delta)], ["EXPIRE", k, "172800"]]) });
      if (r.ok) { const j = await r.json(); const n = j && j[0] && j[0].result; if (typeof n === "number") { if (delta > 0 && n > limit) { await fetch(U.replace(/\/$/, "") + "/pipeline", { method: "POST", headers: { Authorization: "Bearer " + T, "Content-Type": "application/json" }, body: JSON.stringify([["DECRBY", k, String(delta)]]) }); return -1; } return n; } }
    } catch (e) {}
  }
  const k = day + "|" + key; const n = (mem.get(k) || 0) + delta;
  if (delta > 0 && n > limit) return -1;
  mem.set(k, Math.max(0, n)); if (mem.size > 20000) mem.clear(); return Math.max(0, n);
}
async function usage(key) { return bump(key, 1e9, 0); }

module.exports = { SUPABASE_URL, SUPABASE_ANON, SERVICE, ADMIN_EMAIL, send, body, originOk, ipOf, hash, istDay, userFrom, bump, usage };
