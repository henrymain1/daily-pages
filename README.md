# 📖 Daily Pages

A calm, personal daily journal. Log in, write today's entry, and keep a streak
going — your writing syncs to the cloud so it's on every device.

**▶ Live:** https://henrymain1.github.io/daily-pages/

Built as a static site (HTML/CSS/JS) hosted on **GitHub Pages**, with
**Supabase** for accounts and storage. Bold neo-brutalist "Almanac" look.

## Features
- Email/password login
- One entry per day, distraction-free editor with autosave
- Mood picker · a daily writing prompt · live word count
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

## Files
| File | What it is |
|------|------------|
| `index.html` | Page structure |
| `styles.css` | Styling / neo-brutalist "Almanac" theme |
| `app.js` | App logic (auth, editor, planner, calendar, insights, export) |
| `config.js` | Supabase project URL + publishable key (public-safe) |
| `supabase-setup.sql` | Journal table (`entries`) + Row Level Security |
| `supabase-planner.sql` | Planner table (`plans`) + Row Level Security |
