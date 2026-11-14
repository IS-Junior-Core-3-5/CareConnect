import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/NavBar";
import { ProviderCard } from "@/components/ProviderCard";
import { CARE_TYPES, overlapCount, type CareType } from "@/lib/model";
import { useApp } from "@/lib/app-state";
import { useProvidersQuery } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { ErrorState, LoadingState } from "@/components/NavBar";

export const Route = createFileRoute("/providers/")({
  head: () => ({
    meta: [
      { title: "Utah County providers — CareConnect" },
      {
        name: "description",
        content:
          "Browse childcare, preschool, and sitter listings in Utah County. Confirm current availability and terms directly with external providers.",
      },
      { property: "og:title", content: "Utah County providers — CareConnect" },
      {
        property: "og:description",
        content: "Explore local childcare, preschool, and sitter listings.",
      },
    ],
  }),
  component: ProvidersPage,
});

const defaultFilters = {
  types: [] as CareType[],
  maxPrice: 250,
  minRating: 0,
  matchesSchedule: false,
  maxDistance: "any",
};

function ProvidersPage() {
  const { schedule, userId, me } = useApp();
  const providersQuery = useProvidersQuery(!!userId);
  const providers = useMemo(() => providersQuery.data ?? [], [providersQuery.data]);
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const { types, maxPrice, minRating, matchesSchedule } = filters;
  const maxDistance = me?.address ? filters.maxDistance : "any";
  const [sort, setSort] = useState("match");
  const [searchTerm, setSearchTerm] = useState("");
  const distanceProviders = useMemo(
    () =>
      providers
        .filter((p) => !p.externalProfile || "address" in p.externalProfile.location)
        .map((p) => ({
          id: p.id,
          address: p.address,
          latitude: p.latitude,
          longitude: p.longitude,
        })),
    [providers],
  );
  const providerAddressKey = distanceProviders
    .map((p) => `${p.id}:${p.address}:${p.latitude ?? ""}:${p.longitude ?? ""}`)
    .join("|");
  const distanceQuery = useQuery({
    queryKey: ["provider-distances", me?.parentId, me?.address, providerAddressKey],
    enabled: maxDistance !== "any" && !!me?.address && distanceProviders.length > 0,
    staleTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const distances: Record<string, number | null> = {};
      const unmatched: string[] = [];
      for (let offset = 0; offset < distanceProviders.length; offset += 100) {
        const { data, error } = await supabase.functions.invoke("provider-distances", {
          body: { providers: distanceProviders.slice(offset, offset + 100) },
        });
        if (error) {
          const responseBody = await (error as { context?: Response }).context
            ?.json?.()
            .catch(() => null);
          throw new Error(responseBody?.error ?? error.message);
        }
        if (data?.error) throw new Error(data.error);
        Object.assign(distances, data.distances ?? {});
        // Providers whose address could not be located. They are excluded from a
        // distance filter, so the page tells the user instead of dropping them
        // silently.
        if (Array.isArray(data.unmatched)) unmatched.push(...(data.unmatched as string[]));
      }
      return { distances, unmatched };
    },
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterToggle = useRef<HTMLButtonElement>(null);
  const activeFilters =
    types.length +
    (maxPrice < 250 ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (matchesSchedule ? 1 : 0) +
    (maxDistance !== "any" ? 1 : 0);

  const results = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = providers.filter((p) => {
      if (
        query &&
        ![p.name, p.careType, p.address, p.phone, p.blurb, p.bio, ...p.languages]
          .join(" ")
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
      if (types.length && !types.includes(p.careType)) return false;
      if (p.dailyRate !== null && maxPrice < 250 && p.dailyRate > maxPrice) return false;
      if (p.rating < minRating) return false;
      if (maxDistance !== "any") {
        const miles = distanceQuery.data?.distances?.[p.id];
        if (miles === null || miles === undefined || miles > Number(maxDistance)) return false;
      }
      if (matchesSchedule) {
        if (!p.schedule) return false;
        if (overlapCount(schedule, p.schedule) === 0) return false;
      }
      return true;
    });
    const sorted = [...filtered];
    if (sort === "rating")
      sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    else if (sort === "price")
      sorted.sort((a, b) => (a.dailyRate ?? Infinity) - (b.dailyRate ?? Infinity));
    else
      sorted.sort(
        (a, b) =>
          (b.schedule ? overlapCount(schedule, b.schedule) : -1) -
          (a.schedule ? overlapCount(schedule, a.schedule) : -1),
      );
    return sorted;
  }, [
    providers,
    searchTerm,
    types,
    maxPrice,
    minRating,
    matchesSchedule,
    maxDistance,
    distanceQuery.data,
    sort,
    schedule,
  ]);

  const empty = results.length === 0;
  const distancePending = maxDistance !== "any" && distanceQuery.isFetching;
  const distanceError = maxDistance !== "any" ? distanceQuery.error : null;

  function reset() {
    setFilters(defaultFilters);
    setDraft(defaultFilters);
    setSearchTerm("");
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters(me?.address ? draft : { ...draft, maxDistance: "any" });
    if (draft.maxDistance === maxDistance && distanceQuery.isError) void distanceQuery.refetch();
    setFiltersOpen(false);
    if (filtersOpen) filterToggle.current?.focus();
  }

  return (
    <AppShell publicPage>
      <section className="py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Providers in Utah County
            </h1>
            <p className="mt-1 text-sm text-ink-soft" role="status">
              {distancePending
                ? "Calculating provider distances…"
                : `${results.length} ${results.length === 1 ? "result" : "results"}`}
            </p>
            {providers.some((provider) => provider.isDemo) ? (
              <p className="mt-1 text-xs text-ink-soft">
                Fictional listings use public landmarks for distance and are for practice.
              </p>
            ) : null}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="chip rounded-full border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-soft outline-none"
            aria-label="Sort results"
          >
            <option value="match">Best schedule fit</option>
            <option value="rating">Top rated</option>
            <option value="price">Lowest price</option>
          </select>
        </div>

        <label className="mb-6 flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
          <span aria-hidden="true" className="text-lg text-ink-faint">
            ⌕
          </span>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search trusted providers"
            placeholder="Search providers by name, care type, or address"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
          />
        </label>

        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="min-w-0 lg:col-span-3">
            {/* Phones: filters collapse behind a button so results show first. */}
            <button
              type="button"
              ref={filterToggle}
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="provider-filters"
              className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm font-semibold ring-1 ring-line lg:hidden"
            >
              <span>
                Filters
                {activeFilters > 0 ? (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-soft">
                    {activeFilters}
                  </span>
                ) : null}
              </span>
              <span aria-hidden="true" className="text-ink-faint">
                {filtersOpen ? "▲" : "▼"}
              </span>
            </button>
            <form
              id="provider-filters"
              aria-label="Provider filters"
              onSubmit={applyFilters}
              className={`${filtersOpen ? "mt-3 block" : "hidden"} space-y-6 rounded-3xl bg-surface p-5 ring-1 ring-line lg:sticky lg:top-20 lg:mt-0 lg:block`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-ink-faint">
                  Filters
                </span>
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs font-semibold text-primary-ink"
                >
                  Reset
                </button>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Care type
                </p>
                <div className="space-y-1.5">
                  {CARE_TYPES.map((t) => (
                    <label key={t} className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.types.includes(t)}
                        onChange={() =>
                          setDraft((prev) => ({
                            ...prev,
                            types: prev.types.includes(t)
                              ? prev.types.filter((x) => x !== t)
                              : [...prev.types, t],
                          }))
                        }
                        className="size-4 rounded accent-[oklch(0.672_0.152_41.5)]"
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Max daily rate
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={80}
                    max={250}
                    step={5}
                    aria-label="Max daily rate"
                    value={draft.maxPrice}
                    onChange={(e) => setDraft({ ...draft, maxPrice: Number(e.target.value) })}
                    className="w-full accent-[oklch(0.672_0.152_41.5)]"
                  />
                  <span className="font-mono text-sm text-ink-soft">
                    {draft.maxPrice >= 250 ? "Any" : `$${draft.maxPrice}`}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink-faint">
                  Listings without a daily rate are included in this price filter.
                </p>
              </div>

              <div>
                <label
                  htmlFor="provider-rating"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-faint"
                >
                  Minimum rating
                </label>
                <select
                  id="provider-rating"
                  value={draft.minRating}
                  onChange={(e) => setDraft({ ...draft, minRating: Number(e.target.value) })}
                  className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm"
                >
                  <option value={0}>Any rating</option>
                  {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((r) => (
                    <option key={r} value={r}>
                      {r === 5 ? "5 stars only" : `${r}+ stars`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="provider-distance"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-faint"
                >
                  Distance from your address
                </label>
                <select
                  id="provider-distance"
                  value={draft.maxDistance}
                  onChange={(e) => setDraft({ ...draft, maxDistance: e.target.value })}
                  disabled={!me?.address}
                  className="w-full rounded-xl border border-line bg-background px-3 py-2 text-sm disabled:opacity-60"
                >
                  <option value="any">Any distance</option>
                  <option value="5">Within 5 miles</option>
                  <option value="10">Within 10 miles</option>
                  <option value="25">Within 25 miles</option>
                  <option value="50">Within 50 miles</option>
                </select>
                <p className="mt-1 text-[11px] text-ink-faint">
                  Approximate straight-line distance. On first use, your saved address is sent to
                  the U.S. Census Geocoder; coordinates are stored privately.
                </p>
                {!me?.address ? (
                  <p className="mt-1 text-[11px] text-ink-faint">
                    Sign in and add an address in{" "}
                    <Link to="/profile" className="font-semibold text-primary-ink">
                      your profile
                    </Link>{" "}
                    to use this filter.
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                aria-pressed={draft.matchesSchedule}
                onClick={() => setDraft({ ...draft, matchesSchedule: !draft.matchesSchedule })}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 ${
                  draft.matchesSchedule ? "bg-primary-soft" : "bg-background"
                }`}
              >
                <span className="text-left text-sm font-medium text-primary-ink">
                  Matches my schedule
                </span>
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ${
                    draft.matchesSchedule ? "bg-primary" : "bg-line"
                  }`}
                >
                  <span
                    className={`absolute size-4 rounded-full bg-white transition-all ${
                      draft.matchesSchedule ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </span>
              </button>
              <button
                type="submit"
                className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink"
              >
                Apply filters
              </button>
            </form>
          </aside>

          <div className="min-w-0 space-y-4 lg:col-span-9">
            {providersQuery.isLoading ? <LoadingState label="Loading providers…" /> : null}
            {providersQuery.error ? <ErrorState error={providersQuery.error} /> : null}
            {distanceError ? (
              <div role="alert" className="rounded-3xl bg-clay-soft px-5 py-4 text-sm text-clay">
                <p>{distanceError.message}</p>
                <Link to="/profile" className="mt-1 inline-block font-semibold underline">
                  Check your saved address
                </Link>
              </div>
            ) : null}
            {distanceQuery.data?.unmatched.length ? (
              <p className="rounded-3xl bg-clay-soft px-5 py-4 text-sm text-clay">
                {distanceQuery.data.unmatched.length === 1
                  ? "1 provider can't be located from the address on file, so it's hidden while a distance filter is active."
                  : `${distanceQuery.data.unmatched.length} providers can't be located from the address on file, so they're hidden while a distance filter is active.`}
              </p>
            ) : null}
            {empty && providers.length && !distancePending && !distanceError ? (
              <div className="rounded-3xl bg-clay-soft px-5 py-4 text-sm font-medium text-clay">
                {searchTerm.trim()
                  ? `No providers found for “${searchTerm.trim()}”. Try another search.`
                  : "No providers match the selected criteria. Try changing your filters."}
              </div>
            ) : null}
            {results.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                distanceMiles={
                  maxDistance === "any"
                    ? undefined
                    : (distanceQuery.data?.distances?.[p.id] ?? undefined)
                }
              />
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
