import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDate,
  scheduleFromRows,
  type CareType,
  type Parent,
  type Post,
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
  posts: ["posts"] as const,
  languages: ["languages"] as const,
};

type Row = Record<string, any>;

const PROVIDER_SELECT = `
  id, owner_id, name, care_type, blurb, bio, daily_rate, daily_rate_max, neighborhood,
  distance_miles, verified, schedule_available, schedule_summary, photo_key,
  provider_pricing_notes(note, sort_order),
  provider_photos(photo_key, sort_order),
  provider_credentials(name, verified),
  provider_languages(languages(name)),
  provider_availability(day_of_week, block),
  provider_past_families(parent_id),
  reviews(id, parent_id, body, score_experience, score_values, score_communication, score_safety, reviewed_on, parents(name))
`;

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const bySort = (a: Row, b: Row) => (a.sort_order ?? 0) - (b.sort_order ?? 0);

function mapProvider(r: Row): Provider {
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
        (s, v) => s + (v.scores.experience + v.scores.values + v.scores.communication + v.scores.safety) / 4,
        0,
      ) / reviews.length
    : 0;
  const photos = [...(r.provider_photos ?? [])].sort(bySort).map((p: Row) => p.photo_key as string);
  return {
    id: r.id,
    ownerId: r.owner_id ?? null,
    name: r.name,
    careType: r.care_type as CareType,
    photo: r.photo_key ?? photos[0] ?? null,
    gallery: photos,
    blurb: r.blurb ?? "",
    bio: r.bio ?? "",
    dailyRate: num(r.daily_rate),
    dailyRateMax: num(r.daily_rate_max),
    pricingNotes: [...(r.provider_pricing_notes ?? [])].sort(bySort).map((n: Row) => n.note),
    neighborhood: r.neighborhood ?? "",
    distance: num(r.distance_miles),
    rating: Math.round(avg * 10) / 10,
    reviewCount: reviews.length,
    verified: !!r.verified,
    licenses: (r.provider_credentials ?? []).map((c: Row) => c.name),
    languages: (r.provider_languages ?? []).map((l: Row) => l.languages?.name).filter(Boolean).sort(),
    schedule: r.schedule_available ? scheduleFromRows(r.provider_availability ?? []) : null,
    scheduleSummary: r.schedule_available ? (r.schedule_summary ?? "") : "Schedule unavailable",
    pastFamilies: (r.provider_past_families ?? []).map((f: Row) => f.parent_id),
    reviews,
  };
}

export async function fetchProviders(): Promise<Provider[]> {
  const { data, error } = await supabase.from("providers").select(PROVIDER_SELECT).order("name");
  if (error) throw error;
  return (data ?? []).map(mapProvider);
}

export async function fetchParents(): Promise<Parent[]> {
  const { data, error } = await supabase
    .from("parents")
    .select(
      `id, auth_user_id, name, neighborhood, blurb,
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
      authUserId: r.auth_user_id ?? null,
      name: r.name,
      neighborhood: r.neighborhood ?? "",
      blurb: r.blurb ?? "",
      languages,
      language: languages.join(", "),
      children: [...(r.children ?? [])].sort((a: Row, b: Row) => a.id - b.id),
      schedule: scheduleFromRows(r.parent_availability ?? []),
    };
  });
}

export async function fetchPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, author_id, category, title, body, created_at,
       post_mentions(provider_id),
       post_replies(id, author_id, body, created_at, reply_mentions(provider_id))`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: Row) => ({
    id: r.id,
    authorId: r.author_id,
    category: r.category,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
    date: formatDate(r.created_at),
    mentions: (r.post_mentions ?? []).map((m: Row) => m.provider_id),
    replies: [...(r.post_replies ?? [])]
      .sort((a: Row, b: Row) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
      .map((x: Row) => ({
        id: x.id,
        authorId: x.author_id,
        body: x.body,
        date: formatDate(x.created_at),
        mentions: (x.reply_mentions ?? []).map((m: Row) => m.provider_id),
      })),
  }));
}

export async function fetchLanguages(): Promise<{ id: number; name: string }[]> {
  const { data, error } = await supabase.from("languages").select("id, name").order("name");
  if (error) throw error;
  return data ?? [];
}

const opts = { staleTime: 30_000 };

export function useProvidersQuery() {
  return useQuery({ queryKey: QK.providers, queryFn: fetchProviders, ...opts });
}
export function useParentsQuery() {
  return useQuery({ queryKey: QK.parents, queryFn: fetchParents, ...opts });
}
export function usePostsQuery() {
  return useQuery({ queryKey: QK.posts, queryFn: fetchPosts, ...opts });
}
export function useLanguages() {
  return useQuery({ queryKey: QK.languages, queryFn: fetchLanguages, staleTime: 300_000 }).data ?? [];
}

export function useProviders(): Provider[] {
  return useProvidersQuery().data ?? [];
}
export function useParents(): Parent[] {
  return useParentsQuery().data ?? [];
}
export function usePosts(): Post[] {
  return usePostsQuery().data ?? [];
}

export function useProvider(id: string) {
  const q = useProvidersQuery();
  return { provider: q.data?.find((p) => p.id === id), isLoading: q.isLoading, error: q.error };
}
export function useParent(id: string) {
  const q = useParentsQuery();
  return { parent: q.data?.find((p) => p.id === id), isLoading: q.isLoading, error: q.error };
}
export function usePost(id: string) {
  const q = usePostsQuery();
  return { post: q.data?.find((p) => p.id === id), isLoading: q.isLoading, error: q.error };
}
