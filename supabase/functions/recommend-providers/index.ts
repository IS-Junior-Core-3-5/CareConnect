// Supabase Edge Function: recommend-providers
// Sends the logged-in parent's profile + facts about every provider to Google Gemini.
// Gemini picks the top 3 and writes the answers behind each "Why?" style button.
// Results are cached in public.ai_recommendations.
//
// Secrets: GEMINI_API_KEY (required, free from aistudio.google.com), GEMINI_MODEL (optional)
import { createClient } from "npm:@supabase/supabase-js@2";

// Tried in order; Google's free models are sometimes overloaded (503), so fall back.
const MODELS = [
  ...(Deno.env.get("GEMINI_MODEL") ? [Deno.env.get("GEMINI_MODEL")!] : []),
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
];
const RETRYABLE = new Set([429, 500, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DETAIL_KEYS = ["why", "tradeoffs", "schedule", "cost", "trust"] as const;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SYSTEM = `You are CareConnect's childcare matching engine. You are not a chatbot.
You get one parent's profile and facts about every childcare provider.
Analyze the family's needs and pick the 3 providers that fit them best, best first.

Weigh, roughly in this order:
1. Schedule: covered_blocks vs need_blocks, and gap_blocks. If schedule_available is false, the schedule is unknown.
2. Fit for the children's ages and the parent's situation in "about" (e.g. preschool suits ages 3-5,
   infants need infant care, shift workers need evenings/weekends, stated language wishes).
3. Language: shared_languages.
4. Trust: verified, verified vs self-reported credentials, rating, review_count, review_snippets,
   the parent's own past reviews and my_confirmed_bookings (they already used this provider).
5. Cost: daily_rate / daily_rate_max / pricing_notes (null daily_rate = pricing unavailable), distance, same neighborhood.
Favorites signal interest, not quality.

For each pick write:
- headline: one sentence (max 20 words), the main reason this is a fit.
- details.why: 2-4 sentences, why this provider fits THIS family, citing specific facts.
- details.tradeoffs: 1-3 sentences, honest downsides or gaps, and how the parent might handle them.
- details.schedule: 1-3 sentences, which needed blocks are covered and which are gaps (name the days).
- details.cost: 1-3 sentences, price vs alternatives, extras in pricing_notes, or "pricing unavailable".
- details.trust: 1-3 sentences, verification, credentials, ratings and what other parents say.
- match_score: 0-100, overall fit.
Also write summary: one sentence on what this family most needs.

Rules: use only provider_id values from the list; never invent facts; speak to the parent as "you";
no markdown. Respond with JSON only:
{"summary": string, "recommendations": [{"provider_id": string, "match_score": number, "headline": string,
 "details": {"why": string, "tradeoffs": string, "schedule": string, "cost": string, "trust": string}}]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured yet (missing GEMINI_API_KEY)." }, 500);

    // Runs as the logged-in user, so RLS still applies
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Please log in first." }, 401);

    // 1. Parent profile (children's names are not sent, only ages)
    const { data: parent, error: pErr } = await supabase
      .from("parents")
      .select(`id, neighborhood, blurb,
               children(age),
               parent_languages(languages(name)),
               parent_availability(day_of_week, block),
               reviews(provider_id, body, score_experience, score_values, score_communication, score_safety)`)
      .eq("auth_user_id", user.id)
      .single();
    if (pErr || !parent) return json({ error: "Parent profile not found." }, 404);

    // 2. Provider facts relative to this parent
    const { data: providers, error: fErr } = await supabase.rpc("provider_match_features");
    if (fErr) return json({ error: fErr.message }, 500);
    if (!providers?.length) return json({ summary: "", recommendations: [] });

    const profile = {
      neighborhood: parent.neighborhood,
      about: parent.blurb,
      children_ages: (parent.children ?? []).map((c: { age: number | null }) => c.age),
      languages: (parent.parent_languages ?? []).map((l: any) => l.languages?.name).filter(Boolean),
      needs_care: (parent.parent_availability ?? []).map((a: any) => `${DAYS[a.day_of_week]} ${a.block}`),
      my_past_reviews: parent.reviews ?? [],
    };

    // 3. Ask Gemini (retry + fall back to other free models if busy)
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{
        role: "user",
        parts: [{
          text: `PARENT PROFILE:\n${JSON.stringify(profile, null, 2)}\n\nPROVIDERS:\n${JSON.stringify(providers, null, 2)}`,
        }],
      }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 8192 },
    });
    let aiRes: Response | null = null;
    let MODEL = "";
    let lastStatus = 0;
    outer: for (const m of [...new Set(MODELS)]) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
          body,
        });
        if (res.ok) { aiRes = res; MODEL = m; break outer; }
        lastStatus = res.status;
        console.error("Gemini error", m, res.status, await res.text());
        if (res.status === 404) break;              // model name not available, try next
        if (!RETRYABLE.has(res.status)) break outer; // e.g. bad key
        await sleep(1500 * (attempt + 1));
      }
    }
    if (!aiRes) {
      if (RETRYABLE.has(lastStatus)) return json({ error: "Google's free AI is busy right now. Try again in a minute." }, 503);
      if (lastStatus === 400 || lastStatus === 403) return json({ error: "The Gemini API key was rejected. Check GEMINI_API_KEY in Supabase." }, 502);
      return json({ error: `AI request failed (${lastStatus}).` }, 502);
    }
    const ai = await aiRes.json();
    const text: string = (ai.candidates?.[0]?.content?.parts ?? [])
      .filter((p: any) => !p.thought)
      .map((p: any) => p.text ?? "")
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "AI returned an unreadable answer. Try again." }, 502);
    const parsed = JSON.parse(match[0]);

    // 4. Keep only real providers, top 3, clean fields
    const validIds = new Set(providers.map((p: any) => p.provider_id));
    const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
    const summary = clip(parsed.summary, 400);
    const seen = new Set<string>();
    const rows = (parsed.recommendations ?? [])
      .filter((r: any) => validIds.has(r.provider_id) && !seen.has(r.provider_id) && seen.add(r.provider_id))
      .slice(0, 3)
      .map((r: any, i: number) => ({
        parent_id: parent.id,
        provider_id: r.provider_id,
        rank: i + 1,
        match_score: Math.max(0, Math.min(100, Math.round(Number(r.match_score) || 0))),
        headline: clip(r.headline, 300) || "Strong fit for your family.",
        details: Object.fromEntries(DETAIL_KEYS.map((k) => [k, clip(r.details?.[k], 1200)])),
        summary,
        model: MODEL,
      }));

    // 5. Replace the cached set
    const { error: dErr } = await supabase.from("ai_recommendations").delete().eq("parent_id", parent.id);
    if (dErr) return json({ error: dErr.message }, 500);
    if (rows.length) {
      const { error: iErr } = await supabase.from("ai_recommendations").insert(rows);
      if (iErr) return json({ error: iErr.message }, 500);
    }

    return json({ summary, recommendations: rows });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong getting recommendations." }, 500);
  }
});
