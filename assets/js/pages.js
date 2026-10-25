/* Resumiq content pages: templates gallery, career roles directory */
(function () {
  "use strict";
  const { $, $$, esc } = window.RQ, RR = window.RQ_ROLES, RS = window.RQ_RESUME;
  const P = new URLSearchParams(location.search);
  if ($("#tpl-grid") && RS) {
    const sample = RS.sample();
    $("#tpl-grid").innerHTML = RR.TEMPLATES.map(t => `<div class="card tpl-card"><div class="tpl-thumb" style="height:420px"><div class="doc" data-tpl="${t.id}"></div></div><div style="padding:12px 4px 4px"><b style="font-size:16px">${esc(t.name)}</b><p class="small muted" style="margin:2px 0 6px">${esc(t.desc)}</p><p class="small" style="margin:0 0 10px;color:var(--brand-ink)">Best for: ${esc(t.best)}</p><a class="btn btn-primary btn-sm" href="/studio?template=${t.id}">Use this template</a></div></div>`).join("");
    $$("#tpl-grid [data-tpl]").forEach(el => { const r = JSON.parse(JSON.stringify(sample)); r.template = el.dataset.tpl; RS.mount(el, r, { nobreaks: true }); });
    const fit = () => $$(".tpl-thumb").forEach(t => { t.firstElementChild.style.transform = `scale(${t.clientWidth / 794})`; }); fit(); addEventListener("resize", fit);
  }
  if ($("#cr-q")) {
    let fam = P.get("family") || "";
    const q = $("#cr-q"), list = $("#cr-list"), det = $("#cr-detail");
    $("#cr-fam").innerHTML = `<button class="chip ${fam ? "" : "on"}" data-fam="">All</button>` + RR.FAMILIES.map(f => `<button class="chip ${fam === f.id ? "on" : ""}" data-fam="${f.id}">${f.icon} ${esc(f.name.split(/,| &/)[0])}</button>`).join("");
    const draw = () => {
      const res = q.value.trim() ? RR.search(q.value, 60) : RR.all.filter(r => !fam || r.family === fam);
      list.innerHTML = res.map(r => `<a class="card feature" href="?role=${encodeURIComponent(r.title)}" data-role="${esc(r.title)}" style="padding:16px"><b>${esc(r.title)}</b><p>${esc(r.familyName)}${RR.PLAYBOOKS[r.title] ? " · full playbook" : ""}</p><p class="small" style="color:var(--ink2)">${esc(r.skills.slice(0, 5).join(" · "))}</p></a>`).join("") || `<div class="empty">No role found. You can still type any job title in the Resume Studio.</div>`;
      $$("[data-role]", list).forEach(a => a.onclick = (e) => { e.preventDefault(); show(a.dataset.role); history.replaceState(null, "", "?role=" + encodeURIComponent(a.dataset.role)); });
    };
    const show = (title) => {
      const g = RR.guide(title); if (!g.role) { det.innerHTML = ""; return; }
      document.title = g.title + " Resume Guide — Resumiq";
      det.innerHTML = `<div class="card card-pad"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start"><div><span class="eyebrow">${g.family.icon} ${esc(g.family.name)}</span><h2 style="margin:6px 0">${esc(g.title)} resume guide</h2>${g.role.aliases.length ? `<p class="small muted" style="margin:0">Also called: ${esc(g.role.aliases.join(", "))}</p>` : ""}</div><a class="btn btn-primary" href="/studio?role=${encodeURIComponent(g.title)}">Build a ${esc(g.title)} resume</a></div>
        <div class="grid g2" style="margin-top:16px"><div><h3>What recruiters look for</h3><ul class="small" style="padding-left:18px">${g.look.map(x => `<li>${esc(x)}</li>`).join("")}</ul><h3>Core skills</h3><div style="display:flex;flex-wrap:wrap;gap:6px">${g.skills.map(s => `<span class="badge brand">${esc(s)}</span>`).join("")}</div><h3 style="margin-top:14px">Soft skills to show (through results)</h3><div style="display:flex;flex-wrap:wrap;gap:6px">${g.soft.map(s => `<span class="badge">${esc(s)}</span>`).join("")}</div></div>
        <div><h3>Bullet patterns</h3><div class="cmp">${g.patterns.map(p => `<div class="o small">${esc(p)}</div>`).join("")}</div><p class="small muted">Replace each [placeholder] with your real numbers.</p><h3>Summary pattern</h3><div class="cmp"><div class="o small">${esc(g.summary)}</div></div></div></div>
        ${g.projects.length ? `<h3 style="margin-top:16px">Project ideas</h3><ul class="small" style="padding-left:18px">${g.projects.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        <h3>Common mistakes</h3><ul class="small" style="padding-left:18px">${g.mistakes.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
        <p class="small muted">Recommended template: <b>${esc((RR.TEMPLATES.find(t => t.id === g.template) || {}).name || "")}</b>. Freshers: 1 page; most roles under 8 years: 1 page, 2 at most.</p></div>`;
      det.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    q.oninput = draw; $$("[data-fam]").forEach(b => b.onclick = () => { fam = b.dataset.fam; q.value = ""; $$("[data-fam]").forEach(x => x.classList.toggle("on", x === b)); draw(); });
    draw(); if (P.get("role")) show(P.get("role"));
  }
})();
/* samples gallery */
(function () {
  "use strict";
  const { $, $$, esc } = window.RQ; if (!$("#sm-grid") || !window.RQ_SAMPLES) return;
  const SM = window.RQ_SAMPLES, RS = window.RQ_RESUME; let f = "all";
  const groups = [["all", "All"], ["student", "Freshers"], ["exp", "Experienced"]];
  $("#sm-f").innerHTML = groups.map(([k, l]) => `<button class="chip ${k === f ? "on" : ""}" data-f="${k}">${l}</button>`).join("");
  const draw = () => {
    const list = SM.list.filter(s => f === "all" || (f === "student" ? s.level === "student" : s.level !== "student"));
    $("#sm-grid").innerHTML = list.map(s => `<div class="card tpl-card"><div class="tpl-thumb" style="height:440px"><div class="doc" data-s="${s.id}"></div></div><div style="padding:12px 4px 4px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="font-size:16px">${esc(s.title)}</b><span class="badge ok" title="ATS score in Resumiq" data-sc="${s.id}"></span></div><p class="small muted" style="margin:3px 0 10px">${esc(s.tag)} · ${esc((window.RQ_ROLES.TEMPLATES.find(t => t.id === s.template) || {}).name || "")} template</p><a class="btn btn-primary btn-sm" href="/studio?sample=${s.id}">Use this sample</a></div></div>`).join("");
    $$("[data-s]").forEach(el => { const r = SM.build(el.dataset.s); const pages = RS.mount(el, r, { nobreaks: true }); const b = $(`[data-sc="${el.dataset.s}"]`); b.textContent = "ATS " + RS.quality(r, pages).score; });
    fit();
  };
  const fit = () => $$("#sm-grid .tpl-thumb").forEach(t => { t.firstElementChild.style.transform = `scale(${t.clientWidth / 794})`; });
  $$("[data-f]", $("#sm-f")).forEach(b => b.onclick = () => { f = b.dataset.f; $$("[data-f]", $("#sm-f")).forEach(x => x.classList.toggle("on", x === b)); draw(); });
  addEventListener("resize", fit); draw();
  if (document.fonts) document.fonts.ready.then(draw);
})();
