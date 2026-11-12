import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/NavBar";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — CareConnect" },
      {
        name: "description",
        content: "Administration tools for CareConnect.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

const sections = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/providers", label: "Providers" },
  { to: "/admin/bookings", label: "Bookings" },
  { to: "/admin/parents", label: "Parents" },
  { to: "/admin/ai", label: "AI recommendations" },
] as const;

function AdminLayout() {
  const { isAdmin, me } = useApp();

  return (
    <AppShell>
      <section className="py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
              Administration
            </span>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Admin</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Signed in as {me?.email || "your account"}.
            </p>
          </div>
          <span className="rounded-full bg-sun-soft px-3 py-1.5 text-xs font-semibold text-ink-soft">
            Admin access
          </span>
        </div>

        {isAdmin ? (
          <>
            <nav className="mt-6 flex flex-wrap items-center gap-1.5" aria-label="Admin sections">
              {sections.map((section) => (
                <Link
                  key={section.to}
                  to={section.to}
                  activeOptions={{ exact: section.to === "/admin" }}
                  className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink"
                  activeProps={{ className: "bg-surface text-ink ring-1 ring-line" }}
                >
                  {section.label}
                </Link>
              ))}
            </nav>

            <div className="mt-6">
              <Outlet />
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-3xl bg-surface p-8 text-center ring-1 ring-line">
            <p className="font-display text-2xl font-bold">Admins only</p>
            <p className="mx-auto mt-2 max-w-[48ch] text-sm text-ink-soft">
              This account doesn't have the admin role. If that's a mistake, ask a project
              administrator to grant it in Supabase.
            </p>
            <Link
              to="/home"
              className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-soft"
            >
              Back to home
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  );
}
