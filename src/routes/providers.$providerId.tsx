import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/NavBar";
import { ProviderPhoto, VerifiedBadge } from "@/components/ProviderCard";
import { ScheduleCompare } from "@/components/ScheduleGrid";
import {
  gapCount,
  overlapCount,
  parentById,
  priceLabel,
  providerById,
} from "@/data/mock";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/providers/$providerId")({
  loader: ({ params }) => {
    const provider = providerById(params.providerId);
    if (!provider) throw notFound();
    return { provider };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return {
        meta: [{ title: "Provider unavailable — CareConnect" }, { name: "robots", content: "noindex" }],
      };
    const p = loaderData.provider;
    const desc = `${p.careType} in ${p.neighborhood} · ${p.scheduleSummary} · ${priceLabel(p)}. ${p.blurb}`;
    return {
      meta: [
        { title: `${p.name} — CareConnect` },
        { name: "description", content: desc },
        { property: "og:title", content: `${p.name} — CareConnect` },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: ProviderProfile,
});

function ProviderProfile() {
  const { provider } = Route.useLoaderData();
  const { schedule, isFavorite, toggleFavorite, isConnected, toggleConnection } = useApp();
  const fav = isFavorite(provider.id);

  const covered = provider.schedule ? overlapCount(schedule, provider.schedule) : 0;
  const gaps = provider.schedule ? gapCount(schedule, provider.schedule) : 0;

  const avg = (key: "experience" | "values" | "communication" | "safety") =>
    provider.reviews.length
      ? (
          provider.reviews.reduce((s, r) => s + r.scores[key], 0) / provider.reviews.length
        ).toFixed(1)
      : "—";

  return (
    <AppShell>
      <div className="py-8">
        <Link to="/providers" className="text-sm font-semibold text-primary-ink">
          ← Back to providers
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <section className="overflow-hidden rounded-[28px] bg-surface ring-1 ring-line">
              <ProviderPhoto provider={provider} className="h-64 w-full sm:h-80" />
              <div className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="font-display text-4xl font-bold tracking-tight">{provider.name}</h1>
                      <VerifiedBadge verified={provider.verified} />
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {provider.careType} · {provider.neighborhood} · {provider.distance} mi away
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFavorite(provider.id)}
                      className={`chip rounded-full px-4 py-2 text-sm font-semibold ${
                        fav ? "bg-clay-soft text-clay" : "border border-line text-ink-soft hover:border-primary"
                      }`}
                    >
                      {fav ? "♥ In favorites" : "♡ Add to favorites"}
                    </button>
                    <a
                      href="#compare"
                      className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink"
                    >
                      Compare schedule
                    </a>
                  </div>
                </div>

                <p className="mt-5 max-w-[68ch] text-ink-soft text-pretty">{provider.bio}</p>

                <div className="mt-5 flex flex-wrap gap-1.5">
                  {provider.languages.map((l) => (
                    <span
                      key={l}
                      className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-ink-soft"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <section id="compare" className="scroll-mt-24 rounded-[28px] bg-surface p-6 ring-1 ring-line">
              <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">
                Compare schedule
              </span>
              <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
                Your week vs. {provider.name}
              </h2>
              {provider.schedule ? (
                <>
                  <div className="mt-5">
                    <ScheduleCompare
                      parent={schedule}
                      provider={provider.schedule}
                      providerLabel={provider.name.split(" ")[0].toUpperCase()}
                    />
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-leaf-soft px-4 py-3">
                    <p className="text-sm font-medium text-leaf-ink">
                      {covered} of your {covered + gaps} needed blocks are covered
                      {gaps > 0 ? ` — ${gaps} gap${gaps === 1 ? "" : "s"} to fill.` : " — a full match."}
                    </p>
                    <Link
                      to="/schedule"
                      className="rounded-full bg-leaf px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-leaf-ink"
                    >
                      Open my schedule
                    </Link>
                  </div>
                </>
              ) : (
                <p className="mt-4 rounded-2xl bg-clay-soft px-4 py-3 text-sm font-medium text-clay">
                  Schedule unavailable — this provider is excluded from schedule matches.
                </p>
              )}
            </section>

            <section className="rounded-[28px] bg-surface p-6 ring-1 ring-line">
              <h2 className="font-display text-2xl font-bold tracking-tight">Ratings & reviews</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ["Experience", "experience"],
                    ["Values", "values"],
                    ["Communication", "communication"],
                    ["Safety", "safety"],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key} className="rounded-2xl bg-background p-4">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">{label}</p>
                    <p className="mt-1 font-display text-2xl font-bold">{avg(key)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-4">
                {provider.reviews.map((r) => (
                  <div key={r.author + r.date} className="rounded-2xl bg-background p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{r.author}</p>
                      <p className="text-xs text-ink-faint">{r.date}</p>
                    </div>
                    <p className="mt-2 text-sm text-ink-soft text-pretty">{r.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] bg-surface p-6 ring-1 ring-line">
              <h2 className="font-display text-2xl font-bold tracking-tight">Past families</h2>
              {provider.pastFamilies.length === 0 ? (
                <p className="mt-3 text-sm text-ink-soft">No past families listed yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {provider.pastFamilies.map((pid) => {
                    const parent = parentById(pid);
                    if (!parent) return null;
                    const connected = isConnected(pid);
                    return (
                      <li
                        key={pid}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background p-4"
                      >
                        <div>
                          <Link
                            to="/parents/$parentId"
                            params={{ parentId: pid }}
                            className="font-semibold hover:text-primary-ink"
                          >
                            {parent.name}
                          </Link>
                          <p className="text-sm text-ink-soft">
                            {parent.neighborhood} ·{" "}
                            {parent.children.map((c) => `${c.name} (${c.age})`).join(", ")}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleConnection(pid)}
                          className={`chip rounded-full px-4 py-2 text-sm font-semibold ${
                            connected
                              ? "bg-leaf-soft text-leaf-ink"
                              : "bg-primary text-primary-soft hover:bg-primary-ink"
                          }`}
                        >
                          {connected ? "Connected" : "Connect"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-6 lg:col-span-4">
            <section className="rounded-[28px] bg-surface p-6 ring-1 ring-line">
              <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">Pricing</p>
              {provider.dailyRate === null ? (
                <p className="mt-2 rounded-2xl bg-clay-soft px-3 py-2 text-sm font-semibold text-clay">
                  Pricing unavailable
                </p>
              ) : (
                <>
                  <p className="mt-1 font-display text-3xl font-bold">{priceLabel(provider)}</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                    {provider.pricingNotes.map((n) => (
                      <li key={n}>· {n}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="rounded-[28px] bg-surface p-6 ring-1 ring-line">
              <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">Hours</p>
              <p
                className={`mt-1 font-semibold ${provider.schedule ? "" : "text-clay"}`}
              >
                {provider.scheduleSummary}
              </p>
              <p className="mt-4 font-mono text-xs uppercase tracking-wider text-ink-faint">
                Licenses & certifications
              </p>
              {provider.licenses.length ? (
                <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
                  {provider.licenses.map((l) => (
                    <li key={l}>· {l}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">None on file.</p>
              )}
            </section>

            <section className="rounded-[28px] bg-surface p-6 ring-1 ring-line">
              <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">Location</p>
              <p className="mt-1 font-semibold">
                {provider.neighborhood} · {provider.distance} mi from you
              </p>
              <div className="mt-3 grid h-40 place-items-center rounded-2xl bg-leaf-soft">
                <span className="font-mono text-xs uppercase tracking-[0.15em] text-leaf-ink/60">
                  Map placeholder
                </span>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
