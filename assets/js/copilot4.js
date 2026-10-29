/* Resumiq — Job Search Copilot, part 4 (ideas from Big Interview, Rezi, Teal, Simplify, Kickresume, Saarthi):
   📚 Data Analyst question bank · 💰 Offer & CTC calculator · 🎯 Weekly goals + streak · 📅 Calendar export (.ics)
   🔖 Save-to-Resumiq bookmarklet · 🌐 Portfolio page · 🧬 Resume versions · 🔔 Job alerts
   Rule-based and local-first; only the alert e-mails need the server. Needs copilot.js (window.RQ_CP). */
(function () {
  "use strict";
  const { $, $$, esc, toast, store, fmtDay, modal, closeModal } = window.RQ;
  const A = () => window.RQ_APP, C = window.RQ_CP, RS = () => window.RQ_RESUME;
  const { cpList, cpSave, lc } = C;
  const todayS = () => new Date().toISOString().slice(0, 10);
  const dayS = (d) => { const x = new Date(d); return isNaN(x) ? "" : new Date(x.getTime() - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const inr = (n) => { const v = Math.round(n || 0); return (v < 0 ? "−₹" : "₹") + Math.abs(v).toLocaleString("en-IN"); };
  const lakh = (n) => (Math.round((n || 0) / 1e3) / 100).toLocaleString("en-IN") + " L";
  const one = (t) => cpList(t)[0];

  const CSS = `.qb-f{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end}.qb-f>div{min-width:150px;flex:1}
.qb-q{border:1px solid var(--line);border-radius:var(--r-sm);padding:12px 14px;margin-top:10px;background:var(--card)}
.qb-q .top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.qb-q h4{margin:0;font-size:15px;line-height:1.4}
.qb-q .tg{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.qb-q .tg span{font-size:11.5px;padding:1px 8px;border-radius:99px;background:var(--soft);color:var(--ink2)}
.qb-q .ans{margin-top:10px;font-size:13.5px;background:var(--soft);border-radius:8px;padding:10px 12px}.qb-q pre{white-space:pre-wrap;font:12.5px/1.5 ui-monospace,Menlo,Consolas,monospace;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:8px;margin:8px 0 0;overflow-x:auto}
.qb-q .act{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.qb-q.known{border-left:4px solid var(--ok)}.qb-q.rev{border-left:4px solid var(--warn)}
.qb-bar{height:8px;border-radius:99px;background:var(--soft);overflow:hidden}.qb-bar i{display:block;height:100%;background:var(--ok)}
.of-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:14px}
.of-tb{width:100%;border-collapse:collapse;font-size:13.5px}.of-tb td,.of-tb th{padding:7px 8px;border-bottom:1px solid var(--line);text-align:right}.of-tb td:first-child,.of-tb th:first-child{text-align:left}.of-tb tr.tot td{font-weight:700;border-top:2px solid var(--line2)}
.gl-row{display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}.gl-row:last-child{border:0}.gl-row .tx{flex:1;min-width:0}.gl-row .qb-bar{margin-top:6px}
.gl-days{display:flex;gap:4px;flex-wrap:wrap}.gl-days span{width:26px;height:26px;border-radius:6px;background:var(--soft);display:grid;place-items:center;font-size:11px;color:var(--mute)}.gl-days span.on{background:var(--ok);color:#fff}
.bm-btn{display:inline-block;padding:10px 16px;border-radius:10px;background:var(--brand);color:#fff!important;font-weight:700;text-decoration:none;cursor:grab}`;
  let cssOn = false; const page = (on, title, sub, right) => { if (!cssOn) { cssOn = true; const s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); } return C.page(on, title, sub, right); };

  /* ================================ 📚 Question bank ================================ */
  const LV = { f: "Fresher / 0–1 yr", m: "2–4 yrs", s: "5+ yrs / lead", a: "Any level" };
  const CT = { a: "Any company", sv: "IT services", pr: "Product / tech", bf: "Bank / BFSI", st: "Startup", rt: "Retail / e-commerce", cs: "Consulting" };
  const qid = (q) => { let h = 0; const s = q[0] + q[3]; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return "q" + (h >>> 0).toString(36); };
  const QB = () => (window.RQ_QBANK || []).map(q => ({ id: qid(q), topic: q[0], lv: q[1], ct: q[2].split(","), q: q[3], a: q[4], ex: q[5] || "" }));
  const qState = () => { const d = one("qbank"); return d ? d : { id: undefined, data: { marks: {}, log: [], own: [] } }; };
  const qSave = (st) => { const d = cpSave("qbank", "Question bank progress", st.data, st.id); st.id = d.id; return d; };
  let qf = { topic: "", lv: "", ct: "", s: "", show: "all" };
  function qbankView() {
    const st = qState(), M = st.data.marks || {}, all = QB().concat((st.data.own || []).map(o => Object.assign({ own: true, ct: ["a"] }, o)));
    const topics = [...new Set(all.map(q => q.topic))];
    const list = all.filter(q => (!qf.topic || q.topic === qf.topic) && (!qf.lv || q.lv === qf.lv || q.lv === "a") && (!qf.ct || q.ct.includes(qf.ct) || q.ct.includes("a")) && (!qf.s || lc(q.q + " " + q.a).includes(lc(qf.s))) && (qf.show === "all" || (qf.show === "new" ? !M[q.id] : M[q.id] === qf.show)));
    const known = all.filter(q => M[q.id] === "known").length, rev = all.filter(q => M[q.id] === "revise").length;
    const byTopic = topics.map(t => { const l = all.filter(q => q.topic === t); return [t, l.length, l.filter(q => M[q.id] === "known").length]; });
    A().view.innerHTML = page("qbank", "Data Analyst question bank", `${all.length} real interview questions on SQL, Excel, Power BI, Tableau, Python, statistics, case studies and HR, with what a good answer covers. Mark what you know; practise the rest.`, `<button class="btn btn-primary" id="qb-drill">🎲 Practise 10 random</button>`) + `
      <div class="card card-pad"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div><b>${known}</b> known · <b>${rev}</b> to revise · <b>${all.length - known - rev}</b> not tried</div><div class="small muted">Progress is saved ${store.cloud ? "to your account" : "in this browser"}.</div></div>
        <div class="qb-bar" style="margin:8px 0 12px"><i style="width:${all.length ? Math.round(known / all.length * 100) : 0}%"></i></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${byTopic.map(([t, n, k]) => `<button class="chip ${qf.topic === t ? "on" : ""}" data-tp="${esc(t)}">${esc(t)} <span class="muted">${k}/${n}</span></button>`).join("")}${qf.topic ? `<button class="chip" data-tp="">✕ All topics</button>` : ""}</div></div>
      <div class="card card-pad" style="margin-top:14px"><div class="qb-f"><div><label class="f" for="qb-s">Search</label><input class="input" id="qb-s" value="${esc(qf.s)}" placeholder="window function, DAX, VLOOKUP…"></div>
        <div><label class="f" for="qb-lv">Level</label><select class="select" id="qb-lv"><option value="">All levels</option>${["f", "m", "s"].map(k => `<option value="${k}" ${qf.lv === k ? "selected" : ""}>${LV[k]}</option>`).join("")}</select></div>
        <div><label class="f" for="qb-ct">Company type</label><select class="select" id="qb-ct"><option value="">All</option>${Object.entries(CT).filter(([k]) => k !== "a").map(([k, n]) => `<option value="${k}" ${qf.ct === k ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <div><label class="f" for="qb-sh">Show</label><select class="select" id="qb-sh">${[["all", "All"], ["new", "Not tried"], ["revise", "To revise"], ["known", "Known"]].map(([k, n]) => `<option value="${k}" ${qf.show === k ? "selected" : ""}>${n}</option>`).join("")}</select></div></div>
        <p class="small muted" style="margin:10px 0 0">${list.length} question${list.length === 1 ? "" : "s"}. Try to answer aloud first, then open “What a good answer covers”.</p></div>
      <div id="qb-list">${list.slice(0, 60).map(q => qCard(q, M)).join("") || A().empty("🔍", "No questions match", "Change the filters or search word.", "")}</div>
      ${list.length > 60 ? `<p class="small muted">Showing 60 of ${list.length}. Narrow the filters to see the rest.</p>` : ""}
      <div class="card card-pad" style="margin-top:16px"><h3 style="margin-top:0">Add a question you were asked</h3><p class="small muted" style="margin-top:-4px">Heard a new question in an interview? Save it with your best answer so you never get caught twice.</p><div class="row"><div><label class="f" for="qo-t">Topic</label><select class="select" id="qo-t">${topics.map(t => `<option>${esc(t)}</option>`).join("")}</select></div><div><label class="f" for="qo-l">Level</label><select class="select" id="qo-l">${["f", "m", "s"].map(k => `<option value="${k}">${LV[k]}</option>`).join("")}</select></div></div>
        <label class="f" for="qo-q">Question</label><input class="input" id="qo-q"><label class="f" for="qo-a">Your answer / notes</label><textarea class="textarea" id="qo-a" rows="3"></textarea><button class="btn btn-ghost" id="qo-add" style="margin-top:10px">＋ Save question</button></div>`;
    const re = () => qbankView();
    $$("[data-tp]").forEach(b => b.onclick = () => { qf.topic = b.dataset.tp; re(); });
    $("#qb-lv").onchange = (e) => { qf.lv = e.target.value; re(); }; $("#qb-ct").onchange = (e) => { qf.ct = e.target.value; re(); }; $("#qb-sh").onchange = (e) => { qf.show = e.target.value; re(); };
    let t = 0; $("#qb-s").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { qf.s = e.target.value; re(); const i = $("#qb-s"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 350); };
    wireCards(st, re);
    $("#qb-drill").onclick = () => drill(list.length >= 5 ? list : all);
    $("#qo-add").onclick = () => { const q = $("#qo-q").value.trim(); if (q.length < 8) return toast("Type the question first.", "bad"); st.data.own = (st.data.own || []).concat([{ id: "o" + Date.now().toString(36), topic: $("#qo-t").value, lv: $("#qo-l").value, q, a: $("#qo-a").value.trim() || "Your notes go here.", ex: "" }]); qSave(st); toast("Question saved to your bank.", "ok"); re(); };
  }
  const qCard = (q, M) => `<div class="qb-q ${M[q.id] === "known" ? "known" : M[q.id] === "revise" ? "rev" : ""}" data-q="${esc(q.id)}"><div class="top"><h4>${esc(q.q)}</h4>${M[q.id] ? `<span class="badge ${M[q.id] === "known" ? "ok" : "warn"}">${M[q.id] === "known" ? "Known" : "Revise"}</span>` : ""}</div>
      <div class="tg"><span>${esc(q.topic)}</span><span>${esc(LV[q.lv] || "")}</span>${q.ct.filter(c => c !== "a").map(c => `<span>${esc(CT[c] || c)}</span>`).join("")}${q.own ? "<span>Your question</span>" : ""}</div>
      <details><summary class="small" style="cursor:pointer;font-weight:600;margin-top:8px">What a good answer covers</summary><div class="ans">${esc(q.a)}${q.ex ? `<pre>${esc(q.ex)}</pre>` : ""}</div></details>
      <div class="act"><button class="btn btn-ghost btn-sm" data-mk="known">✓ I know this</button><button class="btn btn-ghost btn-sm" data-mk="revise">↻ Revise later</button><button class="btn btn-ghost btn-sm" data-say>🔊 Hear it</button>${q.own ? `<button class="icon-btn" data-del aria-label="Delete question">🗑</button>` : ""}</div></div>`;
  function wireCards(st, re) {
    $$(".qb-q").forEach(card => { const id = card.dataset.q;
      $$("[data-mk]", card).forEach(b => b.onclick = () => { const M = st.data.marks = st.data.marks || {}; M[id] = M[id] === b.dataset.mk ? undefined : b.dataset.mk; if (!M[id]) delete M[id]; logPractice(st, 1); qSave(st); re(); });
      const s = $("[data-say]", card); if (s) s.onclick = () => speak($("h4", card).textContent);
      const d = $("[data-del]", card); if (d) d.onclick = () => { st.data.own = (st.data.own || []).filter(o => o.id !== id); qSave(st); re(); }; });
  }
  const logPractice = (st, n) => { const L = st.data.log = st.data.log || [], t = todayS(), x = L.find(l => l.d === t); if (x) x.n += n; else L.push({ d: t, n }); st.data.log = L.slice(-120); };
  const speak = (t) => { const S = window.speechSynthesis; if (!S || !window.SpeechSynthesisUtterance) return toast("This browser can't read aloud."); try { S.cancel(); } catch (e) {} setTimeout(() => { try { const u = new SpeechSynthesisUtterance(t); const v = S.getVoices().filter(x => /^en/i.test(x.lang)).sort((a, b) => (/en-IN/i.test(b.lang) - /en-IN/i.test(a.lang)))[0]; if (v) u.voice = v; u.lang = v ? v.lang : "en-IN"; u.rate = .97; window.__rqU = u; S.speak(u); } catch (e) {} }, 120); };
  function drill(pool) {
    const st = qState(), M = st.data.marks || {}, pick = pool.slice().sort((a, b) => ((M[a.id] === "known") - (M[b.id] === "known")) || (Math.random() - .5)).slice(0, 10);
    let i = 0, got = 0, seen = 0, t0 = Date.now(), timer = 0;
    const m = modal(`<div id="dr"></div>`, { wide: true, sticky: true });
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const draw = () => { clearInterval(timer); const q = pick[i]; if (!q) { if (seen) logPractice(st, seen); qSave(st); $("#dr", m).innerHTML = `<h3>Practice done 🎉</h3><p>You knew <b>${got}</b> of ${seen}. The ones you missed are marked <b>Revise</b>.</p><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn btn-ghost" id="dr-x">Close</button><button class="btn btn-primary" id="dr-again">Another 10</button></div>`; $("#dr-x", m).onclick = () => { closeModal(); qbankView(); }; $("#dr-again", m).onclick = () => { closeModal(); drill(pool); }; return; }
      t0 = Date.now();
      $("#dr", m).innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="small muted">Question ${i + 1} of ${pick.length} · ${esc(q.topic)}</span><span class="cp-timer" id="dr-t">0:00</span></div><h3 style="margin:10px 0">${esc(q.q)}</h3>
        <p class="small muted">Answer aloud (or type) in under 2 minutes, then reveal and judge yourself honestly.</p><textarea class="textarea" id="dr-a" rows="4" placeholder="Your answer (optional)…"></textarea><div id="dr-dl"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-ghost btn-sm" id="dr-say">🔊 Hear it</button>${SR ? `<button class="btn btn-ghost btn-sm" id="dr-mic">🎤 Speak</button>` : ""}<button class="btn btn-primary btn-sm" id="dr-show">Reveal what a good answer covers</button><button class="btn btn-ghost btn-sm" id="dr-quit" style="margin-left:auto">End practice</button></div><div id="dr-ans"></div>`;
      timer = setInterval(() => { const el = $("#dr-t", m); if (!el) return clearInterval(timer); const s = Math.round((Date.now() - t0) / 1000); el.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); el.style.color = s > 120 ? "var(--bad)" : ""; }, 500);
      const qq = { mine: "", secs: 0 }; const ta = $("#dr-a", m), upd = () => { qq.mine = ta.value; qq.secs = Math.round((Date.now() - t0) / 1000); const D = window.RQ_DELIV && window.RQ_DELIV.html; $("#dr-dl", m).innerHTML = D ? D(qq) : ""; };
      ta.oninput = upd; $("#dr-say", m).onclick = () => speak(q.q); $("#dr-quit", m).onclick = () => { i = pick.length; draw(); };
      const mic = $("#dr-mic", m); let rec = null; if (mic) mic.onclick = () => { if (rec) return rec.stop(); rec = new SR(); rec.lang = "en-IN"; rec.interimResults = true; rec.continuous = true; const base = ta.value ? ta.value + " " : "", r0 = Date.now(); let last = r0; qq.spoken = true; rec.onresult = (e) => { const n = Date.now(); if (n - last > 2500 && last !== r0) qq.pauses = (qq.pauses || 0) + 1; last = n; let s = ""; for (let k = 0; k < e.results.length; k++) s += e.results[k][0].transcript; ta.value = base + s; }; rec.onend = () => { rec = null; qq.spokeSecs = (qq.spokeSecs || 0) + Math.round((last - r0) / 1000); mic.textContent = "🎤 Speak"; upd(); }; rec.onerror = () => toast("Microphone not available. Type instead.", "bad"); try { rec.start(); mic.textContent = "⏹ Stop"; } catch (e) { rec = null; } };
      $("#dr-show", m).onclick = () => { clearInterval(timer); upd(); $("#dr-ans", m).innerHTML = `<div class="qb-q" style="margin-top:12px"><div class="ans" style="margin:0">${esc(q.a)}${q.ex ? `<pre>${esc(q.ex)}</pre>` : ""}</div><p class="small" style="margin:10px 0 6px"><b>How did you do?</b></p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" data-r="known">✓ Got it</button><button class="btn btn-ghost btn-sm" data-r="revise">↻ Partly / missed it</button></div></div>`;
        $$("[data-r]", m).forEach(b => b.onclick = () => { st.data.marks = st.data.marks || {}; st.data.marks[q.id] = b.dataset.r; if (b.dataset.r === "known") got++; seen++; i++; draw(); }); };
    };
    draw();
  }

  /* ============================ 💰 Offer & CTC calculator ============================ */
  // New tax regime FY 2025-26 / 2026-27: slabs 4/8/12/16/20/24 L, standard deduction ₹75,000, 87A rebate makes ≤ ₹12 L taxable income tax-free (with marginal relief), 4% cess.
  const SLABS = [[4e5, 0], [8e5, .05], [12e5, .10], [16e5, .15], [20e5, .20], [24e5, .25], [Infinity, .30]];
  function taxNew(taxable) {
    let t = 0, prev = 0; for (const [cap, r] of SLABS) { if (taxable > prev) t += (Math.min(taxable, cap) - prev) * r; prev = cap; }
    if (taxable <= 12e5) t = 0; else t = Math.min(t, taxable - 12e5 + 0); // marginal relief just above ₹12 L
    let sur = 0; if (taxable > 2e7) sur = .25; else if (taxable > 1e7) sur = .15; else if (taxable > 5e6) sur = .10; t = t * (1 + sur);
    return Math.round(t * 1.04);
  }
  const OFD = () => ({ name: "", ctc: 600000, basicPct: 40, variable: 0, joining: 0, pfMode: "cap", gratuity: true, insurance: 0, pt: 2400, otherDed: 0, notes: "" });
  function breakup(o) {
    const ctc = +o.ctc || 0, variable = Math.min(ctc, +o.variable || 0), ins = +o.insurance || 0;
    const fixedCtc = ctc - variable - ins, basic = fixedCtc * (+o.basicPct || 40) / 100;
    const pfBase = o.pfMode === "full" ? basic : o.pfMode === "none" ? 0 : Math.min(basic, 15000 * 12);
    const pfEmployer = pfBase * .12, pfEmployee = pfEmployer, grat = o.gratuity ? basic * .0481 : 0;
    const grossFixed = fixedCtc - pfEmployer - grat;   // what appears as monthly gross × 12
    const tax = taxNew(Math.max(0, grossFixed + variable + (+o.joining || 0) - 75000));
    const taxFixedOnly = taxNew(Math.max(0, grossFixed - 75000));
    const inhandMonthly = (grossFixed - pfEmployee - (+o.pt || 0) - (+o.otherDed || 0) - taxFixedOnly) / 12;
    const yearCash = grossFixed + variable + (+o.joining || 0) - pfEmployee - (+o.pt || 0) - (+o.otherDed || 0) - tax;
    return { ctc, variable, ins, fixedCtc, basic, pfEmployer, pfEmployee, grat, grossFixed, tax, inhandMonthly, yearCash, savings: pfEmployer + pfEmployee + grat };
  }
  function offerView() {
    const d = one("offers"), st = d ? d.data : { offers: [Object.assign(OFD(), { name: "Offer A" })], cur: 0 };
    let cur = Math.min(st.cur || 0, st.offers.length - 1);
    const save = () => { const x = cpSave("offers", "Offers", st, d && d.id); if (!d) offerView.__id = x.id; };
    const form = (o) => `<div class="of-grid"><div><label class="f" for="of-n">Company / offer name</label><input class="input" id="of-n" value="${esc(o.name)}"></div><div><label class="f" for="of-ctc">Total CTC per year (₹)</label><input class="input" type="number" min="0" step="10000" id="of-ctc" value="${esc(o.ctc)}"></div>
      <div><label class="f" for="of-v">Variable / performance bonus in CTC (₹/yr)</label><input class="input" type="number" min="0" id="of-v" value="${esc(o.variable)}"></div><div><label class="f" for="of-b">Basic as % of fixed CTC</label><input class="input" type="number" min="20" max="70" id="of-b" value="${esc(o.basicPct)}"></div>
      <div><label class="f" for="of-pf">Provident fund (PF)</label><select class="select" id="of-pf"><option value="cap" ${o.pfMode === "cap" ? "selected" : ""}>12% on basic, capped at ₹15,000/month (common)</option><option value="full" ${o.pfMode === "full" ? "selected" : ""}>12% on full basic</option><option value="none" ${o.pfMode === "none" ? "selected" : ""}>No PF</option></select></div>
      <div><label class="f" for="of-g">Gratuity inside CTC?</label><select class="select" id="of-g"><option value="1" ${o.gratuity ? "selected" : ""}>Yes (4.81% of basic)</option><option value="0" ${!o.gratuity ? "selected" : ""}>No</option></select></div>
      <div><label class="f" for="of-i">Insurance / other benefits in CTC (₹/yr)</label><input class="input" type="number" min="0" id="of-i" value="${esc(o.insurance)}"></div><div><label class="f" for="of-j">One-time joining bonus (₹)</label><input class="input" type="number" min="0" id="of-j" value="${esc(o.joining)}"></div>
      <div><label class="f" for="of-pt">Professional tax (₹/yr)</label><input class="input" type="number" min="0" id="of-pt" value="${esc(o.pt)}"><span class="small muted">Most states ₹2,400–2,500; Delhi & a few states 0</span></div><div><label class="f" for="of-od">Other monthly deductions × 12 (₹/yr)</label><input class="input" type="number" min="0" id="of-od" value="${esc(o.otherDed)}"></div></div>
      <label class="f" for="of-no">Notes (joining date, location, WFH, growth, team)</label><textarea class="textarea" id="of-no" rows="2">${esc(o.notes)}</textarea>`;
    const result = (o) => { const b = breakup(o); return `<div class="grid g3" style="margin-bottom:12px"><div class="card card-pad" style="box-shadow:none"><div class="small muted">Estimated in-hand per month</div><b style="font-size:26px">${inr(b.inhandMonthly)}</b><div class="small muted">fixed pay, after PF, tax &amp; PT</div></div><div class="card card-pad" style="box-shadow:none"><div class="small muted">Cash in a year (incl. variable &amp; joining)</div><b style="font-size:26px">${inr(b.yearCash)}</b></div><div class="card card-pad" style="box-shadow:none"><div class="small muted">Not paid monthly (PF + gratuity)</div><b style="font-size:26px">${inr(b.savings)}</b><div class="small muted">long-term savings, not salary</div></div></div>
      <div class="tbl-wrap"><table class="of-tb"><thead><tr><th>Component</th><th>Per year</th><th>Per month</th></tr></thead><tbody>${[["Total CTC", b.ctc], ["− Variable (paid later, if targets met)", -b.variable], ["− Insurance / benefits", -b.ins], ["= Fixed CTC", b.fixedCtc], ["  Basic", b.basic], ["− Employer PF (in CTC)", -b.pfEmployer], ["− Gratuity (in CTC)", -b.grat], ["= Gross fixed salary", b.grossFixed], ["− Your PF (12%)", -b.pfEmployee], ["− Professional tax", -(+o.pt || 0)], ["− Income tax on fixed (new regime, with cess)", -taxNew(Math.max(0, b.grossFixed - 75000))]].map(([n, v]) => `<tr${/^=/.test(n) ? ' class="tot"' : ""}><td>${esc(n)}</td><td>${inr(v)}</td><td>${inr(v / 12)}</td></tr>`).join("")}<tr class="tot"><td>Estimated in-hand (fixed)</td><td>${inr(b.inhandMonthly * 12)}</td><td>${inr(b.inhandMonthly)}</td></tr></tbody></table></div>
      <p class="small muted" style="margin:10px 0 0">Estimate under the new tax regime (FY 2025-26 / 2026-27 slabs, ₹75,000 standard deduction, no tax up to ₹12 L taxable income). Real payslips differ by HRA, allowances, old-regime choice and company policy. Ask HR for the exact salary breakup before you sign.</p>`; };
    const cmp = () => st.offers.length < 2 ? "" : (() => { const B = st.offers.map(o => [o, breakup(o)]), best = Math.max(...B.map(x => x[1].inhandMonthly));
      return `<div class="card card-pad" style="margin-top:16px"><h3 style="margin-top:0">Side by side</h3><div class="tbl-wrap"><table class="of-tb"><thead><tr><th></th>${B.map(([o]) => `<th>${esc(o.name || "Offer")}</th>`).join("")}</tr></thead><tbody>${[["CTC", b => lakh(b.ctc)], ["Fixed CTC", b => lakh(b.fixedCtc)], ["Variable", b => lakh(b.variable)], ["In-hand / month", b => inr(b.inhandMonthly)], ["Cash in year 1", b => inr(b.yearCash)], ["PF + gratuity / yr", b => inr(b.savings)], ["Variable share of CTC", b => b.ctc ? Math.round(b.variable / b.ctc * 100) + "%" : "–"]].map(([n, f]) => `<tr><td>${n}</td>${B.map(([, b]) => `<td${n === "In-hand / month" && b.inhandMonthly === best ? ' style="color:var(--ok);font-weight:700"' : ""}>${f(b)}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="small muted" style="margin:10px 0 0">Money is one part. Also compare: the work you'll do, tools you'll learn, manager, growth, location / commute, notice period and bond clauses.</p></div>`; })();
    A().view.innerHTML = page("offer", "Offer & CTC calculator", "Turn a CTC number into the salary that actually reaches your bank account, compare offers, and ask for more with a polite, data-backed email.") + `
      <div class="seg" style="margin-bottom:12px">${st.offers.map((o, i) => `<button class="chip ${i === cur ? "on" : ""}" data-of="${i}">${esc(o.name || "Offer " + (i + 1))}</button>`).join("")}${st.offers.length < 3 ? `<button class="chip" id="of-add">＋ Add an offer to compare</button>` : ""}</div>
      <div class="grid g2" style="align-items:start"><div class="card card-pad">${form(st.offers[cur])}<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">${st.offers.length > 1 ? `<button class="btn btn-ghost btn-sm" id="of-del">Remove this offer</button>` : ""}<button class="btn btn-ghost btn-sm" id="of-neg">✉ Negotiation email</button></div></div><div class="card card-pad" id="of-res">${result(st.offers[cur])}</div></div><div id="of-cmp">${cmp()}</div>`;
    const F = { n: "name", ctc: "ctc", v: "variable", b: "basicPct", pf: "pfMode", g: "gratuity", i: "insurance", j: "joining", pt: "pt", od: "otherDed", no: "notes" };
    let t = 0; Object.entries(F).forEach(([k, f]) => { const el = $("#of-" + k); el.addEventListener("input", () => { const o = st.offers[cur]; o[f] = f === "gratuity" ? el.value === "1" : ["name", "pfMode", "notes"].includes(f) ? el.value : +el.value; $("#of-res").innerHTML = result(o); $("#of-cmp").innerHTML = cmp(); clearTimeout(t); t = setTimeout(save, 400); }); });
    $$("[data-of]").forEach(b => b.onclick = () => { st.cur = +b.dataset.of; save(); offerView(); });
    if ($("#of-add")) $("#of-add").onclick = () => { st.offers.push(Object.assign(OFD(), { name: "Offer " + String.fromCharCode(65 + st.offers.length) })); st.cur = st.offers.length - 1; save(); offerView(); };
    if ($("#of-del")) $("#of-del").onclick = () => { st.offers.splice(cur, 1); st.cur = 0; save(); offerView(); };
    $("#of-neg").onclick = () => { const o = st.offers[cur], other = st.offers.find((x, i) => i !== cur && +x.ctc > +o.ctc), me = (A().resumes()[0] || {}).data || {}, nm = (me.contact && me.contact.name) || "[Your name]";
      const ask = Math.round(Math.max(+o.ctc * 1.12, other ? +other.ctc : 0) / 10000) * 10000;
      const txt = `Subject: ${o.name || "Offer"}: thank you, and one question on the compensation\n\nDear [HR name],\n\nThank you for the offer for the [role] position. I'm excited about the team and the work, especially [one specific thing from the interviews].\n\nBefore I confirm, I'd like to discuss the compensation. ${other ? `I have another offer at a total CTC of ${lakh(+other.ctc)}, and ` : ""}based on the role's scope, my [skills / certification / project result] and current market ranges for this role in [city], I was hoping for a total CTC closer to ${lakh(ask)}${+o.variable ? ", ideally with more of it in fixed pay" : ""}.\n\nIf the CTC is fixed, I'd also be glad to discuss a joining bonus, an earlier salary review (6 months), or the joining date.\n\nI'm keen to join and hope we can find something that works for both of us.\n\nBest regards,\n${nm}`;
      const m = modal(`<h3>Negotiation email</h3><p class="small muted" style="margin-top:-4px">Be polite and specific. Ask once, give a reason, and stay positive. Fill the [brackets] with real facts.</p><textarea class="textarea" id="ng-t" rows="16">${esc(txt)}</textarea><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><button class="btn btn-ghost" onclick="RQ.closeModal()">Close</button><button class="btn btn-primary" id="ng-c">Copy</button></div>`, { wide: true }); $("#ng-c", m).onclick = () => A().copy($("#ng-t", m).value); };
  }

  /* ======================= 🎯 Weekly goals, streak & 📅 calendar ======================= */
  const weekStart = (d) => { const x = new Date(d || Date.now()); const k = (x.getDay() + 6) % 7; x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - k); return x; };
  const GDEF = { apps: 10, msgs: 5, mocks: 2, qs: 20 };
  function activity() {
    const days = {}, add = (d, k) => { const s = d && String(d).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return; (days[s] = days[s] || {})[k] = ((days[s] || {})[k] || 0) + 1; };
    store.list("application").forEach(a => { add(a.data.applied, "apps"); if (a.data.stageAt && a.data.stageAt !== a.data.applied) add(a.data.stageAt, "moves"); (a.data.followups || []).forEach(f => add(f.date || f.d, "msgs")); });
    cpList("contact").forEach(c => (c.data.log || []).forEach(l => add(l.d, "msgs")));
    cpList("mock").forEach(m => add(dayS(m.created), "mocks"));
    const q = one("qbank"); if (q) (q.data.log || []).forEach(l => { for (let i = 0; i < Math.max(1, l.n); i++) add(l.d, "qs"); });
    store.list("resume").forEach(r => add(dayS(r.updated), "resume")); store.list("cover").forEach(r => add(dayS(r.created), "letters"));
    const ck = one("checkup"); if (ck) add(ck.data.at, "checkup");
    return days;
  }
  function streak(days) { let n = 0; const d = new Date(); if (!days[dayS(d)]) d.setDate(d.getDate() - 1); while (days[dayS(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }
  function weekCount(days, k, ws) { let n = 0; for (let i = 0; i < 7; i++) { const d = new Date(ws); d.setDate(d.getDate() + i); n += ((days[dayS(d)] || {})[k] || 0); } return n; }
  const goals = () => Object.assign({}, GDEF, ((one("goals") || {}).data || {}).g || {});
  function goalsCard() { const days = activity(), g = goals(), ws = weekStart(), s = streak(days), done = Object.keys(GDEF).map(k => Math.min(1, weekCount(days, k, ws) / Math.max(1, g[k]))), pct = Math.round(done.reduce((a, b) => a + b, 0) / done.length * 100);
    return `<a class="card card-pad" href="#/goals" style="display:block;text-decoration:none;color:inherit;margin-top:18px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><h3 style="margin:0">🎯 This week's goals: ${pct}%</h3><p class="small muted" style="margin:4px 0 0">${Object.keys(GDEF).map(k => `${weekCount(days, k, ws)}/${g[k]} ${{ apps: "applications", msgs: "messages", mocks: "mock interviews", qs: "questions" }[k]}`).join(" · ")}</p></div><span class="badge ${s ? "ok" : ""}" style="font-size:13px">🔥 ${s}-day streak</span></div><div class="qb-bar" style="margin-top:10px"><i style="width:${pct}%"></i></div></a>`; }
  function goalsView() {
    const d = one("goals"), g = goals(), days = activity(), ws = weekStart(), s = streak(days);
    const L = [["apps", "Applications sent", "Move a card to Applied on the board, or set Applied on.", "#/board"], ["msgs", "Networking / follow-up messages", "Log them with “Mark as sent” in Network or Follow-ups.", "#/network"], ["mocks", "Mock interviews", "Each mock interview you start counts.", "#/mock"], ["qs", "Interview questions practised", "Mark questions in the question bank or run a practice round.", "#/qbank"]];
    const last28 = [...Array(28)].map((_, i) => { const x = new Date(); x.setDate(x.getDate() - 27 + i); const k = dayS(x); return [k, days[k]]; });
    A().view.innerHTML = page("goals", "Weekly goals", "Job hunting is a numbers game played with quality. Set a weekly target you can keep, and keep the streak alive with one small step a day.", `<button class="btn btn-ghost" id="gl-ics">📅 Add to my calendar (.ics)</button>`) + `
      <div class="grid g2" style="align-items:start"><div class="card card-pad"><h3 style="margin-top:0">Week of ${esc(fmtDay(dayS(ws)))}</h3>${L.map(([k, n, h, href]) => { const v = weekCount(days, k, ws), p = Math.min(100, Math.round(v / Math.max(1, g[k]) * 100)); return `<div class="gl-row"><div class="tx"><b>${esc(n)}</b> <span class="small muted">${v} / </span><input class="input" type="number" min="0" max="200" data-g="${k}" value="${g[k]}" style="width:70px;padding:3px 6px;display:inline-block" aria-label="Weekly goal for ${esc(n)}"><div class="small muted">${esc(h)} <a href="${href}">Open →</a></div><div class="qb-bar"><i style="width:${p}%;${p < 100 ? "background:var(--brand)" : ""}"></i></div></div>${p >= 100 ? '<span class="badge ok">✓ Done</span>' : ""}</div>`; }).join("")}</div>
        <div class="card card-pad"><h3 style="margin-top:0">🔥 ${s}-day streak</h3><p class="small muted" style="margin-top:-4px">Any job-search step counts: an application, a message, a mock, practice questions, or editing your resume.</p><div class="gl-days">${last28.map(([k, v]) => `<span class="${v ? "on" : ""}" title="${esc(k)}${v ? ": " + Object.entries(v).map(([a, b]) => b + " " + a).join(", ") : ""}">${+k.slice(8)}</span>`).join("")}</div>
          <h3 style="margin-top:20px">📅 Calendar</h3><p class="small muted" style="margin-top:-4px">Download your interviews, follow-ups, contact reminders and deadlines as one .ics file. Open it with Google Calendar, Outlook or Apple Calendar.</p><div id="gl-up"></div></div></div>`;
    let t = 0; $$("[data-g]").forEach(i => i.oninput = () => { clearTimeout(t); t = setTimeout(() => { const ng = Object.assign({}, goals()); $$("[data-g]").forEach(x => ng[x.dataset.g] = Math.max(0, +x.value || 0)); cpSave("goals", "Weekly goals", { g: ng }, d && d.id); }, 400); });
    const ev = calEvents(); $("#gl-up").innerHTML = ev.length ? `<ul class="small" style="margin:0;padding-left:18px;line-height:1.7">${ev.slice(0, 8).map(e => `<li><b>${esc(fmtDay(e.date))}${e.time ? " " + esc(e.time) : ""}</b>: ${esc(e.title)}</li>`).join("")}</ul>${ev.length > 8 ? `<p class="small muted">+${ev.length - 8} more in the file.</p>` : ""}` : `<p class="small muted">Nothing upcoming yet. Add follow-up dates, interview dates or contact reminders first.</p>`;
    $("#gl-ics").onclick = () => downloadIcs();
  }
  function calEvents() {
    const T = todayS(), E = [];
    store.list("application").forEach(a => { const x = a.data, nm = [x.role, x.company].filter(Boolean).join(" @ ") || a.title;
      if (x.interviewAt) E.push({ uid: a.id + "-int", date: String(x.interviewAt).slice(0, 10), time: /T\d\d:\d\d/.test(x.interviewAt) ? String(x.interviewAt).slice(11, 16) : "", dur: 60, title: "Interview: " + nm, desc: (x.link ? "Job: " + x.link + "\n" : "") + "Prep: Resumiq STAR stories & question bank." });
      if (x.followUp && !["Offer", "Hired", "Rejected", "No response", "Withdrawn"].includes(x.status)) E.push({ uid: a.id + "-fu", date: x.followUp, title: "Follow up: " + nm, desc: "Polite follow-up message (Resumiq → Follow-ups)." });
      if (x.deadline && ["Saved", "Ready to Apply"].includes(x.status)) E.push({ uid: a.id + "-dl", date: x.deadline, title: "Apply before deadline: " + nm, desc: x.link || "" }); });
    cpList("contact").forEach(c => { if (c.data.next && c.data.status !== "No reply") E.push({ uid: c.id + "-nx", date: c.data.next, title: "Reach out: " + c.data.name + (c.data.company ? " (" + c.data.company + ")" : ""), desc: c.data.kind + (c.data.url ? "\n" + c.data.url : "") }); });
    return E.filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= T).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  }
  const icsEsc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const fold = (l) => { const out = []; while (l.length > 74) { out.push(l.slice(0, 74)); l = " " + l.slice(74); } out.push(l); return out.join("\r\n"); };
  function buildIcs(ev) {
    const st = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""), L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Resumiq//Job search//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Resumiq job search"];
    ev.forEach(e => { const d = e.date.replace(/-/g, ""); L.push("BEGIN:VEVENT", "UID:" + e.uid + "@resumiq", "DTSTAMP:" + st);
      if (e.time) { const [h, m] = e.time.split(":").map(Number), end = new Date(2000, 0, 1, h, m + (e.dur || 60)); L.push("DTSTART;TZID=Asia/Kolkata:" + d + "T" + e.time.replace(":", "") + "00", "DTEND;TZID=Asia/Kolkata:" + d + "T" + String(end.getHours()).padStart(2, "0") + String(end.getMinutes()).padStart(2, "0") + "00"); }
      else { const n = new Date(e.date + "T00:00:00Z"); n.setUTCDate(n.getUTCDate() + 1); L.push("DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + n.toISOString().slice(0, 10).replace(/-/g, "")); }
      L.push("SUMMARY:" + icsEsc(e.title)); if (e.desc) L.push("DESCRIPTION:" + icsEsc(e.desc)); L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEsc(e.title), e.time ? "TRIGGER:-PT60M" : "TRIGGER:PT9H", "END:VALARM", "END:VEVENT"); });
    L.push("END:VCALENDAR"); return L.map(fold).join("\r\n") + "\r\n";
  }
  function downloadIcs() { const ev = calEvents(); if (!ev.length) return toast("No upcoming dates yet. Add follow-up or interview dates first.", "bad"); A().download(new Blob([buildIcs(ev)], { type: "text/calendar;charset=utf-8" }), "resumiq-job-search.ics"); toast(ev.length + " event" + (ev.length > 1 ? "s" : "") + " exported.", "ok"); }

  window.RQ_CP4 = { taxNew, breakup, buildIcs, calEvents, activity, streak, QB, downloadIcs, goalsCard };
  window.RQ_EXTRA_ROUTES = Object.assign(window.RQ_EXTRA_ROUTES || {}, { qbank: qbankView, offer: offerView, goals: goalsView });
  window.RQ_EXTRA_TITLES = Object.assign(window.RQ_EXTRA_TITLES || {}, { qbank: "Question bank", offer: "Offer & CTC", goals: "Weekly goals" });
  C.SUB.splice(C.SUB.findIndex(s => s[0] === "mock") + 1, 0, ["qbank", "📚 Questions"]);
  C.SUB.push(["goals", "🎯 Goals"], ["offer", "💰 Offer & CTC"]);
  const dc = window.RQ_COPILOT && window.RQ_COPILOT.dashCard; if (window.RQ_COPILOT) window.RQ_COPILOT.dashCard = () => goalsCard() + (dc ? dc() : "");
})();
