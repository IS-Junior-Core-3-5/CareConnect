import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/NavBar";
import { useApp } from "@/lib/app-state";
import { useProviders } from "@/lib/data";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — CareConnect" },
      {
        name: "description",
        content:
          "Your CareConnect home: search providers and parents, and jump to your schedule, favorites, and provider listing.",
      },
      { property: "og:title", content: "Home — CareConnect" },
      {
        property: "og:description",
        content: "Search care, check your weekly schedule, and see how providers line up with it.",
      },
    ],
  }),
  component: HomePage,
});

const tiles = [
  {
    to: "/schedule",
    n: "01",
    title: "My schedule",
    sub: "The hours you need covered",
    cls: "bg-primary text-primary-soft",
  },
  {
    to: "/providers",
    n: "02",
    title: "Utah County providers",
    sub: "Explore local listings",
    cls: "bg-leaf text-white",
  },
  {
    to: "/favorites",
    n: "03",
    title: "My favorites",
    sub: "Shortlist & compare",
    cls: "bg-sun text-ink",
  },
  {
    to: "/listing",
    n: "04",
    title: "My listing",
    sub: "Offer care to families",
    cls: "bg-surface ring-1 ring-line",
  },
] as const;

function HomePage() {
  const navigate = useNavigate();
  const { parentName, favorites } = useApp();
  const providers = useProviders();
  const [q, setQ] = useState("");

  return (
    <AppShell>
      <section className="grid gap-8 py-10 lg:grid-cols-12 lg:items-center">
        <div className="min-w-0 lg:col-span-7">
          <span className="inline-flex items-center gap-2 rounded-full bg-sun-soft px-3 py-1.5 text-xs font-semibold text-ink-soft">
            <span className="size-1.5 rounded-full bg-sun" />{" "}
            {providers.filter((p) => p.verified).length} verified providers near you
          </span>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl font-bold leading-[1.02] tracking-tight text-balance">
            Good afternoon, <span className="italic text-primary">{parentName.split(" ")[0]}</span>.
          </h1>
          <p className="mt-4 max-w-[46ch] text-lg text-ink-soft text-pretty">
            Search caregivers and other parents at once.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/search", search: { q } });
            }}
            className="mt-6 flex flex-col gap-2 rounded-3xl bg-surface p-2 ring-1 ring-line sm:flex-row sm:items-center"
          >
            <div className="flex flex-1 items-center gap-3 rounded-2xl bg-background px-4 py-3">
              <span className="text-ink-faint">⌕</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
                placeholder="Search providers or parents"
              />
            </div>
            <button className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink">
              Search
            </button>
          </form>
        </div>

        <div className="min-w-0 lg:col-span-5">
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((t) => (
              <Link key={t.to} to={t.to} className={`card-lift rounded-3xl p-5 ${t.cls}`}>
                <span className="font-mono text-xs">{t.n}</span>
                <p className="mt-6 font-display text-2xl font-bold leading-tight">{t.title}</p>
                <p className="mt-1 text-sm">
                  {t.to === "/favorites" ? `${favorites.length} saved` : t.sub}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </AppShell>
  );
}
