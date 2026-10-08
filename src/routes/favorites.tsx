import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/NavBar";
import { ProviderPhoto, VerifiedBadge } from "@/components/ProviderCard";
import { distanceLabel, overlapCount, priceLabel } from "@/lib/model";
import { useApp } from "@/lib/app-state";
import { useProviders } from "@/lib/data";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "My favorites — CareConnect" },
      {
        name: "description",
        content:
          "Your shortlisted caregivers. Pick two or three and compare price, schedule, rating, verification and location side by side.",
      },
      { property: "og:title", content: "My favorites — CareConnect" },
      {
        property: "og:description",
        content: "Shortlist caregivers and compare them side by side.",
      },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { favorites, toggleFavorite, schedule } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const providers = useProviders();
  const byId = (id: string) => providers.find((p) => p.id === id);
  const saved = favorites.map(byId).filter((p) => p !== undefined);
  const chosen = selected.map(byId).filter((p) => p !== undefined);

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id],
    );
  }

  return (
    <AppShell>
      <section className="py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">My favorites</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {saved.length} saved · select 2–3 to compare side by side
            </p>
          </div>
          <button
            disabled={selected.length < 2}
            onClick={() => setComparing(true)}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Compare {selected.length > 0 ? `(${selected.length})` : ""}
          </button>
        </div>

        {saved.length === 0 ? (
          <div className="rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
            <p className="font-display text-2xl font-bold">Nothing saved yet</p>
            <p className="mt-2 text-sm text-ink-soft">Tap the heart on any provider to shortlist them.</p>
            <Link
              to="/providers"
              className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-soft"
            >
              Browse providers
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {saved.map((p) => {
              const picked = selected.includes(p.id);
              return (
                <article
                  key={p.id}
                  className={`card-lift overflow-hidden rounded-3xl bg-surface ring-1 ${
                    picked ? "ring-2 ring-primary" : "ring-line"
                  }`}
                >
                  <ProviderPhoto provider={p} className="h-36 w-full" />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-display text-lg font-bold leading-tight">{p.name}</h2>
                        <p className="text-sm text-ink-soft">
                          {p.careType} · {p.neighborhood}
                        </p>
                      </div>
                      <VerifiedBadge verified={p.verified} />
                    </div>
                    <p className="mt-2 text-sm font-semibold">
                      {p.dailyRate === null ? (
                        <span className="text-ink-faint">Pricing unavailable</span>
                      ) : (
                        priceLabel(p)
                      )}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Link
                        to="/providers/$providerId"
                        params={{ providerId: p.id }}
                        className="rounded-full bg-background px-3 py-1.5 text-xs font-semibold text-ink-soft"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => toggleSelect(p.id)}
                        className={`chip rounded-full px-3 py-1.5 text-xs font-semibold ${
                          picked ? "bg-primary text-primary-soft" : "border border-line text-ink-soft"
                        }`}
                      >
                        {picked ? "Selected" : "Select"}
                      </button>
                      <button
                        onClick={() => {
                          toggleFavorite(p.id);
                          setSelected((prev) => prev.filter((x) => x !== p.id));
                        }}
                        className="ml-auto text-xs font-semibold text-clay"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {comparing && chosen.length >= 2 ? (
          <section className="mt-8 rounded-[28px] bg-surface p-6 ring-1 ring-line">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold tracking-tight">Side by side</h2>
              <button onClick={() => setComparing(false)} className="text-sm font-semibold text-primary-ink">
                Close
              </button>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-36 p-2 text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                      &nbsp;
                    </th>
                    {chosen.map((p) => (
                      <th key={p.id} className="p-2 text-left font-display text-lg font-bold">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["Price", (p: (typeof chosen)[number]) => priceLabel(p)],
                      ["Schedule", (p: (typeof chosen)[number]) => p.scheduleSummary],
                      [
                        "Matches you",
                        (p: (typeof chosen)[number]) =>
                          p.schedule ? `${overlapCount(schedule, p.schedule)} blocks` : "Schedule unavailable",
                      ],
                      ["Rating", (p: (typeof chosen)[number]) => (p.reviewCount ? `★ ${p.rating.toFixed(1)} (${p.reviewCount})` : "No reviews yet")],
                      ["Verified", (p: (typeof chosen)[number]) => (p.verified ? "Yes" : "No")],
                      [
                        "Location",
                        (p: (typeof chosen)[number]) => `${p.neighborhood} · ${distanceLabel(p.distance)}`,
                      ],
                    ] as const
                  ).map(([label, fn]) => (
                    <tr key={label} className="border-t border-line">
                      <td className="p-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                        {label}
                      </td>
                      {chosen.map((p) => (
                        <td key={p.id} className="p-2 text-ink-soft">
                          {fn(p)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </section>
    </AppShell>
  );
}
