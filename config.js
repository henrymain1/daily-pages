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
  SUPABASE_URL: "https://dzorirqyxjrgascpptea.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_78h3RCWdqJsEn9lGpIKWDA_15kNFOfs",

  // Optional: URL of the deployed "weekly-summary" Supabase Edge Function.
  // Leave empty to keep the weekly AI reflection off. Once deployed, paste
  // the function URL here, e.g.:
  //   https://dzorirqyxjrgascpptea.supabase.co/functions/v1/weekly-summary
  AI_SUMMARY_URL: "",

  // "Continue with Google" button. Keep this false until you've enabled the
  // Google provider in the Supabase dashboard (Authentication → Providers →
  // Google) — otherwise the button just shows a gentle "not set up yet" note.
  // Flip to true after setup and the button will sign in with Google.
  GOOGLE_ENABLED: false,

  // Google Calendar sync. Leave empty to keep it off (the Connect option is
  // hidden and nothing calls Google). After you deploy the `gcal` Edge
  // Function (see GCAL_SETUP.md), paste its URL here, e.g.:
  //   https://dzorirqyxjrgascpptea.supabase.co/functions/v1/gcal
  GCAL_FUNCTION_URL: "https://dzorirqyxjrgascpptea.supabase.co/functions/v1/gcal",
};
