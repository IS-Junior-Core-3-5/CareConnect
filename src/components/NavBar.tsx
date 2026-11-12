import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AskAiLauncher } from "@/components/AiChat";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-state";

const links = [
  { to: "/home", label: "Home" },
  { to: "/recommendations", label: "Recommendations" },
  { to: "/schedule", label: "Schedule" },
  { to: "/providers", label: "Providers" },
  { to: "/favorites", label: "Favorites" },
  { to: "/listing", label: "My listing" },
  { to: "/profile", label: "Profile" },
] as const;

export function NavBar() {
  const navigate = useNavigate();
  const { favorites, signOut, isAdmin } = useApp();
  const [open, setOpen] = useState(false);

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
              key={l.label}
              to={l.to}
              activeOptions={{ includeHash: true }}
              className="chip rounded-full px-3 py-2 hover:text-ink"
              activeProps={{ className: "text-ink bg-surface" }}
            >
              {l.label}
              {l.to === "/favorites" && favorites.length > 0 ? (
                <span className="ml-1 font-mono text-xs text-primary-ink">{favorites.length}</span>
              ) : null}
            </Link>
          ))}
          {isAdmin ? (
            <Link
              to="/admin"
              className="chip rounded-full px-3 py-2 font-semibold text-primary-ink hover:text-ink"
              activeProps={{ className: "text-ink bg-surface" }}
            >
              Admin
            </Link>
          ) : null}
        </nav>

        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="ml-auto whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink"
        >
          Sign out
        </button>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="rounded-full border border-line px-3 py-2 text-sm font-medium text-ink-soft lg:hidden"
        >
          Menu
        </button>
      </div>

      {open ? (
        <div className="border-t border-line bg-surface px-5 py-3 lg:hidden">
          <div className="grid grid-cols-2 gap-1.5">
            {links.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                activeOptions={{ includeHash: true }}
                onClick={() => setOpen(false)}
                className="rounded-2xl bg-background px-3 py-2 text-sm font-medium text-ink-soft"
                activeProps={{ className: "text-ink" }}
              >
                {l.label}
              </Link>
            ))}
            {isAdmin ? (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="rounded-2xl bg-background px-3 py-2 text-sm font-semibold text-primary-ink"
                activeProps={{ className: "text-ink" }}
              >
                Admin
              </Link>
            ) : null}
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
        <span>Trusted care, matched to your week.</span>
      </div>
    </footer>
  );
}

export function AppShell({
  children,
  publicPage = false,
}: {
  children: React.ReactNode;
  publicPage?: boolean;
}) {
  const { authLoading, session, meLoading, me } = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!publicPage && !authLoading && !session) navigate({ to: "/" });
  }, [authLoading, session, navigate, publicPage]);

  let body: React.ReactNode = children;
  if (!publicPage && (authLoading || !session || meLoading))
    body = <LoadingState label="Loading your account…" />;
  else if (!publicPage && !me)
    body = (
      <p className="py-16 text-center text-ink-soft">
        We couldn't find your parent profile. Try signing out and back in.
      </p>
    );

  return (
    <div className="flex min-h-screen flex-col bg-background text-ink">
      {publicPage && !session ? (
        <header className="border-b border-line bg-background">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
            <Link to="/providers" className="font-display text-xl font-bold">
              CareConnect
            </Link>
            <Link to="/" className="text-sm font-semibold text-primary-ink">
              Sign in
            </Link>
          </nav>
        </header>
      ) : (
        <NavBar />
      )}
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-12">{body}</main>
      <PageFooter />
      {session && me && pathname !== "/preferences" && !pathname.startsWith("/admin") ? (
        <AskAiLauncher />
      ) : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid place-items-center py-24">
      <div className="flex items-center gap-3 text-sm font-medium text-ink-soft">
        <span className="size-4 animate-spin rounded-full border-2 border-line border-t-primary" />
        {label}
      </div>
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="my-10 rounded-3xl bg-clay-soft px-5 py-4 text-sm font-medium text-clay">
      Couldn't load data from the database. {error instanceof Error ? error.message : ""}
    </div>
  );
}
