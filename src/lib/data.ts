import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  parents as mockParents,
  posts as mockPosts,
  providers as mockProviders,
  type Parent,
  type Post,
  type Provider,
} from "@/data/mock";

/**
 * Reads app data from Supabase. While loading (or if Supabase is
 * unreachable / tables are missing), the bundled demo data is used so
 * the UI never breaks.
 */

async function fetchTable<T>(table: string, fallback: T[]): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("data");
  if (error || !data || data.length === 0) return fallback;
  return data.map((row) => row.data as T);
}

export function useProviders(): Provider[] {
  const { data } = useQuery({
    queryKey: ["providers"],
    queryFn: () => fetchTable<Provider>("providers", mockProviders),
    placeholderData: mockProviders,
    staleTime: 60_000,
  });
  return data ?? mockProviders;
}

export function useParents(): Parent[] {
  const { data } = useQuery({
    queryKey: ["parents"],
    queryFn: () => fetchTable<Parent>("parents", mockParents),
    placeholderData: mockParents,
    staleTime: 60_000,
  });
  return data ?? mockParents;
}

export function usePosts(): Post[] {
  const { data } = useQuery({
    queryKey: ["posts"],
    queryFn: () => fetchTable<Post>("posts", mockPosts),
    placeholderData: mockPosts,
    staleTime: 60_000,
  });
  return data ?? mockPosts;
}

export function useProvider(id: string): Provider | undefined {
  return useProviders().find((p) => p.id === id);
}

export function useParent(id: string): Parent | undefined {
  return useParents().find((p) => p.id === id);
}

export function usePost(id: string): Post | undefined {
  return usePosts().find((p) => p.id === id);
}
