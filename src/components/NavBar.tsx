import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useApp } from "@/lib/app-state";

const links = [
  { to: "/home", label: "Home" },
  { to: "/schedule", label: "Schedule" },
  { to: "/providers", label: "Trusted Providers" },
  { to: "/board", label: "Message Board" },
  { to: "/favorites", label: "Favorites" },
  { to: "/profile", label: "Profile" },
] as const;

export function NavBar() {
  const navigate = useNavigate();
  const { favorites } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/search", search: { q } });
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3">
        <Link to="/home" className="flex shrink-0 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-2xl bg-primary text-primary-soft">
            <span className="font-display text-lg font-bold leading-none">C</span>
          </span>
          <span className="font-display text-xl font-bold tracking-tight">CareConnect</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-0.5 text-sm font-medium text-ink-soft lg:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="chip rounded-full px-3 py-2 hover:text-ink"
              activeProps={{ className: "text-ink bg-surface" }}
            >
              {l.label}
              {l.to === "/favorites" && favorites.length > 0 ? (
                <span className="ml-1 font-mono text-xs text-primary-ink">{favorites.length}</span>
              ) : null}
            </Link>
          ))}
        </nav>

        <form onSubmit={submit} className="ml-auto hidden items-center md:flex">
          <div className="flex items-center gap-2 rounded-2xl bg-surface px-3 py-2 ring-1 ring-line">
            <span className="text-ink-faint">⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-44 bg-transparent text-sm outline-none placeholder:text-ink-faint"
              placeholder="Search everything"
            />
          </div>
        </form>

        <Link
          to="/"
          className="ml-auto rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink md:ml-2"
        >
          Sign out
        </Link>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-line px-3 py-2 text-sm font-medium text-ink-soft lg:hidden"
        >
          Menu
        </button>
      </div>

      {open ? (
        <div className="border-t border-line bg-surface px-5 py-3 lg:hidden">
          <form onSubmit={submit} className="mb-3 flex items-center gap-2 rounded-2xl bg-background px-3 py-2">
            <span className="text-ink-faint">⌕</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-ink-faint"
              placeholder="Search everything"
            />
          </form>
          <div className="grid grid-cols-2 gap-1.5">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-2xl bg-background px-3 py-2 text-sm font-medium text-ink-soft"
                activeProps={{ className: "text-ink" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function PageFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-ink-soft sm:flex-row">
        <span className="font-display text-lg font-bold text-ink">CareConnect</span>
        <span>Trusted care, matched to your week. Demo data only.</span>
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-ink">
      <NavBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-12">{children}</main>
      <PageFooter />
    </div>
  );
}
