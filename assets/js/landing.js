/* Resumiq landing: live product mockup, template gallery, role families, job-match demo, real AI limits */
(function () {
  "use strict";
  const { $, esc } = window.RQ, RS = window.RQ_RESUME, RR = window.RQ_ROLES;
  const sample = RS.sample();
  // hero mockup uses the real renderer
  const hd = $("#hero-doc"); RS.mount(hd, sample, { nobreaks: true });
  const q = RS.quality(sample, 1); $("#hero-score").textContent = q.score; $("#hero-ring").style.setProperty("--p", q.score);
  const fitHero = () => { const m = $("#mock"), w = Math.min(m.clientWidth * 0.82, 520); hd.parentElement.style.transform = `scale(${w / 794})`; };
  fitHero(); addEventListener("resize", fitHero);
  // template gallery
  $("#tpl-grid").innerHTML = RR.TEMPLATES.map(t => `<a class="card tpl-card" href="/studio?template=${t.id}"><div class="tpl-thumb"><div class="doc" data-tpl="${t.id}"></div></div><div style="padding:12px 4px 2px"><b>${esc(t.name)}</b><div class="small muted">${esc(t.desc)}</div><div class="small" style="margin-top:4px;color:var(--brand-ink)">Best for: ${esc(t.best)}</div></div></a>`).join("");
  document.querySelectorAll("#tpl-grid [data-tpl]").forEach(el => { const r = JSON.parse(JSON.stringify(sample)); r.template = el.dataset.tpl; RS.mount(el, r, { nobreaks: true }); });
  const fitT = () => document.querySelectorAll(".tpl-thumb").forEach(t => { t.firstElementChild.style.transform = `scale(${t.clientWidth / 794})`; });
  fitT(); addEventListener("resize", fitT);
  // role families
  $("#fam").innerHTML = RR.FAMILIES.map(f => `<a class="card feature" href="/career-roles?family=${f.id}" style="padding:18px"><div class="fi">${f.icon}</div><b>${esc(f.name)}</b><p>${f.roles.slice(0, 4).map(r => esc(r.title)).join(", ")}${f.roles.length > 4 ? ` +${f.roles.length - 4} more` : ""}</p></a>`).join("");
  // job match demo (rule engine, in the browser)
  const col = (n) => n == null ? "var(--faint)" : n >= 75 ? "#16A34A" : n >= 50 ? "#D97706" : "#DC2626";
  const demo = () => { const a = window.RQ_JD.analyze(sample, $("#demo-jd").value); const s = a.scores;
    $("#demo-out").innerHTML = `<div style="display:flex;gap:16px;align-items:center"><div class="ring" style="--p:${s.overall};--c:${col(s.overall)};width:96px;height:96px"><div><b style="font-size:26px">${s.overall}</b><span>match</span></div></div><div class="small">Must-haves <b>${s.must == null ? "–" : s.must + "%"}</b><br>Preferred <b>${s.pref == null ? "–" : s.pref + "%"}</b><br>Evidence <b>${s.evidence == null ? "–" : s.evidence + "%"}</b><br>Experience <b>${s.exp == null ? "n/a" : s.exp + "%"}</b></div></div>
      <div style="margin-top:14px;display:grid;gap:6px">${a.keywords.slice(0, 9).map(k => `<div style="display:flex;justify-content:space-between;gap:10px;font-size:14px;border-bottom:1px solid var(--soft);padding-bottom:6px"><span><b>${esc(k.k)}</b> <span class="badge ${k.imp === "must" ? "bad" : ""}" style="font-size:10.5px">${k.imp === "must" ? "must" : "nice"}</span></span><span class="kw-st ${k.status}">${k.status === "strong" ? "● Strong" : k.status === "weak" ? "◐ Weak" : "○ Missing"}</span></div>`).join("")}</div>
      <a class="btn btn-primary btn-sm" href="/job-match" style="margin-top:14px">Try with your own resume →</a>`; };
  let t; $("#demo-jd").addEventListener("input", () => { clearTimeout(t); t = setTimeout(demo, 250); }); demo();
  // real daily limits from the server
  fetch("/api/ai").then(r => r.json()).then(j => { if (j && j.limits) { document.querySelectorAll('[data-lim="guest"]').forEach(e => e.textContent = j.limits.guest); document.querySelectorAll('[data-lim="user"]').forEach(e => e.textContent = j.limits.user); } }).catch(() => {});
})();
(function () {
  const el = document.getElementById("sm-home"); if (!el || !window.RQ_SAMPLES) return; const RS = window.RQ_RESUME, SM = window.RQ_SAMPLES;
  const pick = ["da-fresher", "da-exp", "ba", "ai"].map(id => SM.list.find(s => s.id === id)).filter(Boolean);
  const draw = () => { el.innerHTML = pick.map(s => `<a class="card tpl-card" href="/studio?sample=${s.id}"><div class="tpl-thumb" style="height:330px"><div class="doc" data-s="${s.id}"></div></div><div style="padding:10px 2px 2px;display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="font-size:14.5px">${s.title}</b><span class="badge ok" data-sc="${s.id}"></span></div></a>`).join("");
    el.querySelectorAll("[data-s]").forEach(d => { const r = SM.build(d.dataset.s); const pg = RS.mount(d, r, { nobreaks: true }); el.querySelector(`[data-sc="${d.dataset.s}"]`).textContent = "ATS " + RS.quality(r, pg).score; });
    el.querySelectorAll(".tpl-thumb").forEach(t => { t.firstElementChild.style.transform = `scale(${t.clientWidth / 794})`; }); };
  draw(); addEventListener("resize", draw); if (document.fonts) document.fonts.ready.then(draw);
})();
