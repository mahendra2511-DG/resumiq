/* Resumiq resume engine: data model, templates (HTML), plain text, quality rules, bullet lint, DOCX export. */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => "s" + Math.random().toString(36).slice(2, 10);
  const lines = (s) => String(s || "").split("\n").map(x => x.replace(/^\s*[-•*–▪]\s*/, "").trim()).filter(Boolean);
  const words = (s) => (String(s || "").trim().match(/\S+/g) || []).length;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtMonth = (v) => { if (!v) return ""; const m = /^(\d{4})-(\d{2})/.exec(v); return m ? `${MON[+m[2] - 1]} ${m[1]}` : v; };
  const span = (a, b, cur) => { const s = fmtMonth(a), e = cur ? "Present" : fmtMonth(b); return s && e ? `${s} – ${e}` : s || e || ""; };

  const SECTIONS = { summary: "Summary", experience: "Experience", projects: "Projects", education: "Education", skills: "Skills", certifications: "Certifications", achievements: "Achievements", publications: "Publications", languages: "Languages", volunteering: "Volunteering", interests: "Interests" };
  const OPTIONAL = ["achievements", "publications", "languages", "volunteering", "interests"];

  function blank(opts) {
    opts = opts || {}; const L = window.RQ_ROLES.LEVELS.find(l => l.id === (opts.level || "student")) || window.RQ_ROLES.LEVELS[0];
    const g = window.RQ_ROLES.guide(opts.targetRole || "");
    return { v: 1, targetRole: opts.targetRole || "", level: L.id, template: opts.template || g.template || "ats", accent: "", density: "normal", bold: true, country: "India",
      contact: { name: "", headline: opts.targetRole || "", email: "", phone: "", location: "", linkedin: "", portfolio: "", github: "" },
      sections: L.order.filter(t => !OPTIONAL.includes(t) || t === "achievements").map(t => ({ id: uid(), type: t, title: SECTIONS[t], hidden: false })),
      summary: "", experience: [], projects: [], education: [], skills: [], certifications: [], achievements: "", publications: "", languages: "", volunteering: "", interests: "" };
  }
  function normalize(r) {
    const b = blank({ targetRole: r && r.targetRole, level: r && r.level });
    const o = Object.assign(b, r || {}); o.contact = Object.assign(b.contact, (r && r.contact) || {});
    ["experience", "projects", "education", "skills", "certifications"].forEach(k => { if (!Array.isArray(o[k])) o[k] = []; o[k].forEach(x => { if (!x.id) x.id = uid(); }); });
    if (!Array.isArray(o.sections) || !o.sections.length) o.sections = b.sections;
    o.sections.forEach(s => { if (!s.id) s.id = uid(); if (!s.title) s.title = SECTIONS[s.type] || s.type; });
    o.template = ({ classic: "ats", minimal: "pro", technical: "ats" })[o.template] || o.template;
    if (!window.RQ_ROLES.TEMPLATES.some(t => t.id === o.template)) o.template = "ats";
    if (!DENSITY.includes(o.density)) o.density = "normal"; if (o.bold == null) o.bold = true;
    return o;
  }

  /* ---------- plain text (for AI, matching, import review) ---------- */
  function text(r, opts) {
    opts = opts || {}; const L = [], c = r.contact || {};
    L.push(c.name, c.headline, [c.email, c.phone, c.location, c.linkedin, c.portfolio, c.github].filter(Boolean).join(" | "));
    r.sections.filter(s => !s.hidden).forEach(s => {
      const body = sectionText(r, s.type); if (!body.trim()) return;
      L.push("", (opts.labels === false ? s.title : s.title.toUpperCase()), body);
    });
    return L.filter(x => x != null).join("\n").replace(/\n{3,}/g, "\n\n").replace(/\*\*([^*]+)\*\*/g, "$1").trim();
  }
  function sectionText(r, t) {
    switch (t) {
      case "summary": return r.summary || "";
      case "experience": return r.experience.map(e => [`${e.role || ""}${e.company ? ", " + e.company : ""}${e.location ? ", " + e.location : ""} (${span(e.start, e.end, e.current)})`, ...lines(e.bullets).map(b => "- " + b)].join("\n")).join("\n");
      case "projects": return r.projects.map(p => [`${p.title || ""}${p.tools ? " | " + p.tools : ""}${p.link ? " | " + p.link : ""}${p.date ? " (" + fmtMonth(p.date) + ")" : ""}`, ...lines(p.bullets).map(b => "- " + b)].join("\n")).join("\n");
      case "education": return r.education.map(e => `${e.degree || ""}${e.school ? ", " + e.school : ""} (${span(e.start, e.end) || e.year || ""})${e.score ? " " + e.score : ""}${e.details ? "\n" + e.details : ""}`).join("\n");
      case "skills": return r.skills.filter(g => g.items).map(g => (g.name ? g.name + ": " : "") + g.items).join("\n");
      case "certifications": return r.certifications.filter(c => c.name).map(c => `${c.name}${c.issuer ? ", " + c.issuer : ""}${c.date ? " (" + fmtMonth(c.date) + ")" : ""}`).join("\n");
      default: return lines(r[t]).map(x => "- " + x).join("\n");
    }
  }
  const allBullets = (r) => [].concat(...r.experience.map(e => lines(e.bullets)), ...r.projects.map(p => lines(p.bullets)));

  /* ---------- HTML document ---------- */
  const clean = (u) => String(u || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  const href = (u) => /^https?:\/\//.test(u) ? u : "https://" + u;
  // emphasis: **bold** typed by the user, plus (optional) auto-bold of numbers and the user's own skills, like recruiter-favourite samples
  const UNIT = "%|\\+|x|k|K|M|L|Cr|lakh|lakhs|crore|crores|hrs?|hours|days|weeks|months|years|users|customers|clients|records|rows|reports|dashboards|KPIs|people|members|stores|branches|regions|requests|projects|SKUs|tickets|accounts|cities|teams";
  const WORDU = UNIT.split("|").slice(8).join("|");
  const NUM_RE = new RegExp("(?:₹\\s?|\\$|Rs\\.?\\s?)?\\d[\\d,.]*(?:%|\\+|(?:x|k|K|M|L|Cr)(?![A-Za-z]))?\\+?(?:\\s(?:lakh|lakhs|crore|crores)(?![A-Za-z]))?(?:\\s(?:" + WORDU + ")(?![A-Za-z]))?", "g");
  function skillTerms(r) {
    if (r.__sk && r.__skSig === JSON.stringify(r.skills)) return r.__sk;
    const t = [...new Set(r.skills.flatMap(g => String(g.items || "").split(",")).map(s => s.trim()).filter(s => s.length >= 2 && s.split(/\s+/).length <= 3 && !/^(and|the|with|data|team|teams|communication)$/i.test(s)))].sort((a, b) => b.length - a.length);
    Object.defineProperty(r, "__sk", { value: t, enumerable: false, configurable: true, writable: true }); Object.defineProperty(r, "__skSig", { value: JSON.stringify(r.skills), enumerable: false, configurable: true, writable: true });
    return t;
  }
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function segs(text, r, auto) {
    const out = []; String(text || "").split(/(\*\*[^*]+\*\*)/).forEach(p => { if (!p) return; if (/^\*\*[^*]+\*\*$/.test(p)) out.push({ t: p.slice(2, -2), b: true }); else out.push({ t: p, b: false }); });
    if (!auto || r.bold === false || out.some(s => s.b)) return out;
    const res = []; let n = 0; const terms = skillTerms(r);
    out.forEach(s => {
      const hits = []; const add = (i, j) => { if (j - i < 2) return; if (!hits.some(h => i < h[1] && j > h[0])) hits.push([i, j]); };
      // skip placeholders
      const blocked = []; s.t.replace(/\[[^\]]+\]/g, (m, i) => { blocked.push([i, i + m.length]); return m; });
      const free = (i, j) => !blocked.some(b => i < b[1] && j > b[0]);
      let m; NUM_RE.lastIndex = 0; while ((m = NUM_RE.exec(s.t))) { const v = m[0].trim(); if (/^\d{4}$/.test(v) || /^\d$/.test(v)) continue; if (free(m.index, m.index + m[0].length)) add(m.index, m.index + m[0].replace(/\s+$/, "").length); }
      terms.forEach(k => { const re = new RegExp("(^|[^A-Za-z0-9+#])(" + reEsc(k) + ")(?=$|[^A-Za-z0-9+#])", "i"); const mm = re.exec(s.t); if (mm) { const i = mm.index + mm[1].length; if (free(i, i + mm[2].length)) add(i, i + mm[2].length); } });
      hits.sort((a, b) => a[0] - b[0]); let last = 0; const keep = hits.slice(0, 4);
      keep.forEach(([i, j]) => { if (i > last) res.push({ t: s.t.slice(last, i), b: false }); res.push({ t: s.t.slice(i, j), b: true }); last = j; n++; });
      if (last < s.t.length) res.push({ t: s.t.slice(last), b: false });
    });
    return res;
  }
  const ph = (s) => esc(s).replace(/\[[^\]]+\]/g, m => `<span class="ph">${m}</span>`);
  const rich = (text, r, auto) => segs(text, r, auto).map(s => s.b ? `<b>${ph(s.t)}</b>` : ph(s.t)).join("");
  const plain = (s) => String(s || "").replace(/\*\*([^*]+)\*\*/g, "$1");
  function html(r, opts) {
    opts = opts || {}; const c = r.contact || {}, out = [];
    const contact = [c.phone, c.email, c.location].filter(Boolean).map(x => `<span>${esc(x)}</span>`).concat([c.linkedin, c.github, c.portfolio].filter(Boolean).map(u => `<span><a href="${esc(href(u))}">${esc(clean(u))}</a></span>`));
    out.push(`<header class="d-top"><h1 class="d-name">${esc(c.name) || '<span class="d-empty">Your Name</span>'}</h1>`);
    if ((c.headline || r.targetRole) && r.showHeadline !== false) out.push(`<div class="d-title">${esc(c.headline || r.targetRole)}</div>`);
    out.push(`<div class="d-contact">${contact.join("") || '<span class="d-empty">phone | email | city | LinkedIn</span>'}</div></header>`);
    const ent = (o) => `<div class="d-ent"><div class="d-r1"><span class="d-l">${o.a}</span>${o.dt ? `<span class="dt">${esc(o.dt)}</span>` : ""}</div>${o.b || o.loc ? `<div class="d-r2"><span class="d-l">${o.b || ""}</span>${o.loc ? `<span>${o.loc}</span>` : ""}</div>` : ""}${o.bl && o.bl.length ? `<ul>${o.bl.map(b => `<li>${rich(b, r, true)}</li>`).join("")}</ul>` : ""}</div>`;
    let any = false;
    r.sections.filter(s => !s.hidden).forEach(s => {
      let body = "";
      if (s.type === "summary" && r.summary.trim()) body = `<p class="d-p">${rich(r.summary, r, false)}</p>`;
      if (s.type === "experience") body = r.experience.filter(e => e.role || e.company || e.bullets).map(e => ent({ a: `<b>${esc(e.company || e.role || "Company")}</b>`, dt: span(e.start, e.end, e.current), b: e.company ? `<i>${esc(e.role || "Job title")}</i>` : "", loc: esc(e.location || ""), bl: lines(e.bullets) })).join("");
      if (s.type === "projects") body = r.projects.filter(p => p.title || p.bullets).map(p => ent({ a: `<b>${esc(p.title || "Project")}</b>${p.link ? ` <span class="d-sep">|</span> <a href="${esc(href(p.link))}">${esc(clean(p.link))}</a>` : ""}${p.tools ? ` <span class="d-sep">|</span> <i class="d-tools">${esc(p.tools)}</i>` : ""}`, dt: fmtMonth(p.date), bl: lines(p.bullets) })).join("");
      if (s.type === "education") body = r.education.filter(e => e.degree || e.school).map(e => ent({ a: `<b>${esc(e.school || e.degree)}</b>`, dt: span(e.start, e.end) || e.year || "", b: e.school ? `<i>${esc(e.degree || "")}</i>` : "", loc: esc([e.score, e.location].filter(Boolean).join(" · ")), bl: lines(e.details) })).join("");
      if (s.type === "skills") body = `<div class="d-sks">${r.skills.filter(g => g.items && g.items.trim()).map(g => `<div class="d-sk">${g.name ? `<b>${esc(g.name)}:</b> ` : ""}${esc(g.items.split(",").map(x => x.trim()).filter(Boolean).join(", "))}</div>`).join("")}</div>`;
      if (s.type === "skills" && !r.skills.some(g => g.items && g.items.trim())) body = "";
      if (s.type === "certifications") body = r.certifications.filter(x => x.name).length ? `<ul class="d-list">${r.certifications.filter(x => x.name).map(x => `<li><span class="d-crow"><span><b>${esc(x.name)}</b>${x.issuer ? ` — ${esc(x.issuer)}` : ""}</span>${x.date ? `<span class="dt">${esc(fmtMonth(x.date))}</span>` : ""}</span></li>`).join("")}</ul>` : "";
      if (["achievements", "publications", "volunteering"].includes(s.type) && lines(r[s.type]).length) body = `<ul class="d-list">${lines(r[s.type]).map(x => `<li>${rich(x, r, true)}</li>`).join("")}</ul>`;
      if (["languages", "interests"].includes(s.type) && String(r[s.type] || "").trim()) body = `<p class="d-p">${esc(r[s.type])}</p>`;
      if (body) { any = true; out.push(`<section class="d-sec" data-sec="${s.id}"><h3>${esc(s.title)}</h3>${body}</section>`); }
    });
    if (!any && !opts.quiet) out.push(`<div class="d-sec"><p class="d-empty">Start filling the editor and your resume appears here.</p></div>`);
    return out.join("");
  }
  const DENSITY = ["normal", "compact", "tight"];
  // mount into a .doc element and draw page-break markers; returns page count
  function mount(el, r, opts) {
    el.className = "doc t-" + (r.template || "ats") + " d-" + (DENSITY.includes(r.density) ? r.density : "normal"); el.style.setProperty("--acc", r.accent || ((window.RQ_ROLES.TEMPLATES.find(t => t.id === r.template) || {}).acc) || "#1F2937");
    el.innerHTML = html(r, opts); el.style.minHeight = "";
    // the printed PDF uses the same width and margins as this preview (see printCSS), so page breaks match
    const H = 1123, cs = getComputedStyle(el), py = parseFloat(cs.paddingTop) || 40, per = H - 2 * py, h = el.scrollHeight;
    const pages = Math.max(1, Math.ceil((h - 2 * py - 2) / per));
    el.style.minHeight = pages * H + "px";
    if (!(opts && opts.nobreaks)) for (let k = 1; k < pages; k++) { const d = document.createElement("div"); d.className = "pb"; d.style.top = (py + k * per) + "px"; d.innerHTML = `<span>Page ${k + 1}</span>`; el.appendChild(d); }
    return pages;
  }
  // @page rule + fixed width so the PDF wraps lines exactly like the on-screen preview
  function printCSS(el) { const cs = getComputedStyle(el), py = parseFloat(cs.paddingTop) || 40, px = parseFloat(cs.paddingLeft) || 48; return `@page{size:A4;margin:${py}px ${px}px}@media print{.print-root .doc{width:${794 - 2 * px}px!important;padding:0!important}}`; }
  // try tighter spacing until the resume fits the target page count; returns the density used (or null)
  function fit(el, r, target) {
    const keep = r.density; for (const d of DENSITY) { r.density = d; if (mount(el, r, { nobreaks: true }) <= target) return d; }
    r.density = keep; return null;
  }

  /* ---------- bullet lint + quality rules ---------- */
  const VERBS = new Set("accelerated achieved administered advised analysed analyzed architected assessed audited automated boosted budgeted built captured championed closed coached collaborated completed conducted consolidated converted coordinated created cut decreased defined delivered deployed designed developed devised directed drafted drove edited eliminated enabled engineered established evaluated executed expanded facilitated forecasted founded generated grew guided handled hired identified implemented improved increased initiated integrated interviewed introduced investigated launched led lowered maintained managed mapped mentored migrated minimised minimized modeled modelled monitored negotiated onboarded optimised optimized orchestrated organised organized oversaw owned partnered performed pioneered planned prepared presented prioritised prioritized processed produced programmed proposed prototyped published raised ran rebuilt recovered recruited redesigned reduced refactored reconciled resolved restructured revamped reviewed saved scaled secured shipped simplified sold solved spearheaded standardised standardized steered streamlined strengthened structured supervised supported surveyed taught tested trained transformed tripled doubled trimmed tuned unified upgraded validated visualised visualized won wrote found discovered answered calculated cleaned segmented parsed indexed estimated containerised containerized added gathered documented fine wired shipped modelled queried scripted extracted merged categorised categorized forecast benchmarked translated localized localised taught onboarded".split(" "));
  const WEAK = ["responsible for", "worked on", "helped with", "helped in", "involved in", "duties included", "tasked with", "assisted in", "participated in", "was part of", "various tasks", "etc", "and so on"];
  const CLICHES = ["team player", "hard working", "hardworking", "hard-working", "go-getter", "self-motivated", "self motivated", "fast learner", "quick learner", "result-oriented", "results-oriented", "result oriented", "dynamic individual", "think outside the box", "synergy", "go getter"];
  const PERSONAL = ["date of birth", "dob", "d.o.b", "marital status", "married", "unmarried", "father's name", "fathers name", "mother's name", "religion", "nationality", "gender", "caste", "passport no", "declaration", "i hereby declare", "references available", "references on request", "reference available"];
  const PASSIVE = /\b(was|were|been|being|is|are|got)\s+(\w+ly\s+)?\w+(ed|en)\b/i;
  const LEVELS_RE = /\b(beginner|intermediate|advanced level|expert level|basic knowledge|proficient)\b|\d+\s*%|★|⭐|\(\s*\d\s*\/\s*\d\s*\)/i;
  const firstWord = (l) => (String(l).replace(/\*\*/g, "").match(/^[A-Za-z]+/) || [""])[0].toLowerCase();
  function lint(l) {
    const out = [], fw = firstWord(l), n = words(l), low = " " + l.toLowerCase() + " ";
    if (!fw) out.push("Start with an action verb");
    else if (/ing$/.test(fw) && !VERBS.has(fw)) out.push(`Use past tense ("${fw}" → "${fw.replace(/ing$/, "ed")}")`);
    else if (!VERBS.has(fw) && !/ed$/.test(fw)) out.push(`Start with a strong verb (Built, Led, Cut…) instead of "${fw}"`);
    const weak = WEAK.find(w => low.includes(" " + w + " ") || low.includes(" " + w + ".") || low.includes(" " + w + ","));
    if (weak) out.push(`Weak phrase "${weak}"`);
    if (/\b(i|my|me)\b/.test(l)) out.push("No first person");
    if (PASSIVE.test(l)) out.push("Use active voice (say what YOU did)");
    if (/\[[^\]]+\]/.test(l)) out.push("Fill the [placeholder] with a real fact");
    else if (!/\d|%|₹|\$|\blakh|\bcrore/i.test(l)) out.push("Add a number if you have one (users, hours, %)");
    if (n > 34) out.push(`Long (${n} words)`); else if (n < 6) out.push("Too short");
    const bz = l.match(/\b(team player|hard[- ]?working|go[- ]getter|self[- ]motivated|results[- ]driven|detail[- ]oriented|synergy|passionate|think outside the box|quick learner|fast learner|dynamic)\b/i); if (bz) out.push(`Cliché "${bz[1]}": show proof instead`);
    return out;
  }
  // ATS score: four categories with fixed, visible weights. Each check says how to fix it; some can be fixed automatically (fix key).
  const STD_HEAD = { summary: ["summary", "professional summary", "profile", "profile summary", "career summary", "objective", "career objective"], experience: ["experience", "work experience", "professional experience", "employment history", "internships", "experience & internships", "work history"], projects: ["projects", "academic projects", "key projects", "personal projects", "projects & case studies"], education: ["education", "academic background", "qualifications"], skills: ["skills", "technical skills", "key skills", "core skills", "skills & tools"], certifications: ["certifications", "certificates", "licenses & certifications", "certifications & courses"], achievements: ["achievements", "awards", "achievements & awards", "competitions/achievements", "accomplishments"], publications: ["publications"], languages: ["languages"], volunteering: ["volunteering", "volunteer experience", "leadership & activities"], interests: ["interests", "hobbies"] };
  const ODD = /[☀-➿\uD83C-\uDBFF←-⇿★☆✓✔✗❖➤►▶◆◇■□●○◉]/;
  function quality(r, pages) {
    const C = [], add = (cat, w, part, t, fix, where, auto) => C.push({ cat, w, part: Math.max(0, Math.min(1, part)), t, fix, where, auto: auto || null });
    const c = r.contact || {}, ft = text(r), low = ft.toLowerCase(), bl = allBullets(r).map(plain), nb = bl.length, L = window.RQ_ROLES.LEVELS.find(l => l.id === r.level) || window.RQ_ROLES.LEVELS[0];
    const has = ft.replace(/\s/g, "").length > 200 && (nb > 0 || words(r.summary) > 10);
    const early = ["student", "switcher"].includes(r.level), main = early ? "projects" : "experience";
    const vis = r.sections.filter(s => !s.hidden);
    // 1) ATS format (25): can software read it?
    add("ATS format", 5, 1, "ATS-safe layout (single column, real text, no tables or images)", "Every Resumiq template is built this way.", null);
    const odd = vis.filter(s => !(STD_HEAD[s.type] || []).includes(s.title.trim().toLowerCase()));
    add("ATS format", 4, odd.length ? 0 : 1, odd.length ? `Non-standard headings: ${odd.map(s => s.title).join(", ")}` : "Standard section headings", "ATS look for familiar names like Experience, Education, Skills.", null, "headings");
    const ex = r.experience.filter(e => e.role || e.company), noDate = ex.filter(e => !e.start).length;
    add("ATS format", 4, ex.length ? 1 - noDate / ex.length : has ? 1 : 0, "Dates on every role (Mon YYYY)", "Add a start and end month for each role.", "experience");
    const ord = ex.map(e => e.current ? "9999-12" : (e.end || e.start || "")).filter(Boolean), sorted = ord.every((v, i) => !i || ord[i - 1] >= v);
    add("ATS format", 3, has && sorted ? 1 : 0, "Most recent role first", "Reverse-chronological order is what ATS and recruiters expect.", "experience", sorted ? null : "order");
    const pers = PERSONAL.filter(p => new RegExp("(^|[^a-z])" + p.replace(/[.*+?^${}()|[\]\\']/g, "\\$&") + "([^a-z]|$)", "i").test(low));
    add("ATS format", 4, pers.length ? 0 : has ? 1 : 0, pers.length ? `Personal details found: ${pers.join(", ")}` : "No personal details (DOB, photo, religion…)", "Remove DOB, marital status, religion, declaration and full address.", "contact", pers.length ? "personal" : null);
    const oddN = bl.filter(l => ODD.test(l)).length + (ODD.test(r.summary) ? 1 : 0);
    const lv = r.skills.filter(g => LEVELS_RE.test(String(g.items || "") + " " + String(g.name || ""))).length;
    add("ATS format", 1, lv ? 0 : has ? 1 : 0, lv ? "Skill levels or ratings in Skills" : "No skill ratings (stars, %, levels)", "Remove levels like “Expert / 80%”: list your strongest skills first instead.", "skills");
    add("ATS format", 1, oddN ? 0 : has ? 1 : 0, oddN ? `${oddN} line(s) with emojis or symbols` : "Plain characters (no emojis or icons)", "Symbols can turn into garbage in an ATS.", null, oddN ? "symbols" : null);
    const lim = L.pages; add("ATS format", 3, !has ? 0 : pages <= lim ? 1 : pages === lim + 1 ? .4 : 0, `Length: ${pages} page${pages > 1 ? "s" : ""} (target ${lim})`, "Use “Fit to page” in the preview, or trim older bullets.", null, pages > lim ? "fit" : null);
    // 2) Keywords (25): does it match the role?
    const g = window.RQ_ROLES.guide(r.targetRole), core = (g.skills || []).slice(0, 12), hit = core.filter(k => window.RQ_JD ? window.RQ_JD.has(ft, k) : low.includes(k.toLowerCase()));
    add("Keywords", 13, core.length ? hit.length / Math.ceil(core.length * .5) : (r.targetRole ? .6 : 0), core.length ? `${g.title} keywords (${hit.length}/${core.length})` : "Target role set", core.length ? `Common for this role: ${core.filter(k => !hit.includes(k)).slice(0, 6).join(", ")}. Add only what you can prove.` : "Choose a target role so checks can be tailored.", "skills");
    const sk = [...new Set(r.skills.flatMap(x => String(x.items || "").split(",").map(v => v.trim()).filter(Boolean)))];
    add("Keywords", 5, sk.length >= 8 ? 1 : sk.length / 8, `Skills section (${sk.length} skills)`, "List 8–30 skills you can discuss, grouped by type.", "skills");
    const evid = bl.concat(r.projects.map(p => p.tools || ""), r.certifications.map(v => v.name || "")).join("\n").toLowerCase();
    const proven = sk.filter(k => evid.includes(k.toLowerCase())).length;
    add("Keywords", 5, sk.length ? proven / Math.max(1, Math.ceil(sk.length * .35)) : 0, `Skills proven in bullets (${proven}/${sk.length})`, "Mention your key tools inside bullets (what you built with them). ATS rank evidence higher.", main);
    add("Keywords", 2, (c.headline || "").trim() ? 1 : 0, "Job title in headline", "Write the exact job title you're applying for under your name.", "contact");
    // 3) Impact (30): will a recruiter be convinced?
    const verbOk = bl.filter(l => { const fw = firstWord(l); return VERBS.has(fw) || (/ed$/.test(fw) && fw.length > 3); }).length;
    const numOk = bl.filter(l => /\d|%|₹|\$/.test(l.replace(/[~₹$]?\[[^\]]*\][%+]?/g, ""))).length, need = early ? .4 : .5;
    add("Impact", 7, nb ? verbOk / nb / .85 : 0, `Action verbs (${verbOk}/${nb})`, "Start bullets with Built, Led, Automated, Reduced…", main, nb && verbOk < nb ? "verbs" : null);
    add("Impact", 9, nb ? numOk / nb / need : 0, `Measurable results (${numOk}/${nb} bullets)`, `Aim for ${Math.round(need * 100)}%+ of bullets with a real number (users, %, hours, ₹).`, main);
    const weakN = bl.filter(l => PASSIVE.test(l) || WEAK.some(w => (" " + l.toLowerCase() + " ").includes(" " + w))).length;
    add("Impact", 3, nb ? 1 - weakN / Math.max(2, nb / 2) : 0, "No weak phrases or passive voice", "Replace “responsible for / worked on / was handled by” with what you did.", main, weakN ? "verbs" : null);
    const lenBad = bl.filter(l => words(l) > 34 || words(l) < 6).length;
    add("Impact", 3, nb ? 1 - lenBad / nb : 0, "Scannable bullets (6–34 words)", "One idea per bullet.", main);
    const phN = (ft.match(/\[[^\]]+\]/g) || []).length, cl = CLICHES.filter(v => low.includes(v));
    add("Impact", 6, phN ? 0 : has ? 1 : 0, phN ? `${phN} placeholder(s) to fill` : "No unfilled placeholders", "Replace each [placeholder] with your real fact, or remove it.", null);
    add("Impact", 2, cl.length ? 0 : has ? 1 : 0, cl.length ? `Clichés: ${cl.slice(0, 3).join(", ")}` : "No clichés", "Show qualities through results instead of claiming them.", "summary");
    // 4) Completeness (20)
    add("Completeness", 3, (c.name || "").trim().split(/\s+/).length >= 2 ? 1 : 0, "Full name", "First and last name.", "contact");
    add("Completeness", 3, /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(c.email || "") ? 1 : 0, "Email", "Use a professional address.", "contact");
    add("Completeness", 2, String(c.phone || "").replace(/\D/g, "").length >= 10 ? 1 : 0, "Phone number", "Add a reachable number.", "contact");
    add("Completeness", 2, /linkedin\.com\/in\//i.test(c.linkedin || "") ? 1 : 0, "LinkedIn URL", "linkedin.com/in/your-name", "contact");
    add("Completeness", 4, words(r.summary) >= 20 && words(r.summary) <= 80 ? 1 : words(r.summary) ? .5 : 0, "Summary (2–3 lines)", "40–60 words: role, strongest skills, one result.", "summary");
    add("Completeness", 3, r.education.some(e => e.degree || e.school) ? 1 : 0, "Education", "Degree, college and years.", "education");
    if (early) { const good = r.projects.filter(p => p.title && lines(p.bullets).length >= 2).length; add("Completeness", 3, good / 2, `Projects with 2+ bullets (${good})`, "2–3 projects with tools, a link and results.", "projects"); }
    else { const top = r.experience[0], n = top ? lines(top.bullets).length : 0; add("Completeness", 3, top && (top.company || top.role) ? Math.min(1, n / 3) : 0, "Latest role: 3+ bullets", "3–5 bullets for your latest job.", "experience"); }
    const dots = bl.filter(l => /\.$/.test(l)).length; if (nb && dots && dots !== nb) add("ATS format", 0, 0, "Mixed punctuation at bullet ends", "End every bullet the same way.", null, "punct");
    const cats = {}; C.forEach(v => { const k = cats[v.cat] || (cats[v.cat] = { w: 0, g: 0 }); k.w += v.w; k.g += v.w * v.part; });
    const total = C.reduce((a, v) => a + v.w, 0), got = C.reduce((a, v) => a + v.w * v.part, 0);
    return { score: Math.round(got / total * 100), cats: Object.entries(cats).filter(([, v]) => v.w).map(([k, v]) => ({ name: k, weight: v.w, pct: Math.round(v.g / v.w * 100) })), checks: C };
  }
  // one-click fixes that change wording only in safe, mechanical ways (never add facts)
  const SWAP = [[/^responsible for (managing|handling|creating|building|preparing|maintaining|developing)\s+/i, (m, v) => ({ managing: "Managed ", handling: "Handled ", creating: "Created ", building: "Built ", preparing: "Prepared ", maintaining: "Maintained ", developing: "Developed " })[v.toLowerCase()]], [/^responsible for\s+/i, "Managed "], [/^worked on\s+/i, "Built "], [/^worked with\s+/i, "Collaborated with "], [/^helped (to |with |in |the )?/i, "Supported "], [/^involved in\s+/i, "Contributed to "], [/^participated in\s+/i, "Contributed to "], [/^assisted (in|with)\s+/i, "Supported "], [/^tasked with\s+/i, "Delivered "], [/^was part of\s+/i, "Contributed to "], [/^duties included\s+/i, "Handled "]];
  const ING = { developing: "Developed", building: "Built", creating: "Created", managing: "Managed", analyzing: "Analyzed", analysing: "Analysed", designing: "Designed", leading: "Led", handling: "Handled", preparing: "Prepared", maintaining: "Maintained", working: "Worked", implementing: "Implemented", conducting: "Conducted", coordinating: "Coordinated", writing: "Wrote", running: "Ran", making: "Made", using: "Used", performing: "Performed", monitoring: "Monitored", supporting: "Supported", generating: "Generated", automating: "Automated", reducing: "Reduced", improving: "Improved", collaborating: "Collaborated", training: "Trained", testing: "Tested" };
  function fixLine(l) {
    let t = l.replace(/^\s*[-•*–▪]\s*/, "").trim(); if (!t) return l;
    for (const [re, to] of SWAP) { if (re.test(t)) { t = t.replace(re, to); break; } }
    const fw = (t.match(/^[A-Za-z]+/) || [""])[0]; if (ING[fw.toLowerCase()]) t = ING[fw.toLowerCase()] + t.slice(fw.length);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const mapBullets = (r, f) => { ["experience", "projects"].forEach(k => r[k].forEach(e => { e.bullets = String(e.bullets || "").split("\n").map(x => x.trim() ? f(x) : x).join("\n"); })); };
  function autofix(r, key) {
    if (key === "headings") r.sections.forEach(s => { if (STD_HEAD[s.type] && !STD_HEAD[s.type].includes(s.title.trim().toLowerCase())) s.title = SECTIONS[s.type]; });
    if (key === "order") { const k = (e) => e.current ? "9999-12" : (e.end || e.start || ""); r.experience.sort((a, b) => String(k(b)).localeCompare(String(k(a)))); }
    if (key === "verbs") mapBullets(r, fixLine);
    if (key === "punct") mapBullets(r, x => x.replace(/\.\s*$/, ""));
    if (key === "symbols") { mapBullets(r, x => x.replace(new RegExp(ODD.source, "g"), "").replace(/\s{2,}/g, " ").trim()); r.summary = r.summary.replace(new RegExp(ODD.source, "g"), "").trim(); }
    if (key === "personal") { const re = new RegExp("^.*(" + PERSONAL.map(p => p.replace(/[.*+?^${}()|[\]\\']/g, "\\$&")).join("|") + ").*$", "gim"); ["summary", "achievements", "interests", "languages", "volunteering"].forEach(k => { r[k] = String(r[k] || "").replace(re, "").replace(/\n{2,}/g, "\n").trim(); }); }
    return r;
  }

  /* ---------- DOCX export (WordprocessingML via JSZip), same structure as the on-screen templates ---------- */
  const x = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const SERIF = ["ats", "classic", "executive"];
  async function docx(r) {
    if (!window.JSZip) throw new Error("Export library not loaded. Check your internet and reload.");
    const c = r.contact || {}, tpl = r.template || "ats", accent = String(r.accent || ((window.RQ_ROLES.TEMPLATES.find(t => t.id === r.template) || {}).acc) || "#1F2937").replace("#", "").toUpperCase();
    const font = SERIF.includes(tpl) ? "Georgia" : "Calibri", centered = ["ats", "pro", "accent", "executive"].includes(tpl);
    const headColor = ["accent", "modern", "technical"].includes(tpl) ? accent : "111827", dens = r.density === "tight" ? -2 : r.density === "compact" ? -1 : 0, S = (n) => Math.max(16, n + dens * 1);
    const run = (t, o) => { o = o || {}; return `<w:r><w:rPr>${o.b ? "<w:b/>" : ""}${o.i ? "<w:i/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ""}${o.caps ? "<w:smallCaps/>" : ""}</w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`; };
    const richRuns = (t, sz, auto) => segs(t, r, auto).map(sg => run(sg.t, { b: sg.b, sz })).join("");
    const p = (runs, o) => { o = o || {}; return `<w:p><w:pPr>${o.num ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ""}${o.tab ? '<w:tabs><w:tab w:val="right" w:pos="10204"/></w:tabs>' : ""}${o.border ? `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="${o.border}"/></w:pBdr>` : ""}<w:spacing w:before="${o.before || 0}" w:after="${o.after == null ? 20 : o.after}"/>${o.center ? '<w:jc w:val="center"/>' : ""}</w:pPr>${runs}</w:p>`; };
    const out = [];
    out.push(p(run(c.name || "Your Name", { b: tpl !== "pro", sz: 44 }), { after: 20, center: centered }));
    if ((c.headline || r.targetRole) && r.showHeadline !== false) out.push(p(run(c.headline || r.targetRole, { sz: S(22), color: ["accent", "modern"].includes(tpl) ? accent : "374151", b: true }), { after: 20, center: centered }));
    out.push(p(run([c.phone, c.email, c.location, clean(c.linkedin), clean(c.github), clean(c.portfolio)].filter(Boolean).join("  |  "), { sz: S(19) }), { after: 60, center: centered }));
    const H = (t) => out.push(p(run(t, { b: true, caps: tpl === "ats", sz: S(tpl === "ats" ? 25 : 22), color: headColor }), { before: 140, after: 50, border: tpl === "accent" ? accent : "111827" }));
    const E = (o) => { out.push(p(run(o.a, { b: true, sz: S(21) }) + (o.tools ? run("  |  " + o.tools, { i: true, sz: S(19) }) : "") + (o.dt ? `<w:r><w:tab/></w:r>` + run(o.dt, { b: true, sz: S(20) }) : ""), { tab: true, after: 0, before: 60 }));
      if (o.b || o.loc) out.push(p(run(o.b || "", { i: true, sz: S(20) }) + (o.loc ? `<w:r><w:tab/></w:r>` + run(o.loc, { i: true, sz: S(20) }) : ""), { tab: true, after: 10 }));
      (o.bl || []).forEach(b => out.push(p(richRuns(b, S(20), true), { num: true, after: 10 }))); };
    r.sections.filter(s => !s.hidden).forEach(s => {
      const t = s.type;
      if (t === "summary" && r.summary.trim()) { H(s.title); out.push(p(richRuns(r.summary, S(20), false))); }
      if (t === "experience" && r.experience.some(e => e.role || e.company)) { H(s.title); r.experience.filter(e => e.role || e.company).forEach(e => E({ a: e.company || e.role, dt: span(e.start, e.end, e.current), b: e.company ? e.role : "", loc: e.location, bl: lines(e.bullets) })); }
      if (t === "projects" && r.projects.some(pr => pr.title)) { H(s.title); r.projects.filter(pr => pr.title).forEach(pr => E({ a: pr.title + (pr.link ? "  |  " + clean(pr.link) : ""), tools: pr.tools, dt: fmtMonth(pr.date), bl: lines(pr.bullets) })); }
      if (t === "education" && r.education.some(e => e.degree || e.school)) { H(s.title); r.education.filter(e => e.degree || e.school).forEach(e => E({ a: e.school || e.degree, dt: span(e.start, e.end) || e.year || "", b: e.school ? e.degree : "", loc: [e.score, e.location].filter(Boolean).join(" · "), bl: lines(e.details) })); }
      if (t === "skills" && r.skills.some(g => g.items)) { H(s.title); r.skills.filter(g => g.items).forEach(g => out.push(p((g.name ? run(g.name + ": ", { b: true, sz: S(20) }) : "") + run(g.items.split(",").map(v => v.trim()).filter(Boolean).join(", "), { sz: S(20) }), { after: 10 }))); }
      if (t === "certifications" && r.certifications.some(v => v.name)) { H(s.title); r.certifications.filter(v => v.name).forEach(v => out.push(p(run(v.name, { b: true, sz: S(20) }) + run(`${v.issuer ? " — " + v.issuer : ""}`, { sz: S(20) }) + (v.date ? `<w:r><w:tab/></w:r>` + run(fmtMonth(v.date), { sz: S(20) }) : ""), { num: true, tab: true, after: 10 }))); }
      if (["achievements", "publications", "volunteering"].includes(t) && lines(r[t]).length) { H(s.title); lines(r[t]).forEach(v => out.push(p(richRuns(v, S(20), true), { num: true, after: 10 }))); }
      if (["languages", "interests"].includes(t) && String(r[t] || "").trim()) { H(s.title); out.push(p(run(r[t], { sz: S(20) }))); }
    });
    const body = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${out.join("")}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="680" w:right="851" w:bottom="680" w:left="851" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="20"/><w:color w:val="111827"/><w:lang w:val="en-IN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="20" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
    const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="400" w:hanging="220"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;
    const z = new JSZip();
    z.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
    z.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
    z.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`);
    z.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x((c.name || "Resume") + " - " + (c.headline || r.targetRole || "Resume"))}</dc:title><dc:creator>${x(c.name || "")}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`);
    z.file("word/document.xml", body); z.file("word/styles.xml", styles); z.file("word/numbering.xml", numbering);
    return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }
  function fileName(r, ext) { const c = r.contact || {}; return `${(c.name || "Resume").trim()} - ${(c.headline || r.targetRole || "Resume").trim()}`.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ") + "." + ext; }

  /* ---------- sample resume for template previews ---------- */
  function sample(role) {
    if (!role || /^data analyst$/i.test(role)) {
      const r = blank({ targetRole: "Data Analyst", level: "early", template: "modern" });
      r.contact = { name: "Aarav Mehta", headline: "Data Analyst", email: "aarav.mehta@email.com", phone: "+91 98765 43210", location: "Pune, India", linkedin: "linkedin.com/in/aaravmehta", portfolio: "aaravmehta.github.io", github: "" };
      r.summary = "Data Analyst with 2 years in SQL, Excel and Power BI for retail and e-commerce. Built 9 dashboards used by regional sales teams and automated weekly reporting, saving 6 hours a week.";
      r.experience = [
        { id: uid(), role: "Data Analyst", company: "Example Retail Pvt Ltd", location: "Pune", start: "2023-07", end: "", current: true, bullets: "Built a Power BI sales dashboard for 14 regional managers, replacing 5 manual Excel reports\nWrote SQL on 2.3M order rows to find a 9% repeat-purchase drop in two regions, leading to a targeted coupon campaign\nAutomated the weekly KPI pack with Power Query, cutting preparation time from 7 hours to 1" },
        { id: uid(), role: "Data Analyst Intern", company: "Sample Startup", location: "Remote", start: "2023-01", end: "2023-06", current: false, bullets: "Cleaned and reconciled 4 customer data sources, reducing duplicate records by 31%\nDefined 8 KPIs with the marketing team so every report used one definition" }];
      r.projects = [{ id: uid(), title: "E-commerce Churn Analysis", tools: "Python, Pandas, Power BI", link: "github.com/aaravmehta/churn", date: "2023-03", bullets: "Analysed 50K customers and found 3 behaviours linked to churn; presented a one-page recommendation" }];
      r.education = [{ id: uid(), degree: "B.Com (Honours)", school: "Example University", start: "2019-08", end: "2022-05", score: "CGPA 8.1", location: "", details: "" }];
      r.skills = [{ id: uid(), name: "Analysis", items: "SQL, Excel, Python, Pandas, Statistics" }, { id: uid(), name: "BI & reporting", items: "Power BI, DAX, Power Query, Tableau, Dashboard design" }, { id: uid(), name: "Working style", items: "Stakeholder communication, Storytelling with data" }];
      r.certifications = [{ id: uid(), name: "Microsoft Power BI Data Analyst (PL-300)", issuer: "Microsoft", date: "2024-02", link: "" }];
      return r;
    }
    const g = window.RQ_ROLES.guide(role);
    const r = blank({ targetRole: g.title, level: "early", template: g.template });
    r.contact = { name: "Aarav Mehta", headline: g.title, email: "aarav.mehta@email.com", phone: "+91 98765 43210", location: "Pune, India", linkedin: "linkedin.com/in/aaravmehta", portfolio: "", github: "" };
    r.summary = g.summary.replace(/\[[^\]]+\]/g, m => ({ "[X years / a portfolio of N projects]": "2 years", "[X years]": "2 years" }[m] || m));
    r.experience = [{ id: uid(), role: g.title, company: "Example Company Pvt Ltd", location: "Pune", start: "2023-07", end: "", current: true, bullets: g.patterns.slice(0, 3).join("\n") },
      { id: uid(), role: g.title + " Intern", company: "Sample Startup", location: "Remote", start: "2023-01", end: "2023-06", current: false, bullets: g.patterns[3] || g.patterns[0] }];
    r.projects = g.projects.slice(0, 1).map(t => ({ id: uid(), title: t.split(/ with |:|\(|,/)[0], tools: g.skills.slice(0, 3).join(", "), link: "github.com/aaravmehta/project", date: "2023-03", bullets: g.patterns[1] }));
    r.education = [{ id: uid(), degree: "B.Tech, Computer Science", school: "Example Institute of Technology", start: "2019-08", end: "2023-05", score: "CGPA 8.4", location: "", details: "" }];
    r.skills = [{ id: uid(), name: "Core", items: g.skills.slice(0, 6).join(", ") }, { id: uid(), name: "Also", items: g.skills.slice(6, 10).concat(g.soft.slice(0, 2)).join(", ") }];
    r.certifications = [{ id: uid(), name: "Relevant certification", issuer: "Issuer", date: "2024-02", link: "" }];
    const fill = (s) => String(s || "").replace(/\[([^\]]+)\]/g, (m, t) => { t = t.replace(/^.*e\.g\.\s*/, "").split(" / ")[0].trim(); if (/^(N|X)$/.test(t)) return "12"; if (/^X%$/.test(t)) return "18%"; if (/^₹/.test(t)) return "₹4 lakh"; return t.replace(/\bX%/g, "18%").replace(/\bN\b/g, "12").replace(/\bX\b/g, "3").replace(/\bY%/g, "34%").replace(/\bY\b/g, "5"); });
    r.summary = fill(r.summary); r.experience.forEach(e => e.bullets = fill(e.bullets)); r.projects.forEach(p => { p.bullets = fill(p.bullets); p.title = fill(p.title); });
    return r;
  }

  window.RQ_RESUME = { SECTIONS, OPTIONAL, DENSITY, blank, normalize, text, html, mount, fit, printCSS, lint, quality, autofix, fixLine, segs, plain, docx, fileName, sample, lines, words, fmtMonth, span, allBullets, uid };
})();
