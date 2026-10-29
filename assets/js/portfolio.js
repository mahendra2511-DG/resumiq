/* Resumiq — portfolio page renderer. The page data lives in the link itself (#p=…, compressed), so nothing is stored on a server.
   window.RQ_PORTFOLIO = { render(data) → { css, html }, encode(data) → Promise<string>, decode(str) → Promise<data> } */
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const url = (u) => { u = String(u || "").trim(); if (!u) return ""; if (!/^[a-z]+:/i.test(u)) u = "https://" + u; try { const x = new URL(u); return ["http:", "https:"].includes(x.protocol) ? x.href : ""; } catch (e) { return ""; } };
  const mail = (e) => /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(String(e || "")) ? "mailto:" + e : "";
  const col = (c) => /^#[0-9a-f]{6}$/i.test(String(c || "")) ? c : "#5B4BF0";
  const lines = (t) => String(t || "").split("\n").map(x => x.replace(/^[-•*]\s*/, "").replace(/\*\*([^*]+)\*\*/g, "$1").trim()).filter(Boolean);
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return "link"; } };

  function render(d) {
    d = d || {}; const c = col(d.accent), L = d.links || {};
    const links = [["Email", mail(L.email)], ["LinkedIn", url(L.linkedin)], ["GitHub", url(L.github)], ["Website", url(L.website)], ["Tableau Public", url(L.tableau)], ["Medium", url(L.medium)]].filter(x => x[1]);
    const css = `*{box-sizing:border-box}body{margin:0;font:16px/1.6 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#0f172a;background:#f8fafc}
a{color:${c}}.pf-wrap{max-width:980px;margin:0 auto;padding:0 20px}.pf-hero{background:linear-gradient(135deg,${c},#0f172a);color:#fff;padding:64px 0 56px}
.pf-hero h1{font-size:clamp(30px,6vw,48px);line-height:1.1;margin:0 0 8px;letter-spacing:-.02em}.pf-hero p.h{font-size:clamp(17px,3vw,21px);margin:0;opacity:.92}.pf-hero p.l{margin:6px 0 0;opacity:.75;font-size:14px}
.pf-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.pf-links a{color:#fff;border:1px solid rgba(255,255,255,.45);padding:7px 14px;border-radius:99px;text-decoration:none;font-weight:600;font-size:14px}.pf-links a:hover{background:rgba(255,255,255,.15)}
section{padding:36px 0 8px}h2{font-size:22px;margin:0 0 14px;letter-spacing:-.01em}.pf-about{font-size:17px;max-width:760px;white-space:pre-wrap}
.pf-sk{display:flex;flex-wrap:wrap;gap:8px}.pf-sk span{background:#fff;border:1px solid #e2e8f0;border-radius:99px;padding:5px 12px;font-size:14px}
.pf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:18px}.pf-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.pf-card img{width:100%;aspect-ratio:16/9;object-fit:cover;background:#e2e8f0;display:block}.pf-card .b{padding:16px;flex:1;display:flex;flex-direction:column}.pf-card h3{margin:0 0 4px;font-size:18px}
.pf-card .t{font-size:13px;color:#64748b;margin-bottom:8px}.pf-card ul{margin:0 0 12px;padding-left:18px;font-size:14.5px}.pf-card .lk{margin-top:auto;display:flex;gap:10px;flex-wrap:wrap;font-weight:600;font-size:14px}
.pf-x{border-left:3px solid ${c};padding:2px 0 2px 16px;margin-bottom:20px}.pf-x h3{margin:0;font-size:17px}.pf-x .m{color:#64748b;font-size:14px}.pf-x ul{margin:6px 0 0;padding-left:18px;font-size:15px}
.pf-ed{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px}.pf-ed div{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;font-size:14.5px}
footer{padding:40px 0;color:#94a3b8;font-size:13px;text-align:center}@media print{.pf-hero{background:${c}!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
    const P = (d.projects || []).filter(p => p.title);
    const html = `<header class="pf-hero"><div class="pf-wrap"><h1>${esc(d.name || "Your Name")}</h1>${d.headline ? `<p class="h">${esc(d.headline)}</p>` : ""}${d.location ? `<p class="l">📍 ${esc(d.location)}</p>` : ""}${links.length ? `<nav class="pf-links">${links.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(n)}</a>`).join("")}</nav>` : ""}</div></header>
      <main class="pf-wrap">${d.about ? `<section><h2>About</h2><p class="pf-about">${esc(d.about)}</p></section>` : ""}
      ${(d.skills || []).length ? `<section><h2>Skills</h2><div class="pf-sk">${d.skills.slice(0, 40).map(s => `<span>${esc(s)}</span>`).join("")}</div></section>` : ""}
      ${P.length ? `<section><h2>Projects</h2><div class="pf-grid">${P.map(p => { const img = url(p.image), lk = [["Live dashboard", url(p.live)], ["Code / files", url(p.link)]].filter(x => x[1]); return `<article class="pf-card">${img ? `<img src="${esc(img)}" alt="${esc(p.title)} screenshot" loading="lazy" referrerpolicy="no-referrer">` : ""}<div class="b"><h3>${esc(p.title)}</h3>${p.tools ? `<div class="t">${esc(p.tools)}</div>` : ""}${lines(p.bullets).length ? `<ul>${lines(p.bullets).slice(0, 5).map(b => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}${lk.length ? `<div class="lk">${lk.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(n)} ↗</a>`).join("")}</div>` : ""}</div></article>`; }).join("")}</div></section>` : ""}
      ${(d.experience || []).filter(e => e.role || e.company).length ? `<section><h2>Experience</h2>${d.experience.filter(e => e.role || e.company).map(e => `<div class="pf-x"><h3>${esc(e.role)}${e.company ? ` · ${esc(e.company)}` : ""}</h3><div class="m">${esc(e.dates || "")}</div>${lines(e.bullets).length ? `<ul>${lines(e.bullets).slice(0, 4).map(b => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}</div>`).join("")}</section>` : ""}
      ${(d.education || []).length || (d.certs || []).length ? `<section><h2>Education & certifications</h2><div class="pf-ed">${(d.education || []).map(e => `<div><b>${esc(e.degree)}</b><br>${esc(e.school || "")}${e.dates ? `<br><span style="color:#64748b">${esc(e.dates)}</span>` : ""}</div>`).join("")}${(d.certs || []).map(e => `<div><b>${esc(e.name)}</b>${e.issuer ? `<br>${esc(e.issuer)}` : ""}${url(e.link) ? `<br><a href="${esc(url(e.link))}" target="_blank" rel="noopener noreferrer">Verify ↗</a>` : ""}</div>`).join("")}</div></section>` : ""}</main>
      <footer>Portfolio made with <a href="https://resumiq-pekm.vercel.app/" target="_blank" rel="noopener">Resumiq</a></footer>`;
    return { css, html, title: (d.name || "Portfolio") + (d.headline ? " · " + d.headline : "") };
  }
  const b64u = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64u = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function encode(d) { const raw = new TextEncoder().encode(JSON.stringify(d)); if (window.CompressionStream) { const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()); return "z." + b64u(z); } return "u." + b64u(raw); }
  async function decode(s) { s = String(s || ""); const [k, v] = [s.slice(0, 2), s.slice(2)]; let bytes = unb64u(v); if (k === "z.") { if (!window.DecompressionStream) throw new Error("Please open this link in a recent version of Chrome, Edge, Safari or Firefox."); bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()); } else if (k !== "u.") throw new Error("This portfolio link is incomplete."); return JSON.parse(new TextDecoder().decode(bytes)); }
  window.RQ_PORTFOLIO = { render, encode, decode };

  // standalone page: /portfolio#p=…
  const host0 = document.getElementById("pf-root"); if (!host0) return;
  const show = async () => { const m = /[#&]p=([^&]+)/.exec(location.hash); if (!m) { host0.innerHTML = `<div style="max-width:560px;margin:80px auto;padding:20px;font:16px/1.6 system-ui;text-align:center"><h1>Portfolio</h1><p>This link has no portfolio in it. Build yours free in <a href="/app#/portfolio">Resumiq</a>.</p></div>`; return; }
    try { const d = await decode(m[1]), r = render(d); const st = document.createElement("style"); st.textContent = r.css; document.head.appendChild(st); document.title = r.title; host0.innerHTML = r.html; }
    catch (e) { host0.innerHTML = `<div style="max-width:560px;margin:80px auto;padding:20px;font:16px/1.6 system-ui;text-align:center"><h1>Can't open this portfolio</h1><p>${esc(e.message || "The link looks broken. Ask the owner to copy it again.")}</p></div>`; } };
  window.addEventListener("hashchange", show); show();
})();
