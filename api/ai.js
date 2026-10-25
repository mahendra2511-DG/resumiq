// Resumiq AI endpoint: one POST /api/ai with a "mode". Provider: xAI Grok (XAI_API_KEY) or Groq (GROQ_API_KEY),
// both OpenAI-compatible. Daily free limits are counted on the server. Dexa never invents facts.
"use strict";
const L = require("./_lib");

const GUEST = +process.env.AI_DAILY_GUEST || 10, USER = +process.env.AI_DAILY_USER || 40, ADMIN = +process.env.AI_DAILY_ADMIN || 500;

/* ---------- provider ---------- */
function provider() {
  if (process.env.AI_BASE_URL && process.env.AI_API_KEY) return { name: "custom", base: process.env.AI_BASE_URL.replace(/\/$/, ""), key: process.env.AI_API_KEY, prefer: [] };
  if (process.env.XAI_API_KEY) return { name: "grok", base: (process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/$/, ""), key: process.env.XAI_API_KEY, prefer: [/^grok-4.*fast.*non-reasoning/i, /^grok-4.*fast/i, /^grok-3-mini$/i, /^grok-3-mini/i, /^grok-4/i, /^grok-3$/i, /^grok/i] };
  if (process.env.GROQ_API_KEY) return { name: "groq", base: (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, ""), key: process.env.GROQ_API_KEY, prefer: [/^llama-3\.3-70b-versatile$/i, /^openai\/gpt-oss-120b$/i, /^meta-llama\/llama-4-maverick/i, /^meta-llama\/llama-4/i, /^llama-3\.1-70b/i, /llama/i, /gpt-oss/i] };
  return null;
}
let modelCache = { at: 0, ids: [] };
async function models(P) {
  if (Date.now() - modelCache.at < 30 * 60e3 && modelCache.ids.length && modelCache.base === P.base) return modelCache.ids;
  try { const r = await fetch(P.base + "/models", { headers: { Authorization: "Bearer " + P.key } }); const j = r.ok ? await r.json() : null; const ids = (j && j.data || []).map(m => m.id).filter(Boolean); modelCache = { at: Date.now(), ids, base: P.base }; return ids; } catch (e) { return []; }
}
async function pickModels(P) {
  const env = process.env.AI_MODEL || (P.name === "grok" ? process.env.XAI_MODEL : P.name === "groq" ? process.env.GROQ_MODEL : "");
  const ids = await models(P); const out = [];
  if (env) out.push(env);
  P.prefer.forEach(re => { const m = ids.find(id => re.test(id) && !/vision|image|audio|whisper|tts|guard|embed/i.test(id)); if (m && !out.includes(m)) out.push(m); });
  if (!out.length) out.push(P.name === "grok" ? "grok-3-mini" : P.name === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini");
  return out.slice(0, 3);
}
async function complete(P, msgs, json, maxTokens) {
  const list = await pickModels(P); let last = "";
  for (const model of list) {
    for (const useFmt of json ? [true, false] : [false]) {
      try {
        const body = { model, messages: msgs, temperature: json ? 0.35 : 0.5, max_tokens: maxTokens || 1100 };
        if (useFmt) body.response_format = { type: "json_object" };
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 40000);
        const r = await fetch(P.base + "/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + P.key, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal }).finally(() => clearTimeout(to));
        const j = await r.json().catch(() => null);
        if (r.ok && j && j.choices && j.choices[0]) { const t = String(j.choices[0].message && j.choices[0].message.content || "").trim(); if (t) return { text: t, model }; }
        last = (j && j.error && (j.error.message || j.error)) || ("HTTP " + r.status);
        if (r.status === 401 || r.status === 403) throw Object.assign(new Error("bad_key"), { fatal: true });
        if (useFmt && r.status === 400) continue; // retry without response_format
        break; // next model
      } catch (e) { if (e.fatal) throw e; last = e.name === "AbortError" ? "timeout" : e.message; break; }
    }
  }
  throw new Error(String(last || "upstream"));
}
function parseJSON(t) {
  t = String(t || "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}"); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  return null;
}

/* ---------- modes ---------- */
const RULES = `You are Dexa, the resume and career coach inside Resumiq (a free tool for job seekers, many in India).
Hard rules:
- Use ONLY facts the user gave you. Never invent employers, job titles, dates, degrees, certifications, tools, metrics or results.
- When a number or detail would help but is not given, write a short placeholder in square brackets, e.g. [X%], [N users], [tool].
- Do not exaggerate seniority or claim skills that are not in the input.
- Plain professional English, Indian context is fine (₹, lakh, crore). No emojis in resume text. No first person ("I", "my") in resume bullets.
- Resume bullets: start with a strong past-tense action verb (present tense only for a current role), 12–28 words, one idea, result-focused.
- Do not include personal details (date of birth, religion, marital status, photo).`;
const s = (x, n) => String(x == null ? "" : x).slice(0, n || 4000);
const arrS = (a, n, len) => (Array.isArray(a) ? a : []).map(x => typeof x === "string" ? x.trim() : "").filter(Boolean).slice(0, n).map(x => x.slice(0, len || 600));
const MODES = {
  chat: { json: false, tokens: 700, build: (b) => [{ role: "system", content: RULES + `\nYou are chatting with a user. Be warm, concrete and brief (under 180 words unless asked). Use short paragraphs or "-" bullets. If the user writes Hinglish, you may reply in simple Hinglish. If you are given their resume, refer to it specifically. Never claim to have applied, emailed or contacted anyone. For anything outside careers, resumes, interviews, jobs or LinkedIn, briefly steer back.` + (b.context ? `\n\nCONTEXT FROM THE PAGE:\n${s(b.context, 6500)}` : "") }, ...(Array.isArray(b.history) ? b.history.slice(-6).map(h => ({ role: h.r === "assistant" ? "assistant" : "user", content: s(h.c, 1200) })) : []), { role: "user", content: s(b.q, 1500) }], out: (t) => ({ text: t.slice(0, 4000) }) },
  rewrite: { json: true, tokens: 700, build: (b) => [{ role: "system", content: RULES + `\nRewrite ONE resume line/paragraph. Action: ${({ improve: "make it stronger and clearer", concise: "make it shorter (under 20 words) without losing the result", impact: "turn it into an accomplishment: action + what + measurable result (use placeholders for unknown numbers)", grammar: "fix grammar, tense and punctuation only; keep wording", role: "tailor wording toward the target role" + (b.jd ? " and this job description" : "") })[b.action] || "improve it"}.
Return JSON: {"options":["...","..."],"note":"one short tip"} with 2-3 options.` }, { role: "user", content: `Target role: ${s(b.role, 80) || "not given"}\nLevel: ${s(b.level, 20)}\nWhere: ${s(b.where, 160)}\n${b.jd ? "Job description (excerpt):\n" + s(b.jd, 3000) + "\n" : ""}TEXT:\n${s(b.text, 1500)}` }], out: (j) => ({ options: arrS(j.options, 3, 700), note: s(j.note, 300) }), need: (j) => arrS(j.options, 3).length },
  bullet: { json: true, tokens: 800, build: (b) => [{ role: "system", content: RULES + `\nTurn the user's rough notes (may be Hinglish) into 3-5 resume bullets for this entry. Keep every fact; translate to English; add [placeholders] where a number would help.
Return JSON: {"bullets":["..."],"note":"what number or detail to add"}.` }, { role: "user", content: `Target role: ${s(b.role, 80)}\nEntry: ${s(b.title, 120)} ${b.org ? "at/with " + s(b.org, 120) : ""}\nNOTES:\n${s(b.notes, 2500)}` }], out: (j) => ({ bullets: arrS(j.bullets, 6, 400), note: s(j.note, 300) }), need: (j) => arrS(j.bullets, 6).length },
  summary: { json: true, tokens: 700, build: (b) => [{ role: "system", content: RULES + `\nWrite 3 different professional summaries (40-60 words each, no "I") for the target role, using only facts from the resume${b.jd ? " and emphasising what this job needs" : ""}. Lead with the role and years/level, top 2-3 relevant skills, one real result.
Return JSON: {"options":["...","...","..."]}.` }, { role: "user", content: `Target role: ${s(b.role, 80)}\nLevel: ${s(b.level, 20)}\n${b.jd ? "JOB:\n" + s(b.jd, 3000) + "\n" : ""}RESUME:\n${s(b.text, 7000)}` }], out: (j) => ({ options: arrS(j.options, 3, 700) }), need: (j) => arrS(j.options, 3).length },
  boost: { json: true, tokens: 1500, build: (b) => [{ role: "system", content: RULES + `\nImprove each weak resume bullet so it scores well with ATS and recruiters: strong past-tense action verb first, what was done, tools used, and a measurable result. Keep every fact; never invent numbers — use [placeholders] where a number is missing. Use keywords for the target role only when the original already implies them. 12-28 words each.
Return JSON: {"items":[{"original":"exact original bullet","proposed":"improved bullet"}]} — one item per bullet, same order.` }, { role: "user", content: `Target role: ${s(b.role, 80)}\nLevel: ${s(b.level, 20)}\nRESUME CONTEXT:\n${s(b.text, 4000)}\n\nBULLETS TO IMPROVE:\n${arrS(b.bullets, 12, 400).map((x, i) => (i + 1) + ". " + x).join("\n")}` }], out: (j) => ({ items: (Array.isArray(j.items) ? j.items : []).slice(0, 12).map(x => ({ original: s(x && x.original, 500), proposed: s(x && x.proposed, 500) })).filter(x => x.original && x.proposed) }), need: (j) => (j.items || []).length },
  review: { json: true, tokens: 900, build: (b) => [{ role: "system", content: RULES + `\nReview this resume like an experienced recruiter for the target role and level. Be specific (quote the part you mean) and practical.
Return JSON: {"verdict":"2 sentences","strengths":["..."],"fixes":[{"issue":"...","fix":"...","section":"summary|experience|projects|skills|education|contact|format"}]} with 2-4 strengths and 4-7 fixes ordered by impact.` }, { role: "user", content: `Target role: ${s(b.role, 80)}\nLevel: ${s(b.level, 20)}\nRESUME:\n${s(b.text, 9000)}` }], out: (j) => ({ verdict: s(j.verdict, 500), strengths: arrS(j.strengths, 5, 300), fixes: (Array.isArray(j.fixes) ? j.fixes : []).slice(0, 8).map(f => ({ issue: s(f && f.issue, 300), fix: s(f && f.fix, 400), section: s(f && f.section, 20) })).filter(f => f.issue) }), need: (j) => j.verdict || (j.fixes || []).length },
  import: { json: true, tokens: 2600, build: (b) => [{ role: "system", content: `Extract this resume text into JSON exactly. Copy facts as written; do not improve, invent or summarise. Leave a field "" if missing. Dates as "YYYY-MM" when possible, end "" and current true for present roles. Exclude personal details (DOB, religion, marital status, father's name, declaration).
Return JSON: {"contact":{"name":"","headline":"","email":"","phone":"","location":"","linkedin":"","portfolio":"","github":""},"summary":"","experience":[{"role":"","company":"","location":"","start":"","end":"","current":false,"bullets":[""]}],"projects":[{"title":"","tools":"","link":"","date":"","bullets":[""]}],"education":[{"degree":"","school":"","start":"","end":"","score":"","location":"","details":""}],"skills":[{"name":"","items":"comma separated"}],"certifications":[{"name":"","issuer":"","date":""}],"achievements":[""],"languages":"","volunteering":[""],"interests":""}` }, { role: "user", content: s(b.text, 14000) }], out: (j) => ({ resume: j && typeof j === "object" ? (j.resume || j) : null }), need: (j) => j && (j.contact || j.experience || j.resume) },
  tailor: { json: true, tokens: 1400, build: (b) => [{ role: "system", content: RULES + `\nTailor the resume toward the job description WITHOUT adding anything the candidate has not done. Reword existing bullets to use the job's language where the experience truly matches; never add a skill that is not already evidenced. Suggest up to 6 bullet rewrites (copy the original bullet exactly) and one new summary.
Return JSON: {"summary":"...","bullets":[{"original":"exact original bullet","proposed":"...","why":"which requirement it supports"}],"note":"honest gaps the candidate should not fake"}` }, { role: "user", content: `Target role: ${s(b.role, 80)}\nUser confirmed they have / partly have: ${arrS(b.missing, 15, 60).join(", ") || "none"}\nJOB DESCRIPTION:\n${s(b.jd, 6000)}\n\nRESUME:\n${s(b.text, 8000)}` }], out: (j) => ({ summary: s(j.summary, 800), bullets: (Array.isArray(j.bullets) ? j.bullets : []).slice(0, 6).map(x => ({ original: s(x && x.original, 600), proposed: s(x && x.proposed, 600), why: s(x && x.why, 200) })).filter(x => x.original && x.proposed), note: s(j.note, 400) }), need: (j) => j.summary || (j.bullets || []).length },
  jd_extract: { json: true, tokens: 900, build: (b) => [{ role: "system", content: `Read this job description and extract requirements. Only list what the text actually asks for.
Return JSON: {"title":"","company":"","seniority":"","years":"","must":["skill or requirement"],"preferred":["..."],"responsibilities":["short"],"soft":["..."],"education":["..."],"certifications":["..."],"summary":"2 sentences: what this job really is"}` }, { role: "user", content: s(b.jd, 9000) }], out: (j) => ({ title: s(j.title, 120), company: s(j.company, 120), seniority: s(j.seniority, 60), years: s(j.years, 60), must: arrS(j.must, 25, 80), preferred: arrS(j.preferred, 20, 80), responsibilities: arrS(j.responsibilities, 10, 200), soft: arrS(j.soft, 10, 60), education: arrS(j.education, 6, 120), certifications: arrS(j.certifications, 8, 100), summary: s(j.summary, 500) }), need: (j) => (j.must || []).length || j.summary },
  cover: { json: true, tokens: 1100, build: (b) => [{ role: "system", content: RULES + `\nWrite a cover letter (${({ short: "120-170", standard: "220-300", detailed: "320-400" })[b.length] || "220-300"} words), tone: ${s(b.tone, 30) || "professional"}. Structure: why this role/company (use only what the job text says about the company), 2 proof points from the resume tied to the job's needs, a confident close. No clichés like "I am writing to express my interest". If the company name is unknown use [Company]. First person is fine here.
Return JSON: {"subject":"email subject line","letter":"full letter with greeting and sign-off using the candidate's name","note":"what to personalise"}` }, { role: "user", content: `Candidate name: ${s(b.name, 80)}\nJob title: ${s(b.title, 120)}\nCompany: ${s(b.company, 120)}\nHiring manager: ${s(b.manager, 80) || "unknown"}\nExtra from user: ${s(b.extra, 600)}\nJOB:\n${s(b.jd, 5000)}\n\nRESUME:\n${s(b.text, 6000)}` }], out: (j) => ({ subject: s(j.subject, 200), letter: s(j.letter, 5000), note: s(j.note, 300) }), need: (j) => j.letter },
  linkedin: { json: true, tokens: 1300, build: (b) => [{ role: "system", content: RULES + `\nOptimise the user's LinkedIn profile for the target role using only their facts. Headline max 220 characters, About 150-260 words in first person (allowed on LinkedIn), skills to pin, and 3 experience-entry rewrites.
Return JSON: {"headlines":["...","...","..."],"about":"...","skills":["top 10"],"experience":[{"role":"","rewrite":"2-3 lines"}],"tips":["profile tips: photo, banner, custom URL, open-to-work, featured section"]}` }, { role: "user", content: `Target role: ${s(b.role, 80)}\nCurrent headline: ${s(b.headline, 300)}\nCurrent About: ${s(b.about, 2000)}\nRESUME:\n${s(b.text, 7000)}` }], out: (j) => ({ headlines: arrS(j.headlines, 3, 240), about: s(j.about, 2600), skills: arrS(j.skills, 12, 60), experience: (Array.isArray(j.experience) ? j.experience : []).slice(0, 4).map(x => ({ role: s(x && x.role, 120), rewrite: s(x && x.rewrite, 600) })), tips: arrS(j.tips, 6, 240) }), need: (j) => (j.headlines || []).length || j.about },
  questions: { json: true, tokens: 1400, build: (b) => [{ role: "system", content: `You are Dexa, an interview coach. Create interview questions for this candidate${b.jd ? " and job" : ""}: mix of ${s(b.kind, 40) || "behavioural, technical and resume-based"} questions, realistic for Indian and global companies at the given level. For each give why it's asked and an answer outline built from the candidate's resume (never invent experience; say "[your example]" if none fits).
Return JSON: {"questions":[{"q":"","type":"behavioural|technical|resume|role","why":"","outline":"3-4 short lines"}]} with 8 questions.` }, { role: "user", content: `Target role: ${s(b.role, 80)}\nLevel: ${s(b.level, 20)}\n${b.jd ? "JOB:\n" + s(b.jd, 4000) + "\n" : ""}RESUME:\n${s(b.text, 6000)}` }], out: (j) => ({ questions: (Array.isArray(j.questions) ? j.questions : []).slice(0, 10).map(x => ({ q: s(x && x.q, 300), type: s(x && x.type, 20), why: s(x && x.why, 300), outline: s(x && x.outline, 700) })).filter(x => x.q) }), need: (j) => (j.questions || []).length },
  answer: { json: true, tokens: 800, build: (b) => [{ role: "system", content: `You are Dexa, an interview coach. Give feedback on the candidate's practice answer using the STAR method (Situation, Task, Action, Result). Be encouraging and concrete.
Return JSON: {"score":1-10,"star":{"situation":true,"task":true,"action":true,"result":true},"good":["..."],"improve":["..."],"better":"a stronger version of THEIR answer, keeping their facts, with [placeholders] for missing numbers"}` }, { role: "user", content: `Question: ${s(b.q, 400)}\nTarget role: ${s(b.role, 80)}\nANSWER:\n${s(b.answer, 3000)}` }], out: (j) => ({ score: Math.max(1, Math.min(10, +j.score || 5)), star: j.star && typeof j.star === "object" ? { situation: !!j.star.situation, task: !!j.star.task, action: !!j.star.action, result: !!j.star.result } : {}, good: arrS(j.good, 4, 300), improve: arrS(j.improve, 5, 300), better: s(j.better, 2000) }), need: (j) => j.better || (j.improve || []).length },
  jobs: { json: true, tokens: 900, build: (b) => [{ role: "system", content: `You are Dexa, a career advisor. Based on the resume, suggest 6 realistic job titles to search for in India (mix of exact-fit and stretch), each with why it fits, 3 search keywords, and the skill gap to close. Do not invent experience.
Return JSON: {"roles":[{"title":"","fit":"strong|good|stretch","why":"","keywords":["",""],"gap":""}]}` }, { role: "user", content: `Preferred location: ${s(b.location, 80) || "India"}\nTarget role (if any): ${s(b.role, 80)}\nRESUME:\n${s(b.text, 6000)}` }], out: (j) => ({ roles: (Array.isArray(j.roles) ? j.roles : []).slice(0, 8).map(x => ({ title: s(x && x.title, 100), fit: s(x && x.fit, 12), why: s(x && x.why, 300), keywords: arrS(x && x.keywords, 4, 40), gap: s(x && x.gap, 200) })).filter(x => x.title) }), need: (j) => (j.roles || []).length },
};

module.exports = async (req, res) => {
  if (!L.originOk(req)) return L.send(res, 403, { ok: false, error: "origin", message: "Requests from this site are not allowed." });
  const P = provider();
  if (req.method === "GET") return L.send(res, 200, { ok: true, provider: P ? P.name : null, limits: { guest: GUEST, user: USER } });
  if (req.method !== "POST") return L.send(res, 405, { ok: false, error: "method", message: "Use POST." });
  const b = await L.body(req); const M = MODES[b.mode];
  if (!M) return L.send(res, 400, { ok: false, error: "bad_request", message: "Unknown AI action." });
  if (!P) return L.send(res, 503, { ok: false, error: "no_key", message: "Dexa AI isn't switched on yet. The site owner needs to add a Grok (XAI_API_KEY) or Groq (GROQ_API_KEY) key in Vercel." });
  const main = b.mode === "chat" ? s(b.q) : b.mode === "boost" ? arrS(b.bullets, 12).join(" ") : b.mode === "bullet" ? s(b.notes) : b.mode === "jd_extract" ? s(b.jd) : b.mode === "answer" ? s(b.answer) : s(b.text);
  if (main.trim().length < (b.mode === "chat" ? 2 : 10)) return L.send(res, 400, { ok: false, error: "bad_request", message: "Please add some text first." });
  const user = await L.userFrom(req);
  const isAdmin = user && user.email === L.ADMIN_EMAIL, limit = isAdmin ? ADMIN : user ? USER : GUEST;
  const key = user ? "u:" + user.id : "g:" + L.hash(L.ipOf(req));
  const n = await L.bump(key, limit, 1);
  if (n < 0) return L.send(res, 429, { ok: false, error: "daily_limit", left: 0, message: user ? `You've used all ${limit} free AI credits for today. They reset at midnight (IST). Everything else in Resumiq still works.` : `You've used ${limit} free AI credits as a guest today. Create a free account for ${USER} credits a day.` });
  try {
    let out = null, tries = 0;
    while (!out && tries < 2) {
      tries++; const r = await complete(P, M.build(b), M.json, M.tokens);
      if (!M.json) out = M.out(r.text);
      else { const j = parseJSON(r.text); if (j && (!M.need || M.need(j))) out = M.out(j); }
    }
    if (!out) throw new Error("bad_output");
    return L.send(res, 200, Object.assign({ ok: true, left: Math.max(0, limit - n) }, out));
  } catch (e) {
    await L.bump(key, limit, -1); // don't charge for failures
    const bad = /bad_key/.test(e.message);
    console.error("[ai]", b.mode, e.message);
    return L.send(res, 502, { ok: false, error: bad ? "no_key" : "upstream", left: Math.max(0, limit - n + 1), message: bad ? "The AI key in Vercel was rejected. The site owner needs to check XAI_API_KEY / GROQ_API_KEY." : e.message === "bad_output" ? "Dexa's answer came back incomplete. Please try again." : "Dexa is busy right now. Please try again in a minute." });
  }
};
module.exports.MODES = MODES; module.exports.provider = provider;
