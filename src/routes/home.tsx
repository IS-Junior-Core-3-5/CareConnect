import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/NavBar";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — CareConnect" },
      {
        name: "description",
        content: "Search care providers and open your schedule, favorites, or listing.",
      },
      { property: "og:title", content: "Home — CareConnect" },
      {
        property: "og:description",
        content: "Search care providers and open your CareConnect links.",
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
  const { favorites } = useApp();
  const [q, setQ] = useState("");

  return (
    <AppShell>
      <section className="mx-auto max-w-4xl space-y-6 py-10 sm:py-14">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/search", search: { q } });
          }}
          className="flex flex-col gap-2 rounded-3xl bg-surface p-2 ring-1 ring-line sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 items-center gap-3 rounded-2xl bg-background px-4 py-3">
            <span className="text-ink-faint" aria-hidden="true">⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
              placeholder="Search providers or parents"
              aria-label="Search providers or parents"
            />
          </div>
          <button className="rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink">
            Search
          </button>
        </form>

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
      </section>
    </AppShell>
  );
}
