/* ============================================================
   Daily Pages — app logic
   Static frontend • Supabase auth + database • GitHub Pages
   ============================================================ */
(function () {
  "use strict";

  // ---- Config check ---------------------------------------------------------
  const cfg = window.JOURNAL_CONFIG || {};
  const configured =
    !!cfg.SUPABASE_URL &&
    !!cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR_") &&
    !cfg.SUPABASE_ANON_KEY.includes("YOUR_");

  // ---- Tiny DOM helpers -----------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    Object.assign(n, props);
    for (const k of kids) if (k != null) n.append(k);
    return n;
  }

  // ---- Theme ----------------------------------------------------------------
  const THEME_KEY = "dp-theme";
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    // theme-toggle icons are masked CSS (.ic-theme) that swap on [data-theme]
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  (function initTheme() {
    let t;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (!t) t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(t);
  })();

  // ---- Skin (visual theme) --------------------------------------------------
  const SKIN_KEY = "dp-skin";
  function currentSkin() { return document.documentElement.getAttribute("data-skin") || "sanctuary"; }
  function applySkin(skin) {
    document.documentElement.setAttribute("data-skin", skin);
    try { localStorage.setItem(SKIN_KEY, skin); } catch (e) {}
    refreshSettingsUI();
  }
  function refreshSettingsUI() {
    $$(".skin-option").forEach((b) => b.classList.toggle("active", b.dataset.skin === currentSkin()));
    $$(".mode-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === currentTheme()));
  }
  function openSettings() { $("#settings-view").hidden = false; refreshSettingsUI(); }
  function closeSettings() { $("#settings-view").hidden = true; }

  // ---- Avatar dropdown menu -------------------------------------------------
  function closeUserMenu() {
    const dd = $("#user-dropdown"), ab = $("#user-avatar-btn");
    if (dd) dd.hidden = true;
    if (ab) ab.setAttribute("aria-expanded", "false");
  }
  function toggleUserMenu() {
    const dd = $("#user-dropdown"), ab = $("#user-avatar-btn");
    if (!dd) return;
    const willOpen = dd.hidden;
    dd.hidden = !willOpen;
    if (ab) ab.setAttribute("aria-expanded", String(willOpen));
  }

  // ---- Composer formatting toolbar (lightweight markdown) -------------------
  function applyTool(cmd) {
    const ta = $("#compose-input");
    if (!ta) return;
    if (cmd === "mic" || cmd === "tag") { toast("That tool isn't available yet."); return; }
    const s = ta.selectionStart, e = ta.selectionEnd, v = ta.value, sel = v.slice(s, e);
    let ins = sel;
    if (cmd === "bold") ins = `**${sel || "bold"}**`;
    else if (cmd === "italic") ins = `*${sel || "italic"}*`;
    else if (cmd === "list") ins = (s > 0 && v[s - 1] !== "\n" ? "\n" : "") + `- ${sel}`;
    else if (cmd === "link") ins = `[${sel || "text"}](url)`;
    ta.value = v.slice(0, s) + ins + v.slice(e);
    ta.focus();
    const pos = s + ins.length;
    ta.setSelectionRange(pos, pos);
    autoGrow(ta);
    updateWords();
  }
  (function initSkin() {
    let s = "sanctuary";
    try {
      s = localStorage.getItem(SKIN_KEY) || "sanctuary";
      // One-time migration: land everyone on the new Sanctuary design once,
      // then respect whatever they pick afterwards.
      if (!localStorage.getItem("dp-skin-v2")) {
        s = "sanctuary";
        localStorage.setItem(SKIN_KEY, "sanctuary");
        localStorage.setItem("dp-skin-v2", "1");
      }
    } catch (e) {}
    document.documentElement.setAttribute("data-skin", s);
  })();

  (function initMastheadDate() {
    const e = document.getElementById("masthead-date");
    if (!e) return;
    e.textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  })();

  // ---- Date utils (local time, timezone-safe strings) -----------------------
  const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const MON_SHORT = MON.map((m) => m.slice(0, 3));
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = () => ymd(new Date());
  function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return ymd(d); }
  function longDate(s) { const d = parseDate(s); return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }
  function shortDate(s) { const d = parseDate(s); return `${MON_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }
  function dateNoDow(s) { const d = parseDate(s); return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }

  // ---- Moods ----------------------------------------------------------------
  const MOODS = [
    { key: "great", emoji: "😄", label: "Great" },
    { key: "good",  emoji: "🙂", label: "Good" },
    { key: "meh",   emoji: "😐", label: "Okay" },
    { key: "down",  emoji: "😔", label: "Low" },
    { key: "awful", emoji: "😣", label: "Rough" },
  ];
  const moodOf = (k) => MOODS.find((m) => m.key === k) || null;
  const moodEmoji = (k) => (moodOf(k) ? moodOf(k).emoji : "");
  const MOOD_SCORE = { great: 5, good: 4, meh: 3, down: 2, awful: 1 };
  const MOOD_COLOR = { great: "#54bd62", good: "#8ece6c", meh: "#f4cf4f", down: "#f0a24b", awful: "#ec6a6a" };
  const MOOD_LIGHT = { great: "#82d67e", good: "#b6e28f", meh: "#ffe07e", down: "#f8c07f", awful: "#f6a3a3" };
  // "Sanctuary" reference palette: calendar dots, insight bars, and the low→high order (1..5)
  const MOOD_DOT = { great: "#79b7f7", good: "#86ce9b", meh: "#f5ce66", down: "#f6b278", awful: "#f9b4ab" };
  const MOOD_BAR = { great: "#4d9bf7", good: "#52b779", meh: "#f6c653", down: "#f59e6b", awful: "#f87171" };
  const MOOD_ORDER = ["awful", "down", "meh", "good", "great"]; // reference shows worst → best, labelled 1..5
  const NODE_COLORS = ["#86ce9b", "#f5ce66", "#79b7f7", "#f6b278", "#f9b4ab"]; // decorative timeline nodes
  // Expressive mood faces (rounded-square, subtle gradient, features in currentColor/theme ink).
  function moodFace(key, size = 28) {
    const base = MOOD_COLOR[key] || "var(--muted)";
    const light = MOOD_LIGHT[key] || base;
    const gid = "mf" + Math.random().toString(36).slice(2, 8);
    const dots = '<circle cx="14.8" cy="16.8" r="1.9" fill="currentColor"/><circle cx="25.2" cy="16.8" r="1.9" fill="currentColor"/>';
    const spark = '<g stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M27 11 l2.3 -2.3"/><path d="M30 12.4 l2.3 -2.3"/><path d="M28.2 14 l1.9 -1.9"/></g>';
    const F = {
      great: '<path d="M11 17.6 Q14.5 14 18 17.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M22 17.6 Q25.5 14 29 17.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M13.5 23.5 Q20 31.5 26.5 23.5 Z" fill="currentColor"/>' + spark,
      good:  dots + '<path d="M14 24 Q20 28.8 26 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' + spark,
      meh:   dots + '<path d="M14.5 25.5 L25.5 25.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
      down:  dots + '<path d="M11.6 15 L16.6 13.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M28.4 15 L23.4 13.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M14 27.6 Q20 23.4 26 27.6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>',
      awful: '<path d="M12 14.8 L16 16.8 L12 18.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 14.8 L24 16.8 L28 18.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 28 Q20 22 26.5 28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' + spark,
    };
    return `<svg class="mood-face" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">`
      + `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${base}"/></linearGradient></defs>`
      + `<rect x="4" y="4" width="32" height="32" rx="9.5" fill="url(#${gid})" stroke="currentColor" stroke-width="2.6"/>`
      + (F[key] || F.meh) + `</svg>`;
  }
  function faceEl(key, size) { const s = el("span", { className: "mood-face-wrap" }); s.innerHTML = moodFace(key, size); return s; }

  // "Sanctuary" watercolor blob faces (ported from the reference design).
  const MOOD_BLOB = {
    awful: { fill: "#f8b6ac",
      path: "M12 25 C10 12, 22 6, 35 7 C46 8, 52 16, 50 28 C48 40, 36 45, 24 44 C12 43, 14 35, 12 25 Z",
      face: '<circle cx="23" cy="23" r="2.4" fill="#334155"/><circle cx="37" cy="23" r="2.4" fill="#334155"/><path d="M26 34 Q30 29 34 34" fill="none" stroke="#334155" stroke-width="2.2" stroke-linecap="round"/>' },
    down: { fill: "#f8ba7b",
      path: "M10 27 C8 15, 20 7, 33 8 C45 9, 52 18, 49 30 C46 41, 34 45, 22 43 C11 41, 12 37, 10 27 Z",
      face: '<circle cx="23" cy="24" r="2.2" fill="#334155"/><circle cx="37" cy="24" r="2.2" fill="#334155"/><path d="M21 19 L25 21" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><path d="M39 19 L35 21" stroke="#334155" stroke-width="1.5" stroke-linecap="round"/><path d="M26 33 Q30 29 34 33" fill="none" stroke="#334155" stroke-width="2" stroke-linecap="round"/>' },
    meh: { fill: "#f8d370",
      path: "M12 25 C10 13, 23 8, 36 9 C47 10, 52 18, 50 30 C48 42, 35 45, 24 44 C13 43, 14 36, 12 25 Z",
      face: '<circle cx="23" cy="24" r="2.2" fill="#334155"/><circle cx="37" cy="24" r="2.2" fill="#334155"/><line x1="26" y1="31" x2="34" y2="31" stroke="#334155" stroke-width="2.2" stroke-linecap="round"/>' },
    good: { fill: "#93dca5",
      path: "M12 25 C10 12, 23 6, 36 8 C48 10, 52 19, 50 31 C48 41, 35 45, 24 44 C13 43, 14 36, 12 25 Z",
      face: '<path d="M21 21 Q24 18 27 21" fill="none" stroke="#2d4a3e" stroke-width="2" stroke-linecap="round"/><path d="M33 21 Q36 18 39 21" fill="none" stroke="#2d4a3e" stroke-width="2" stroke-linecap="round"/><path d="M24 28 Q30 36 36 28 Z" fill="#2d4a3e"/>' },
    great: { fill: "#88c0fa",
      path: "M12 25 C10 13, 23 8, 36 8 C48 9, 52 18, 50 30 C48 41, 36 45, 24 44 C13 43, 14 36, 12 25 Z",
      face: '<path d="M21 21 Q24 17 27 21" fill="none" stroke="#1e3a5f" stroke-width="2.2" stroke-linecap="round"/><path d="M33 21 Q36 17 39 21" fill="none" stroke="#1e3a5f" stroke-width="2.2" stroke-linecap="round"/><path d="M24 27 Q30 38 36 27 Z" fill="#1e3a5f"/>' },
  };
  function moodBlob(key, size = 48) {
    const b = MOOD_BLOB[key] || MOOD_BLOB.meh;
    const h = Math.round((size * 50) / 60);
    return `<svg viewBox="0 0 60 50" width="${size}" height="${h}" aria-hidden="true"><path d="${b.path}" fill="${b.fill}"/>${b.face}</svg>`;
  }

  // ---- Daily prompts --------------------------------------------------------
  const PROMPTS = [
    "What's one small thing that went well today?",
    "What are you grateful for right now?",
    "Describe a moment today you'd like to remember.",
    "What's been on your mind lately?",
    "What drained your energy today, and what restored it?",
    "If today had a title, what would it be?",
    "What did you learn today — about anything or anyone?",
    "Who are you thankful for, and why?",
    "What's something you're looking forward to?",
    "What would make tomorrow a little better?",
    "How are you really doing, underneath it all?",
    "What did you do today that your future self will thank you for?",
    "What's a challenge you're facing, and one next step?",
    "Describe your mood in a few honest words.",
    "What made you smile today?",
    "What would you tell a friend who had the day you just had?",
    "What's taking up the most space in your head right now?",
    "Name one thing you did just for yourself today.",
    "What felt meaningful today, even if it was small?",
    "What are you letting go of?",
    "What's a decision you're weighing?",
    "Where did you feel most like yourself today?",
    "What's something you noticed today that you usually miss?",
    "If you could redo one moment from today, which and how?",
  ];
  function promptForToday() {
    const seed = Math.floor(parseDate(todayStr()).getTime() / 86400000);
    return PROMPTS[((seed % PROMPTS.length) + PROMPTS.length) % PROMPTS.length];
  }

  // ---- State ----------------------------------------------------------------
  let sb = null;
  let currentUser = null;
  let allEntries = [];            // rows, newest first
  let byDate = new Map();         // entry_date -> row
  let selectedDate = todayStr();
  let curMood = "";
  let curSections = [];           // [{ ts, text }] for the currently open day
  let readerMode = false;
  let calCursor = new Date();     // any date within the displayed month
  let saveTimer = null;
  let dirty = false;
  let toastTimer = null;
  let insightsPeriod = "week";
  let currentView = "journal";
  let planDate = todayStr();
  let planFocus = "";
  let planItems = [];        // [{ id, text, done }]
  let plansLoaded = false;
  let plansByDate = new Map(); // plan_date -> plan row (all plans, loaded once)
  let planDirty = false;
  let planSaveTimer = null;

  // ---- Small UI helpers -----------------------------------------------------
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }
  function setSaveStatus(text, saved) {
    const s = $("#save-status");
    s.textContent = text;
    s.classList.toggle("saved", !!saved);
  }
  function showMsg(text, type) {
    const m = $("#auth-msg");
    m.textContent = text;
    m.className = "msg " + (type === "err" ? "msg-err" : "msg-ok");
    m.hidden = false;
  }
  function hideMsg() { $("#auth-msg").hidden = true; }
  function firstLine(s) { return (s || "").split("\n").map((x) => x.trim()).find(Boolean) || ""; }

  // ---- Journal entries: a day's content is a JSON list of { ts, text } sections
  function sectionsOf(row) {
    if (!row) return [];
    const c = row.content;
    if (typeof c !== "string") return [];
    const t = c.trim();
    if (!t) return [];
    if (t[0] === "[") { try { const a = JSON.parse(t); if (Array.isArray(a)) return a; } catch (e) {} }
    return [{ ts: null, text: c }]; // legacy single-blob entry
  }
  function dayText(row) { return sectionsOf(row).map((s) => s.text).join("\n\n"); }
  function dayWordCount(row) { const t = dayText(row).trim(); return t ? t.split(/\s+/).length : 0; }
  function hasEntry(ds) { const r = byDate.get(ds); return !!(r && sectionsOf(r).length > 0); }
  function fmtTime(ts) {
    if (!ts) return "";
    const d = new Date(ts); let h = d.getHours(); const m = d.getMinutes();
    const ap = h < 12 ? "AM" : "PM"; h = h % 12 || 12;
    return `${h}:${pad(m)} ${ap}`;
  }
  function autoGrow(ta) { if (!ta) return; ta.style.height = "auto"; ta.style.height = Math.max(ta.scrollHeight, 24) + "px"; }
  // Time label — shows the date too when the entry was written on a different day than the one it's filed under
  function fmtStamp(ts, dayStr) {
    if (!ts) return "Earlier";
    const t = fmtTime(ts);
    if (dayStr && ymd(new Date(ts)) !== dayStr) {
      const d = new Date(ts);
      return `${MON_SHORT[d.getMonth()]} ${d.getDate()} · ${t}`;
    }
    return t;
  }
  // Run a DOM change without the page jumping — keep the viewport anchored to the bottom content
  function withScrollStable(fn) {
    const y = window.scrollY;
    const before = document.documentElement.scrollHeight;
    fn();
    const after = document.documentElement.scrollHeight;
    window.scrollTo(0, Math.max(0, y + (after - before)));
  }

  // ---- Auth mode toggle -----------------------------------------------------
  let authMode = "login";
  function setAuthMode(mode) {
    authMode = mode;
    const isLogin = mode === "login";
    const set = (sel, txt) => { const n = $(sel); if (n) n.textContent = txt; };
    $$(".seg-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.mode === mode));
    set("#auth-submit-label", isLogin ? "Log in" : "Create account");
    set("#auth-title", isLogin ? "Welcome back" : "Create your account");
    set("#auth-subtitle", isLogin ? "Sign in to continue your daily pages." : "Start your first daily page.");
    set("#auth-toggle-q", isLogin ? "Don't have an account?" : "Already have an account?");
    set("#auth-toggle", isLogin ? "Sign up" : "Log in");
    const p = $("#password"); if (p) p.setAttribute("autocomplete", isLogin ? "current-password" : "new-password");
    hideMsg();
  }

  // Google OAuth via Supabase (button is live; shows a gentle note until the
  // provider is enabled in the Supabase dashboard).
  async function signInGoogle() {
    if (!sb) return;
    hideMsg();
    // Gated on a config flag so the button never bounces to a broken provider
    // page before Google is enabled in the Supabase dashboard.
    if (!cfg.GOOGLE_ENABLED) {
      showMsg("Google sign-in isn't set up yet — please use email & password for now.", "err");
      return;
    }
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
      if (error) throw error;
      // on success the browser redirects to Google
    } catch (e) {
      showMsg("Couldn't start Google sign-in. Please try email & password.", "err");
    }
  }

  // ---- Data -----------------------------------------------------------------
  async function loadEntries() {
    const { data, error } = await sb
      .from("entries")
      .select("*")
      .order("entry_date", { ascending: false });
    if (error) { toast("Couldn't load entries: " + error.message); return; }
    allEntries = data || [];
    byDate = new Map(allEntries.map((e) => [e.entry_date, e]));
  }

  async function maybeFlush() {
    if (dirty) await saveNow();
  }

  function scheduleSave() {
    dirty = true;
    setSaveStatus("Saving…", false);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 700);
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    if (!currentUser) return;
    const existing = byDate.get(selectedDate);
    const empty = curSections.length === 0 && !curMood;

    if (empty) {
      dirty = false;
      if (existing) {
        // the day is now blank — remove its row
        await sb.from("entries").delete().eq("id", existing.id);
        byDate.delete(selectedDate);
        allEntries = allEntries.filter((e) => e.id !== existing.id);
        renderStats(); renderCalendar(); renderList();
      }
      setSaveStatus("");
      return;
    }

    const row = {
      user_id: currentUser.id,
      entry_date: selectedDate,
      title: "",
      content: JSON.stringify(curSections),
      mood: curMood,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await sb
      .from("entries")
      .upsert(row, { onConflict: "user_id,entry_date" })
      .select()
      .single();

    if (error) {
      setSaveStatus("Save failed", false);
      toast("Save failed: " + error.message);
      return;
    }

    byDate.set(selectedDate, data);
    const i = allEntries.findIndex((e) => e.entry_date === selectedDate);
    if (i >= 0) allEntries[i] = data;
    else {
      allEntries.push(data);
      allEntries.sort((a, b) => b.entry_date.localeCompare(a.entry_date));
    }
    dirty = false;
    setSaveStatus("Saved ✓", true);
    renderStats();
    renderCalendar();
    renderList();
  }

  function addEntry(text) {
    text = (text || "").trim();
    if (!text) return false;
    curSections.push({ ts: new Date().toISOString(), text });
    renderFeed();
    saveNow();
    return true;
  }

  // ---- Editor ---------------------------------------------------------------
  function renderMoodRow() {
    const row = $("#mood-row");
    if (!row) return;
    row.innerHTML = "";
    MOOD_ORDER.forEach((key, i) => {
      const m = moodOf(key);
      const b = el("button", {
        className: "mood-btn" + (curMood === key ? " active" : ""),
        type: "button",
        title: m ? m.label : "",
      });
      b.style.setProperty("--m", MOOD_DOT[key] || "#86ce9b");
      const glyph = el("span", { className: "dpj-mood-glyph" });
      glyph.innerHTML = moodBlob(key, 48);
      const num = el("span", { className: "dpj-mood-num", textContent: String(i + 1) });
      b.append(glyph, num);
      b.addEventListener("click", () => {
        curMood = curMood === key ? "" : key;
        renderMoodRow();
        scheduleSave();
      });
      row.append(b);
    });
  }

  function renderMoodLegend() {
    const leg = $("#mood-legend");
    if (!leg) return;
    leg.innerHTML = "";
    MOOD_ORDER.forEach((key, i) => {
      const item = el("div", { className: "dpj-legend-item" });
      item.innerHTML = moodBlob(key, 26) + `<span>${i + 1}</span>`;
      leg.append(item);
    });
  }

  function updateWords() {
    const w = $("#compose-words"), ci = $("#compose-input");
    if (!w || !ci) return;
    const n = wordCount(ci.value);
    w.textContent = n === 1 ? "1 word" : n + " words";
  }

  function openEditor(date) {
    selectedDate = date;
    const row = byDate.get(date);
    curSections = sectionsOf(row).map((s) => ({ ts: s.ts || null, text: s.text || "" }));
    curMood = row ? (row.mood || "") : "";

    const isToday = date === todayStr();
    $("#entry-daylabel").textContent = DOW[parseDate(date).getDay()];
    $("#entry-date").textContent = dateNoDow(date);

    const chip = $("#prompt-chip");
    chip.hidden = !(isToday && curSections.length === 0); // gentle nudge only on an empty today
    if (!chip.hidden) chip.textContent = promptForToday();

    renderMoodRow();
    renderFeed();
    setSaveStatus(curSections.length ? "Saved" : "", curSections.length > 0);

    // fresh composer for each day
    const ci = $("#compose-input"); if (ci) { ci.value = ""; autoGrow(ci); }
    updateWords();

    renderCalendar();
    renderList();
    updatePager();
  }

  // ---- Page-flip day navigation ---------------------------------------------
  let flipping = false;
  function dateDiffDays(a, b) { return Math.round((parseDate(a) - parseDate(b)) / 86400000); }
  function dayOfYear(ds) { const d = parseDate(ds); const start = new Date(d.getFullYear(), 0, 0); return Math.round((d - start) / 86400000); }
  function daysInYear(y) { return ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365; }
  function reducedMotion() { return window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function nbMobile() { return window.innerWidth <= 820; }

  function updatePager() {
    const lbl = $("#nb-page-label");
    if (lbl) lbl.textContent = `Page ${dayOfYear(selectedDate)} of ${daysInYear(parseDate(selectedDate).getFullYear())}`;
    const pn = $("#nb-page-num");
    if (pn) pn.textContent = "p. " + dayOfYear(selectedDate);
    const next = $("#day-next");
    if (next) next.disabled = selectedDate >= todayStr();
  }

  // Switch to another day (no future days).
  async function flipTo(target) {
    if (target > todayStr()) target = todayStr();
    if (target === selectedDate) return;
    await maybeFlush();
    calCursor = parseDate(target);
    openEditor(target);
  }

  function renderFeed() {
    const feed = $("#entry-feed"); feed.innerHTML = "";
    if (curSections.length === 0) {
      const prev = latestBefore(selectedDate);
      if (prev) feed.append(prevPeek(prev));
      else feed.append(el("div", { className: "feed-empty", textContent: "Nothing here yet — add your first entry below." }));
      return;
    }
    curSections.forEach((s, i) => {
      const item = el("div", { className: "feed-entry" });
      const node = el("span", { className: "feed-node" });
      node.style.background = NODE_COLORS[i % NODE_COLORS.length];
      item.append(node);
      const head = el("div", { className: "feed-head" });
      head.append(el("span", { className: "feed-time", textContent: fmtStamp(s.ts, selectedDate) }));
      const del = el("button", { className: "feed-del", type: "button", title: "Delete this entry", textContent: "✕" });
      del.addEventListener("click", () => {
        if (!confirm("Delete this entry?")) return;
        withScrollStable(() => { curSections.splice(i, 1); renderFeed(); });
        saveNow();
      });
      head.append(del);
      const body = el("textarea", { className: "feed-text", value: s.text });
      body.addEventListener("input", () => { s.text = body.value; autoGrow(body); scheduleSave(); });
      item.append(head, body);
      feed.append(item);
      autoGrow(body);
    });
  }

  function latestBefore(dateStr) {
    const days = allEntries
      .filter((e) => e.entry_date < dateStr && sectionsOf(e).length > 0)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
    return days[0] || null;
  }
  function prevPeek(row) {
    const secs = sectionsOf(row);
    const last = secs[secs.length - 1];
    const wrap = el("div", { className: "prev-peek" });
    wrap.append(el("div", { className: "prev-peek-label", textContent: "Previously — " + shortDate(row.entry_date) + (last.ts ? ", " + fmtTime(last.ts) : "") }));
    wrap.append(el("div", { className: "prev-peek-text", textContent: last.text }));
    return wrap;
  }

  // ---- Stats ----------------------------------------------------------------
  // Consecutive CALENDAR DAYS that have at least one entry (not the number of
  // entries). Dedupe by date so multiple entries on one day count once.
  function computeStreak() {
    const days = new Set(allEntries.filter((e) => sectionsOf(e).length > 0).map((e) => e.entry_date));
    let cur = todayStr();
    if (!days.has(cur)) cur = addDays(cur, -1); // "haven't written yet today" doesn't break it
    let n = 0;
    while (days.has(cur)) { n++; cur = addDays(cur, -1); }
    return n;
  }
  function totalEntries() { return allEntries.reduce((n, e) => n + sectionsOf(e).length, 0); }
  function renderStats() {
    const streak = computeStreak();
    $("#streak-num").textContent = streak;
    { const sb = $("#streak-badge"); if (sb) sb.hidden = streak < 1; } // only show a live streak
    $("#stat-streak").textContent = streak;
    $("#stat-total").textContent = totalEntries();
    const now = new Date();
    const pref = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    $("#stat-month").textContent = allEntries
      .filter((e) => e.entry_date.startsWith(pref))
      .reduce((n, e) => n + sectionsOf(e).length, 0);
  }

  // ---- Calendar -------------------------------------------------------------
  function renderCalendar() {
    const y = calCursor.getFullYear();
    const m = calCursor.getMonth();
    $("#cal-title").textContent = `${MON[m]} ${y}`;
    const grid = $("#cal-grid");
    grid.innerHTML = "";

    // Reference calendar is Monday-first.
    const startOffset = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = todayStr();

    for (let i = 0; i < startOffset; i++) grid.append(el("div", { className: "cal-cell empty" }));

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
      const cell = el("button", { className: "cal-cell", type: "button" });
      const dayEl = el("span", { className: "cal-day", textContent: String(d) });
      cell.append(dayEl);

      const row = byDate.get(ds);
      if (row && sectionsOf(row).length > 0) {
        cell.classList.add("has");
        // fill the whole day cell with its mood colour; the number knocks out in the bg colour
        cell.style.background = MOOD_DOT[row.mood] || "#cbd5e1";
      }
      if (ds === today) cell.classList.add("today");
      if (ds === selectedDate) cell.classList.add("selected");
      if (ds > today) {
        cell.classList.add("future");
        cell.disabled = true;
      } else {
        cell.addEventListener("click", () => flipTo(ds));
      }
      grid.append(cell);
    }

    renderSidebarInsights();
  }

  // ---- Sidebar insights (reference panel: tied to the visible month) --------
  function renderSidebarInsights() {
    const y = calCursor.getFullYear(), m = calCursor.getMonth();
    const setTxt = (sel, v) => { const n = $(sel); if (n) n.textContent = v; };
    setTxt("#si-month", `${MON[m]} ${y}`);

    const pref = `${y}-${pad(m + 1)}`;
    const days = allEntries.filter((e) => e.entry_date.startsWith(pref) && sectionsOf(e).length > 0);
    const moodDays = days.filter((e) => e.mood && MOOD_SCORE[e.mood]);
    const totalMonth = days.reduce((n, e) => n + sectionsOf(e).length, 0);
    const avg = moodDays.length ? moodDays.reduce((s, e) => s + MOOD_SCORE[e.mood], 0) / moodDays.length : 0;

    setTxt("#si-avg", moodDays.length ? `${avg.toFixed(1)} / 5` : "—");
    setTxt("#si-days", String(days.length));
    setTxt("#si-total", String(totalMonth));

    const dist = $("#si-mooddist");
    if (dist) {
      dist.innerHTML = "";
      const counts = {}; moodDays.forEach((e) => { counts[e.mood] = (counts[e.mood] || 0) + 1; });
      const totalMood = moodDays.length;
      ["great", "good", "meh", "down", "awful"].forEach((key, idx) => {
        const rowEl = el("div", { className: "dpj-dist-row" });
        rowEl.append(el("span", { className: "dpj-dist-lvl", textContent: String(5 - idx) }));
        const track = el("div", { className: "dpj-dist-track" });
        const fill = el("div", { className: "dpj-dist-fill" });
        const pct = totalMood ? Math.round((counts[key] || 0) / totalMood * 100) : 0;
        fill.style.width = pct + "%";
        fill.style.background = MOOD_BAR[key];
        track.append(fill);
        rowEl.append(track, el("span", { className: "dpj-dist-pct", textContent: pct + "%" }));
        dist.append(rowEl);
      });
    }

    const best = $("#si-bestdays");
    if (best) {
      best.innerHTML = "";
      const ranked = [...moodDays]
        .sort((a, b) => MOOD_SCORE[b.mood] - MOOD_SCORE[a.mood] || a.entry_date.localeCompare(b.entry_date))
        .slice(0, 3)
        .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
      if (ranked.length === 0) {
        best.append(el("div", { className: "dpj-bestdays-empty", textContent: "No moods logged yet this month." }));
      } else {
        const track = el("div", { className: "dpj-bestdays-track" });
        ranked.forEach((e) => { const dot = el("div", { className: "dpj-bestdays-dot" }); dot.style.background = MOOD_DOT[e.mood] || "#86ce9b"; track.append(dot); });
        const dates = el("div", { className: "dpj-bestdays-dates" });
        ranked.forEach((e, i) => {
          const dd = parseDate(e.entry_date);
          dates.append(el("span", { textContent: `${MON_SHORT[dd.getMonth()]} ${dd.getDate()}` }));
          if (i < ranked.length - 1) dates.append(el("span", { className: "sep", textContent: "•" }));
        });
        best.append(track, dates);
      }
    }
  }

  // ---- Entries list ---------------------------------------------------------
  function renderList() {
    const list = $("#entries-list");
    if (!list) return;
    const searchEl = $("#search");
    const q = (searchEl ? searchEl.value || "" : "").toLowerCase().trim();
    list.innerHTML = "";

    let items = allEntries.filter((e) => sectionsOf(e).length > 0);
    if (q) items = items.filter((e) => dayText(e).toLowerCase().includes(q));

    if (items.length === 0) {
      list.append(el("div", {
        className: "empty-hint",
        textContent: q ? "No matching entries." : "No entries yet — today is a good day to start ✍️",
      }));
      return;
    }

    for (const e of items) {
      const item = el("button", { className: "entry-item" + (e.entry_date === selectedDate ? " active" : ""), type: "button" });
      const top = el("div", { className: "entry-item-top" });
      const ms = el("span", { className: "entry-item-mood" });
      if (e.mood) ms.innerHTML = moodFace(e.mood, 18);
      top.append(ms);
      top.append(el("span", { className: "entry-item-date", textContent: shortDate(e.entry_date) }));
      item.append(top);
      const dt = dayText(e);
      const secN = sectionsOf(e).length;
      item.append(el("div", { className: "entry-item-title", textContent: firstLine(dt) || "(no text)" }));
      const preview = dt.replace(/\s+/g, " ").trim();
      item.append(el("div", { className: "entry-item-preview", textContent: (secN > 1 ? secN + " entries · " : "") + preview.slice(0, 90) }));
      item.addEventListener("click", () => flipTo(e.entry_date));
      list.append(item);
    }
  }

  // ---- Export ---------------------------------------------------------------
  function exportEntries() {
    if (allEntries.length === 0) { toast("No entries to export yet."); return; }
    const sorted = [...allEntries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    let md = `# My Journal\n\n_Exported ${shortDate(todayStr())} · ${totalEntries()} entries_\n`;
    for (const e of sorted) {
      const secs = sectionsOf(e);
      if (secs.length === 0) continue;
      md += `\n\n---\n\n## ${longDate(e.entry_date)}\n`;
      const mood = moodOf(e.mood);
      if (mood) md += `\n**Mood:** ${mood.emoji} ${mood.label}\n`;
      for (const s of secs) md += `\n**${fmtStamp(s.ts, e.entry_date)}**\n\n${s.text}\n`;
    }
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: `journal-${todayStr()}.md` });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Exported to a Markdown file.");
  }

  // ---- Insights / review ----------------------------------------------------
  function weekDates() {
    const t = new Date();
    const offset = (t.getDay() + 6) % 7; // days since Monday
    const monday = new Date(t); monday.setDate(t.getDate() - offset);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return ymd(d); });
  }
  function monthDates() {
    const t = new Date(), y = t.getFullYear(), m = t.getMonth();
    const n = new Date(y, m + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => `${y}-${pad(m + 1)}-${pad(i + 1)}`);
  }
  function wordCount(s) { const v = (s || "").trim(); return v ? v.split(/\s+/).length : 0; }

  function openInsights() { $("#insights-view").hidden = false; renderInsights(); }
  function closeInsights() { $("#insights-view").hidden = true; }
  function setPeriod(p) {
    insightsPeriod = p;
    $$(".period-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.period === p));
    renderInsights();
  }

  function renderInsights() {
    const dates = insightsPeriod === "week" ? weekDates() : monthDates();
    const first = parseDate(dates[0]);
    $("#insights-title").textContent = insightsPeriod === "week"
      ? `Week of ${MON_SHORT[first.getMonth()]} ${first.getDate()}`
      : `${MON[first.getMonth()]} ${first.getFullYear()}`;

    const today = todayStr();
    const past = dates.filter((d) => d <= today);
    const entries = past.map((d) => byDate.get(d)).filter(Boolean);

    const empty = $("#insights-empty"), content = $("#insights-content");
    if (entries.length === 0) {
      empty.hidden = false;
      empty.textContent = "No entries in this stretch yet. A blank page is a fresh start ✍️";
      content.hidden = true;
      return;
    }
    empty.hidden = true; content.hidden = false;

    const words = entries.reduce((s, e) => s + dayWordCount(e), 0);
    const avg = Math.round(words / entries.length);
    const moodCounts = {};
    let best = null;
    for (const e of entries) {
      if (e.mood && MOOD_SCORE[e.mood]) {
        moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
        if (!best || MOOD_SCORE[e.mood] >= MOOD_SCORE[best.mood]) best = e;
      }
    }
    const topMood = Object.keys(moodCounts).sort((a, b) => moodCounts[b] - moodCounts[a] || MOOD_SCORE[b] - MOOD_SCORE[a])[0] || "";

    const statsEl = $("#insights-stats"); statsEl.innerHTML = "";
    const mk = (num, label, big) => {
      const s = el("div", { className: "stat" });
      s.append(el("div", { className: "stat-num", textContent: String(num), style: big ? "font-size:1.5rem;" : "" }));
      s.append(el("div", { className: "stat-label", textContent: label }));
      return s;
    };
    statsEl.append(mk(entries.length, entries.length === 1 ? "Day" : "Days"));
    statsEl.append(mk(words, "Words"));
    statsEl.append(mk(avg, "Avg / day"));
    const topStat = el("div", { className: "stat" });
    const topNum = el("div", { className: "stat-num" });
    if (topMood) topNum.append(faceEl(topMood, 30)); else topNum.textContent = "—";
    topStat.append(topNum, el("div", { className: "stat-label", textContent: "Top mood" }));
    statsEl.append(topStat);

    renderMoodChart(dates, today);

    const dist = $("#mood-dist"); dist.innerHTML = "";
    const present = MOODS.filter((m) => moodCounts[m.key]);
    if (present.length === 0) dist.append(el("span", { className: "empty-hint", textContent: "No moods logged this stretch." }));
    else for (const m of present) {
      const chip = el("div", { className: "dist-chip" });
      chip.append(faceEl(m.key, 20));
      chip.append(el("span", { textContent: `${m.label} · ${moodCounts[m.key]}` }));
      dist.append(chip);
    }

    $("#insights-summary").textContent = localSummary(entries, { words, avg, topMood, best, daysWritten: entries.length, totalDays: past.length });

    $("#ai-summary-wrap").hidden = !cfg.AI_SUMMARY_URL;
    $("#ai-summary-out").hidden = true;
  }

  function renderMoodChart(dates, today) {
    const chart = $("#mood-chart"); chart.innerHTML = "";
    for (const ds of dates) {
      const col = el("div", { className: "mood-col" });
      const e = byDate.get(ds);
      let h = 6, color = "var(--muted)";
      if (e && e.mood && MOOD_SCORE[e.mood]) { h = 20 + MOOD_SCORE[e.mood] * 16; color = MOOD_COLOR[e.mood]; }
      else if (e) { h = 16; color = "var(--surface)"; }
      if (ds > today) col.classList.add("future");
      const d = parseDate(ds);
      col.title = `${MON_SHORT[d.getMonth()]} ${d.getDate()}` + (e ? (e.mood ? ` · ${moodOf(e.mood).label}` : " · entry") : " · no entry");
      col.append(el("div", { className: "mood-fill", style: `height:${h}%; background:${color};` }));
      chart.append(col);
    }
  }

  const STOP = new Set(("the a an and or but if then else of to in on at for with without from by as is are was were be been being it its this that these those i you he she they we me my your his her their our not no yes so just really very much more most some any all can will would could should did do does done get got have has had about into over under out up down day today feel felt like know think went made make going time that's it's i'm was were then than them there here what when where which who").split(" "));
  function topWord(entries) {
    const freq = {};
    for (const e of entries) {
      const words = dayText(e).toLowerCase().match(/[a-z']{4,}/g) || [];
      for (let w of words) { w = w.replace(/'s$/, ""); if (STOP.has(w)) continue; freq[w] = (freq[w] || 0) + 1; }
    }
    let best = null, n = 0;
    for (const w in freq) if (freq[w] > n) { n = freq[w]; best = w; }
    return n >= 3 ? best : null;
  }

  function localSummary(entries, r) {
    const parts = [];
    parts.push(`You wrote on ${r.daysWritten} of ${r.totalDays} days — ${r.words} words in all.`);
    if (r.topMood) parts.push(`Your mood leaned ${moodOf(r.topMood).label.toLowerCase()}.`);
    if (r.best) { const d = parseDate(r.best.entry_date); parts.push(`Your brightest day was ${DOW[d.getDay()]}, ${MON_SHORT[d.getMonth()]} ${d.getDate()}.`); }
    const streak = computeStreak();
    if (streak > 0) parts.push(`You're on a ${streak}-day streak — keep it going!`);
    const word = topWord(entries);
    if (word) parts.push(`A word that kept coming up: “${word}”.`);
    return parts.join(" ");
  }

  async function generateAISummary() {
    const url = cfg.AI_SUMMARY_URL;
    if (!url) return;
    const btn = $("#ai-summary-btn"), out = $("#ai-summary-out");
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Reflecting…";
    try {
      const dates = insightsPeriod === "week" ? weekDates() : monthDates();
      const today = todayStr();
      const entries = dates.filter((d) => d <= today).map((d) => byDate.get(d)).filter(Boolean)
        .map((e) => ({ date: e.entry_date, mood: e.mood, content: dayText(e) }));
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session ? session.access_token : cfg.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ period: insightsPeriod, entries }),
      });
      if (!res.ok) throw new Error(`(${res.status})`);
      const json = await res.json();
      out.textContent = json.summary || "No summary returned.";
      out.hidden = false;
    } catch (err) {
      toast("AI reflection failed " + (err.message || ""));
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  // ---- Weekly AI reflection -------------------------------------------------
  let currentSummaryWeek = null;
  function weekEndSundayStr() { const t = new Date(); const d = new Date(t); d.setDate(t.getDate() - t.getDay()); return ymd(d); }
  function weekLabelFor(sun) { const s = parseDate(sun); const m = parseDate(addDays(sun, -6)); return `${MON_SHORT[m.getMonth()]} ${m.getDate()} – ${MON_SHORT[s.getMonth()]} ${s.getDate()}`; }

  async function checkWeeklySummary() {
    if (!cfg.AI_SUMMARY_URL || !currentUser) return;
    const sun = weekEndSundayStr();
    let row = null;
    try {
      const { data, error } = await sb.from("summaries").select("*").eq("week", sun).maybeSingle();
      if (error) return; // table not set up yet, or transient — stay silent
      row = data;
    } catch (e) { return; }

    if (row) { if (!row.seen) showSummaryPopup(row.text, sun); return; }

    // none yet for this week — generate it if there's anything to reflect on
    const mon = addDays(sun, -6);
    const weekEntries = allEntries
      .filter((e) => e.entry_date >= mon && e.entry_date <= sun && sectionsOf(e).length > 0)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
      .map((e) => ({ date: shortDate(e.entry_date), mood: moodOf(e.mood) ? moodOf(e.mood).label : "", content: dayText(e) }));
    if (weekEntries.length === 0) return;

    try {
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch(cfg.AI_SUMMARY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session ? session.access_token : cfg.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ entries: weekEntries, weekLabel: weekLabelFor(sun) }),
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.summary) return;
      await sb.from("summaries").insert({ week: sun, text: json.summary, seen: false });
      showSummaryPopup(json.summary, sun);
    } catch (e) { /* stay silent — the reflection just won't appear this time */ }
  }

  function showSummaryPopup(text, weekKey) {
    currentSummaryWeek = weekKey;
    $("#summary-sub").textContent = "Week of " + weekLabelFor(weekKey);
    $("#summary-text").textContent = text;
    $("#summary-view").hidden = false;
  }
  async function closeSummary(markSeen) {
    $("#summary-view").hidden = true;
    if (markSeen && currentSummaryWeek) {
      try { await sb.from("summaries").update({ seen: true }).eq("week", currentSummaryWeek); } catch (e) {}
    }
  }

  // ---- Reader mode ----------------------------------------------------------
  function applyViews() {
    $("#planner-view").hidden = currentView !== "planner";
    $("#journal-view").hidden = !(currentView === "journal" && !readerMode);
    const rv = $("#reader-view"); if (rv) rv.hidden = !(currentView === "journal" && readerMode);
    const lv = $("#lists-view"); if (lv) lv.hidden = currentView !== "lists";
  }
  function toggleReader() {
    readerMode = !readerMode;
    if (readerMode) renderReader();
    applyViews();
    if (!readerMode) { const ci = $("#compose-input"); if (ci) ci.focus({ preventScroll: true }); }
  }
  function renderReader() {
    const body = $("#reader-body"); if (!body) return;
    body.innerHTML = "";
    const days = [...allEntries].filter((e) => sectionsOf(e).length > 0).sort((a, b) => b.entry_date.localeCompare(a.entry_date));
    if (days.length === 0) { body.append(el("div", { className: "feed-empty", textContent: "Nothing written yet — switch back and start your first entry." })); return; }
    for (const d of days) {
      const day = el("section", { className: "reader-day" });
      const h = el("h3", { className: "reader-date" });
      h.append(el("span", { textContent: longDate(d.entry_date) }));
      if (d.mood) h.append(faceEl(d.mood, 22));
      day.append(h);
      for (const s of sectionsOf(d)) {
        const e = el("div", { className: "reader-entry" });
        if (s.ts) e.append(el("div", { className: "reader-time", textContent: fmtStamp(s.ts, d.entry_date) }));
        e.append(el("div", { className: "reader-text", textContent: s.text }));
        day.append(e);
      }
      body.append(day);
    }
  }

  // ---- Planner --------------------------------------------------------------
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  async function switchView(view) {
    if (view === currentView) return;
    const prev = currentView;
    currentView = view;
    try { localStorage.setItem("dp-view", view); } catch (e) {}
    // flip the toggle + swap views immediately so the pill animates right away
    const tog = $("#view-toggle");
    if (tog) tog.dataset.view = view;
    applyViews();
    // then persist the page we left and load the one we entered
    if (prev === "journal") await maybeFlush();
    if (prev === "planner") await savePlanNow();
    if (view === "planner") await ensurePlan();
    if (view === "lists") await ensureLists();
  }

  async function ensurePlan() {
    if (!plansLoaded) { setPlanLoading(true); await loadAllPlans(); setPlanLoading(false); }
    if (!plansLoaded) return; // table missing — setup message already shown
    planDate = todayStr();
    applyPlanForDate();
    renderPlanner();
  }

  async function loadAllPlans() {
    const { data, error } = await sb.from("plans").select("*");
    if (error) {
      const info = `${error.message || ""} ${error.code || ""} ${error.details || ""}`;
      if (/plans|schema cache|does not exist|42P01|PGRST2\d\d/i.test(info)) {
        $("#plan-body").hidden = true;
        const s = $("#plan-setup"); s.hidden = false;
        s.innerHTML = "<strong>One quick setup step 🛠️</strong><br>The planner needs a small database table. In Supabase → <strong>SQL Editor</strong>, paste &amp; run the SQL from <code>supabase-planner.sql</code>, then reload this page.";
      } else {
        toast("Couldn't load your plans: " + error.message);
      }
      return;
    }
    $("#plan-setup").hidden = true; $("#plan-body").hidden = false;
    plansByDate = new Map((data || []).map((p) => [p.plan_date, p]));
    plansLoaded = true;
  }

  function applyPlanForDate() {
    const row = plansByDate.get(planDate);
    planFocus = row ? (row.focus || "") : "";
    planItems = row && Array.isArray(row.items)
      ? row.items.map((it) => ({ ...it, subs: Array.isArray(it.subs) ? it.subs.map((s) => ({ ...s })) : [] }))
      : [];
    loadSchedule();
  }

  function setPlanLoading(on) { const s = $("#plan-loading"); if (s) s.hidden = !on; }

  function renderPlanner() {
    const isToday = planDate === todayStr();
    $("#plan-daylabel").textContent = isToday ? "Today's plan" : DOW[parseDate(planDate).getDay()];
    $("#plan-date").textContent = longDate(planDate);
    $("#plan-today").hidden = isToday;
    $("#plan-focus").value = planFocus;
    renderPlanList();
    updatePlanProgress();
    renderSchedule();
    const has = plansLoaded && (planFocus.trim() || planItems.length);
    setPlanStatus(has ? "Saved" : "", !!has);
  }

  async function goToPlanDate(dateStr) {
    if (planDirty) { setPlanLoading(true); await savePlanNow(); setPlanLoading(false); }
    planDate = dateStr;
    applyPlanForDate();     // instant — read from the in-memory map
    renderPlanner();
  }

  function renderPlanList() {
    const list = $("#plan-list"); list.innerHTML = "";
    if (planItems.length === 0) {
      list.append(el("div", { className: "plan-empty", textContent: "No tasks yet — add your first one below." }));
      return;
    }
    for (const it of planItems) {
      if (!Array.isArray(it.subs)) it.subs = [];
      const group = el("div", { className: "plan-task-group" });

      const row = el("div", { className: "plan-item" + (it.done ? " done" : "") });
      const cb = el("button", { className: "plan-check" + (it.done ? " checked" : ""), type: "button", title: it.done ? "Mark not done" : "Mark done" });
      cb.addEventListener("click", () => { it.done = !it.done; schedulePlanSave(); renderPlanList(); updatePlanProgress(); });
      const txt = el("input", { className: "plan-text", value: it.text, placeholder: "Task…" });
      txt.addEventListener("input", () => { it.text = txt.value; schedulePlanSave(); });
      const addSub = el("button", { className: "plan-subadd-btn", type: "button", title: "Add subtask", textContent: "＋" });
      addSub.addEventListener("click", () => { it.subs.push({ id: uid(), text: "", done: false }); schedulePlanSave(); renderPlanList(); focusSub(it.id, it.subs.length - 1); });
      const del = el("button", { className: "plan-del", type: "button", title: "Delete task", textContent: "✕" });
      del.addEventListener("click", () => { planItems = planItems.filter((x) => x !== it); schedulePlanSave(); renderPlanList(); updatePlanProgress(); });
      row.append(cb, txt, addSub, del);
      group.append(row);

      if (it.subs.length) {
        const subWrap = el("div", { className: "plan-subs" });
        it.subs.forEach((s, si) => {
          const srow = el("div", { className: "plan-sub" + (s.done ? " done" : "") });
          const scb = el("button", { className: "plan-check sub" + (s.done ? " checked" : ""), type: "button", title: s.done ? "Mark not done" : "Mark done" });
          scb.addEventListener("click", () => { s.done = !s.done; schedulePlanSave(); renderPlanList(); });
          const stxt = el("input", { className: "plan-text sub", value: s.text, placeholder: "Subtask…" });
          stxt.dataset.parent = it.id; stxt.dataset.idx = String(si);
          stxt.addEventListener("input", () => { s.text = stxt.value; schedulePlanSave(); });
          const sdel = el("button", { className: "plan-del", type: "button", title: "Delete subtask", textContent: "✕" });
          sdel.addEventListener("click", () => { it.subs = it.subs.filter((x) => x !== s); schedulePlanSave(); renderPlanList(); });
          srow.append(scb, stxt, sdel);
          subWrap.append(srow);
        });
        group.append(subWrap);
      }
      list.append(group);
    }
  }

  function focusSub(parentId, idx) {
    const node = document.querySelector(`.plan-text.sub[data-parent="${parentId}"][data-idx="${idx}"]`);
    if (node) node.focus();
  }

  function updatePlanProgress() {
    const total = planItems.length;
    const done = planItems.filter((i) => i.done).length;
    const p = $("#plan-progress");
    p.hidden = total === 0;
    p.textContent = total ? `${done} / ${total} done` : "";
  }

  function addTask(text) {
    text = (text || "").trim();
    if (!text) return;
    planItems.push({ id: uid(), text, done: false });
    schedulePlanSave(); renderPlanList(); updatePlanProgress();
  }

  function setPlanStatus(text, saved) {
    const s = $("#plan-save-status"); if (!s) return;
    s.textContent = text; s.classList.toggle("saved", !!saved);
  }

  function schedulePlanSave() {
    planDirty = true; setPlanStatus("Saving…", false);
    clearTimeout(planSaveTimer); planSaveTimer = setTimeout(savePlanNow, 700);
  }

  async function savePlanNow() {
    clearTimeout(planSaveTimer);
    if (!currentUser || !plansLoaded) { planDirty = false; return; }
    const focus = $("#plan-focus") ? $("#plan-focus").value : planFocus;
    planFocus = focus;
    const empty = !focus.trim() && planItems.length === 0;
    const existing = plansByDate.get(planDate);
    if (empty) {
      planDirty = false;
      if (existing) { await sb.from("plans").delete().eq("id", existing.id); plansByDate.delete(planDate); }
      setPlanStatus("");
      return;
    }
    const row = { user_id: currentUser.id, plan_date: planDate, focus, items: planItems, updated_at: new Date().toISOString() };
    const { data, error } = await sb.from("plans").upsert(row, { onConflict: "user_id,plan_date" }).select().single();
    if (error) { setPlanStatus("Save failed", false); toast("Plan save failed: " + error.message); return; }
    plansByDate.set(planDate, data);
    planDirty = false; setPlanStatus("Saved ✓", true);
  }

  // ---- Day schedule (time blocks) -------------------------------------------
  // Stored per day in localStorage (per device for now). Block = { id, start, dur, title, c }
  // start/dur are minutes; start is minutes-from-midnight.
  const SCHED_START_H = 6, SCHED_END_H = 24, HOUR_PX = 56, SNAP_MIN = 15, SCHED_COLORS = 6;
  const DAY_MIN0 = SCHED_START_H * 60, DAY_MIN1 = SCHED_END_H * 60;
  let scheduleBlocks = [];
  let schedSaveTimer = null;

  function schedKey(d) { return `dp-sched-${currentUser ? currentUser.id : "anon"}-${d}`; }
  function loadSchedule() {
    scheduleBlocks = [];
    try {
      const raw = localStorage.getItem(schedKey(planDate));
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) scheduleBlocks = arr
          .filter((b) => b && typeof b.start === "number" && typeof b.dur === "number")
          .map((b) => ({ id: b.id || uid(), start: b.start, dur: Math.max(SNAP_MIN, b.dur), title: b.title || "", c: ((b.c | 0) % SCHED_COLORS + SCHED_COLORS) % SCHED_COLORS }));
      }
    } catch (e) {}
  }
  function saveSchedule() {
    try {
      if (scheduleBlocks.length) localStorage.setItem(schedKey(planDate), JSON.stringify(scheduleBlocks));
      else localStorage.removeItem(schedKey(planDate));
    } catch (e) {}
  }
  function saveScheduleSoon() { clearTimeout(schedSaveTimer); schedSaveTimer = setTimeout(saveSchedule, 400); }
  const snapMin = (m) => Math.round(m / SNAP_MIN) * SNAP_MIN;
  function fmtMin(m) {
    m = ((Math.round(m) % 1440) + 1440) % 1440;
    let h = Math.floor(m / 60); const mm = m % 60; const ap = h < 12 ? "AM" : "PM";
    let h12 = h % 12; if (h12 === 0) h12 = 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${ap}`;
  }
  function fmtHour(h) { const hh = h % 24; const ap = hh < 12 ? "AM" : "PM"; let h12 = hh % 12; if (h12 === 0) h12 = 12; return `${h12} ${ap}`; }

  function renderSchedule() {
    const host = $("#plan-schedule"); if (!host) return;
    const prevScroll = host.querySelector(".dpp-sched-grid") ? host.scrollTop : null;
    host.innerHTML = "";
    const grid = el("div", { className: "dpp-sched-grid" });
    grid.style.height = ((DAY_MIN1 - DAY_MIN0) / 60 * HOUR_PX + 8) + "px";

    for (let h = SCHED_START_H; h <= SCHED_END_H; h++) {
      const top = (h - SCHED_START_H) * HOUR_PX + 4;
      const line = el("div", { className: "dpp-hour" }); line.style.top = top + "px"; grid.append(line);
      if (h < SCHED_END_H) { const lab = el("span", { className: "dpp-hour-label", textContent: fmtHour(h) }); lab.style.top = top + "px"; grid.append(lab); }
    }
    if (planDate === todayStr()) {
      const now = new Date(); const nm = now.getHours() * 60 + now.getMinutes();
      if (nm >= DAY_MIN0 && nm <= DAY_MIN1) { const n = el("div", { className: "dpp-now" }); n.style.top = ((nm - DAY_MIN0) / 60 * HOUR_PX + 4) + "px"; grid.append(n); }
    }
    scheduleBlocks.forEach((b) => grid.append(buildSchedBlock(b, grid)));

    // click empty area to add a block
    grid.addEventListener("pointerdown", (e) => {
      if (e.target !== grid && !e.target.classList.contains("dpp-hour")) return;
      const rect = grid.getBoundingClientRect();
      const y = e.clientY - rect.top - 4;
      let start = snapMin(DAY_MIN0 + y / HOUR_PX * 60);
      start = Math.max(DAY_MIN0, Math.min(start, DAY_MIN1 - 60));
      addSchedBlock(start, 60);
    });

    host.append(grid);
    if (prevScroll != null) host.scrollTop = prevScroll;
    else {
      const focusMin = planDate === todayStr() ? (new Date().getHours() * 60 + new Date().getMinutes()) - 30 : 8 * 60;
      host.scrollTop = Math.max(0, (Math.max(DAY_MIN0, focusMin) - DAY_MIN0) / 60 * HOUR_PX);
    }
  }

  function addSchedBlock(start, dur) {
    const b = { id: uid(), start, dur, title: "", c: scheduleBlocks.length % SCHED_COLORS };
    scheduleBlocks.push(b);
    saveSchedule();
    renderSchedule();
    const node = document.querySelector(`.dpp-block[data-id="${b.id}"] .dpp-block-title`);
    if (node) node.focus();
  }

  function buildSchedBlock(b, grid) {
    const box = el("div", { className: "dpp-block c" + b.c });
    box.dataset.id = b.id;
    const place = () => { box.style.top = ((b.start - DAY_MIN0) / 60 * HOUR_PX + 4) + "px"; box.style.height = (b.dur / 60 * HOUR_PX) + "px"; };
    place();
    const title = el("input", { className: "dpp-block-title", value: b.title, placeholder: "New block" });
    title.addEventListener("pointerdown", (e) => e.stopPropagation());
    title.addEventListener("input", () => { b.title = title.value; saveScheduleSoon(); });
    const time = el("div", { className: "dpp-block-time", textContent: fmtMin(b.start) + " – " + fmtMin(b.start + b.dur) });
    const del = el("button", { className: "dpp-block-del", type: "button", title: "Delete block", textContent: "✕" });
    del.addEventListener("pointerdown", (e) => e.stopPropagation());
    del.addEventListener("click", () => { scheduleBlocks = scheduleBlocks.filter((x) => x !== b); saveSchedule(); renderSchedule(); });
    const resize = el("div", { className: "dpp-block-resize" });
    box.append(title, time, del, resize);
    const setTime = () => { time.textContent = fmtMin(b.start) + " – " + fmtMin(b.start + b.dur); };
    schedDrag(box, b, "move", box, place, setTime);
    schedDrag(resize, b, "resize", box, place, setTime);
    return box;
  }

  function schedDrag(handle, b, mode, box, place, setTime) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const startY = e.clientY, origStart = b.start, origDur = b.dur;
      const onMove = (ev) => {
        const dMin = (ev.clientY - startY) / HOUR_PX * 60;
        if (mode === "move") {
          let ns = snapMin(origStart + dMin);
          ns = Math.max(DAY_MIN0, Math.min(ns, DAY_MIN1 - b.dur));
          b.start = ns;
        } else {
          let nd = snapMin(origDur + dMin);
          nd = Math.max(SNAP_MIN, Math.min(nd, DAY_MIN1 - b.start));
          b.dur = nd;
        }
        place(); setTime();
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        saveSchedule();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  // ---- Lists (dashboard) ----------------------------------------------------
  let lists = [];
  let listsLoaded = false;
  const listTimers = {};     // per-list content-save debounce
  const layoutTimers = {};   // per-list position/size-save debounce
  let zTop = 10;             // running z-index for click-to-front
  let listsWasDesktop = null;
  const LISTS_MIN = 768;     // below this, widgets stack instead of free-floating
  const isDesktopLists = () => window.innerWidth >= LISTS_MIN;

  async function ensureLists() {
    if (listsLoaded) return;
    await loadAllLists();
    if (!listsLoaded) return;
    renderLists();
  }

  async function loadAllLists() {
    const { data, error } = await sb.from("lists").select("*").order("created_at", { ascending: true });
    if (error) {
      const info = `${error.message || ""} ${error.code || ""} ${error.details || ""}`;
      if (/lists|schema cache|does not exist|42P01|PGRST2\d\d/i.test(info)) {
        $("#lists-grid").hidden = true; $("#lists-empty").hidden = true; $("#list-add-btn").disabled = true;
        const s = $("#lists-setup"); s.hidden = false;
        s.innerHTML = "<strong>One quick setup step 🛠️</strong><br>Lists need a small database table. In Supabase → <strong>SQL Editor</strong>, run the SQL from <code>supabase-lists.sql</code>, then reload this page.";
      } else { toast("Couldn't load lists: " + error.message); }
      return;
    }
    $("#lists-setup").hidden = true; $("#lists-grid").hidden = false; $("#list-add-btn").disabled = false;
    lists = data || [];
    listsLoaded = true;
  }

  // x/y = pixel offset of the window inside the canvas; w/h = pixel size.
  function normPos(list) {
    list.w = Math.max(200, Math.round(list.w) || 300);
    list.h = Math.max(150, Math.round(list.h) || 280);
    list.x = Math.max(0, Math.round(list.x) || 0);
    list.y = Math.max(0, Math.round(list.y) || 0);
  }

  function renderLists() {
    const gridEl = $("#lists-grid");
    $("#lists-empty").hidden = lists.length > 0;
    gridEl.innerHTML = "";
    const desktop = isDesktopLists();
    listsWasDesktop = desktop;
    // desktop = free-floating "windows on a desktop"; mobile = a tidy stack
    gridEl.classList.toggle("lists-canvas", desktop);
    gridEl.classList.toggle("lists-stack", !desktop);
    gridEl.style.minHeight = "";
    const canvasW = gridEl.clientWidth || 1072;
    for (const list of lists) {
      const winEl = buildWidget(list);
      if (desktop) {
        normPos(list);
        // keep windows fully within the canvas (fixes off-screen-right lists)
        list.w = Math.min(list.w, canvasW);
        list.x = Math.max(0, Math.min(list.x, canvasW - list.w));
        winEl.style.left = list.x + "px";
        winEl.style.top = list.y + "px";
        winEl.style.width = list.w + "px";
        winEl.style.height = list.h + "px";
        winEl.style.zIndex = ++zTop;
        makeDraggable(winEl, list);
        makeResizable(winEl, list);
      }
      gridEl.appendChild(winEl);
    }
    if (desktop) updateCanvasHeight();
  }

  // Grow the canvas so the lowest window is always reachable + scrollable.
  function updateCanvasHeight() {
    const gridEl = $("#lists-grid");
    if (!isDesktopLists()) { gridEl.style.minHeight = ""; return; }
    let maxB = 0;
    for (const l of lists) maxB = Math.max(maxB, (l.y || 0) + (l.h || 280));
    gridEl.style.minHeight = (maxB + 48) + "px";
  }

  // Re-render when we cross the desktop/mobile boundary (debounced).
  function onListsResize() {
    if (currentView !== "lists" || !listsLoaded) return;
    const d = isDesktopLists();
    if (d !== listsWasDesktop) { listsWasDesktop = d; renderLists(); }
  }

  function bringToFront(winEl) { winEl.style.zIndex = ++zTop; }

  // Free-form drag by the title bar (ignores clicks on the title field / buttons).
  function makeDraggable(winEl, list) {
    const head = winEl.querySelector(".list-widget-head");
    head.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !isDesktopLists()) return;
      if (e.target.closest("input, button, textarea, a")) return;
      bringToFront(winEl);
      const sx = e.clientX, sy = e.clientY, ox = list.x, oy = list.y;
      const canvasW = $("#lists-grid").clientWidth;
      winEl.classList.add("dragging");
      try { head.setPointerCapture(e.pointerId); } catch (_) {}
      const move = (ev) => {
        let nx = Math.max(0, Math.min(ox + (ev.clientX - sx), Math.max(0, canvasW - list.w)));
        let ny = Math.max(0, oy + (ev.clientY - sy));
        list.x = nx; list.y = ny;
        winEl.style.left = nx + "px"; winEl.style.top = ny + "px";
      };
      const up = () => {
        head.removeEventListener("pointermove", move);
        head.removeEventListener("pointerup", up);
        try { head.releasePointerCapture(e.pointerId); } catch (_) {}
        winEl.classList.remove("dragging");
        updateCanvasHeight(); scheduleLayoutSave(list);
      };
      head.addEventListener("pointermove", move);
      head.addEventListener("pointerup", up);
      e.preventDefault();
    });
  }

  // Corner-handle resize.
  function makeResizable(winEl, list) {
    const handle = winEl.querySelector(".list-resize");
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !isDesktopLists()) return;
      e.stopPropagation();
      bringToFront(winEl);
      const sx = e.clientX, sy = e.clientY, ow = list.w, oh = list.h;
      winEl.classList.add("dragging");
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      const move = (ev) => {
        list.w = Math.max(200, ow + (ev.clientX - sx));
        list.h = Math.max(150, oh + (ev.clientY - sy));
        winEl.style.width = list.w + "px"; winEl.style.height = list.h + "px";
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
        winEl.classList.remove("dragging");
        updateCanvasHeight(); scheduleLayoutSave(list);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      e.preventDefault();
    });
  }

  // Per-list accent colour (cosmetic; stored per device in localStorage).
  const LIST_COLORS = { violet: "#7c6cf0", blue: "#4d8bf0", green: "#3fb489", amber: "#e0a83a", rose: "#ec6a9c", slate: "#7c8aa0" };
  const LIST_COLOR_KEYS = ["violet", "blue", "green", "amber", "rose", "slate"];
  function getListColor(list) { try { return localStorage.getItem("dp-listcolor-" + list.id) || "violet"; } catch (e) { return "violet"; } }
  function setListColor(list, c) { try { localStorage.setItem("dp-listcolor-" + list.id, c); } catch (e) {} }

  function buildWidget(list) {
    if (!Array.isArray(list.items)) list.items = [];
    const wrap = el("div", { className: "list-window card" });
    wrap.dataset.id = list.id;
    const colorKey = getListColor(list);
    wrap.style.setProperty("--la", LIST_COLORS[colorKey] || LIST_COLORS.violet);
    wrap.addEventListener("pointerdown", () => { if (isDesktopLists()) bringToFront(wrap); }, true);

    // Top bar (drag handle): colour dot · grab space · clear · delete
    const head = el("div", { className: "list-widget-head widget-drag" });
    const dot = el("button", { className: "list-dot", type: "button", title: "Change colour", "aria-label": "Change colour" });
    const pop = el("div", { className: "list-color-pop", hidden: true });
    LIST_COLOR_KEYS.forEach((k) => {
      const sw = el("button", { className: "list-swatch" + (k === colorKey ? " sel" : ""), type: "button", title: k });
      sw.style.background = LIST_COLORS[k];
      sw.addEventListener("pointerdown", (e) => e.stopPropagation());
      sw.addEventListener("click", (e) => {
        e.stopPropagation();
        setListColor(list, k);
        wrap.style.setProperty("--la", LIST_COLORS[k]);
        pop.querySelectorAll(".list-swatch").forEach((x) => x.classList.toggle("sel", x === sw));
        pop.hidden = true;
      });
      pop.append(sw);
    });
    dot.addEventListener("pointerdown", (e) => e.stopPropagation());
    dot.addEventListener("click", (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; });
    const spacer = el("span", { className: "list-head-spacer" });
    const clearBtn = el("button", { className: "list-clear", type: "button", title: "Clear all items", "aria-label": "Clear all items" });
    clearBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12"/></svg>';
    clearBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    const del = el("button", { className: "list-del", type: "button", title: "Delete list", textContent: "✕" });
    del.addEventListener("pointerdown", (e) => e.stopPropagation());
    del.addEventListener("click", () => deleteList(list));
    head.append(dot, spacer, clearBtn, del, pop);
    // close the colour popover on an outside click
    wrap.addEventListener("pointerdown", (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== dot) pop.hidden = true; });

    // Editable title (click and type — no more double-click needed)
    const title = el("input", { className: "list-title-input", value: list.title || "", placeholder: "List name", "aria-label": "List title" });
    title.addEventListener("pointerdown", (e) => e.stopPropagation());
    title.addEventListener("input", () => { list.title = title.value; scheduleListSave(list); });

    // Progress
    const prog = el("div", { className: "list-progress" });
    const progLabel = el("span", { className: "list-progress-label" });
    const bar = el("div", { className: "list-bar" });
    const fill = el("div", { className: "list-bar-fill" });
    bar.append(fill); prog.append(progLabel, bar);
    const refreshProgress = () => {
      const total = list.items.length, done = list.items.filter((i) => i.done).length;
      prog.hidden = total === 0;
      progLabel.textContent = `${done} / ${total} completed`;
      fill.style.width = total ? Math.round((done / total) * 100) + "%" : "0%";
    };

    const itemsWrap = el("div", { className: "list-items" });
    renderListItems(list, itemsWrap, refreshProgress);
    refreshProgress();

    clearBtn.addEventListener("click", () => { list.items = []; renderListItems(list, itemsWrap, refreshProgress); refreshProgress(); scheduleListSave(list); });

    const addForm = el("form", { className: "list-add" });
    const addInput = el("input", { className: "list-add-input2", placeholder: "Add an item…", autocomplete: "off" });
    addInput.addEventListener("pointerdown", (e) => e.stopPropagation());
    addForm.append(addInput);
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = addInput.value.trim(); if (!t) return;
      list.items.push({ id: uid(), text: t, done: false });
      addInput.value = ""; renderListItems(list, itemsWrap, refreshProgress); refreshProgress(); scheduleListSave(list);
    });

    const resize = el("div", { className: "list-resize", title: "Drag to resize" });
    wrap.append(head, title, prog, itemsWrap, addForm, resize);
    return wrap;
  }

  function renderListItems(list, container, refreshProgress) {
    container.innerHTML = "";
    for (const it of list.items) {
      const row = el("div", { className: "list-item" + (it.done ? " done" : "") });
      const cb = el("button", { className: "list-check" + (it.done ? " checked" : ""), type: "button", title: it.done ? "Uncheck" : "Check" });
      cb.addEventListener("click", () => { it.done = !it.done; renderListItems(list, container, refreshProgress); if (refreshProgress) refreshProgress(); scheduleListSave(list); });
      const txt = el("input", { className: "list-item-text", value: it.text });
      txt.addEventListener("input", () => { it.text = txt.value; scheduleListSave(list); });
      const d = el("button", { className: "list-item-del", type: "button", title: "Remove", textContent: "✕" });
      d.addEventListener("click", () => { list.items = list.items.filter((x) => x !== it); renderListItems(list, container, refreshProgress); if (refreshProgress) refreshProgress(); scheduleListSave(list); });
      row.append(cb, txt, d);
      container.append(row);
    }
  }

  async function newList() {
    if (!listsLoaded || !currentUser) return;
    const i = lists.length, col = i % 3, rw = Math.floor(i / 3);
    const row = { user_id: currentUser.id, title: "New list", items: [],
      x: 20 + col * 344, y: 20 + rw * 320, w: 320, h: 300,
      updated_at: new Date().toISOString() };
    const { data, error } = await sb.from("lists").insert(row).select().single();
    if (error) { toast("Couldn't create list: " + error.message); return; }
    lists.push(data);
    renderLists();
  }

  async function deleteList(list) {
    if (!confirm(`Delete "${list.title || "this list"}"? This can't be undone.`)) return;
    const { error } = await sb.from("lists").delete().eq("id", list.id);
    if (error) { toast("Delete failed: " + error.message); return; }
    lists = lists.filter((l) => l !== list);
    renderLists();
  }

  function scheduleListSave(list) {
    clearTimeout(listTimers[list.id]);
    listTimers[list.id] = setTimeout(() => saveListContent(list), 700);
  }
  async function saveListContent(list) {
    const { error } = await sb.from("lists").update({ title: list.title, items: list.items, updated_at: new Date().toISOString() }).eq("id", list.id);
    if (error) toast("List save failed: " + error.message);
  }

  function scheduleLayoutSave(list) {
    clearTimeout(layoutTimers[list.id]);
    layoutTimers[list.id] = setTimeout(() => saveLayout(list), 400);
  }
  async function saveLayout(list) {
    const x = Math.round(list.x), y = Math.round(list.y), w = Math.round(list.w), h = Math.round(list.h);
    const { error } = await sb.from("lists").update({ x, y, w, h }).eq("id", list.id);
    if (error) toast("Layout save failed: " + error.message);
  }

  // ---- App enter / exit -----------------------------------------------------
  async function enterApp(user) {
    if (currentUser && currentUser.id === user.id && !$("#app-view").hidden) return;
    currentUser = user;
    $("#auth-view").hidden = true;
    $("#landing-view").hidden = true;
    $("#setup-notice").hidden = true;
    $("#app-view").hidden = false;
    const initial = ((user.email || "?").trim().charAt(0) || "?").toUpperCase();
    $("#user-avatar").textContent = initial;
    $("#user-avatar").title = user.email || "";
    { const em = $("#user-dropdown-email"); if (em) em.textContent = user.email || ""; }
    applyTheme(currentTheme());
    renderMoodLegend();

    calCursor = new Date();
    selectedDate = todayStr();
    readerMode = false;
    await loadEntries();
    renderStats();
    openEditor(todayStr()); // also renders calendar + list + sidebar insights
    applyViews();
    let lastView = "journal";
    try { lastView = localStorage.getItem("dp-view") || "journal"; } catch (e) {}
    if (lastView === "planner") await switchView("planner");
    else $("#compose-input").focus();

    checkWeeklySummary(); // fire-and-forget; pops up when a new week's reflection is ready
  }

  function showLanding() {
    currentUser = null;
    allEntries = [];
    byDate.clear();
    planItems = []; planFocus = ""; plansLoaded = false; plansByDate.clear(); planDirty = false; currentView = "journal";
    curSections = []; readerMode = false;
    lists = []; listsLoaded = false; listsWasDesktop = null;
    { const tog = $("#view-toggle"); if (tog) { tog.dataset.view = "journal"; tog.setAttribute("aria-checked", "false"); } }
    $("#app-view").hidden = true;
    $("#auth-view").hidden = true;
    $("#setup-notice").hidden = true;
    $("#landing-view").hidden = false;
    applyTheme(currentTheme());
  }

  function showAuthForm(mode) {
    $("#landing-view").hidden = true;
    $("#setup-notice").hidden = true;
    $("#app-view").hidden = true;
    $("#auth-view").hidden = false;
    setAuthMode(mode || "login");
    const em = $("#email"); if (em) em.focus();
  }

  // ---- Wire up events -------------------------------------------------------
  function wireEvents() {
    // theme toggles
    $("#theme-toggle").addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark"));
    $("#auth-theme").addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark"));

    // auth
    $$(".seg-btn").forEach((b) => b.addEventListener("click", () => setAuthMode(b.dataset.mode)));
    $("#auth-form").addEventListener("submit", onAuthSubmit);
    { const t = $("#auth-toggle"); if (t) t.addEventListener("click", () => setAuthMode(authMode === "login" ? "signup" : "login")); }
    { const g = $("#auth-google"); if (g) g.addEventListener("click", signInGoogle); }
    { const eye = $("#auth-eye"); if (eye) eye.addEventListener("click", () => {
        const p = $("#password"); if (!p) return;
        const show = p.type === "password"; p.type = show ? "text" : "password";
        eye.classList.toggle("is-on", show);
        eye.setAttribute("aria-label", show ? "Hide password" : "Show password");
      }); }
    $("#logout-btn").addEventListener("click", async () => { await maybeFlush(); await sb.auth.signOut(); });

    // landing → auth
    $$(".landing-start").forEach((b) => b.addEventListener("click", () => showAuthForm("signup")));
    $$(".landing-login").forEach((b) => b.addEventListener("click", () => showAuthForm("login")));
    $("#auth-back").addEventListener("click", showLanding);
    $("#landing-theme").addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark"));
    // landing section nav (smooth scroll + active state)
    $$(".lp-navlink").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById(a.dataset.scroll);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      $$(".lp-navlink").forEach((x) => x.classList.toggle("is-active", x === a));
    }));

    // journal (timestamped log)
    $("#compose-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const inp = $("#compose-input");
      withScrollStable(() => { if (addEntry(inp.value)) { inp.value = ""; autoGrow(inp); updateWords(); } });
      inp.focus({ preventScroll: true });
    });
    $("#compose-input").addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); $("#compose-form").requestSubmit(); }
    });
    $("#compose-input").addEventListener("input", () => { autoGrow($("#compose-input")); updateWords(); });
    // formatting toolbar
    $$(".dpj-tool").forEach((btn) => btn.addEventListener("click", () => applyTool(btn.dataset.cmd)));
    { const rb = $("#reader-btn"); if (rb) rb.addEventListener("click", toggleReader); }
    { const sb2 = $("#search-btn"); if (sb2) sb2.addEventListener("click", toggleReader); }
    $("#reader-exit").addEventListener("click", toggleReader);
    $("#back-today").addEventListener("click", async () => {
      await flipTo(todayStr());
      const ci = $("#compose-input"); if (ci) ci.focus({ preventScroll: true });
    });
    // day navigation (left back-arrow + right arrow pair)
    $$(".js-prevday").forEach((b) => b.addEventListener("click", () => flipTo(addDays(selectedDate, -1))));
    $$(".js-nextday").forEach((b) => b.addEventListener("click", () => flipTo(addDays(selectedDate, 1))));

    // sidebar
    $("#export-btn").addEventListener("click", exportEntries);
    $("#search").addEventListener("input", renderList);
    $("#cal-prev").addEventListener("click", () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); renderCalendar(); });
    $("#cal-next").addEventListener("click", () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); renderCalendar(); });
    { const io = $("#insights-open"); if (io) io.addEventListener("click", async () => { await maybeFlush(); openInsights(); }); }

    // insights
    $("#insights-btn").addEventListener("click", async () => { await maybeFlush(); openInsights(); });
    $("#insights-close").addEventListener("click", closeInsights);
    $("#insights-view").addEventListener("click", (e) => { if (e.target === $("#insights-view")) closeInsights(); });
    $$(".period-btn").forEach((b) => b.addEventListener("click", () => setPeriod(b.dataset.period)));
    $("#ai-summary-btn").addEventListener("click", generateAISummary);

    // settings (skin switcher entry point removed from the menu for now; modal code kept)
    { const sb = $("#settings-btn"); if (sb) sb.addEventListener("click", openSettings); }
    $("#settings-close").addEventListener("click", closeSettings);
    $("#settings-view").addEventListener("click", (e) => { if (e.target === $("#settings-view")) closeSettings(); });
    $$(".skin-option").forEach((b) => b.addEventListener("click", () => applySkin(b.dataset.skin)));
    $$(".mode-btn").forEach((b) => b.addEventListener("click", () => { applyTheme(b.dataset.mode); refreshSettingsUI(); }));

    // avatar dropdown menu
    { const ab = $("#user-avatar-btn"); if (ab) ab.addEventListener("click", (e) => { e.stopPropagation(); toggleUserMenu(); }); }
    $$("#user-dropdown .menu-item").forEach((b) => b.addEventListener("click", closeUserMenu));
    document.addEventListener("click", (e) => {
      const dd = $("#user-dropdown"), ab = $("#user-avatar-btn");
      if (dd && !dd.hidden && !dd.contains(e.target) && ab && !ab.contains(e.target)) closeUserMenu();
    });

    // weekly reflection popup
    $("#summary-close").addEventListener("click", () => closeSummary(false));
    $("#summary-read").addEventListener("click", () => closeSummary(true));
    $("#summary-view").addEventListener("click", (e) => { if (e.target === $("#summary-view")) closeSummary(false); });

    // page nav + lists
    $$("#view-toggle .view-toggle-opt").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.view)));
    $("#list-add-btn").addEventListener("click", newList);
    let listsResizeT = null;
    window.addEventListener("resize", () => { clearTimeout(listsResizeT); listsResizeT = setTimeout(onListsResize, 200); });
    // planner
    $("#plan-focus").addEventListener("input", () => { planFocus = $("#plan-focus").value; schedulePlanSave(); });
    $("#plan-add-form").addEventListener("submit", (e) => { e.preventDefault(); const inp = $("#plan-add-input"); addTask(inp.value); inp.value = ""; inp.focus(); });
    $("#plan-prev").addEventListener("click", () => goToPlanDate(addDays(planDate, -1)));
    $("#plan-next").addEventListener("click", () => goToPlanDate(addDays(planDate, 1)));
    $("#plan-today").addEventListener("click", () => goToPlanDate(todayStr()));

    // shortcuts + safety
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (currentUser) (currentView === "planner" ? savePlanNow() : saveNow());
      }
      if (e.key === "Escape" && !$("#insights-view").hidden) closeInsights();
      if (e.key === "Escape" && !$("#summary-view").hidden) closeSummary(false);
      if (e.key === "Escape" && !$("#settings-view").hidden) closeSettings();
      { const dd = $("#user-dropdown"); if (e.key === "Escape" && dd && !dd.hidden) closeUserMenu(); }
    });
    window.addEventListener("beforeunload", () => { if (dirty) saveNow(); if (planDirty) savePlanNow(); });
  }

  async function onAuthSubmit(ev) {
    ev.preventDefault();
    const email = $("#email").value.trim();
    const password = $("#password").value;
    const btn = $("#auth-submit");
    const lbl = $("#auth-submit-label");
    btn.disabled = true;
    if (lbl) lbl.textContent = "…";
    hideMsg();
    try {
      if (authMode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // onAuthStateChange -> enterApp
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          showMsg("Account created! Check your email to confirm, then log in.", "ok");
          setAuthMode("login");
        }
        // if email confirmation is off, session exists -> onAuthStateChange -> enterApp
      }
    } catch (err) {
      showMsg(err.message || "Something went wrong. Please try again.", "err");
    } finally {
      btn.disabled = false;
      if (lbl) lbl.textContent = authMode === "login" ? "Log in" : "Create account";
    }
  }

  // ---- Init -----------------------------------------------------------------
  async function init() {
    if (!configured) {
      $("#setup-notice").hidden = false;
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      $("#setup-notice").hidden = false;
      $("#setup-notice .muted").textContent =
        "Couldn't load the Supabase library (check your internet connection) and refresh.";
      return;
    }

    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    wireEvents();
    setAuthMode("login");

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session && session.user) enterApp(session.user);
      else showLanding();
    } catch (e) {
      showLanding();
    }

    sb.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) enterApp(session.user);
      else showLanding();
    });
  }

  init();
})();
