// Records anonymous usage events (page visits, resume created, downloads…) for the owner's admin panel.
"use strict";
const L = require("./_lib");
const KINDS = new Set(["visit", "resume_create", "download_pdf", "download_docx", "job_match", "signup", "login", "sample_open", "import", "cover_letter", "interview"]);
module.exports = async (req, res) => {
  if (req.method !== "POST" || !L.originOk(req)) { res.statusCode = 204; return res.end(); }
  const b = await L.body(req); const kind = String(b.k || "");
  const vid = /^[a-z0-9]{8,40}$/i.test(String(b.v || "")) ? String(b.v) : null;
  if (!KINDS.has(kind)) { res.statusCode = 204; return res.end(); }
  if ((await L.bump("trk:" + L.hash(L.ipOf(req)), 1500, 1)) < 0) { res.statusCode = 204; return res.end(); }
  const u = await L.userFrom(req);
  let ref = String(b.r || ""); try { if (/^https?:/.test(ref)) ref = new URL(ref).hostname.replace(/^www\./, ""); } catch (e) { ref = ""; }
  if (ref && req.headers.host && ref === String(req.headers.host).replace(/^www\./, "")) ref = "";
  await L.logEvent(req, { kind, page: String(b.p || "").slice(0, 120), ref: ref.slice(0, 80) || null, vid, uid: u ? u.id : null, email: u ? u.email : null, detail: b.d ? String(b.d).slice(0, 120) : null });
  res.statusCode = 204; res.end();
};
