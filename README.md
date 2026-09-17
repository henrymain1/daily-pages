# Daily Pages

**Live app → [henrymain1.github.io/daily-pages](https://henrymain1.github.io/daily-pages/)**

A calm, personal space for journaling and planning your day. Write a daily
entry, track how you're feeling over time, plan your to-dos on a schedule, and
keep your own lists — all in one quiet, uncluttered place.

## Features

- **Daily journal** — a distraction-free writing space with an entry for each day.
- **Mood tracking** — tag each day with a mood and watch the patterns appear on a
  calendar and in your insights.
- **Planner** — a keyboard-friendly to-do outliner (tasks and subtasks) alongside
  a visual day schedule you can click to add time blocks and drag to resize.
- **Deadlines & Google Calendar** — give a to-do a time of day and optionally sync
  it to Google Calendar so your phone reminds you.
- **Lists** — free-form lists for anything, each with its own colour.
- **Light & dark** — a warm, soft theme that follows your preference.

## Tech

A static site — plain HTML, CSS, and JavaScript, no build step — backed by
[Supabase](https://supabase.com/) for accounts and data storage, and hosted on
GitHub Pages.

## Running your own copy

1. Clone the repo.
2. Create a Supabase project and run the SQL in `supabase-setup.sql` to create the
   tables.
3. Copy your Supabase project URL and public (anon) key into `config.js`.
4. Open `index.html` — that's it. To host it, push to a GitHub Pages branch.
