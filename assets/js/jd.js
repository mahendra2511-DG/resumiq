/* Resumiq job-description engine: extract requirements from a JD, find evidence in a resume, score with explained weights.
   Rule-based and private (runs in the browser). Dexa AI can add a deeper read on top. */
(function () {
  "use strict";
  const EXTRA = ["Excel", "Advanced Excel", "Google Sheets", "PowerPoint", "MS Office", "Word", "Jira", "Confluence", "Git", "GitHub", "GitLab", "AWS", "Azure", "GCP", "Google Cloud", "Snowflake", "BigQuery", "Redshift", "Databricks", "Looker", "Looker Studio", "Qlik", "QlikView", "Alteryx", "SAS", "SPSS", "R", "MATLAB", "Hadoop", "Hive", "NoSQL", "MongoDB", "PostgreSQL", "MySQL", "Oracle", "SQL Server", "SSRS", "SSAS", "ETL", "ELT", "API", "REST", "GraphQL", "Linux", "Shell Scripting", "Bash", "C", "C++", "C#", ".NET", "Java", "Go", "Rust", "Scala", "Kotlin", "Swift", "PHP", "Ruby", "TypeScript", "Angular", "Vue", "Next.js", "Django", "Flask", "Spring", "NumPy", "Matplotlib", "Seaborn", "Plotly", "Statistics", "Probability", "Hypothesis Testing", "Regression", "Forecasting", "Time Series", "Deep Learning", "NLP", "Computer Vision", "Generative AI", "OpenAI", "Hugging Face", "Transformers", "LLMs", "Agile", "Scrum", "Kanban", "Waterfall", "SDLC", "Six Sigma", "Lean", "SAP", "Salesforce", "HubSpot", "Zoho", "Tally", "QuickBooks", "Workday", "ServiceNow", "Zendesk", "Figma", "Canva", "Photoshop", "Illustrator", "Data Analysis", "Data Visualization", "Data Modeling", "Data Mining", "Data Warehousing", "Business Intelligence", "Dashboards", "Reporting", "KPIs", "Excel Macros", "VBA", "Pivot Tables", "VLOOKUP", "XLOOKUP", "Power Automate", "Power Apps", "Microsoft Fabric", "Azure Data Factory", "SSIS", "Informatica", "Talend", "Kafka", "Spark", "Airflow", "dbt", "Docker", "Kubernetes", "Terraform", "CI/CD", "Jenkins", "Unit Testing", "Microservices", "System Design", "Customer Service", "Sales", "Negotiation", "Presentation Skills", "Written Communication", "Verbal Communication", "English", "Hindi", "Problem-Solving", "Analytical Thinking", "Stakeholder Management", "Project Management", "Product Management", "Market Research", "Financial Analysis", "Budgeting", "Accounting", "GST", "Compliance", "Risk Management", "Recruitment", "Payroll", "Onboarding", "Content Writing", "SEO", "Google Analytics", "Google Ads", "Social Media Marketing", "Email Marketing", "CRM", "ERP"];
  const CERTS = ["PMP", "PRINCE2", "CAPM", "CSM", "PSM", "SAFe", "PL-300", "DA-100", "AZ-900", "DP-900", "DP-203", "AWS Certified", "Google Data Analytics", "Tableau Desktop Specialist", "CFA", "FRM", "CA", "CPA", "ACCA", "CMA", "CISSP", "CEH", "CompTIA Security+", "ITIL", "Six Sigma Green Belt", "Six Sigma Black Belt", "ISTQB", "SHRM", "NISM", "Scrum Master"];
  const EDU = ["Bachelor's degree", "Bachelor", "Master's degree", "Master", "B.Tech", "B.E.", "BE", "BSc", "B.Sc", "B.Com", "BCA", "BBA", "MBA", "M.Tech", "MSc", "M.Sc", "MCA", "PhD", "Computer Science", "Information Technology", "Engineering", "Statistics", "Mathematics", "Economics", "Finance", "Commerce", "Business Administration"];
  const SYN = { "powerbi": "Power BI", "power-bi": "Power BI", "ms excel": "Excel", "microsoft excel": "Excel", "javascript": "JavaScript", "js": "JavaScript", "ml": "Machine Learning", "ai": "Artificial Intelligence", "nlp": "NLP", "postgres": "PostgreSQL", "k8s": "Kubernetes", "sklearn": "Scikit-learn", "scikit learn": "Scikit-learn", "gen ai": "Generative AI", "genai": "Generative AI", "llm": "LLM", "llms": "LLM", "large language models": "LLM", "a/b tests": "A/B Testing", "ab testing": "A/B Testing", "a/b test": "A/B Testing", "problem solving": "Problem Solving", "problem-solving": "Problem Solving", "communication skills": "Communication", "ci cd": "CI/CD", "node": "Node.js", "nodejs": "Node.js", "react.js": "React", "reactjs": "React", "py": "Python", "gcp": "GCP", "google cloud platform": "GCP", "amazon web services": "AWS", "data visualisation": "Data Visualization", "visualisation": "Data Visualization", "stakeholder management": "Stakeholder Management", "dashboarding": "Dashboards", "dashboard": "Dashboards", "kpi": "KPIs", "kpi's": "KPIs" };
  const SOFTSET = new Set(["communication", "stakeholder management", "leadership", "teamwork", "collaboration", "problem solving", "critical thinking", "time management", "attention to detail", "presentation", "presentation skills", "negotiation", "mentoring", "analytical skills", "analytical thinking", "ownership", "adaptability", "storytelling", "cross-functional", "customer focus", "written communication", "verbal communication", "english", "hindi"]);
  const PREF_RE = /\b(preferred|nice[- ]to[- ]have|good[- ]to[- ]have|bonus|a plus|is a plus|added advantage|desirable|advantageous|optional|familiarity)\b/i;
  const MUST_RE = /\b(must|required|requirement|mandatory|essential|minimum|strong|proficien|hands[- ]on|expert|solid|proven|at least)\b/i;
  const HEAD_PREF = /^(preferred|nice to have|good to have|bonus|desired|preferred qualifications|plus|additional)/i;
  const HEAD_MUST = /^(requirements?|must have|must-have|required|qualifications?|key skills|skills required|what you need|who you are|basic qualifications|minimum qualifications|eligibility|skills)/i;
  const HEAD_RESP = /^(responsibilities|what you'?ll do|role|key responsibilities|job description|about the role|the role|duties)/i;
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const termRe = (t) => new RegExp("(^|[^A-Za-z0-9+#.])" + escRe(t).replace(/\\ /g, "[\\s-]?").replace(/\s+/g, "[\\s-]+") + "(?=$|[^A-Za-z0-9+#])", "i");
  const lc = (s) => String(s || "").toLowerCase();

  let DICT = null;
  function dict() {
    if (DICT) return DICT;
    const R = window.RQ_ROLES; const m = new Map();
    const add = (t, cat) => { const k = lc(t).trim(); if (!k || k.length < 1) return; if (!m.has(k)) m.set(k, { t, cat }); };
    CERTS.forEach(t => add(t, "cert")); EDU.forEach(t => add(t, "edu"));
    (R ? R.SKILLS : []).forEach(t => add(t, SOFTSET.has(lc(t)) ? "soft" : "skill"));
    EXTRA.forEach(t => add(t, SOFTSET.has(lc(t)) ? "soft" : "skill")); (R ? R.SOFT : []).forEach(t => add(t, "soft"));
    // single letters / ambiguous words only match in their exact case
    DICT = [...m.values()].sort((a, b) => b.t.length - a.t.length).map(x => Object.assign(x, { re: x.t.length <= 2 || ["Go", "Word", "Sales", "Lean", "Swift", "Spring", "Ruby", "Rust", "Excel", "Spark", "Hive", "Looker", "Agile", "Master", "Bachelor", "Engineering", "Finance", "Commerce", "Reporting", "English", "Hindi", "Presentation"].includes(x.t) ? new RegExp("(^|[^A-Za-z0-9+#.])" + escRe(x.t) + "(?=$|[^A-Za-z0-9+#])", x.t.length <= 2 ? "" : "i") : termRe(x.t) }));
    return DICT;
  }
  function canon(t) { const s = SYN[lc(t).trim()]; return s || t; }

  /* ---------- JD parsing ---------- */
  function parseJD(jd) {
    const text = String(jd || "").replace(/\r/g, "").replace(/[•▪●◦]/g, "\n- ").replace(/\t/g, " ");
    const rawLines = text.split("\n").map(s => s.trim()).filter(Boolean);
    let ctx = "resp"; const lines = [];
    rawLines.forEach(l => {
      const h = l.replace(/[:\-–*#]+$/, "").replace(/^[#*\s]+/, "").trim();
      if (h.length < 60 && !/[.,;]$/.test(l)) { if (HEAD_PREF.test(h)) { ctx = "pref"; return; } if (HEAD_MUST.test(h)) { ctx = "must"; return; } if (HEAD_RESP.test(h)) { ctx = "resp"; return; } }
      l.split(/(?<=[.;])\s+(?=[A-Z])/).forEach(s => lines.push({ s, ctx }));
    });
    const found = new Map();
    const note = (t, cat, line, li) => {
      const name = canon(t); const k = lc(name);
      let imp = PREF_RE.test(line.s) || line.ctx === "pref" ? "pref" : (MUST_RE.test(line.s) || line.ctx === "must") ? "must" : "core";
      const f = found.get(k) || { k: name, cat, imp, count: 0, line: line.s, first: li };
      f.count++; if (imp === "must" || (imp === "core" && f.imp === "pref" && line.ctx !== "pref")) f.imp = imp === "core" ? f.imp : "must";
      found.set(k, f);
    };
    const D = dict();
    lines.forEach((line, li) => {
      let s = " " + line.s + " ";
      D.forEach(d => { if (d.re.test(s)) { note(d.t, d.cat, line, li); s = s.replace(new RegExp(d.re.source, d.re.flags + "g"), "$1 "); } });
      // synonyms
      Object.keys(SYN).forEach(k => { if (k.length > 2 && termRe(k).test(s)) note(SYN[k], SOFTSET.has(lc(SYN[k])) ? "soft" : "skill", line, li); });
      // tools listed after cue phrases that are not in the dictionary
      const m = s.match(/\b(?:experience (?:with|in)|knowledge of|proficiency (?:with|in)|familiarity with|exposure to|tools? (?:like|such as)|such as|including|using)\s+([^.;:]{3,160})/i);
      if (m) m[1].split(/,|\/|\band\b|\bor\b|\(|\)/).map(x => x.trim().replace(/^(the|a|an|etc)\s+/i, "")).filter(x => x && x.length <= 30 && x.split(/\s+/).length <= 3 && /^[A-Z0-9.]/.test(x) && !/^(etc|other|similar|tools?|relevant|related|strong|good|excellent)$/i.test(x))
        .forEach(x => { if (!found.has(lc(canon(x))) && !D.some(d => lc(d.t) === lc(x))) note(x, "skill", line, li); });
    });
    // years of experience
    let need = null; const yr = text.match(/(\d{1,2})\s*(?:\+|plus)?\s*(?:-|–|to)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)(?:'|’)?\s*(?:of\s+)?(?:relevant\s+|professional\s+|work\s+|hands[- ]on\s+|industry\s+)?(?:experience|exp)/i);
    if (yr) need = { min: +yr[1], max: yr[2] ? +yr[2] : null, text: yr[0] };
    else if (/\b(fresher|freshers|entry[- ]level|graduate trainee|0\s*-\s*1 years?)\b/i.test(text)) need = { min: 0, max: 1, text: "Entry level" };
    const kw = [...found.values()].map(f => Object.assign(f, { imp: f.imp === "core" ? (f.count >= 2 || f.cat === "skill" && lines[f.first] && lines[f.first].ctx !== "resp" ? "must" : "pref") : f.imp }));
    // job title + company guesses
    const tl = text.match(/(?:job title|position|role)\s*[:\-–]\s*([^\n]{3,70})/i); const co = text.match(/(?:company|organisation|organization|employer)\s*[:\-–]\s*([^\n]{2,60})/i) || text.match(/\babout\s+([A-Z][A-Za-z0-9&.\- ]{1,40})\n/);
    let title = tl ? tl[1].trim() : ""; if (!title) { const first = rawLines[0] || ""; if (first.length < 70 && !/[.]$/.test(first)) title = first.replace(/^(we are hiring|hiring|job opening)\s*[:\-–]?\s*/i, ""); }
    return { title, company: co ? co[1].trim() : "", keywords: kw, years: need, words: (text.match(/\S+/g) || []).length };
  }

  /* ---------- resume evidence ---------- */
  function views(resume) {
    const RS = window.RQ_RESUME;
    if (resume && typeof resume === "object") {
      const r = resume, L = RS.lines;
      return { strong: [].concat(...r.experience.map(e => L(e.bullets).concat([e.role])), ...r.projects.map(p => L(p.bullets).concat([p.title, p.tools])), L(r.achievements)).join("\n"),
        cert: r.certifications.map(c => c.name + " " + (c.issuer || "")).join("\n") + "\n" + r.education.map(e => [e.degree, e.school, e.details].join(" ")).join("\n"),
        weak: [r.summary, r.contact && r.contact.headline, r.skills.map(g => g.items).join(", ")].join("\n"), years: yearsFromResume(r) };
    }
    const t = String(resume || ""), ls = t.split("\n"); const strong = [], weak = [];
    ls.forEach(l => { const s = l.trim(); if (!s) return; if (/^[-•*▪●]/.test(s) || (s.split(/\s+/).length >= 9 && (s.match(/,/g) || []).length < 4)) strong.push(s); else weak.push(s); });
    return { strong: strong.join("\n"), cert: t, weak: weak.join("\n"), years: yearsFromText(t) };
  }
  function yearsFromResume(r) {
    const now = new Date(), ym = (v) => { const m = /^(\d{4})(?:-(\d{2}))?/.exec(v || ""); return m ? +m[1] * 12 + (m[2] ? +m[2] - 1 : 0) : null; };
    const iv = r.experience.filter(e => e.start && !/intern/i.test(e.role || "")).map(e => [ym(e.start), e.current || !e.end ? now.getFullYear() * 12 + now.getMonth() : ym(e.end)]).filter(x => x[0] != null && x[1] != null && x[1] >= x[0]).sort((a, b) => a[0] - b[0]);
    let tot = 0, cs = null, ce = null; iv.forEach(([s, e]) => { if (cs == null) { cs = s; ce = e; } else if (s <= ce) ce = Math.max(ce, e); else { tot += ce - cs; cs = s; ce = e; } }); if (cs != null) tot += ce - cs;
    return iv.length ? Math.round(tot / 12 * 10) / 10 : null;
  }
  function yearsFromText(t) {
    const m = t.match(/(\d{1,2}(?:\.\d)?)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)/i); if (m) return +m[1];
    const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 }; const now = new Date(); let tot = 0, n = 0;
    const re = /(?:([A-Za-z]{3,4})[a-z]*\.?\s+)?(20\d\d|19\d\d)\s*(?:-|–|—|to)\s*(?:(present|current|now|till date)|(?:([A-Za-z]{3,4})[a-z]*\.?\s+)?(20\d\d|19\d\d))/gi; let x;
    while ((x = re.exec(t))) { const s = +x[2] * 12 + (MON[lc(x[1] || "jan").slice(0, 3)] || 0); const e = x[3] ? now.getFullYear() * 12 + now.getMonth() : +x[5] * 12 + (MON[lc(x[4] || "dec").slice(0, 3)] || 11); if (e > s && e - s < 480) { tot += e - s; n++; } }
    return n ? Math.round(tot / 12 * 10) / 10 : null;
  }
  const DEG = { bachelor: /\b(bachelor|b\.?\s?tech|b\.?\s?e\b|b\.?\s?sc|b\.?\s?com|bca|bba|b\.?\s?a\b|undergraduate)/i, master: /\b(master|m\.?\s?tech|m\.?\s?sc|mba|mca|m\.?\s?com|post[- ]?graduate|pgdm)/i };
  const stemRe = (k) => { const w = k.split(/\s+/); if (w.length < 2 || w.length > 3) return null; return new RegExp("\\b" + w.map(x => escRe(x.length > 5 ? x.slice(0, Math.max(4, x.length - 3)) : x) + "[a-z]*").join("[\\s-]+") + "\\b", "i"); };
  function has(hay, k) { if (!hay) return false; const kl = lc(k).replace(/'s?\s*degree$/, "").trim(); if (DEG[kl]) return DEG[kl].test(hay); const sr = stemRe(k); if (sr && sr.test(hay)) return true; const D = dict().find(d => lc(d.t) === lc(k)); const re = D ? D.re : termRe(k); if (re.test(" " + hay + " ")) return true; return Object.keys(SYN).some(s => SYN[s] === k && s.length > 2 && termRe(s).test(" " + hay + " ")); }

  /* ---------- analyze + score (explained weights) ---------- */
  const W = { must: 45, pref: 15, evidence: 20, exp: 20 };
  function analyze(resume, jdText, decisions) {
    decisions = decisions || {};
    const jd = parseJD(jdText), v = views(resume);
    jd.keywords.forEach(k => {
      const where = []; if (has(v.strong, k.k)) where.push("experience / projects"); if ((k.cat === "cert" || k.cat === "edu") && has(v.cert, k.k)) where.push(k.cat === "cert" ? "certifications" : "education"); if (has(v.weak, k.k)) where.push("skills / summary");
      k.where = where; k.status = where.length ? (where[0] !== "skills / summary" ? "strong" : "weak") : "missing";
      const d = decisions[lc(k.k)]; k.decision = d || "";
      k.action = k.status === "strong" ? "Good: keep the result-focused bullet." : k.status === "weak" ? (k.cat === "soft" ? "Show it in a bullet (e.g. who you worked with and the outcome)." : `Listed but not proven: add a bullet showing where you used ${k.k}.`) : d === "have" ? `You confirmed you have this: add it to Skills and to the bullet where you used it.` : d === "no" ? "Honest gap: leave it out. Mention related skills or learn it." : (k.cat === "soft" ? "If true, show it through a result in a bullet." : `Add only if you really have it. Click "I have this" to get a placement tip.`);
    });
    const must = jd.keywords.filter(k => k.imp === "must"), pref = jd.keywords.filter(k => k.imp === "pref");
    const cov = (arr) => arr.length ? arr.reduce((a, k) => a + (k.status === "strong" ? 1 : k.status === "weak" ? .6 : 0), 0) / arr.length : null;
    const matched = jd.keywords.filter(k => k.status !== "missing"), ev = matched.length ? matched.filter(k => k.status === "strong").length / matched.length : (jd.keywords.length ? 0 : null);
    let exp = null; if (jd.years && v.years != null) { exp = v.years >= jd.years.min ? 1 : Math.max(0, v.years / Math.max(1, jd.years.min)); }
    const parts = { must: cov(must), pref: cov(pref), evidence: ev, exp }; let tw = 0, got = 0;
    Object.keys(W).forEach(k => { if (parts[k] != null) { tw += W[k]; got += W[k] * parts[k]; } });
    const overall = tw ? Math.round(got / tw * 100) : 0;
    const pct = (x) => x == null ? null : Math.round(x * 100);
    return { title: jd.title, company: jd.company, years: { need: jd.years, have: v.years }, keywords: jd.keywords.sort((a, b) => (a.imp === b.imp ? 0 : a.imp === "must" ? -1 : 1) || (b.count - a.count)),
      scores: { overall, must: pct(parts.must), pref: pct(parts.pref), evidence: pct(parts.evidence), exp: pct(parts.exp) }, weights: W, counts: { must: must.length, pref: pref.length, strong: jd.keywords.filter(k => k.status === "strong").length, weak: jd.keywords.filter(k => k.status === "weak").length, missing: jd.keywords.filter(k => k.status === "missing").length }, jdWords: jd.words };
  }
  window.RQ_JD = { parseJD, analyze, weights: W, has, canon };
})();
