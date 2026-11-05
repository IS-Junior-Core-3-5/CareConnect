/* eslint-disable @typescript-eslint/no-explicit-any -- untyped Supabase and AI JSON payloads */
// Supabase Edge Function: recommend-providers
// Sends the logged-in parent's profile + facts about every provider to Google Gemini.
// Gemini picks the top 3 and writes the answers behind each "Why?" style button.
// With {"mode":"chat","message":"..."} it instead answers a chat message (history in ai_chat_messages).
// Results are cached in public.ai_recommendations.
//
// Secrets: GEMINI_API_KEY (required, free from aistudio.google.com), GEMINI_MODEL (optional)
import { createClient } from "npm:@supabase/supabase-js@2";

// Tried in order; Google's free models are sometimes overloaded (503) or slow, so fall back.
// (Google retired gemini-2.5-* for new keys; a 404 just moves on to the next model.)
const MODELS = [
  ...(Deno.env.get("GEMINI_MODEL") ? [Deno.env.get("GEMINI_MODEL")!] : []),
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.8-flash",
  "gemini-flash-latest",
];
const RETRYABLE = new Set([429, 500, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DETAIL_KEYS = ["why", "tradeoffs", "schedule", "cost", "trust"] as const;

type GeminiContent = { role: "user" | "model"; parts: { text: string }[] };
type GeminiResult = { text: string; model: string } | { error: string; status: number };

/** Calls Gemini with model fallback. Only reports a bad key when Google says so. */
async function callGemini(
  apiKey: string,
  system: string,
  contents: GeminiContent[],
  opts: { json: boolean; maxTokens: number; budgetMs: number },
): Promise<GeminiResult> {
  const started = Date.now();
  const body = (fast: boolean) =>
    JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: {
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
        temperature: opts.json ? 0.4 : 0.6,
        maxOutputTokens: opts.maxTokens,
        // Gemini 3 models take thinkingLevel; "low" keeps answers fast.
        ...(fast ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
      },
    });
  let lastStatus = 0;
  let keyRejected = false;
  for (const m of [...new Set(MODELS)]) {
    // First try with low thinking (fast); if the model rejects that setting, retry without it.
    let fast = true;
    for (let attempt = 0; attempt < 3; attempt++) {
      const left = opts.budgetMs - (Date.now() - started);
      if (left < 4_000) return { error: "timeout", status: lastStatus || 504 };
      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
          {
            method: "POST",
            headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
            body: body(fast),
            signal: AbortSignal.timeout(Math.min(45_000, left)),
          },
        );
      } catch (e) {
        console.error("Gemini timeout/network", m, String(e));
        lastStatus = 504;
        break; // too slow, try the next model
      }
      if (res.ok) {
        const ai = await res.json();
        const text: string = (ai.candidates?.[0]?.content?.parts ?? [])
          .filter((p: any) => !p.thought)
          .map((p: any) => p.text ?? "")
          .join("")
          .trim();
        if (text) return { text, model: m };
        console.error("Gemini empty answer", m, JSON.stringify(ai).slice(0, 300));
        lastStatus = 502;
        break;
      }
      lastStatus = res.status;
      const errText = await res.text();
      console.error("Gemini error", m, res.status, fast, errText.slice(0, 500));
      if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|API key expired/i.test(errText)) {
        keyRejected = true;
        return { error: "key", status: res.status };
      }
      if (res.status === 400 && fast) {
        fast = false; // model doesn't accept thinkingLevel
        continue;
      }
      if (RETRYABLE.has(res.status) && attempt < 2) {
        await sleep(1200);
        continue;
      }
      break; // 400/404/other: try the next model
    }
  }
  return { error: keyRejected ? "key" : "failed", status: lastStatus };
}

function aiError(r: { error: string; status: number }) {
  if (r.error === "key")
    return json({ error: "The Gemini API key was rejected. Check GEMINI_API_KEY in Supabase." }, 502);
  if (RETRYABLE.has(r.status) || r.error === "timeout")
    return json({ error: "Google's free AI is busy right now. Try again in a minute." }, 503);
  return json({ error: `AI request failed (${r.status}).` }, 502);
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

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

const CHAT_SYSTEM = `You are CareConnect's friendly childcare assistant, chatting with one parent.
You get the parent's profile and facts about every childcare provider on CareConnect.
Help them find and compare care: answer questions about providers, schedules, costs, trust, and
what to ask a caregiver. Ground every claim about a provider in the facts given; if something is
unknown (e.g. schedule_available false, null daily_rate), say so. Never invent providers or facts.
Mention providers by name. Keep replies short (under 150 words), warm and practical. Plain text,
you may use simple "- " bullet lines. If asked something unrelated to childcare or parenting,
briefly steer back.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured yet (missing GEMINI_API_KEY)." }, 500);

    // Runs as the logged-in user, so RLS still applies
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: "Please log in first." }, 401);

    const input = await req.json().catch(() => ({}));
    const mode = input?.mode === "chat" ? "chat" : "recommend";
    const message = typeof input?.message === "string" ? input.message.trim().slice(0, 2000) : "";
    if (mode === "chat" && !message) return json({ error: "Type a message first." }, 400);

    // 1. Parent profile (children's names are not sent, only ages).
    //    Resolve it through my_parent_id() so this function never reads the
    //    private auth_user_id column.
    const { data: parentId, error: idErr } = await supabase.rpc("my_parent_id");
    if (idErr || !parentId) return json({ error: "Parent profile not found." }, 404);
    const { data: parent, error: pErr } = await supabase
      .from("parents")
      .select(
        `id, neighborhood, blurb,
               children(age),
               parent_languages(languages(name)),
               parent_availability(day_of_week, block),
               reviews(provider_id, body, score_experience, score_values, score_communication, score_safety)`,
      )
      .eq("id", parentId)
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
      needs_care: (parent.parent_availability ?? []).map(
        (a: any) => `${DAYS[a.day_of_week]} ${a.block}`,
      ),
      my_past_reviews: parent.reviews ?? [],
    };

    const providerFacts = providers.map((p: any) => ({
      ...p,
      bio: p.bio ? String(p.bio).slice(0, 300) : p.bio,
    }));
    const context = `PARENT PROFILE:\n${JSON.stringify(profile)}\n\nPROVIDERS:\n${JSON.stringify(providerFacts)}`;

    // 3a. Chat mode: answer one message using the saved conversation as history
    if (mode === "chat") {
      const { data: history, error: hErr } = await supabase
        .from("ai_chat_messages")
        .select("role, content")
        .eq("parent_id", parent.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (hErr) return json({ error: hErr.message }, 500);
      const past: GeminiContent[] = (history ?? []).reverse().map((h: any) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      }));
      const contents: GeminiContent[] = [
        { role: "user", parts: [{ text: `${context}\n\n(Context only. The chat starts next.)` }] },
        { role: "model", parts: [{ text: "Got it. How can I help with childcare today?" }] },
        ...past,
        { role: "user", parts: [{ text: message }] },
      ];
      const r = await callGemini(apiKey, CHAT_SYSTEM, contents, {
        json: false,
        maxTokens: 2048,
        budgetMs: 100_000,
      });
      if ("error" in r) return aiError(r);
      const reply = r.text.slice(0, 4000);
      const { error: iErr } = await supabase.from("ai_chat_messages").insert([
        { parent_id: parent.id, role: "user", content: message },
        { parent_id: parent.id, role: "assistant", content: reply, model: r.model },
      ]);
      if (iErr) return json({ error: iErr.message }, 500);
      return json({ reply, model: r.model });
    }

    // 3b. Recommend mode: top 3 picks as JSON
    const r = await callGemini(apiKey, SYSTEM, [{ role: "user", parts: [{ text: context }] }], {
      json: true,
      maxTokens: 8192,
      budgetMs: 110_000,
    });
    if ("error" in r) return aiError(r);
    const MODEL = r.model;
    const match = r.text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "AI returned an unreadable answer. Try again." }, 502);
    const parsed = JSON.parse(match[0]);

    // 4. Keep only real providers, top 3, clean fields
    const validIds = new Set(providers.map((p: any) => p.provider_id));
    const clip = (v: unknown, n: number) =>
      String(v ?? "")
        .trim()
        .slice(0, n);
    const summary = clip(parsed.summary, 400);
    const seen = new Set<string>();
    const rows = (parsed.recommendations ?? [])
      .filter(
        (r: any) =>
          validIds.has(r.provider_id) && !seen.has(r.provider_id) && seen.add(r.provider_id),
      )
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
    const { error: dErr } = await supabase
      .from("ai_recommendations")
      .delete()
      .eq("parent_id", parent.id);
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
