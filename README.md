# 📖 Daily Pages

A calm, personal daily journal. Log in, write today's entry, and keep a streak
going — your writing syncs to the cloud so it's on every device.

**▶ Live:** https://henrymain1.github.io/daily-pages/

Built as a static site (HTML/CSS/JS) hosted on **GitHub Pages**, with
**Supabase** for accounts and storage. Bold neo-brutalist "Almanac" look.

## Features
- Email/password login
- **Timestamped entries** — write, hit Add, and it logs a time-stamped entry; add as many as you like, any day, and autosaves
- **Reader mode** — a clean, flowing read of your whole journal across days
- Mood picker · a daily writing prompt
- **Planner page** — a daily focus + a checkable to-do list (its own page)
- **Insights** — mood trends and a week/month review with a summary
- 🔥 streak + stats (entries, entries this month)
- Month calendar to revisit or edit any past day
- Search across all entries · export everything to Markdown
- Light / dark theme

## Is it secure? (short answer: yes)
This trips people up, so it's worth spelling out:

- `config.js` holds the Supabase **project URL** and **publishable key**. These
  are **meant to be public**. Any static website has to send them to the browser
  to talk to its backend — you can read them in the page source of *any*
  deployed Supabase site. They are **not secrets**, so it's fine that they appear
  in this public repo and in the site's source.
- Your entries are protected by **Row Level Security** (see
  [`supabase-setup.sql`](supabase-setup.sql)), **not** by hiding that key. Every
  entry is stamped with your user id, and the database only ever lets a
  logged-in account read or write *its own* rows. The publishable key on its own
  — with no login — can't read anyone's data.
- The **`service_role`** key (the one that bypasses security) is the real secret.
  It is **not** in this repo, and must never be. Keep it out of the frontend.

**Recommended hardening for a personal journal:** once your own account exists,
turn off public sign-ups so no one else can register on your project —
Supabase → **Authentication → Sign In / Providers** → **"Allow new users to
sign up" → off**. Also make sure Row Level Security stays **on** for any new
tables you add later.

*(Making the repo private wouldn't add security — the key is exposed by the live
site regardless — and it would break free GitHub Pages, which requires a public
repo. So public is the right call here.)*

## Set up your own copy
<details>
<summary>Expand — for forking / re-deploying from scratch</summary>

### 1. Create a Supabase project
Sign up at [supabase.com](https://supabase.com) → **New project**. Give it a name
and a database password, pick a region, and wait ~1–2 min.

### 2. Create the database tables
Supabase → **SQL Editor** → **New query** → paste all of
[`supabase-setup.sql`](supabase-setup.sql) → **Run**. Then run
[`supabase-planner.sql`](supabase-planner.sql) the same way to enable the
planner page.

### 3. (Optional) Turn off email confirmation
For instant login: **Authentication → Sign In / Providers → Email →
"Confirm email" → off**.

### 4. Add your keys
Copy your **Project URL** and **anon / publishable** key
(Settings → API / Data API) into [`config.js`](config.js).

### 5. Deploy
Push to a GitHub repo → **Settings → Pages** → deploy from `main` (root) →
visit your `username.github.io/repo` link.

</details>

## Weekly AI reflection (optional)
Each Sunday, the app can generate a short, calm reflection on your week with
**Claude Haiku** and pop it up next time you open the site. It stays off until
you set it up:

1. **Get an Anthropic API key** at [console.anthropic.com](https://console.anthropic.com) and add a little billing credit (each weekly reflection costs a fraction of a cent).
2. **Add the storage table:** Supabase → SQL Editor → run [`supabase-summaries.sql`](supabase-summaries.sql).
3. **Deploy the function:** Supabase → Edge Functions → create one named `weekly-summary` and paste in [`supabase/functions/weekly-summary/index.ts`](supabase/functions/weekly-summary/index.ts). (Or `supabase functions deploy weekly-summary`.)
4. **Add the secret:** in Edge Functions settings, add a secret `ANTHROPIC_API_KEY` = your key.
5. **Point the app at it:** set `AI_SUMMARY_URL` in [`config.js`](config.js) to the function URL (`https://<project>.supabase.co/functions/v1/weekly-summary`).

Your API key lives only as a Supabase secret — never in the website. Entries for the week are sent to the function (and on to Anthropic) only to write the reflection.

## Files
| File | What it is |
|------|------------|
| `index.html` | Page structure |
| `styles.css` | Styling / neo-brutalist "Almanac" theme |
| `app.js` | App logic (auth, journal log, reader, planner, calendar, insights, export) |
| `config.js` | Supabase URL + publishable key + optional AI function URL |
| `supabase-setup.sql` | Journal table (`entries`) + Row Level Security |
| `supabase-planner.sql` | Planner table (`plans`) + Row Level Security |
| `supabase-summaries.sql` | Weekly-reflection table (`summaries`) + RLS |
| `supabase/functions/weekly-summary/` | Edge Function that calls Claude Haiku |
