import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/NavBar";
import { ScheduleCompare } from "@/components/ScheduleGrid";
import { overlapCount } from "@/lib/model";
import { useApp } from "@/lib/app-state";
import { useProviders } from "@/lib/data";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — CareConnect" },
      {
        name: "description",
        content:
          "Your CareConnect home: check your schedule, favorites, and provider listing.",
      },
      { property: "og:title", content: "Home — CareConnect" },
      {
        property: "og:description",
        content: "Check your weekly schedule, see how providers line up with it, and revisit your favorites.",
      },
    ],
  }),
  component: HomePage,
});

const tiles = [
  { to: "/schedule", n: "01", title: "My schedule", sub: "The hours you need covered", cls: "bg-primary text-primary-soft" },
  { to: "/providers", n: "02", title: "Trusted providers", sub: "Filter by fit and price", cls: "bg-leaf text-white" },
  { to: "/favorites", n: "03", title: "My favorites", sub: "Shortlist & compare", cls: "bg-sun text-ink" },
  { to: "/listing", n: "04", title: "My listing", sub: "Offer care to families", cls: "bg-surface ring-1 ring-line" },
] as const;

function HomePage() {
  const { parentName, schedule, favorites } = useApp();
  const providers = useProviders();

  const best = providers
    .filter((p) => p.schedule)
    .map((p) => ({ p, overlap: overlapCount(schedule, p.schedule!) }))
    .sort((a, b) => b.overlap - a.overlap)[0];

  return (
    <AppShell>
      <section className="grid gap-8 py-10 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <span className="inline-flex items-center gap-2 rounded-full bg-sun-soft px-3 py-1.5 text-xs font-semibold text-ink-soft">
            <span className="size-1.5 rounded-full bg-sun" /> {providers.filter((p) => p.verified).length} verified
            providers near you
          </span>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.02] tracking-tight text-balance">
            Good afternoon, <span className="italic text-primary">{parentName.split(" ")[0]}</span>.
          </h1>
          <p className="mt-4 max-w-[46ch] text-lg text-ink-soft text-pretty">
            Find trusted care, compare schedules, and keep your favorites in one place.
          </p>

        </div>

        <div className="lg:col-span-5">
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((t) => (
              <Link key={t.to} to={t.to} className={`card-lift rounded-3xl p-5 ${t.cls}`}>
                <span className="font-mono text-xs opacity-70">{t.n}</span>
                <p className="mt-6 font-display text-2xl font-bold leading-tight">{t.title}</p>
                <p className="mt-1 text-sm opacity-90">
                  {t.to === "/favorites" ? `${favorites.length} saved` : t.sub}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {best ? (
        <section className="py-6">
          <div className="rounded-[28px] bg-surface p-6 ring-1 ring-line sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">Schedule match</span>
                <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">
                  Your week vs. {best.p.name}
                </h2>
                <p className="mt-1 max-w-[46ch] text-sm text-ink-soft text-pretty">
                  Green means they cover a block you need. Red means a gap.
                </p>
              </div>
              <Link
                to="/providers/$providerId"
                params={{ providerId: best.p.id }}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary-ink"
              >
                View profile
              </Link>
            </div>
            <div className="mt-6">
              <ScheduleCompare
                parent={schedule}
                provider={best.p.schedule!}
                providerLabel={best.p.name.split(" ")[0].toUpperCase()}
              />
            </div>
          </div>
        </section>
      ) : null}

      <section className="py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl font-bold tracking-tight">Your saved favorites</h2>
          <Link to="/favorites" className="text-sm font-semibold text-primary-ink">
            See all
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {favorites.slice(0, 3).map((id) => {
            const p = providers.find((x) => x.id === id);
            if (!p) return null;
            return (
              <Link
                key={id}
                to="/providers/$providerId"
                params={{ providerId: id }}
                className="card-lift rounded-3xl bg-surface p-4 ring-1 ring-line"
              >
                <p className="font-display text-lg font-bold">{p.name}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {p.careType} · {p.neighborhood}
                </p>
              </Link>
            );
          })}
          {favorites.length === 0 ? (
            <p className="text-sm text-ink-soft">Nothing saved yet — tap the heart on any provider.</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
