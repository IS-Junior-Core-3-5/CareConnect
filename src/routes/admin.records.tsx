import { createFileRoute, Link } from "@tanstack/react-router";
import { ErrorState, LoadingState } from "@/components/NavBar";
import { useAdminStats } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/records")({
  head: () => ({
    meta: [{ title: "Maintain records — CareConnect" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminRecords,
});

const records = [
  {
    to: "/admin/providers" as const,
    title: "Providers",
    blurb:
      "Create listings, edit contact and pricing details, publish or archive, and permanently delete a provider.",
    action: "Maintain providers",
    countKey: "providers_total" as const,
    countLabel: "listings",
  },
  {
    to: "/admin/bookings" as const,
    title: "Bookings",
    blurb:
      "Create care requests, edit any field, resolve stuck requests, and permanently delete a booking.",
    action: "Maintain bookings",
    countKey: "bookings_pending" as const,
    countLabel: "pending requests",
  },
  {
    to: "/admin/parents" as const,
    title: "Families",
    blurb:
      "Create family profiles, edit contact details, open the full support view, and permanently delete a family.",
    action: "Maintain families",
    countKey: "parents_total" as const,
    countLabel: "family profiles",
  },
];

function AdminRecords() {
  const stats = useAdminStats();

  if (stats.isLoading) return <LoadingState label="Loading record counts…" />;

  if (stats.error) {
    return (
      <div>
        <ErrorState error={stats.error} />
        <p className="mt-3 text-sm text-ink-soft">
          The admin migration may not be applied yet. Run the admin migrations in filename order,
          then reload this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Maintain records</h2>
          <p className="mt-1 max-w-[70ch] text-sm text-ink-soft">
            Full create, read, update, and delete access to the three main tables. Every write is
            recorded in the audit log, and deletes always ask for confirmation first.
          </p>
        </div>
        <Link
          to="/admin/audit"
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-primary/40 hover:text-ink"
        >
          View audit log
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {records.map((record) => {
          const count = stats.data ? stats.data[record.countKey] : null;
          return (
            <section
              key={record.to}
              className="flex flex-col rounded-3xl bg-surface p-5 ring-1 ring-line"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-xl font-bold">{record.title}</h3>
                <span className="rounded-full bg-sun-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                  CRUD
                </span>
              </div>
              <p className="mt-2 flex-1 text-sm text-ink-soft">{record.blurb}</p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                {count === null ? "—" : new Intl.NumberFormat("en-US").format(count)}{" "}
                {record.countLabel}
              </p>
              <Link
                to={record.to}
                className="mt-3 inline-block rounded-full bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-soft transition hover:bg-primary-ink"
              >
                {record.action}
              </Link>
            </section>
          );
        })}
      </div>

      <section className="rounded-3xl bg-clay-soft/40 p-5 text-sm ring-1 ring-clay/20">
        <h3 className="font-display text-lg font-bold">About deletes</h3>
        <p className="mt-1 max-w-[80ch] text-ink-soft">
          Deleting a provider or family cascades to dependent rows. Provider deletes remove
          credentials, reviews, availability, favorites, and bookings. Family deletes remove
          children, schedules, preferences, favorites, bookings, and AI history. Use Maintain Users
          to delete a login account and its linked family together.
        </p>
      </section>
    </div>
  );
}
