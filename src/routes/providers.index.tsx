import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/NavBar";
import { ProviderCard } from "@/components/ProviderCard";
import { overlapCount, providers, type CareType } from "@/data/mock";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/providers/")({
  head: () => ({
    meta: [
      { title: "Trusted providers — CareConnect" },
      {
        name: "description",
        content:
          "Browse verified daycares, preschools, sitters and family friends. Filter by distance, price, rating, and whether their hours match your schedule.",
      },
      { property: "og:title", content: "Trusted providers — CareConnect" },
      {
        property: "og:description",
        content: "Filter caregivers by distance, price, rating, verification, and schedule fit.",
      },
    ],
  }),
  component: ProvidersPage,
});

const CARE_TYPES: CareType[] = ["Daycare", "Preschool", "Sitter", "Family Friend"];

function ProvidersPage() {
  const { schedule } = useApp();
  const [types, setTypes] = useState<CareType[]>([]);
  const [distance, setDistance] = useState(99);
  const [maxPrice, setMaxPrice] = useState(250);
  const [minRating, setMinRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [matchesSchedule, setMatchesSchedule] = useState(false);
  const [sort, setSort] = useState("match");

  const results = useMemo(() => {
    const filtered = providers.filter((p) => {
      if (types.length && !types.includes(p.careType)) return false;
      if (p.distance > distance) return false;
      if (p.dailyRate !== null && p.dailyRate > maxPrice) return false;
      if (p.rating < minRating) return false;
      if (verifiedOnly && !p.verified) return false;
      if (matchesSchedule) {
        if (!p.schedule) return false;
        if (overlapCount(schedule, p.schedule) === 0) return false;
      }
      return true;
    });
    const sorted = [...filtered];
    if (sort === "distance") sorted.sort((a, b) => a.distance - b.distance);
    else if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    else if (sort === "price")
      sorted.sort((a, b) => (a.dailyRate ?? Infinity) - (b.dailyRate ?? Infinity));
    else
      sorted.sort(
        (a, b) =>
          (b.schedule ? overlapCount(schedule, b.schedule) : -1) -
          (a.schedule ? overlapCount(schedule, a.schedule) : -1),
      );
    return sorted;
  }, [types, distance, maxPrice, minRating, verifiedOnly, matchesSchedule, sort, schedule]);

  const empty = results.length === 0;

  function reset() {
    setTypes([]);
    setDistance(99);
    setMaxPrice(250);
    setMinRating(0);
    setVerifiedOnly(false);
    setMatchesSchedule(false);
  }

  return (
    <AppShell>
      <section className="py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Trusted providers near you</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {results.length} {results.length === 1 ? "result" : "results"} · filters update instantly
            </p>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="chip rounded-full border border-line bg-surface px-3 py-2 text-sm font-medium text-ink-soft outline-none"
            aria-label="Sort results"
          >
            <option value="match">Best schedule fit</option>
            <option value="distance">Nearest</option>
            <option value="rating">Top rated</option>
            <option value="price">Lowest price</option>
          </select>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <div className="sticky top-20 space-y-6 rounded-3xl bg-surface p-5 ring-1 ring-line">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-ink-faint">Filters</span>
                <button onClick={reset} className="text-xs font-semibold text-primary-ink">
                  Reset
                </button>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Care type</p>
                <div className="space-y-1.5">
                  {CARE_TYPES.map((t) => (
                    <label key={t} className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={types.includes(t)}
                        onChange={() =>
                          setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
                        }
                        className="size-4 rounded accent-[oklch(0.672_0.152_41.5)]"
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Distance</p>
                <div className="space-y-1.5">
                  {[
                    { v: 2, l: "Within 2 mi" },
                    { v: 5, l: "Within 5 mi" },
                    { v: 99, l: "Any distance" },
                  ].map((d) => (
                    <label key={d.v} className="flex items-center gap-2.5 text-sm">
                      <input
                        type="radio"
                        name="dist"
                        checked={distance === d.v}
                        onChange={() => setDistance(d.v)}
                        className="size-4 accent-[oklch(0.672_0.152_41.5)]"
                      />
                      {d.l}
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
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-full accent-[oklch(0.672_0.152_41.5)]"
                  />
                  <span className="font-mono text-sm text-ink-soft">${maxPrice}</span>
                </div>
                <p className="mt-1 text-[11px] text-ink-faint">
                  Providers without pricing are always shown.
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Rating</p>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 4.5, 4.8].map((r) => (
                    <button
                      key={r}
                      onClick={() => setMinRating(r)}
                      className={`chip rounded-full px-3 py-1.5 text-xs font-semibold ${
                        minRating === r
                          ? "bg-primary-soft text-primary-ink"
                          : "border border-line text-ink-soft hover:border-primary"
                      }`}
                    >
                      {r === 0 ? "Any" : `${r}+`}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setVerifiedOnly((v) => !v)}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 ${
                  verifiedOnly ? "bg-leaf-soft" : "bg-background"
                }`}
              >
                <span className="text-sm font-medium text-leaf-ink">Verified only</span>
                <span
                  className={`relative inline-flex h-5 w-9 items-center rounded-full ${
                    verifiedOnly ? "bg-leaf" : "bg-line"
                  }`}
                >
                  <span
                    className={`absolute size-4 rounded-full bg-white transition-all ${
                      verifiedOnly ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </span>
              </button>

              <button
                onClick={() => setMatchesSchedule((v) => !v)}
                className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 ${
                  matchesSchedule ? "bg-primary-soft" : "bg-background"
                }`}
              >
                <span className="text-left text-sm font-medium text-primary-ink">Matches my schedule</span>
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ${
                    matchesSchedule ? "bg-primary" : "bg-line"
                  }`}
                >
                  <span
                    className={`absolute size-4 rounded-full bg-white transition-all ${
                      matchesSchedule ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </span>
              </button>
            </div>
          </aside>

          <div className="space-y-4 lg:col-span-9">
            {empty ? (
              <div className="rounded-3xl bg-clay-soft px-5 py-4 text-sm font-medium text-clay">
                No providers match the selected criteria. Showing the default provider list below.
              </div>
            ) : null}
            {(empty ? providers : results).map((p) => (
              <ProviderCard key={p.id} provider={p} />
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
