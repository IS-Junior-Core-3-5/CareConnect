// Supabase Edge Function: provider-distances
// Calculates straight-line provider distances from the signed-in parent's address.
// Stored provider coordinates are used when present; only rows without a point
// are sent to the U.S. Census Geocoder. On first use, the parent's address is
// geocoded too. Parent coordinates are stored only in that parent's RLS-protected
// private address row. Provider addresses are public inputs and are never written
// back to provider records.
import { createClient } from "npm:@supabase/supabase-js@2";

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

type Coordinate = { latitude: number; longitude: number };
type ProviderInput = {
  id: string;
  address?: string;
  /** Stored provider coordinates. Used before falling back to the geocoder. */
  latitude?: number | null;
  longitude?: number | null;
};

const providerGeocodeCache = new Map<string, { point: Coordinate | null; expiresAt: number }>();

function coordinate(latitude: unknown, longitude: unknown): Coordinate | null {
  if (latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { latitude: lat, longitude: lon };
}

async function geocodeAddress(address: string): Promise<Coordinate | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", address.trim());
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Geocoding service unavailable.");

  const result = await response.json();
  const point = result?.result?.addressMatches?.[0]?.coordinates;
  if (typeof point?.x !== "number" || typeof point?.y !== "number") return null;
  return { latitude: point.y, longitude: point.x };
}

async function geocodeProviderAddress(address: string): Promise<Coordinate | null> {
  const key = address.trim().toLowerCase();
  const cached = providerGeocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.point;
  const point = await geocodeAddress(address).catch(() => null);
  providerGeocodeCache.set(key, {
    point,
    expiresAt: Date.now() + (point ? 7 : 0.1) * 24 * 60 * 60 * 1000,
  });
  return point;
}

function milesBetween(a: Coordinate, b: Coordinate): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function mapWithLimit<T, U>(
  values: T[],
  limit: number,
  task: (value: T) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(values.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (true) {
        const index = next++;
        if (index >= values.length) return;
        results[index] = await task(values[index]);
      }
    }),
  );
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST to calculate distances." }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Sign in to use the distance filter." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey)
      return json({ error: "Distance filtering is not configured yet." }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user)
      return json({ error: "Sign in to use the distance filter." }, 401);

    const { data: parentId, error: parentIdError } = await userClient.rpc("my_parent_id");
    if (parentIdError || !parentId)
      return json({ error: "Your parent profile could not be found." }, 403);

    const { data: parentLocation, error: locationError } = await userClient
      .from("parent_private_addresses")
      .select("address, latitude, longitude")
      .eq("parent_id", parentId)
      .maybeSingle();
    if (locationError) return json({ error: "Your saved address could not be read." }, 500);
    const parentAddress = parentLocation?.address?.trim();
    if (!parentAddress)
      return json({ error: "Add an address to your profile before filtering by distance." }, 400);
    if (parentAddress.length > 500)
      return json({ error: "Your saved address is too long to geocode." }, 400);

    const body = await req.json().catch(() => ({}));
    const rawProviders = Array.isArray(body?.providers) ? body.providers : [];
    const providers: ProviderInput[] = rawProviders
      .filter(
        (p: unknown) => p && typeof p === "object" && typeof (p as ProviderInput).id === "string",
      )
      .slice(0, 100)
      .map((p: ProviderInput) => ({
        id: p.id.trim().slice(0, 200),
        address: typeof p.address === "string" ? p.address.trim().slice(0, 500) : "",
        latitude: typeof p.latitude === "number" ? p.latitude : null,
        longitude: typeof p.longitude === "number" ? p.longitude : null,
      }))
      .filter((p: ProviderInput) => p.id.length > 0);
    if (!providers.length) return json({ distances: {}, unmatched: [] });

    let parentPoint = coordinate(parentLocation?.latitude, parentLocation?.longitude);
    if (!parentPoint) {
      parentPoint = await geocodeAddress(parentAddress).catch(() => null);
      if (!parentPoint) {
        return json(
          {
            error:
              "We couldn't locate your saved address. Update it in your profile, then try again.",
            code: "address_not_found",
          },
          422,
        );
      }
      const { error: saveError } = await userClient
        .from("parent_private_addresses")
        .update({
          latitude: parentPoint.latitude,
          longitude: parentPoint.longitude,
          geocoded_at: new Date().toISOString(),
        })
        .eq("parent_id", parentId);
      if (saveError)
        return json({ error: "Your private coordinates couldn't be saved. Try again." }, 500);
    }

    const distances: Record<string, number | null> = {};
    const unmatched: string[] = [];
    // Prefer the coordinates already stored on the provider row. That keeps the
    // distance filter fast and avoids re-geocoding the whole directory on every
    // cold start. Only rows without a point fall back to the Census API.
    const results = await mapWithLimit(providers, 4, async (provider) => {
      const stored = coordinate(provider.latitude, provider.longitude);
      if (stored) return stored;
      if (!provider.address?.trim()) return null;
      return geocodeProviderAddress(provider.address);
    });
    providers.forEach((provider, index) => {
      const point = results[index];
      if (!point) unmatched.push(provider.id);
      distances[provider.id] = point
        ? Math.round(milesBetween(parentPoint!, point) * 10) / 10
        : null;
    });

    return json({ distances, unmatched });
  } catch {
    return json({ error: "We couldn't calculate distances right now. Please try again." }, 500);
  }
});
