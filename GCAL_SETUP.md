# Google Calendar sync — setup

One-time setup to turn on two-way Google Calendar sync (solo, no verification).
Everything is **off** until the final step, so the live site is unaffected meanwhile.

Your Supabase project ref is `dzorirqyxjrgascpptea`, so throughout:

- **Function URL / redirect URI:** `https://dzorirqyxjrgascpptea.supabase.co/functions/v1/gcal`

---

## 1. Google Cloud (≈10 min)

1. Go to **console.cloud.google.com** → create a project (e.g. "Daily Pages").
2. **APIs & Services → Library** → search **Google Calendar API** → **Enable**.
3. **APIs & Services → OAuth consent screen:**
   - User type: **External** → Create.
   - App name **Daily Pages**, your email as support + developer contact. Save.
   - **Scopes** → Add → find **`.../auth/calendar.events`** → add it → Save.
   - Back on the consent screen, click **Publish app → Confirm** (status becomes
     "In production"). *Unverified is fine — you'll just click through one
     warning when you connect. This avoids the 7-day token expiry of Testing mode.*
4. **APIs & Services → Credentials → Create credentials → OAuth client ID:**
   - Application type: **Web application**.
   - **Authorized redirect URIs → Add URI:**
     `https://dzorirqyxjrgascpptea.supabase.co/functions/v1/gcal`
   - Create. Copy the **Client ID** and **Client secret**.

## 2. Supabase — database + secrets + deploy

**a) Table** — Supabase → **SQL Editor** → paste & run `supabase-gcal.sql`.

**b) Secrets** — set these four (dashboard: **Edge Functions → Secrets**, or CLI below):
```
GOOGLE_CLIENT_ID       = <the Client ID from step 1>
GOOGLE_CLIENT_SECRET   = <the Client secret from step 1>
GOOGLE_REDIRECT_URI    = https://dzorirqyxjrgascpptea.supabase.co/functions/v1/gcal
GCAL_STATE_SECRET      = <any long random string you make up>
```
*(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically — don't add them.)*

**c) Deploy the function.** With the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and logged in (`supabase login`):
```bash
supabase functions deploy gcal --no-verify-jwt --project-ref dzorirqyxjrgascpptea
```
⚠️ The **`--no-verify-jwt`** flag is required (Google's callback is a plain browser
redirect with no token; the function checks your login itself on the other actions).

CLI secrets alternative:
```bash
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REDIRECT_URI=https://dzorirqyxjrgascpptea.supabase.co/functions/v1/gcal GCAL_STATE_SECRET=... --project-ref dzorirqyxjrgascpptea
```

## 3. Turn it on

In `config.js`, set:
```js
GCAL_FUNCTION_URL: "https://dzorirqyxjrgascpptea.supabase.co/functions/v1/gcal",
```
Commit & push (or tell me and I'll do it). Hard-refresh the live site.

## 4. Try it

1. Avatar menu → **Connect Google Calendar** → Google asks permission.
   Click **Advanced → Go to Daily Pages (unsafe)** — that's the expected
   "unverified" screen for your own app — then **Allow**.
2. You land back in Daily Pages ("connected"). Open **Planner** → your Google
   events for that day appear on the Schedule (striped blue, read-only). The
   **Sync** button (top of Schedule) re-pulls on demand.
3. Give a to-do a **deadline** → it creates a Google Calendar event at that time
   with a popup reminder → your phone's calendar will notify you. Clearing the
   deadline or deleting the task removes the event.

If anything errors, tell me what you see (or check **Supabase → Edge Functions →
gcal → Logs**) and I'll fix it.
