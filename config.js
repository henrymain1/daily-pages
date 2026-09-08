// ============================================================
//  CONFIG  —  paste your two Supabase values here
// ============================================================
//
//  Where to find them:
//    Supabase dashboard  →  your project  →  Settings (gear)
//      →  "API"  →  copy:
//        • Project URL                 → SUPABASE_URL
//        • Project API keys → "anon" (public) key → SUPABASE_ANON_KEY
//
//  ⚠️  The "anon" key is meant to be public. It is SAFE to commit
//      and to ship inside a GitHub Pages site — your data is locked
//      down by Row Level Security (see supabase-setup.sql).
//      NEVER paste the "service_role" key here. That one is secret.
//
window.JOURNAL_CONFIG = {
  SUPABASE_URL: "YOUR_SUPABASE_URL_HERE",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY_HERE",
};
