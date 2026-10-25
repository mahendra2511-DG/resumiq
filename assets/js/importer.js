/* Resumiq importer: read PDF / DOCX / TXT in the browser, then turn the text into a structured resume
   (Dexa AI when available, with a rule-based fallback). Nothing is invented: unknown fields stay empty. */
(function () {
  "use strict";
  const load = (src) => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load the file reader. Check your internet.")); document.head.appendChild(s); });
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", PDFW = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js", MAMMOTH = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
  async function readFile(file) {
    if (!file) throw new Error("Choose a file first.");
    if (file.size > 8 * 1024 * 1024) throw new Error("That file is larger than 8 MB. Try a smaller PDF or paste the text.");
    const name = file.name.toLowerCase();
    if (/\.pdf$/.test(name) || file.type === "application/pdf") {
      await load(PDFJS); const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = PDFW;
      const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise; const out = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 6); i++) {
        const pg = await pdf.getPage(i), tc = await pg.getTextContent(); let lastY = null, line = [];
        tc.items.forEach(it => { const y = Math.round(it.transform[5]); if (lastY != null && Math.abs(y - lastY) > 3) { out.push(line.join("").trim()); line = []; } line.push(it.str + (it.hasEOL ? "" : "")); lastY = y; if (it.hasEOL) { out.push(line.join("").trim()); line = []; lastY = null; } });
        if (line.length) out.push(line.join("").trim()); out.push("");
      }
      const t = out.join("\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      if (t.replace(/\s/g, "").length < 80) throw new Error("This PDF has almost no selectable text (it may be a scanned image). Paste the text instead.");
      return t;
    }
    if (/\.docx$/.test(name)) { await load(MAMMOTH); const r = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() }); return r.value.replace(/\n{3,}/g, "\n\n").trim(); }
    if (/\.doc$/.test(name)) throw new Error("Old .doc files can't be read in the browser. Save it as .docx or PDF, or paste the text.");
    if (/\.(txt|md|rtf)$/.test(name) || /^text\//.test(file.type)) return (await file.text()).trim();
    throw new Error("Use a PDF, DOCX or TXT file.");
  }

  const HEAD = { summary: /^(summary|profile|professional summary|career objective|objective|about me|career summary|profile summary)$/i, experience: /^(experience|work experience|professional experience|employment|employment history|work history|internships?|experience & internships)$/i, projects: /^(projects|academic projects|key projects|personal projects)$/i, education: /^(education|academic|academics|qualifications|educational qualifications|academic qualifications)$/i, skills: /^(skills|technical skills|key skills|core skills|core competencies|skills & tools|tools|technologies)$/i, certifications: /^(certifications?|certificates|courses|licenses)$/i, achievements: /^(achievements|awards|accomplishments|honors|honours)$/i, languages: /^(languages)$/i, volunteering: /^(volunteering|volunteer experience|extra[- ]curricular|activities)$/i, interests: /^(interests|hobbies)$/i, personal: /^(personal details|personal information|declaration)$/i };
  function heuristic(text) {
    const RS = window.RQ_RESUME, r = RS.blank({ level: "early" }), L = text.split("\n").map(s => s.trim());
    const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/), phone = text.match(/(\+?\d[\d\s-]{8,14}\d)/), li = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+/i), gh = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[\w-]+/i);
    r.contact.email = email ? email[0] : ""; r.contact.phone = phone ? phone[1].trim() : ""; r.contact.linkedin = li ? li[0] : ""; r.contact.github = gh ? gh[0] : "";
    const first = L.find(l => l && !/@|\d{5}|linkedin|http/i.test(l) && l.split(/\s+/).length <= 5); r.contact.name = first || "";
    let cur = null; const buckets = {};
    L.forEach(l => { const h = l.replace(/[:|•\-–]+$/, "").trim(); const k = l.length < 40 && Object.keys(HEAD).find(k => HEAD[k].test(h)); if (k) { cur = k; buckets[k] = buckets[k] || []; return; } if (cur && l) buckets[cur].push(l); });
    if (buckets.summary) r.summary = buckets.summary.join(" ");
    if (buckets.skills) r.skills = [{ id: RS.uid(), name: "Skills", items: buckets.skills.join(", ").replace(/^[^:]*:\s*/gm, "").replace(/\s*[|•·]\s*/g, ", ").replace(/,\s*,/g, ",") }];
    ["experience", "projects"].forEach(k => { if (buckets[k] && buckets[k].length) r[k] = [{ id: RS.uid(), role: "", title: "", company: "", bullets: buckets[k].join("\n"), start: "", end: "", current: false, needsReview: true }]; });
    if (buckets.education) r.education = [{ id: RS.uid(), degree: buckets.education[0] || "", school: buckets.education[1] || "", details: buckets.education.slice(2).join("\n"), start: "", end: "" }];
    if (buckets.certifications) r.certifications = buckets.certifications.map(c => ({ id: RS.uid(), name: c.replace(/^[-•*]\s*/, ""), issuer: "", date: "" }));
    ["achievements", "volunteering"].forEach(k => { if (buckets[k]) r[k] = buckets[k].join("\n"); }); ["languages", "interests"].forEach(k => { if (buckets[k]) r[k] = buckets[k].join(", "); });
    r.importNote = "Parsed without AI. Please check every section: job titles, companies and dates may need to be filled in.";
    return r;
  }
  const ym = (v) => { if (!v) return ""; v = String(v).trim(); if (/present|current|now/i.test(v)) return ""; let m = /^(\d{4})-(\d{1,2})/.exec(v); if (m) return `${m[1]}-${m[2].padStart(2, "0")}`; const MON = "jan feb mar apr may jun jul aug sep oct nov dec".split(" "); m = /([A-Za-z]{3})[a-z]*\.?\s*(\d{4})/.exec(v); if (m && MON.includes(m[1].toLowerCase())) return `${m[2]}-${String(MON.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}`; m = /(\d{4})/.exec(v); return m ? m[1] + "-01" : ""; };
  function fromAI(j) {
    const RS = window.RQ_RESUME, r = RS.blank({ level: j.level || "early", targetRole: j.targetRole || "" }), s = (x) => String(x == null ? "" : x).trim(), arr = (x) => Array.isArray(x) ? x : [];
    const c = j.contact || {}; Object.keys(r.contact).forEach(k => { r.contact[k] = s(c[k]); });
    r.summary = s(j.summary);
    const bl = (b) => Array.isArray(b) ? b.map(s).filter(Boolean).join("\n") : s(b);
    r.experience = arr(j.experience).map(e => ({ id: RS.uid(), role: s(e.role || e.title), company: s(e.company), location: s(e.location), start: ym(e.start), end: ym(e.end), current: !!e.current || /present|current/i.test(s(e.end)), bullets: bl(e.bullets) }));
    r.projects = arr(j.projects).map(p => ({ id: RS.uid(), title: s(p.title || p.name), tools: Array.isArray(p.tools) ? p.tools.join(", ") : s(p.tools), link: s(p.link), date: ym(p.date), bullets: bl(p.bullets) }));
    r.education = arr(j.education).map(e => ({ id: RS.uid(), degree: s(e.degree), school: s(e.school || e.institution), start: ym(e.start), end: ym(e.end), year: s(e.year), score: s(e.score || e.grade), location: s(e.location), details: bl(e.details) }));
    r.skills = arr(j.skills).map(g => typeof g === "string" ? { id: RS.uid(), name: "", items: g } : { id: RS.uid(), name: s(g.name || g.group), items: Array.isArray(g.items) ? g.items.join(", ") : s(g.items) }).filter(g => g.items);
    r.certifications = arr(j.certifications).map(x => typeof x === "string" ? { id: RS.uid(), name: x, issuer: "", date: "" } : { id: RS.uid(), name: s(x.name), issuer: s(x.issuer), date: ym(x.date) }).filter(x => x.name);
    ["achievements", "publications", "volunteering"].forEach(k => { r[k] = bl(j[k]); }); ["languages", "interests"].forEach(k => { r[k] = Array.isArray(j[k]) ? j[k].join(", ") : s(j[k]); });
    return r;
  }
  async function parse(text) {
    text = String(text || "").trim(); if (text.length < 80) throw new Error("That text is too short to be a resume.");
    let why = "";
    try { const j = await window.RQ.ai("import", { text: text.slice(0, 14000) }); if (j && j.resume) return { resume: fromAI(j.resume), ai: true }; } catch (e) { why = e.message; }
    return { resume: heuristic(text), ai: false, why };
  }
  window.RQ_IMPORT = { readFile, parse, heuristic, fromAI };
})();
