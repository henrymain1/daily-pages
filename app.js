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
  const MOOD_COLOR = { great: "#16a34a", good: "#84cc16", meh: "#facc15", down: "#fb923c", awful: "#ef4444" };

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
  let calCursor = new Date();     // any date within the displayed month
  let saveTimer = null;
  let dirty = false;
  let toastTimer = null;
  let insightsPeriod = "week";

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
  function updateWordCount() {
    const v = $("#entry-content").value.trim();
    const n = v ? v.split(/\s+/).length : 0;
    $("#wordcount").textContent = `${n} ${n === 1 ? "word" : "words"}`;
  }

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
    const title = $("#entry-title").value.trim();
    const content = $("#entry-content").value;
    const mood = curMood;
    const existing = byDate.get(selectedDate);
    const empty = !title && !content.trim() && !mood;

    if (empty) {
      dirty = false;
      setSaveStatus(existing ? "Saved" : "", !!existing);
      return;
    }

    const row = {
      user_id: currentUser.id,
      entry_date: selectedDate,
      title,
      content,
      mood,
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
    $("#delete-btn").hidden = false;
    renderStats();
    renderCalendar();
    renderList();
  }

  async function deleteEntry() {
    const existing = byDate.get(selectedDate);
    if (!existing) return;
    if (!confirm(`Delete your entry for ${shortDate(selectedDate)}? This can't be undone.`)) return;
    const { error } = await sb.from("entries").delete().eq("id", existing.id);
    if (error) { toast("Delete failed: " + error.message); return; }
    byDate.delete(selectedDate);
    allEntries = allEntries.filter((e) => e.id !== existing.id);
    dirty = false;
    toast("Entry deleted.");
    openEditor(selectedDate);
    renderStats();
    renderCalendar();
    renderList();
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
        textContent: m.emoji,
      });
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
    curMood = row ? row.mood : "";
    $("#entry-title").value = row ? row.title : "";
    $("#entry-content").value = row ? row.content : "";

    const isToday = date === todayStr();
    $("#entry-daylabel").textContent = isToday ? "Today" : DOW[parseDate(date).getDay()];
    $("#entry-date").textContent = longDate(date);
    $("#back-today").hidden = isToday;
    $("#delete-btn").hidden = !row;

    const chip = $("#prompt-chip");
    chip.hidden = !isToday;
    if (isToday) chip.textContent = "✨ " + promptForToday();

    renderMoodRow();
    updateWordCount();
    setSaveStatus(row ? "Saved" : "", !!row);

    // refresh selection highlights
    renderCalendar();
    renderList();
  }

  // ---- Stats ----------------------------------------------------------------
  function computeStreak() {
    let cur = todayStr();
    if (!byDate.has(cur)) cur = addDays(cur, -1); // don't punish "haven't written yet today"
    let n = 0;
    while (byDate.has(cur)) { n++; cur = addDays(cur, -1); }
    return n;
  }
  function renderStats() {
    const streak = computeStreak();
    $("#streak-num").textContent = streak;
    $("#stat-streak").textContent = streak;
    $("#stat-total").textContent = allEntries.length;
    const now = new Date();
    const pref = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    $("#stat-month").textContent = allEntries.filter((e) => e.entry_date.startsWith(pref)).length;
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
      if (row) {
        cell.classList.add("has");
        cell.append(el("span", { className: "cal-dot", textContent: moodEmoji(row.mood) || "•" }));
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

    let items = allEntries;
    if (q) items = items.filter((e) => (e.title + " " + e.content).toLowerCase().includes(q));

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
      top.append(el("span", { className: "entry-item-mood", textContent: moodEmoji(e.mood) }));
      top.append(el("span", { className: "entry-item-date", textContent: shortDate(e.entry_date) }));
      item.append(top);
      item.append(el("div", { className: "entry-item-title", textContent: e.title || firstLine(e.content) || "(untitled)" }));
      const preview = (e.content || "").replace(/\s+/g, " ").trim();
      if (preview) item.append(el("div", { className: "entry-item-preview", textContent: preview.slice(0, 100) }));
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
    let md = `# My Journal\n\n_Exported ${shortDate(todayStr())} · ${allEntries.length} entries_\n`;
    for (const e of sorted) {
      md += `\n\n---\n\n## ${longDate(e.entry_date)}\n`;
      const mood = moodOf(e.mood);
      if (mood) md += `\n**Mood:** ${mood.emoji} ${mood.label}\n`;
      if (e.title) md += `\n### ${e.title}\n`;
      md += `\n${e.content || ""}\n`;
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

    const words = entries.reduce((s, e) => s + wordCount(e.content), 0);
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
    statsEl.append(mk(entries.length, entries.length === 1 ? "Entry" : "Entries"));
    statsEl.append(mk(words, "Words"));
    statsEl.append(mk(avg, "Avg words"));
    statsEl.append(mk(topMood ? moodEmoji(topMood) : "—", "Top mood", true));

    renderMoodChart(dates, today);

    const dist = $("#mood-dist"); dist.innerHTML = "";
    const present = MOODS.filter((m) => moodCounts[m.key]);
    if (present.length === 0) dist.append(el("span", { className: "empty-hint", textContent: "No moods logged this stretch." }));
    else for (const m of present) {
      const chip = el("div", { className: "dist-chip" });
      chip.append(el("span", { className: "emoji", textContent: m.emoji }));
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
      const words = (e.content || "").toLowerCase().match(/[a-z']{4,}/g) || [];
      for (let w of words) { w = w.replace(/'s$/, ""); if (STOP.has(w)) continue; freq[w] = (freq[w] || 0) + 1; }
    }
    let best = null, n = 0;
    for (const w in freq) if (freq[w] > n) { n = freq[w]; best = w; }
    return n >= 3 ? best : null;
  }

  function localSummary(entries, r) {
    const parts = [];
    parts.push(`You wrote ${entries.length} ${entries.length === 1 ? "entry" : "entries"} (${r.words} words, ~${r.avg} per entry) on ${r.daysWritten} of ${r.totalDays} days.`);
    if (r.topMood) parts.push(`Your mood leaned ${moodEmoji(r.topMood)} ${moodOf(r.topMood).label.toLowerCase()}.`);
    if (r.best) { const d = parseDate(r.best.entry_date); parts.push(`Your brightest day was ${DOW[d.getDay()]}, ${MON_SHORT[d.getMonth()]} ${d.getDate()} ${moodEmoji(r.best.mood)}${r.best.title ? ` — “${r.best.title}”` : ""}.`); }
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
        .map((e) => ({ date: e.entry_date, mood: e.mood, title: e.title, content: e.content }));
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

  // ---- App enter / exit -----------------------------------------------------
  async function enterApp(user) {
    if (currentUser && currentUser.id === user.id && !$("#app-view").hidden) return;
    currentUser = user;
    $("#auth-view").hidden = true;
    $("#setup-notice").hidden = true;
    $("#app-view").hidden = false;
    $("#user-email").textContent = user.email || "";
    applyTheme(currentTheme());

    calCursor = new Date();
    selectedDate = todayStr();
    await loadEntries();
    renderStats();
    openEditor(todayStr()); // also renders calendar + list
    $("#entry-content").focus();
  }

  function showAuth() {
    currentUser = null;
    allEntries = [];
    byDate.clear();
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

    // editor
    $("#entry-title").addEventListener("input", scheduleSave);
    $("#entry-content").addEventListener("input", () => { updateWordCount(); scheduleSave(); });
    $("#delete-btn").addEventListener("click", deleteEntry);
    $("#back-today").addEventListener("click", async () => {
      await maybeFlush();
      calCursor = new Date();
      openEditor(todayStr());
      $("#entry-content").focus();
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

    // shortcuts + safety
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (currentUser) saveNow();
      }
      if (e.key === "Escape" && !$("#insights-view").hidden) closeInsights();
    });
    window.addEventListener("beforeunload", () => { if (dirty) saveNow(); });
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
