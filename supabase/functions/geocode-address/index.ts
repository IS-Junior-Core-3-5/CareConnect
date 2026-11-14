// Supabase Edge Function: geocode-address
// Checks a free-text U.S. address against the U.S. Census Geocoder before the
// app saves it. The Census one-line geocoder is the same service that powers
// the distance filter, so a match here means the address can be located later.
//
// This endpoint is deliberately callable before sign-in: the sign-up form needs
// to check the address before the account exists. It stores nothing, needs no
// database access, and only forwards the address to the public Census service.
// Supabase still requires the project's anon key on every request.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

type GeocodeMatch = {
  matchedAddress: string;
  latitude: number;
  longitude: number;
};

/**
 * Calls the Census one-line geocoder. Returns null when the service responded
 * but found no match, and throws when the service itself failed. The caller
 * treats those two cases differently: no match is the user's typo, a failure is
 * an outage and should not block the save.
 */
async function geocode(address: string): Promise<GeocodeMatch | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Geocoder unavailable");

  const result = await response.json();
  const match = result?.result?.addressMatches?.[0];
  const point = match?.coordinates;
  if (typeof point?.x !== "number" || typeof point?.y !== "number") return null;

  return {
    matchedAddress: typeof match.matchedAddress === "string" ? match.matchedAddress : address,
    latitude: point.y,
    longitude: point.x,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST to check an address." }, 405);

  const body = await req.json().catch(() => ({}));
  const address = typeof body?.address === "string" ? body.address.trim().slice(0, 500) : "";
  if (address.length < 5) {
    return json(
      {
        error: "Enter a full street address, including city, state, and ZIP.",
        code: "invalid",
      },
      400,
    );
  }

  try {
    const match = await geocode(address);
    if (!match) {
      return json(
        {
          error:
            "We couldn't find that address. Check the street number, city, state, and ZIP. P.O. boxes can't be located.",
          code: "not_found",
        },
        422,
      );
    }
    return json(match);
  } catch {
    return json(
      {
        error: "The address lookup service is unavailable right now. Try again in a moment.",
        code: "unavailable",
      },
      503,
    );
  }
});
