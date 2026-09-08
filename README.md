# 📖 Daily Pages

A calm, personal journaling website. Log in each day, write your entry, keep a
streak going. Your entries are saved to the cloud so they're on every device.

- **Frontend:** plain HTML/CSS/JS — hosts free on **GitHub Pages**
- **Login + database:** **Supabase** free tier (real email/password accounts)
- **Privacy:** each account can only ever read its own entries (enforced by the
  database via Row Level Security — not just the UI)

### Features
- Email/password sign-up & login
- One entry per day, distraction-free writing area, **autosave**
- Mood picker · a rotating **daily prompt** · live word count
- 🔥 **streak** + stats (total entries, entries this month)
- **Month calendar** — click any past day to read or edit it
- **Search** across every entry
- **Export** everything to a Markdown file
- Light / dark theme (remembers your choice)

---

## Setup (about 5–10 minutes, one time)

### 1. Create a free Supabase project
1. Go to **[supabase.com](https://supabase.com)** → sign up → **New project**.
2. Give it a name and a database password (you won't need the password again).
3. Wait ~1 minute for it to finish provisioning.

### 2. Create the database table
1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase-setup.sql` from this folder, copy **all** of it, paste it in.
3. Click **Run**. You should see “Success”.

### 3. (Recommended) Turn off email confirmation
So you can log in instantly instead of waiting for a confirmation email:
- **Authentication** → **Sign In / Providers** (or **Providers → Email**) →
  turn **“Confirm email”** *off* → Save.

*(For a private, personal journal this is fine. Leave it on if you prefer.)*

### 4. Paste your keys into `config.js`
1. In Supabase: **Settings (gear)** → **API**.
2. Copy these two values into `config.js` in this folder:
   - **Project URL** → `SUPABASE_URL`
   - **Project API keys → `anon` / public** → `SUPABASE_ANON_KEY`

```js
window.JOURNAL_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...your anon key...",
};
```

> ✅ The **anon** key is designed to be public — it's safe to commit and ship.
> ❌ Never use the **service_role** key here.

### 5. Try it locally
Just open `index.html` in your browser. If your browser is fussy about local
files, run a tiny local server from this folder instead:

```bash
python -m http.server 8000
```

Then visit **http://localhost:8000**. Sign up, and start writing.

---

## Deploy to GitHub Pages

1. Create a new repository on GitHub (e.g. `daily-pages`).
2. Upload these files (or push with git — see below). Keep them at the repo root.
3. In the repo: **Settings** → **Pages** → **Build and deployment** →
   **Source: Deploy from a branch** → Branch: **main**, folder: **/ (root)** → **Save**.
4. Wait ~1 minute, then visit **`https://YOUR-USERNAME.github.io/daily-pages/`**.

Bookmark that URL — that's your journal. 🎉

### Pushing with git (optional)
```bash
git init
git add .
git commit -m "Daily Pages journal"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/daily-pages.git
git push -u origin main
```

---

## Notes & tips
- **One entry per day** is the model (clean streaks + calendar). Revisit/edit any
  past day from the calendar or the entries list.
- Entries autosave as you type; `Ctrl`/`Cmd`+`S` forces a save.
- Want to change the mood options, prompts, or colors? They're all near the top
  of `app.js` (moods + prompts) and in `styles.css` (the color variables).
- Back up anytime with the **⬇️ Export** button (downloads all entries as Markdown).

## Files
| File | What it is |
|------|------------|
| `index.html` | Page structure |
| `styles.css` | All styling / theme |
| `app.js` | App logic (auth, editor, calendar, export) |
| `config.js` | **Your** Supabase URL + anon key |
| `supabase-setup.sql` | Database table + security rules |
