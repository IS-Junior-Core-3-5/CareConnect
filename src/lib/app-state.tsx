import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/data";
import {
  BLOCKS,
  emptySchedule,
  scheduleFromRows,
  type Block,
  type Child,
  type Schedule,
} from "@/lib/model";

/**
 * Signed-in user + their saved data (profile, schedule, favorites).
 * Every change is written to Supabase right away; the UI updates instantly and
 * rolls back with an error toast if the save fails.
 */

type Me = {
  parentId: string;
  name: string;
  email: string;
  neighborhood: string;
  blurb: string;
  languages: string[];
  children: Child[];
  schedule: Schedule;
  favorites: string[];
};

type AppState = {
  /** true until we know whether someone is logged in */
  authLoading: boolean;
  session: Session | null;
  userId: string | null;
  me: Me | null;
  meLoading: boolean;
  parentId: string | null;
  parentName: string;
  language: string;
  schedule: Schedule;
  favorites: string[];
  signOut: () => Promise<void>;
  refreshMe: () => Promise<unknown>;
  setLanguage: (v: string) => Promise<void>;
  setSchedule: (s: Schedule) => Promise<void>;
  toggleBlock: (day: number, block: number) => void;
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
};

const Ctx = createContext<AppState | null>(null);

// Supabase rows are untyped until we generate DB types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

async function fetchMe(email: string): Promise<Me | null> {
  // Resolve the caller's parent row through my_parent_id() so the browser never
  // needs to read the private auth_user_id column.
  const { data: parentId, error: idError } = await supabase.rpc("my_parent_id");
  if (idError) throw idError;
  if (!parentId) return null;
  const { data: p, error } = await supabase
    .from("parents")
    .select(
      `id, name, neighborhood, blurb,
       children(id, name, age),
       parent_languages(languages(name)),
       parent_availability(day_of_week, block)`,
    )
    .eq("id", parentId)
    .maybeSingle();
  if (error) throw error;
  if (!p) return null;
  const fav = await supabase
    .from("favorites")
    .select("provider_id, created_at")
    .eq("parent_id", p.id)
    .order("created_at");
  if (fav.error) throw fav.error;
  return {
    parentId: p.id,
    name: p.name,
    email,
    neighborhood: p.neighborhood ?? "",
    blurb: p.blurb ?? "",
    languages: (p.parent_languages ?? []).map((l: Row) => l.languages?.name).filter(Boolean),
    children: [...(p.children ?? [])].sort((a: Row, b: Row) => a.id - b.id),
    schedule: scheduleFromRows(p.parent_availability ?? []),
    favorites: (fav.data ?? []).map((f) => f.provider_id),
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAuthLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;
  const email = session?.user.email ?? "";
  const meKey = ["me", userId] as const;

  const meQuery = useQuery({
    queryKey: meKey,
    queryFn: () => fetchMe(email),
    enabled: !!userId,
  });
  const me = meQuery.data ?? null;
  const parentId = me?.parentId ?? null;

  /** Optimistically patch the cached "me" record. Returns the previous value for rollback. */
  const patchMe = useCallback(
    (fn: (m: Me) => Me) => {
      const prev = qc.getQueryData<Me | null>(meKey);
      if (prev) qc.setQueryData<Me | null>(meKey, fn(prev));
      return prev;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, userId],
  );

  const fail = useCallback(
    (prev: Me | null | undefined, err: unknown, what: string) => {
      if (prev !== undefined) qc.setQueryData(meKey, prev);
      console.error(err);
      toast.error(`Couldn't save ${what}. ${err instanceof Error ? err.message : ""}`.trim());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qc, userId],
  );

  const needLogin = useCallback(() => {
    toast("Log in to save this.");
  }, []);

  const toggleBlock = useCallback(
    (day: number, block: number) => {
      if (!parentId || !me) return needLogin();
      const turnOn = !me.schedule[day][block];
      const prev = patchMe((m) => ({
        ...m,
        schedule: m.schedule.map((row, d) =>
          d === day ? row.map((v, t) => (t === block ? turnOn : v)) : row,
        ),
      }));
      const row = { parent_id: parentId, day_of_week: day, block: BLOCKS[block] };
      const req = turnOn
        ? supabase.from("parent_availability").upsert(row, { ignoreDuplicates: true })
        : supabase.from("parent_availability").delete().match(row);
      req.then(({ error }) => {
        if (error) fail(prev, error, "your schedule");
        else qc.invalidateQueries({ queryKey: QK.parents });
      });
    },
    [parentId, me, patchMe, fail, needLogin, qc],
  );

  const setSchedule = useCallback(
    async (s: Schedule) => {
      if (!parentId || !me) return needLogin();
      const before = me.schedule;
      const prev = patchMe((m) => ({ ...m, schedule: s }));
      const added: { parent_id: string; day_of_week: number; block: Block }[] = [];
      const removed: { parent_id: string; day_of_week: number; block: Block }[] = [];
      s.forEach((row, d) =>
        row.forEach((on, t) => {
          if (on === before[d][t]) return;
          const r = { parent_id: parentId, day_of_week: d, block: BLOCKS[t] };
          (on ? added : removed).push(r);
        }),
      );
      // Add first, then remove, so a failed request can never leave the family
      // with an empty schedule.
      if (added.length) {
        const ins = await supabase
          .from("parent_availability")
          .upsert(added, { ignoreDuplicates: true });
        if (ins.error) return fail(prev, ins.error, "your schedule");
      }
      for (const row of removed) {
        const del = await supabase.from("parent_availability").delete().match(row);
        if (del.error) return fail(prev, del.error, "your schedule");
      }
      qc.invalidateQueries({ queryKey: QK.parents });
    },
    [parentId, me, patchMe, fail, needLogin, qc],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      if (!parentId || !me) return needLogin();
      const on = me.favorites.includes(id);
      const prev = patchMe((m) => ({
        ...m,
        favorites: on ? m.favorites.filter((x) => x !== id) : [...m.favorites, id],
      }));
      const req = on
        ? supabase.from("favorites").delete().match({ parent_id: parentId, provider_id: id })
        : supabase.from("favorites").insert({ parent_id: parentId, provider_id: id });
      req.then(({ error }) => {
        if (error) fail(prev, error, "favorites");
        else toast.success(on ? "Removed from favorites" : "Saved to favorites");
      });
    },
    [parentId, me, patchMe, fail, needLogin],
  );

  const setLanguage = useCallback(
    async (name: string) => {
      if (!parentId) return needLogin();
      const prev = patchMe((m) => ({ ...m, languages: [name] }));
      const up = await supabase
        .from("languages")
        .upsert({ name }, { onConflict: "name", ignoreDuplicates: true });
      if (up.error) return fail(prev, up.error, "language");
      const { data: lang, error: e1 } = await supabase
        .from("languages")
        .select("id")
        .eq("name", name)
        .single();
      if (e1 || !lang) return fail(prev, e1, "language");
      // Add the new language before removing the old one, so a failed request
      // cannot leave the family with no language.
      const ins = await supabase
        .from("parent_languages")
        .upsert({ parent_id: parentId, language_id: lang.id }, { ignoreDuplicates: true });
      if (ins.error) return fail(prev, ins.error, "language");
      const del = await supabase
        .from("parent_languages")
        .delete()
        .eq("parent_id", parentId)
        .neq("language_id", lang.id);
      if (del.error) return fail(prev, del.error, "language");
      qc.invalidateQueries({ queryKey: QK.parents });
      qc.invalidateQueries({ queryKey: QK.languages });
      toast.success("Language saved");
    },
    [parentId, patchMe, fail, needLogin, qc],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    qc.removeQueries({ queryKey: ["me"] });
  }, [qc]);

  const value = useMemo<AppState>(() => {
    const favorites = me?.favorites ?? [];
    return {
      authLoading,
      session,
      userId,
      me,
      meLoading: !!userId && meQuery.isLoading,
      parentId,
      parentName: me?.name ?? "",
      language: me?.languages[0] ?? "English",
      schedule: me?.schedule ?? emptySchedule(),
      favorites,
      signOut,
      refreshMe: () => meQuery.refetch(),
      setLanguage,
      setSchedule,
      toggleBlock,
      toggleFavorite,
      isFavorite: (id) => favorites.includes(id),
    };
  }, [
    authLoading,
    session,
    userId,
    me,
    meQuery,
    parentId,
    signOut,
    setLanguage,
    setSchedule,
    toggleBlock,
    toggleFavorite,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppStateProvider");
  return ctx;
}
