import { createFileRoute, Link } from "@tanstack/react-router";
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
  component: AdminPage,
});

const sections = [
  {
    title: "Providers",
    body: "Review, verify, and manage provider listings and their profile photos.",
  },
  {
    title: "Parents",
    body: "Support parent accounts, saved schedules, and language preferences.",
  },
  {
    title: "Bookings",
    body: "Monitor care requests and booking outcomes across the marketplace.",
  },
  {
    title: "AI recommendations",
    body: "Review matching inputs and the recommendations generated for families.",
  },
] as const;

function AdminPage() {
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
            <p className="mt-6 max-w-[60ch] text-sm text-ink-soft">
              This is the starting point for admin tools. Sections will be added here as we decide
              what the panel should manage.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {sections.map((section) => (
                <article
                  key={section.title}
                  className="rounded-3xl bg-surface p-5 ring-1 ring-line"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-xl font-bold">{section.title}</h2>
                    <span className="rounded-full bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                      Coming soon
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">{section.body}</p>
                </article>
              ))}
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
