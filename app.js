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
    const icon = t === "dark" ? "☀️" : "🌙";
    const a = $("#theme-toggle"), b = $("#auth-theme");
    if (a) a.textContent = icon;
    if (b) b.textContent = icon;
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  (function initTheme() {
    let t;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (!t) t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(t);
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
  let planLoaded = false;
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

  // ---- Auth mode toggle -----------------------------------------------------
  let authMode = "login";
  function setAuthMode(mode) {
    authMode = mode;
    $$(".seg-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.mode === mode));
    $("#auth-submit").textContent = mode === "login" ? "Log in" : "Create account";
    $("#password").setAttribute("autocomplete", mode === "login" ? "current-password" : "new-password");
    hideMsg();
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
    if (!text) return;
    curSections.push({ ts: new Date().toISOString(), text });
    renderFeed();
    saveNow();
    const feed = $("#entry-feed"); if (feed) feed.scrollTop = feed.scrollHeight;
  }

  // ---- Editor ---------------------------------------------------------------
  function renderMoodRow() {
    const row = $("#mood-row");
    row.innerHTML = "";
    for (const m of MOODS) {
      const b = el("button", {
        className: "mood-btn" + (curMood === m.key ? " active" : ""),
        type: "button",
        title: m.label,
      });
      b.innerHTML = moodFace(m.key, 30);
      b.addEventListener("click", () => {
        curMood = curMood === m.key ? "" : m.key;
        renderMoodRow();
        scheduleSave();
      });
      row.append(b);
    }
  }

  function openEditor(date) {
    selectedDate = date;
    const row = byDate.get(date);
    curSections = sectionsOf(row).map((s) => ({ ts: s.ts || null, text: s.text || "" }));
    curMood = row ? (row.mood || "") : "";

    const isToday = date === todayStr();
    $("#entry-daylabel").textContent = isToday ? "Today" : DOW[parseDate(date).getDay()];
    $("#entry-date").textContent = longDate(date);
    $("#back-today").hidden = isToday;

    const chip = $("#prompt-chip");
    chip.hidden = !(isToday && curSections.length === 0); // gentle nudge only on an empty today
    if (!chip.hidden) chip.textContent = "✨ " + promptForToday();

    renderMoodRow();
    renderFeed();
    setSaveStatus(curSections.length ? "Saved" : "", curSections.length > 0);

    renderCalendar();
    renderList();
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
      const head = el("div", { className: "feed-head" });
      head.append(el("span", { className: "feed-time", textContent: s.ts ? fmtTime(s.ts) : "Earlier" }));
      const del = el("button", { className: "feed-del", type: "button", title: "Delete this entry", textContent: "✕" });
      del.addEventListener("click", () => {
        if (!confirm("Delete this entry?")) return;
        curSections.splice(i, 1); renderFeed(); saveNow();
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
  function computeStreak() {
    let cur = todayStr();
    if (!hasEntry(cur)) cur = addDays(cur, -1); // don't punish "haven't written yet today"
    let n = 0;
    while (hasEntry(cur)) { n++; cur = addDays(cur, -1); }
    return n;
  }
  function totalEntries() { return allEntries.reduce((n, e) => n + sectionsOf(e).length, 0); }
  function renderStats() {
    const streak = computeStreak();
    $("#streak-num").textContent = streak;
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

    const startDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = todayStr();

    for (let i = 0; i < startDow; i++) grid.append(el("div", { className: "cal-cell empty" }));

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${y}-${pad(m + 1)}-${pad(d)}`;
      const cell = el("button", { className: "cal-cell", type: "button" });
      cell.append(el("span", { className: "cal-day", textContent: String(d) }));

      const row = byDate.get(ds);
      if (row && sectionsOf(row).length > 0) {
        cell.classList.add("has");
        cell.append(el("span", { className: "cal-dot", style: `background:${MOOD_COLOR[row.mood] || "var(--ink)"};` }));
      }
      if (ds === today) cell.classList.add("today");
      if (ds === selectedDate) cell.classList.add("selected");
      if (ds > today) {
        cell.classList.add("future");
        cell.disabled = true;
      } else {
        cell.addEventListener("click", async () => { await maybeFlush(); openEditor(ds); });
      }
      grid.append(cell);
    }
  }

  // ---- Entries list ---------------------------------------------------------
  function renderList() {
    const q = ($("#search").value || "").toLowerCase().trim();
    const list = $("#entries-list");
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
      item.addEventListener("click", async () => {
        await maybeFlush();
        calCursor = parseDate(e.entry_date);
        openEditor(e.entry_date);
      });
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
      for (const s of secs) md += `\n**${s.ts ? fmtTime(s.ts) : "Entry"}**\n\n${s.text}\n`;
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

  // ---- Reader mode ----------------------------------------------------------
  function applyViews() {
    $("#planner-view").hidden = currentView !== "planner";
    $("#journal-view").hidden = !(currentView === "journal" && !readerMode);
    const rv = $("#reader-view"); if (rv) rv.hidden = !(currentView === "journal" && readerMode);
  }
  function toggleReader() {
    readerMode = !readerMode;
    const btn = $("#reader-btn"); if (btn) btn.textContent = readerMode ? "✎ Write" : "📖 Read";
    if (readerMode) renderReader();
    applyViews();
    if (!readerMode) { const ci = $("#compose-input"); if (ci) ci.focus(); }
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
        if (s.ts) e.append(el("div", { className: "reader-time", textContent: fmtTime(s.ts) }));
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
    if (tog) { tog.dataset.view = view; tog.setAttribute("aria-checked", view === "planner" ? "true" : "false"); }
    applyViews();
    // then persist the page we left and load the one we entered
    if (prev === "journal") await maybeFlush();
    if (prev === "planner") await savePlanNow();
    if (view === "planner") await ensurePlan();
  }

  async function ensurePlan() {
    if (!planLoaded || planDate !== todayStr()) {
      planDate = todayStr();
      await loadPlan();
    }
    renderPlanner();
  }

  async function loadPlan() {
    planFocus = ""; planItems = []; planLoaded = false;
    const { data, error } = await sb.from("plans").select("*").eq("plan_date", planDate).maybeSingle();
    if (error) {
      const info = `${error.message || ""} ${error.code || ""} ${error.details || ""}`;
      if (/plans|schema cache|does not exist|42P01|PGRST2\d\d/i.test(info)) {
        $("#plan-body").hidden = true;
        const s = $("#plan-setup"); s.hidden = false;
        s.innerHTML = "<strong>One quick setup step 🛠️</strong><br>The planner needs a small database table. In Supabase → <strong>SQL Editor</strong>, paste &amp; run the SQL from <code>supabase-planner.sql</code>, then reload this page.";
      } else {
        toast("Couldn't load your plan: " + error.message);
      }
      return;
    }
    $("#plan-setup").hidden = true; $("#plan-body").hidden = false;
    if (data) { planFocus = data.focus || ""; planItems = Array.isArray(data.items) ? data.items : []; }
    planLoaded = true;
  }

  function renderPlanner() {
    $("#plan-date").textContent = longDate(planDate);
    $("#plan-focus").value = planFocus;
    renderPlanList();
    updatePlanProgress();
    const has = planLoaded && (planFocus.trim() || planItems.length);
    setPlanStatus(has ? "Saved" : "", !!has);
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
    if (!currentUser || !planLoaded) { planDirty = false; return; }
    const focus = $("#plan-focus") ? $("#plan-focus").value : planFocus;
    planFocus = focus;
    if (!focus.trim() && planItems.length === 0) { planDirty = false; setPlanStatus(""); return; }
    const row = { user_id: currentUser.id, plan_date: planDate, focus, items: planItems, updated_at: new Date().toISOString() };
    const { error } = await sb.from("plans").upsert(row, { onConflict: "user_id,plan_date" });
    if (error) { setPlanStatus("Save failed", false); toast("Plan save failed: " + error.message); return; }
    planDirty = false; setPlanStatus("Saved ✓", true);
  }

  // ---- App enter / exit -----------------------------------------------------
  async function enterApp(user) {
    if (currentUser && currentUser.id === user.id && !$("#app-view").hidden) return;
    currentUser = user;
    $("#auth-view").hidden = true;
    $("#setup-notice").hidden = true;
    $("#app-view").hidden = false;
    const initial = ((user.email || "?").trim().charAt(0) || "?").toUpperCase();
    $("#user-avatar").textContent = initial;
    $("#user-avatar").title = user.email || "";
    applyTheme(currentTheme());

    calCursor = new Date();
    selectedDate = todayStr();
    readerMode = false;
    await loadEntries();
    renderStats();
    openEditor(todayStr()); // also renders calendar + list
    applyViews();
    let lastView = "journal";
    try { lastView = localStorage.getItem("dp-view") || "journal"; } catch (e) {}
    if (lastView === "planner") await switchView("planner");
    else $("#compose-input").focus();
  }

  function showAuth() {
    currentUser = null;
    allEntries = [];
    byDate.clear();
    planItems = []; planFocus = ""; planLoaded = false; planDirty = false; currentView = "journal";
    curSections = []; readerMode = false;
    $("#journal-view").hidden = false;
    $("#planner-view").hidden = true;
    { const rv = $("#reader-view"); if (rv) rv.hidden = true; }
    { const tog = $("#view-toggle"); if (tog) { tog.dataset.view = "journal"; tog.setAttribute("aria-checked", "false"); } }
    $("#app-view").hidden = true;
    $("#setup-notice").hidden = true;
    $("#auth-view").hidden = false;
  }

  // ---- Wire up events -------------------------------------------------------
  function wireEvents() {
    // theme toggles
    $("#theme-toggle").addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark"));
    $("#auth-theme").addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark"));

    // auth
    $$(".seg-btn").forEach((b) => b.addEventListener("click", () => setAuthMode(b.dataset.mode)));
    $("#auth-form").addEventListener("submit", onAuthSubmit);
    $("#logout-btn").addEventListener("click", async () => { await maybeFlush(); await sb.auth.signOut(); });

    // journal (timestamped log)
    $("#compose-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const inp = $("#compose-input");
      addEntry(inp.value);
      inp.value = ""; autoGrow(inp); inp.focus();
    });
    $("#compose-input").addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); $("#compose-form").requestSubmit(); }
    });
    $("#compose-input").addEventListener("input", () => autoGrow($("#compose-input")));
    $("#reader-btn").addEventListener("click", toggleReader);
    $("#reader-exit").addEventListener("click", toggleReader);
    $("#back-today").addEventListener("click", async () => {
      await maybeFlush();
      calCursor = new Date();
      openEditor(todayStr());
      $("#compose-input").focus();
    });

    // sidebar
    $("#export-btn").addEventListener("click", exportEntries);
    $("#search").addEventListener("input", renderList);
    $("#cal-prev").addEventListener("click", () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1); renderCalendar(); });
    $("#cal-next").addEventListener("click", () => { calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1); renderCalendar(); });

    // insights
    $("#insights-btn").addEventListener("click", async () => { await maybeFlush(); openInsights(); });
    $("#insights-close").addEventListener("click", closeInsights);
    $("#insights-view").addEventListener("click", (e) => { if (e.target === $("#insights-view")) closeInsights(); });
    $$(".period-btn").forEach((b) => b.addEventListener("click", () => setPeriod(b.dataset.period)));
    $("#ai-summary-btn").addEventListener("click", generateAISummary);

    // planner
    $("#view-toggle").addEventListener("click", () => switchView(currentView === "journal" ? "planner" : "journal"));
    $("#plan-focus").addEventListener("input", () => { planFocus = $("#plan-focus").value; schedulePlanSave(); });
    $("#plan-add-form").addEventListener("submit", (e) => { e.preventDefault(); const inp = $("#plan-add-input"); addTask(inp.value); inp.value = ""; inp.focus(); });

    // shortcuts + safety
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (currentUser) (currentView === "planner" ? savePlanNow() : saveNow());
      }
      if (e.key === "Escape" && !$("#insights-view").hidden) closeInsights();
    });
    window.addEventListener("beforeunload", () => { if (dirty) saveNow(); if (planDirty) savePlanNow(); });
  }

  async function onAuthSubmit(ev) {
    ev.preventDefault();
    const email = $("#email").value.trim();
    const password = $("#password").value;
    const btn = $("#auth-submit");
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "…";
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
      btn.textContent = authMode === "login" ? "Log in" : "Create account";
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
      else showAuth();
    } catch (e) {
      showAuth();
    }

    sb.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) enterApp(session.user);
      else showAuth();
    });
  }

  init();
})();
