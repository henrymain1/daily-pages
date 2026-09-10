// ============================================================
//  Daily Pages — weekly-summary Edge Function
//  Calls Claude Haiku to write a calm weekly reflection.
//  The Anthropic API key stays here on the server (a Supabase
//  secret), never in the website. Deploy this in Supabase and
//  set the ANTHROPIC_API_KEY secret (see README).
// ============================================================

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM = `You are a thoughtful journaling companion writing a short weekly reflection for one person, based only on their journal entries from the past week.

Voice: calm, neutral, and grounded — a gentle, objective mirror. Reflect patterns back honestly, without cheerleading, judgement, or exaggeration. Quiet warmth is fine; hype is not.

Cover, only as far as the entries support it:
- the overall emotional tone across the week and any shifts in mood
- recurring themes: people, work, worries, or ideas they kept returning to
- genuine bright spots or things that seemed to go well
- difficulties they faced, with at most one small, practical, non-preachy observation

Length: about two short paragraphs. Do not pad. If there is little to go on, write less.

End with a single gentle question, or a suggested focus, to carry into the coming week.

Write in second person ("you"), in flowing prose — no headings, no bullet points. Do not invent events or feelings that are not in the entries. Do not mention that you are an AI or refer mechanically to "the entries"; simply reflect their week back to them.`;

Deno.serve(async (req: Request) => {
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) return json({ error: "Server missing ANTHROPIC_API_KEY" }, 500);

    const { entries, weekLabel } = await req.json();
    if (!Array.isArray(entries) || entries.length === 0) return json({ error: "No entries provided" }, 400);

    let userText = `Here are my journal entries for ${weekLabel || "the past week"}:\n\n`;
    for (const e of entries) {
      userText += `## ${e.date}${e.mood ? ` (mood: ${e.mood})` : ""}\n${e.content}\n\n`;
    }
    userText += `Please write my weekly reflection.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system: SYSTEM,
        messages: [{ role: "user", content: userText }],
      }),
    });

    if (!resp.ok) return json({ error: "Anthropic error: " + (await resp.text()) }, 502);
    const data = await resp.json();
    const summary = (data.content || []).map((b: { text?: string }) => b.text || "").join("").trim();
    return json({ summary });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
