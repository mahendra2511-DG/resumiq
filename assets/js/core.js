/* Resumiq core — shared by every page: config, local + cloud store, Supabase auth, AI client, UI helpers, header/footer, Dexa chat.
   Data is local-first (browser). When signed in, documents also sync to Supabase table rq_docs (row-level security: own rows only). */
(function () {
  "use strict";
  const CFG = {
    SUPABASE_URL: "https://huskawxfnbsriulcrvsx.supabase.co",
    SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1c2thd3hmbmJzcml1bGNydnN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5NjA0MTcsImV4cCI6MjA5NTUzNjQxN30.mj8IyY7Rcfh8V7mhEtbVXMrpxHzIIAr-OLOIMHKd5TQ',           // public anon key (safe in the browser; data is protected by RLS)
    ADMIN_EMAIL: "mahendraa1188@gmail.com",
    CRACK_URL: "https://www.crackanalytics.com/",
    AI_URL: "/api/ai",
  };
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  const rel = (t) => { if (!t) return ""; const s = (Date.now() - new Date(t).getTime()) / 1000; if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + " min ago"; if (s < 86400) return Math.floor(s / 3600) + " h ago"; if (s < 86400 * 7) return Math.floor(s / 86400) + " d ago"; return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); };
  const fmtDay = (d) => { if (!d) return ""; const x = new Date(String(d).length <= 10 ? d + "T12:00:00" : d); return isNaN(x) ? d : x.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); };

  /* ---------- toast / modal / confirm ---------- */
  function toast(msg, kind) { let w = $(".toasts"); if (!w) { w = document.createElement("div"); w.className = "toasts"; w.setAttribute("role", "status"); document.body.appendChild(w); } const t = document.createElement("div"); t.className = "toast " + (kind || ""); t.textContent = msg; w.appendChild(t); setTimeout(() => t.remove(), 3600); }
  let lastFocus = null;
  function modal(html, opts) {
    opts = opts || {}; closeModal(); lastFocus = document.activeElement;
    const bg = document.createElement("div"); bg.className = "modal-bg"; bg.id = "rq-modal";
    bg.innerHTML = `<div class="modal ${opts.wide ? "wide" : ""}" role="dialog" aria-modal="true"><button type="button" class="icon-btn modal-x" aria-label="Close">✕</button>${html}</div>`;
    document.body.appendChild(bg);
    const close = () => closeModal();
    bg.querySelector(".modal-x").onclick = close;
    if (!opts.sticky) bg.addEventListener("mousedown", (e) => { if (e.target === bg) close(); });
    const f = bg.querySelector("input,textarea,select,button:not(.modal-x)"); setTimeout(() => f && f.focus(), 30);
    return bg.querySelector(".modal");
  }
  function closeModal() { const m = $("#rq-modal"); if (m) { m.remove(); if (lastFocus && lastFocus.focus) lastFocus.focus(); } }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#rq-modal")) closeModal(); });
  function confirmBox(text, okLabel, danger) {
    return new Promise(res => { const m = modal(`<h3>${esc(text)}</h3><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px"><button class="btn btn-ghost" data-no>Cancel</button><button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-yes>${esc(okLabel || "OK")}</button></div>`);
      m.querySelector("[data-no]").onclick = () => { closeModal(); res(false); }; m.querySelector("[data-yes]").onclick = () => { closeModal(); res(true); }; });
  }

  /* ---------- auth (Supabase) ---------- */
  let sb = null, user = null, authReady = false; const authCbs = [];
  function onAuth(cb) { authCbs.push(cb); if (authReady) cb(user); }
  const fire = () => { authReady = true; authCbs.forEach(cb => { try { cb(user); } catch (e) { console.error(e); } }); renderNavUser(); };
  async function initAuth() {
    try { if (window.supabase && window.supabase.createClient) sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); } catch (e) { sb = null; }
    if (!sb) { fire(); return; }
    try { const { data } = await sb.auth.getSession(); user = data && data.session ? data.session.user : null; } catch (e) { user = null; }
    sb.auth.onAuthStateChange(async (evt, session) => {
      const was = user && user.id; user = session ? session.user : null;
      if (evt === "PASSWORD_RECOVERY") newPasswordModal();
      if (user && user.id !== was) { await afterLogin(); }
      if (!user && was) { store.cloudOff(); }
      if ((user && user.id) !== was) fire();
    });
    if (user) await afterLogin();
    fire();
  }
  async function afterLogin() {
    try { await sb.from("profiles").upsert({ id: user.id, email: user.email, name: (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || "" }, { onConflict: "id", ignoreDuplicates: false }); } catch (e) {}
    await store.sync();
  }
  async function token() { if (!sb || !user) return null; try { const { data } = await sb.auth.getSession(); return data && data.session ? data.session.access_token : null; } catch (e) { return null; } }
  const displayName = () => user ? ((user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || user.email.split("@")[0]) : "";
  function authModal(tab, why) {
    tab = tab || "signin";
    const m = modal(`<div class="logo" style="margin-bottom:14px"><span class="logo-mark">R</span><span>Resumiq</span></div>
      ${why ? `<div class="note info">${esc(why)}</div>` : ""}
      <div class="tabs" style="margin-bottom:16px"><button type="button" data-t="signin" class="${tab === "signin" ? "on" : ""}">Sign in</button><button type="button" data-t="signup" class="${tab === "signup" ? "on" : ""}">Create account</button></div>
      <form id="af" novalidate>
        <div data-only="signup" ${tab === "signup" ? "" : "hidden"}><label class="f" for="a-name">Full name</label><input class="input" id="a-name" autocomplete="name" placeholder="Priya Sharma"><div style="height:12px"></div></div>
        <label class="f" for="a-email">Email</label><input class="input" id="a-email" type="email" autocomplete="email" placeholder="you@example.com">
        <div style="height:12px"></div>
        <label class="f" for="a-pass">Password</label><input class="input" id="a-pass" type="password" autocomplete="${tab === "signup" ? "new-password" : "current-password"}" placeholder="${tab === "signup" ? "At least 8 characters" : "Your password"}">
        <div class="err" id="a-err" role="alert"></div>
        <button class="btn btn-primary" style="width:100%" id="a-go">${tab === "signup" ? "Create free account" : "Sign in"}</button>
      </form>
      <div data-only="signin" ${tab === "signin" ? "" : "hidden"} style="text-align:right;margin-top:8px"><button type="button" class="btn-link" id="a-forgot">Forgot password?</button></div>
      <div style="display:flex;align-items:center;gap:10px;margin:16px 0;color:var(--faint);font-size:12px"><span style="flex:1;height:1px;background:var(--line)"></span>OR<span style="flex:1;height:1px;background:var(--line)"></span></div>
      <button type="button" class="btn btn-ghost" style="width:100%" id="a-google"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continue with Google</button>
      <p class="small muted" style="margin:14px 0 0">Free forever. Your resumes are private to your account. You can also use Resumiq without an account (saved in this browser).</p>`);
    m.querySelectorAll("[data-t]").forEach(b => b.onclick = () => authModal(b.dataset.t, why));
    const err = (t) => { m.querySelector("#a-err").textContent = t || ""; };
    m.querySelector("#a-forgot").onclick = () => resetModal(m.querySelector("#a-email").value);
    m.querySelector("#a-google").onclick = async () => { if (!sb) return err("Sign-in is not available right now."); const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + "/app" } }); if (error) err(error.message); };
    m.querySelector("#af").onsubmit = async (e) => {
      e.preventDefault(); if (!sb) return err("Sign-in is not available right now. Check your internet.");
      const email = m.querySelector("#a-email").value.trim(), pass = m.querySelector("#a-pass").value, name = (m.querySelector("#a-name").value || "").trim(), go = m.querySelector("#a-go");
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return err("Enter a valid email address.");
      if (tab === "signup" && name.length < 2) return err("Enter your full name.");
      if (pass.length < (tab === "signup" ? 8 : 1)) return err(tab === "signup" ? "Use at least 8 characters for the password." : "Enter your password.");
      go.disabled = true; go.innerHTML = '<span class="spin"></span> Please wait…'; err("");
      try {
        if (tab === "signup") {
          const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name }, emailRedirectTo: location.origin + "/app" } });
          if (error) throw error;
          track("signup");
          if (!data.session) { closeModal(); modal(`<h3>Check your email 📬</h3><p>We sent a confirmation link to <b>${esc(email)}</b>. Open it to finish creating your account, then sign in.</p>`); return; }
        } else { const { error } = await sb.auth.signInWithPassword({ email, password: pass }); if (error) throw error; track("login"); }
        closeModal(); toast("Welcome to Resumiq!", "ok");
      } catch (x) { err(/invalid login/i.test(x.message) ? "Wrong email or password." : /already registered/i.test(x.message) ? "This email already has an account. Sign in instead." : x.message); }
      go.disabled = false; go.textContent = tab === "signup" ? "Create free account" : "Sign in";
    };
  }
  function resetModal(email) {
    const m = modal(`<h3>Reset your password</h3><p class="muted">Enter your account email. We'll send a secure link to set a new password.</p>
      <label class="f" for="r-email">Email</label><input class="input" id="r-email" type="email" value="${esc(email || "")}"><div class="err" id="r-err"></div><button class="btn btn-primary" style="width:100%" id="r-go">Send reset link</button>`);
    m.querySelector("#r-go").onclick = async () => { const e = m.querySelector("#r-email").value.trim(); if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e)) { m.querySelector("#r-err").textContent = "Enter a valid email."; return; }
      if (!sb) { m.querySelector("#r-err").textContent = "Not available right now."; return; }
      const { error } = await sb.auth.resetPasswordForEmail(e, { redirectTo: location.origin + "/app" }); if (error) { m.querySelector("#r-err").textContent = error.message; return; }
      m.innerHTML = `<h3>Check your inbox 📬</h3><p>If <b>${esc(e)}</b> has an account, a reset link is on its way. Open it on this device to choose a new password.</p><button class="btn btn-primary" onclick="RQ.closeModal()">OK</button>`; };
  }
  function newPasswordModal() {
    const m = modal(`<h3>Choose a new password</h3><label class="f" for="np">New password</label><input class="input" id="np" type="password" autocomplete="new-password" placeholder="At least 8 characters"><div class="err" id="np-err"></div><button class="btn btn-primary" style="width:100%" id="np-go">Save password</button>`, { sticky: true });
    m.querySelector("#np-go").onclick = async () => { const p = m.querySelector("#np").value; if (p.length < 8) { m.querySelector("#np-err").textContent = "Use at least 8 characters."; return; }
      const { error } = await sb.auth.updateUser({ password: p }); if (error) { m.querySelector("#np-err").textContent = error.message; return; } closeModal(); toast("Password updated. You're signed in.", "ok"); };
  }
  async function signOut() { if (sb) await sb.auth.signOut(); user = null; store.cloudOff(); fire(); toast("Signed out."); if (/\/(app|admin)/.test(location.pathname)) location.href = "/"; }

  /* ---------- store: local-first docs, synced to Supabase rq_docs when signed in ---------- */
  const KEY = "rq_docs_v1";
  const store = (function () {
    let docs = ls.get(KEY, []); if (!Array.isArray(docs)) docs = [];
    let cloud = false, cloudErr = "";
    const subs = [];
    const persist = () => { if (!ls.set(KEY, docs)) toast("Your browser storage is full. Delete old items or sign in to keep a cloud copy.", "bad"); subs.forEach(f => { try { f(); } catch (e) {} }); };
    const pending = new Map();
    const push = debounce(async () => {
      if (!cloud || !sb || !user) return; const rows = [...pending.values()]; pending.clear(); if (!rows.length) return;
      const { error } = await sb.from("rq_docs").upsert(rows.map(d => ({ id: d.id, user_id: user.id, kind: d.kind, title: d.title || "", data: d.data || {}, created_at: d.created, updated_at: d.updated })));
      if (error) { cloudErr = error.message; rows.forEach(r => pending.set(r.id, r)); }
    }, 900);
    return {
      list(kind) { return docs.filter(d => !d.deleted && (!kind || d.kind === kind)).sort((a, b) => String(b.updated).localeCompare(String(a.updated))); },
      get(id) { return docs.find(d => d.id === id && !d.deleted) || null; },
      save(doc) { doc = Object.assign({}, doc); if (!doc.id) delete doc.id; const now = new Date().toISOString(); let d = doc.id && docs.find(x => x.id === doc.id);
        if (!d) { d = Object.assign({ id: uid(), created: now }, doc); docs.push(d); } else Object.assign(d, doc);
        d.updated = now; persist(); if (cloud) { pending.set(d.id, d); push(); } return d; },
      async remove(id) { const d = docs.find(x => x.id === id); docs = docs.filter(x => x.id !== id); persist(); if (cloud && d) { const { error } = await sb.from("rq_docs").delete().eq("id", id); if (error) toast("Deleted here, but the cloud copy could not be deleted: " + error.message, "bad"); } },
      subscribe(f) { subs.push(f); },
      get cloud() { return cloud; }, get cloudErr() { return cloudErr; },
      cloudOff() { cloud = false; },
      async sync() {
        if (!sb || !user) return;
        const { data, error } = await sb.from("rq_docs").select("id,kind,title,data,created_at,updated_at").order("updated_at", { ascending: false }).limit(1000);
        if (error) { cloud = false; cloudErr = /relation|does not exist|schema cache/i.test(error.message) ? "Cloud save is not set up yet (run supabase.sql)." : error.message; persist(); return; }
        cloud = true; cloudErr = "";
        const byId = new Map(docs.map(d => [d.id, d]));
        (data || []).forEach(r => { const l = byId.get(r.id); const c = { id: r.id, kind: r.kind, title: r.title, data: r.data, created: r.created_at, updated: r.updated_at };
          if (!l || String(c.updated) > String(l.updated)) byId.set(r.id, c); });
        docs = [...byId.values()];
        const cloudIds = new Set((data || []).map(r => r.id));
        docs.filter(d => !cloudIds.has(d.id) || String(d.updated) > String(((data || []).find(r => r.id === d.id) || {}).updated_at || "")).forEach(d => pending.set(d.id, d));
        persist(); push();
      },
      exportAll() { return JSON.stringify({ app: "Resumiq", exported: new Date().toISOString(), docs: this.list() }, null, 1); },
      async wipe() { const ids = docs.map(d => d.id); docs = []; persist(); if (cloud && ids.length) await sb.from("rq_docs").delete().in("id", ids); },
    };
  })();

  /* ---------- anonymous usage events for the owner's admin panel ---------- */
  const vid = (() => { let v = ls.get("rq_vid", ""); if (!/^[a-z0-9]{8,40}$/i.test(v)) { v = (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)); ls.set("rq_vid", v); } return v; })();
  async function track(k, d) {
    try { if (navigator.doNotTrack === "1") return; const t = await token(); const q = new URLSearchParams(location.search);
      fetch("/api/track", { method: "POST", keepalive: true, headers: Object.assign({ "Content-Type": "application/json" }, t ? { Authorization: "Bearer " + t } : {}), body: JSON.stringify({ k, d: d || "", p: location.pathname + (q.get("ref") ? "?ref=" + q.get("ref") : ""), r: q.get("ref") || document.referrer || "", v: vid }) }).catch(() => {}); } catch (e) {}
  }
  /* ---------- AI (server: /api/ai → Grok or Groq) ---------- */
  async function ai(mode, payload) {
    const t = await token(); let r, j = null;
    try { r = await fetch(CFG.AI_URL, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, t ? { Authorization: "Bearer " + t } : {}), body: JSON.stringify(Object.assign({ mode, vid, page: location.pathname }, payload || {})) }); j = await r.json().catch(() => null); }
    catch (e) { throw new Error("You seem to be offline. Check your internet and try again."); }
    if (j && typeof j.left === "number") { aiLeft = j.left; renderCredits(); }
    if (r.ok && j && j.ok) return j;
    const e = new Error((j && j.message) || (r.status === 404 ? "The AI service is not deployed yet." : "Dexa could not answer right now. Please try again.")); e.code = j && j.error; e.status = r.status;
    if (j && j.error === "daily_limit" && !user) setTimeout(() => authModal("signup", "You've used today's free AI credits as a guest. Create a free account to get more every day."), 300);
    throw e;
  }
  let aiLeft = null;
  function renderCredits() { $$("[data-ai-left]").forEach(el => { el.textContent = aiLeft == null ? "" : `${aiLeft} AI credit${aiLeft === 1 ? "" : "s"} left today`; }); }

  /* ---------- header / footer ---------- */
  const PRODUCTS = [["/studio", "✍️", "Resume Studio", "Build and edit with live preview"], ["/job-match", "🎯", "ATS & Job Match", "Compare a resume with a job description"], ["/app#/cover-letter", "✉️", "Cover Letter Studio", "Tailored, truthful cover letters"], ["/app#/linkedin", "💼", "LinkedIn Optimizer", "Headline, About and skills"], ["/app#/interview", "🎤", "Interview Prep", "Questions from your resume + JD"], ["/app#/applications", "📋", "Application Tracker", "Track every application"], ["/app#/jobs", "🔎", "Job Finder", "Search Naukri, LinkedIn, Internshala"]];
  function header() {
    const page = document.body.dataset.page || "";
    const h = document.createElement("header"); h.className = "rq-nav";
    h.innerHTML = `<div class="container"><a href="/" class="logo" aria-label="Resumiq home"><span class="logo-mark">R</span><span>Resumiq<small>with Dexa AI</small></span></a>
      <nav class="nav-links" aria-label="Main"><div class="dd"><button type="button" aria-expanded="false">Product ▾</button><div class="dd-menu">${PRODUCTS.map(([u, i, t, d]) => `<a href="${u}"><span class="dd-ic">${i}</span><span><b>${t}</b><span>${d}</span></span></a>`).join("")}</div></div>
        <a href="/samples" class="${page === "samples" ? "on" : ""}">Samples</a><a href="/templates" class="${page === "templates" ? "on" : ""}">Templates</a><a href="/career-roles" class="${page === "roles" ? "on" : ""}">Career Roles</a><a href="/resume-guide" class="${page === "guide" ? "on" : ""}">Resume Guide</a><a href="/#pricing">Pricing</a></nav>
      <div class="nav-right"><span id="nav-user"></span><a href="/studio" class="btn btn-primary btn-sm hide-m">Build my resume</a><button type="button" class="icon-btn nav-burger" aria-label="Menu" aria-expanded="false">☰</button></div></div>
      <div class="mobile-menu" id="mm">${PRODUCTS.map(([u, i, t]) => `<a href="${u}">${i} ${t}</a>`).join("")}<a href="/samples">⭐ Samples</a><a href="/templates">📄 Templates</a><a href="/career-roles">🧭 Career Roles</a><a href="/resume-guide">📘 Resume Guide</a><a href="/app">🏠 Dashboard</a><a href="/#pricing">💳 Pricing</a></div>`;
    document.body.prepend(h);
    const dd = h.querySelector(".dd"), ddb = dd.querySelector("button");
    ddb.onclick = (e) => { e.stopPropagation(); const o = !dd.classList.contains("open"); dd.classList.toggle("open", o); ddb.setAttribute("aria-expanded", String(o)); };
    document.addEventListener("click", (e) => { if (!dd.contains(e.target)) { dd.classList.remove("open"); ddb.setAttribute("aria-expanded", "false"); } });
    const bg = h.querySelector(".nav-burger"); bg.onclick = () => { const mm = $("#mm"), o = !mm.classList.contains("open"); mm.classList.toggle("open", o); bg.setAttribute("aria-expanded", String(o)); };
    renderNavUser();
  }
  function renderNavUser() {
    const el = $("#nav-user"); if (!el) return;
    if (!authReady) { el.innerHTML = ""; return; }
    if (user) { el.innerHTML = `<div class="dd" id="ud"><button type="button" class="btn btn-ghost btn-sm" style="padding:4px 10px 4px 4px" aria-expanded="false"><span class="avatar" style="width:28px;height:28px;font-size:12px">${esc(displayName().charAt(0).toUpperCase())}</span><span class="hide-m">${esc(displayName().split(" ")[0])}</span></button>
        <div class="dd-menu" style="left:auto;right:0;min-width:220px"><a href="/app"><span class="dd-ic">🏠</span><span><b>Dashboard</b></span></a><a href="/app#/resumes"><span class="dd-ic">📄</span><span><b>My resumes</b></span></a><a href="/app#/settings"><span class="dd-ic">⚙️</span><span><b>Settings</b></span></a>${user.email === CFG.ADMIN_EMAIL ? `<a href="/admin"><span class="dd-ic">🛡️</span><span><b>Admin</b></span></a>` : ""}<a href="#" data-out><span class="dd-ic">↩</span><span><b>Sign out</b></span></a></div></div>`;
      const ud = $("#ud"), b = ud.querySelector("button"); b.onclick = (e) => { e.stopPropagation(); ud.classList.toggle("open"); b.setAttribute("aria-expanded", String(ud.classList.contains("open"))); };
      document.addEventListener("click", (e) => { if (!ud.contains(e.target)) ud.classList.remove("open"); });
      ud.querySelector("[data-out]").onclick = (e) => { e.preventDefault(); signOut(); };
    } else { el.innerHTML = `<a href="/app" class="btn btn-ghost btn-sm hide-m">Dashboard</a> <button type="button" class="btn btn-ghost btn-sm" id="nav-signin">Sign in</button>`; $("#nav-signin").onclick = () => authModal("signin"); }
  }
  function footer() {
    const f = document.createElement("footer"); f.className = "rq-foot";
    f.innerHTML = `<div class="container"><div class="cols"><div><a href="/" class="logo"><span class="logo-mark">R</span><span>Resumiq</span></a><p style="margin-top:12px;font-size:14px;max-width:300px">Free AI resume & career copilot by Mahendra Singh. Build truthful, role-specific resumes and tailor them to every job.</p><p style="font-size:13px">Part of <a href="${CFG.CRACK_URL}" target="_blank" rel="noopener">CrackAnalytics</a></p></div>
      <div><h4>Product</h4><ul><li><a href="/studio">Resume Studio</a></li><li><a href="/job-match">ATS & Job Match</a></li><li><a href="/app#/cover-letter">Cover letters</a></li><li><a href="/app#/linkedin">LinkedIn optimizer</a></li><li><a href="/app#/interview">Interview prep</a></li></ul></div>
      <div><h4>Resources</h4><ul><li><a href="/samples">Resume samples</a></li><li><a href="/templates">Templates</a></li><li><a href="/career-roles">Career roles</a></li><li><a href="/resume-guide">Resume guide</a></li><li><a href="/#faq">FAQ</a></li></ul></div>
      <div><h4>Account</h4><ul><li><a href="/app">Dashboard</a></li><li><a href="/app#/applications">Application tracker</a></li><li><a href="/app#/settings">Settings & data</a></li></ul></div>
      <div><h4>Company</h4><ul><li><a href="/about">About</a></li><li><a href="/contact">Contact</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li></ul></div></div>
      <div class="fine"><span>© ${new Date().getFullYear()} Resumiq · Made in India by Mahendra Singh</span><span>AI suggestions can be wrong: always review before you apply. Scores are guidance, not an employer's ATS result.</span></div></div>`;
    document.body.appendChild(f);
  }

  /* ---------- Dexa chat (opened by the owl corner, assets/js/dexa.js) ---------- */
  const dx = { hist: [] };
  function dexaPanel() {
    if ($("#dx-panel")) return;
    const p = document.createElement("div"); p.className = "dx-panel"; p.id = "dx-panel"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Ask Dexa");
    p.innerHTML = `<div class="dx-head"><img src="/assets/img/dexa-avatar.svg" alt="" width="34" height="34"><div><b>Dexa</b><span>Your resume & career coach</span></div><button type="button" aria-label="Close">✕</button></div><div class="dx-body" id="dx-body"></div><form class="dx-in" id="dx-form"><input id="dx-q" maxlength="700" autocomplete="off" placeholder="Ask Dexa…" aria-label="Message Dexa"><button type="submit" aria-label="Send">➤</button></form>`;
    document.body.appendChild(p);
    p.querySelector(".dx-head button").onclick = () => dexaToggle(false);
    p.querySelector("#dx-form").onsubmit = (e) => { e.preventDefault(); dexaAsk(p.querySelector("#dx-q").value); };
  }
  const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split(/\n{2,}/).map(par => /^\s*([-*•]|\d+\.) /m.test(par) ? "<ul>" + par.split("\n").filter(x => x.trim()).map(x => "<li>" + x.replace(/^\s*([-*•]|\d+\.)\s*/, "") + "</li>").join("") + "</ul>" : "<p>" + par.replace(/\n/g, "<br>") + "</p>").join("");
  function dxMsg(who, html) { const b = $("#dx-body"), d = document.createElement("div"); d.className = "dx-msg " + who; d.innerHTML = html; b.appendChild(d); b.scrollTop = 1e9; return d; }
  function dexaToggle(force) {
    dexaPanel(); const p = $("#dx-panel"), open = typeof force === "boolean" ? force : !p.classList.contains("open"); p.classList.toggle("open", open);
    if (open && !$("#dx-body").children.length) {
      const ctx = window.RQ_DEXA && window.RQ_DEXA.intro; dxMsg("bot", `<p>Hi! I'm <b>Dexa</b> 🦉. ${ctx ? esc(ctx) : "Ask me about resumes, job descriptions, interviews or LinkedIn."}</p>`);
      const sug = (window.RQ_DEXA && window.RQ_DEXA.suggest) || ["How do I write a strong resume bullet?", "What should a fresher put on a resume?", "How do I tailor my resume to a job?", "Give me a LinkedIn headline idea"];
      const s = dxMsg("bot", `<div style="display:flex;flex-wrap:wrap;gap:6px">${sug.map(q => `<button type="button" class="chip">${esc(q)}</button>`).join("")}</div>`); s.querySelectorAll("button").forEach(b => b.onclick = () => dexaAsk(b.textContent));
    }
    if (open) setTimeout(() => $("#dx-q").focus(), 40);
  }
  async function dexaAsk(q) {
    q = String(q || "").trim(); if (!q) return; dxMsg("me", esc(q)); $("#dx-q").value = "";
    const t = dxMsg("bot", '<span class="spin"></span> Dexa is thinking…');
    try { const ctx = window.RQ_DEXA && window.RQ_DEXA.context ? window.RQ_DEXA.context() : ""; const j = await ai("chat", { q, context: ctx, history: dx.hist.slice(-6) }); t.innerHTML = md(j.text); dx.hist.push({ r: "user", c: q }, { r: "assistant", c: j.text }); }
    catch (e) { t.innerHTML = `<p>⚠ ${esc(e.message)}</p>`; }
    $("#dx-body").scrollTop = 1e9;
  }
  window.DEXA_CA = { panel: "#dx-panel", toggle: () => dexaToggle(), close: () => dexaToggle(false) };

  /* ---------- boot ---------- */
  window.RQ = { track, CFG, $, $$, esc, uid, debounce, ls, rel, fmtDay, toast, modal, closeModal, confirm: confirmBox, store, ai, md, authModal, signOut, onAuth, get user() { return user; }, get sb() { return sb; }, token, displayName, dexa: { toggle: dexaToggle, ask: dexaAsk }, renderCredits };
  document.addEventListener("DOMContentLoaded", () => {
    if (!document.body.hasAttribute("data-nochrome")) { header(); footer(); }
    dexaPanel(); initAuth().finally(() => { if (!/^\/admin/.test(location.pathname)) track("visit"); });
  });
})();
