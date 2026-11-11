import { useQuery } from "@tanstack/react-query";
import { getExternalProfile } from "@/lib/external-profiles";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDate,
  scheduleFromRows,
  type CareType,
  type Parent,
  type Provider,
  type Review,
} from "@/lib/model";

/**
 * All app data is read live from Supabase. Query keys are shared so that
 * any save can call queryClient.invalidateQueries({ queryKey: [...] }) to refresh.
 */
export const QK = {
  providers: ["providers"] as const,
  parents: ["parents"] as const,
  languages: ["languages"] as const,
};

// Supabase rows are untyped until we generate DB types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const PROVIDER_SELECT = `
  id, owner_id, listing_origin, website_url, contact_url, source_url, checked_on,
  name, care_type, blurb, bio, daily_rate, daily_rate_max, address, phone,
  distance_miles, verified, schedule_available, schedule_summary, photo_key, profile_photo_path,
  provider_pricing_notes(note, sort_order),
  provider_photos(photo_key, sort_order),
  provider_credentials(name, verified),
  provider_languages(languages(name)),
  provider_availability(day_of_week, block)
`;

const PROVIDER_ACTIVITY_SELECT = `
  provider_past_families(parent_id),
  reviews(id, parent_id, body, score_experience, score_values, score_communication, score_safety, reviewed_on, parents(name))
`;

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const bySort = (a: Row, b: Row) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

function mapProvider(r: Row, preview = false): Provider {
  const reviews: Review[] = (r.reviews ?? [])
    .map((v: Row) => ({
      id: v.id,
      parentId: v.parent_id,
      author: v.parents?.name ?? "A parent",
      reviewedOn: v.reviewed_on,
      date: formatDate(v.reviewed_on, false),
      text: v.body ?? "",
      scores: {
        experience: v.score_experience,
        values: v.score_values,
        communication: v.score_communication,
        safety: v.score_safety,
      },
    }))
    .sort((a: Review, b: Review) => b.reviewedOn.localeCompare(a.reviewedOn));
  const avg = reviews.length
    ? reviews.reduce(
        (s, v) =>
          s +
          (v.scores.experience + v.scores.values + v.scores.communication + v.scores.safety) / 4,
        0,
      ) / reviews.length
    : 0;
  const photos = [...(r.provider_photos ?? [])].sort(bySort).map((p: Row) => p.photo_key as string);
  const external = r.listing_origin === "external";
  const externalProfile = external ? getExternalProfile(r.id) : null;
  const publishedHours = externalProfile?.hours;
  const location = externalProfile?.location;
  return {
    id: r.id,
    ownerId: r.owner_id ?? null,
    listingOrigin: r.listing_origin ?? "owned",
    isDemo:
      preview ||
      (import.meta.env.VITE_CARECONNECT_DEMO === "true" && r.id.startsWith("careconnect-demo-")),
    profilePhotoPath: r.profile_photo_path ?? null,
    externalProfile,
    websiteUrl: r.website_url ?? null,
    contactUrl: externalProfile?.contactUrl ?? r.contact_url ?? null,
    sourceUrl: r.source_url ?? null,
    checkedOn: r.checked_on ?? null,
    name: r.name,
    careType: r.care_type as CareType,
    photo: external ? null : (r.photo_key ?? photos[0] ?? null),
    gallery: external ? [] : photos,
    blurb: r.blurb ?? "",
    bio: r.bio ?? "",
    dailyRate: num(r.daily_rate),
    dailyRateMax: num(r.daily_rate_max),
    pricingNotes: [...(r.provider_pricing_notes ?? [])].sort(bySort).map((n: Row) => n.note),
    address: location
      ? "address" in location
        ? location.address
        : location.serviceArea
      : (r.address ?? ""),
    phone: r.phone ?? "",
    distance: num(r.distance_miles),
    rating: Math.round(avg * 10) / 10,
    reviewCount: reviews.length,
    verified: !external && !!r.verified,
    licenses: (r.provider_credentials ?? []).map((c: Row) => c.name),
    languages: (r.provider_languages ?? [])
      .map((l: Row) => l.languages?.name)
      .filter(Boolean)
      .sort(),
    schedule:
      !external && r.schedule_available ? scheduleFromRows(r.provider_availability ?? []) : null,
    scheduleSummary:
      publishedHours?.kind === "published"
        ? `${publishedHours.label}: ${publishedHours.summary}`
        : (publishedHours?.summary ??
          (!external && r.schedule_available
            ? (r.schedule_summary ?? "")
            : "Availability unknown")),
    pastFamilies: (r.provider_past_families ?? []).map((f: Row) => f.parent_id),
    reviews,
  };
}

export async function fetchProviders(includeFamilyActivity = true): Promise<Provider[]> {
  const select = includeFamilyActivity
    ? `${PROVIDER_SELECT}, ${PROVIDER_ACTIVITY_SELECT}`
    : PROVIDER_SELECT;
  const { data, error } = await supabase
    .from("providers")
    .select(select)
    .eq("is_public", true)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((row) => mapProvider(row));
}

export async function fetchParents(): Promise<Parent[]> {
  const { data, error } = await supabase
    .from("parents")
    .select(
      `id, name, blurb,
       children(id, name, age),
       parent_languages(languages(name)),
       parent_availability(day_of_week, block)`,
    )
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r: Row) => {
    const languages = (r.parent_languages ?? []).map((l: Row) => l.languages?.name).filter(Boolean);
    return {
      id: r.id,
      name: r.name,
      blurb: r.blurb ?? "",
      languages,
      language: languages.join(", "),
      children: [...(r.children ?? [])].sort((a: Row, b: Row) => a.id - b.id),
      schedule: scheduleFromRows(r.parent_availability ?? []),
    };
  });
}

export async function fetchLanguages(): Promise<{ id: number; name: string }[]> {
  const { data, error } = await supabase.from("languages").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}

const opts = { staleTime: 30_000 };

export function useProvidersQuery(includeFamilyActivity = true, enabled = true) {
  return useQuery({
    queryKey: [...QK.providers, includeFamilyActivity],
    queryFn: () => fetchProviders(includeFamilyActivity),
    enabled,
    ...opts,
  });
}
export function usePreviewProviders(enabled: boolean) {
  return useQuery({
    queryKey: ["provider-preview"],
    enabled,
    staleTime: Infinity,
    queryFn: async () => {
      const { buildDemoProviders } = await import("../../supabase/demo/providers.mjs");
      return buildDemoProviders()
        .map(({ listing, notes, credentials, languages, availability }) =>
          mapProvider(
            {
              ...listing,
              provider_pricing_notes: notes.map((note) => ({ note })),
              provider_credentials: credentials.map((name) => ({ name })),
              provider_languages: languages.map((name) => ({ languages: { name } })),
              provider_availability: availability,
            },
            true,
          ),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function useParentsQuery(enabled = true) {
  return useQuery({ queryKey: QK.parents, queryFn: fetchParents, ...opts, enabled });
}
export function useLanguages() {
  return (
    useQuery({ queryKey: QK.languages, queryFn: fetchLanguages, staleTime: 300_000 }).data ?? []
  );
}

export function useProviders(): Provider[] {
  return useProvidersQuery().data ?? [];
}
export function useParents(enabled = true): Parent[] {
  return useParentsQuery(enabled).data ?? [];
}

export function useProvider(id: string, includeFamilyActivity = true, enabled = true) {
  const q = useProvidersQuery(includeFamilyActivity, enabled);
  return { provider: q.data?.find((p) => p.id === id), isLoading: q.isLoading, error: q.error };
}
export function useParent(id: string) {
  const q = useParentsQuery();
  return { parent: q.data?.find((p) => p.id === id), isLoading: q.isLoading, error: q.error };
}
