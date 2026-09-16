// ============================================================
//  Edge Function: gcal  —  Google Calendar sync for Daily Pages
//  Actions (POST JSON, with the user's Supabase JWT in Authorization):
//    status | authurl | disconnect | pull | push | unpush
//  Plus the OAuth callback (GET ?code=&state=) that Google redirects to.
//
//  DEPLOY:   supabase functions deploy gcal --no-verify-jwt
//    (--no-verify-jwt is required so Google's callback GET can reach us;
//     we verify the user's JWT ourselves on the JSON actions.)
//
//  SECRETS the function needs (supabase secrets set ...):
//    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GCAL_STATE_SECRET
//  (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI")!;
const STATE_SECRET = Deno.env.get("GCAL_STATE_SECRET") || CLIENT_SECRET;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const FALLBACK_APP = "https://henrymain1.github.io/daily-pages/";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---- signed state (stateless CSRF + carries the uid through the redirect) ----
function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(STATE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(new Uint8Array(sig));
}
async function signState(payload: Record<string, unknown>): Promise<string> {
  const p = b64url(new TextEncoder().encode(JSON.stringify({ ...payload, iat: Date.now() })));
  return p + "." + (await hmac(p));
}
async function verifyState(state: string): Promise<Record<string, unknown> | null> {
  const [p, sig] = (state || "").split(".");
  if (!p || !sig || (await hmac(p)) !== sig) return null;
  try {
    const data = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    if (Date.now() - (data.iat || 0) > 10 * 60 * 1000) return null; // 10-minute window
    return data;
  } catch { return null; }
}

async function getUser(req: Request) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data.user;
}

async function getAccessToken(uid: string): Promise<string> {
  const { data: row } = await admin.from("gcal").select("*").eq("user_id", uid).maybeSingle();
  if (!row) throw new Error("not_connected");
  if (row.access_token && row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 60000) {
    return row.access_token;
  }
  const body = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: row.refresh_token, grant_type: "refresh_token" });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const t = await r.json();
  if (!t.access_token) throw new Error("refresh_failed");
  const expires_at = new Date(Date.now() + ((t.expires_in || 3600) - 60) * 1000).toISOString();
  await admin.from("gcal").update({ access_token: t.access_token, expires_at }).eq("user_id", uid);
  return t.access_token;
}

// dateStr "YYYY-MM-DD" + minutes-from-midnight → local RFC3339 without offset
// (the event's timeZone field carries the zone).
function isoLocal(dateStr: string, min: number): string {
  let d = new Date(dateStr + "T00:00:00");
  let mm = Math.round(min);
  while (mm >= 1440) { d = new Date(d.getTime() + 86400000); mm -= 1440; }
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(Math.floor(mm / 60))}:${p(mm % 60)}:00`;
}

async function handleCallback(url: URL): Promise<Response> {
  const st = await verifyState(url.searchParams.get("state") || "");
  const ret = (st?.ret as string) || FALLBACK_APP;
  const back = (msg: string) => Response.redirect(ret + "#gcal=" + msg, 302);
  const code = url.searchParams.get("code");
  if (!st || !code) return back("error");
  try {
    const body = new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: "authorization_code" });
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const t = await r.json();
    if (!t.access_token) return back("error");
    const rec: Record<string, unknown> = {
      user_id: st.uid,
      access_token: t.access_token,
      expires_at: new Date(Date.now() + ((t.expires_in || 3600) - 60) * 1000).toISOString(),
      connected_at: new Date().toISOString(),
    };
    if (t.refresh_token) rec.refresh_token = t.refresh_token; // present because we send prompt=consent
    await admin.from("gcal").upsert(rec);
    return back("connected");
  } catch { return back("error"); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);

  // OAuth callback — a top-level browser redirect from Google (no JWT).
  if (req.method === "GET" && url.searchParams.has("code")) return handleCallback(url);

  let payload: Record<string, any> = {};
  try { payload = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const uid = user.id;

  try {
    switch (payload.action) {
      case "status": {
        const { data } = await admin.from("gcal").select("user_id").eq("user_id", uid).maybeSingle();
        return json({ connected: !!data });
      }
      case "authurl": {
        const state = await signState({ uid, ret: (payload.returnUrl as string) || FALLBACK_APP });
        const p = new URLSearchParams({
          client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: "code",
          scope: SCOPE, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
        });
        return json({ url: "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString() });
      }
      case "disconnect": {
        const { data: row } = await admin.from("gcal").select("refresh_token").eq("user_id", uid).maybeSingle();
        if (row?.refresh_token) { try { await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(row.refresh_token), { method: "POST" }); } catch { /* ignore */ } }
        await admin.from("gcal").delete().eq("user_id", uid);
        return json({ connected: false });
      }
      case "pull": {
        const token = await getAccessToken(uid);
        const q = new URLSearchParams({ timeMin: payload.timeMin, timeMax: payload.timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50" });
        const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (d.error) return json({ error: d.error.message || "google_error" }, 502);
        const events = (d.items || [])
          .filter((e: any) => e.status !== "cancelled" && !e.extendedProperties?.private?.dailyPages)
          .map((e: any) => ({ id: e.id, title: e.summary || "(no title)", start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date, allDay: !e.start?.dateTime }));
        return json({ connected: true, events });
      }
      case "push": {
        const token = await getAccessToken(uid);
        const { itemId, title, dateStr, startMin, durMin = 30, reminderMin = 0, tz, eventId } = payload;
        const body = {
          summary: title || "(untitled)",
          start: { dateTime: isoLocal(dateStr, startMin), timeZone: tz || "UTC" },
          end: { dateTime: isoLocal(dateStr, startMin + (durMin || 30)), timeZone: tz || "UTC" },
          reminders: { useDefault: false, overrides: [{ method: "popup", minutes: reminderMin || 0 }] },
          extendedProperties: { private: { dailyPages: String(itemId || "1") } },
        };
        const base = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
        const r = await fetch(eventId ? `${base}/${eventId}` : base, {
          method: eventId ? "PATCH" : "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await r.json();
        if (d.error) return json({ error: d.error.message || "google_error" }, 502);
        return json({ eventId: d.id });
      }
      case "unpush": {
        const token = await getAccessToken(uid);
        if (payload.eventId) { try { await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${payload.eventId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); } catch { /* ignore */ } }
        return json({ ok: true });
      }
      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
