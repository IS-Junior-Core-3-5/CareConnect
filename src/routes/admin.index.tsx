import { createFileRoute, Link } from "@tanstack/react-router";
import { ErrorState, LoadingState } from "@/components/NavBar";
import { useAdminStats, type AdminStats } from "@/lib/admin-data";
import { formatDate } from "@/lib/model";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Admin overview — CareConnect" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminOverview,
});

function number(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
      <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">{label}</span>
      <p className="mt-2 font-display text-3xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function attentionItems(stats: AdminStats) {
  return [
    stats.unverified_credentials > 0 && {
      label: "Unverified credentials",
      body: `${number(stats.unverified_credentials)} credential${
        stats.unverified_credentials === 1 ? "" : "s"
      } still need review.`,
      to: "/admin/providers" as const,
    },
    stats.stale_external > 0 && {
      label: "Stale external listings",
      body: `${number(stats.stale_external)} external listing${
        stats.stale_external === 1 ? "" : "s"
      } haven't been checked in 6 months.`,
      to: "/admin/providers" as const,
    },
    stats.providers_missing_photo > 0 && {
      label: "Missing profile photos",
      body: `${number(stats.providers_missing_photo)} public provider${
        stats.providers_missing_photo === 1 ? "" : "s"
      } have no profile photo.`,
      to: "/admin/providers" as const,
    },
    stats.bookings_pending_over_2d > 0 && {
      label: "Old pending requests",
      body: `${number(stats.bookings_pending_over_2d)} booking request${
        stats.bookings_pending_over_2d === 1 ? " has" : "s have"
      } waited more than 2 days.`,
      to: "/admin/bookings" as const,
    },
  ].filter(Boolean) as {
    label: string;
    body: string;
    to: "/admin/providers" | "/admin/bookings" | null;
  }[];
}

function AdminOverview() {
  const { data, isLoading, error } = useAdminStats();

  if (isLoading) return <LoadingState label="Loading admin overview…" />;

  if (error) {
    return (
      <div>
        <ErrorState error={error} />
        <p className="text-sm text-ink-soft">
          The admin migration may not be applied yet. Run{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
            supabase/migrations/20261111000000_admin_foundation.sql
          </code>{" "}
          in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const items = attentionItems(data);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-lg font-bold">Needs attention</h2>
        {items.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {items.map((item) => {
              const content = (
                <>
                  <span className="font-semibold">{item.label}</span>
                  <span className="mt-1 block text-sm text-ink-soft">{item.body}</span>
                </>
              );
              return item.to ? (
                <Link
                  key={item.label}
                  to={item.to}
                  className="rounded-3xl bg-clay-soft/50 p-5 text-sm ring-1 ring-clay/20 transition hover:ring-clay/40"
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={item.label}
                  className="rounded-3xl bg-clay-soft/50 p-5 text-sm ring-1 ring-clay/20"
                >
                  {content}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 rounded-3xl bg-surface p-5 text-sm text-ink-soft ring-1 ring-line">
            Nothing needs attention right now.
          </p>
        )}
      </section>

      <Group title="Providers">
        <Stat
          label="Public"
          value={number(data.providers_public)}
          hint={`${number(data.providers_total)} total listings`}
        />
        <Stat label="Archived" value={number(data.providers_archived)} hint="Hidden from parents" />
        <Stat
          label="Verified"
          value={number(data.providers_verified)}
          hint={`${number(data.providers_owned)} owned · ${number(data.providers_external)} external · ${number(data.providers_sample)} sample`}
        />
        <Stat
          label="Missing photos"
          value={number(data.providers_missing_photo)}
          hint="Public listings without a profile photo"
        />
      </Group>

      <Group title="Families">
        <Stat label="Parents" value={number(data.parents_total)} hint="Parent profiles" />
        <Stat
          label="Active · 7 days"
          value={number(data.active_users_7d)}
          hint={`${number(data.logins_total)} logins tracked`}
        />
        <Stat
          label="Search sessions · 7 days"
          value={number(data.search_sessions_7d)}
          hint="Sign-in to favorite-save activity"
        />
        <Stat
          label="Avg. search time"
          value={data.avg_search_minutes === null ? "—" : `${number(data.avg_search_minutes)} min`}
          hint="Completed sessions in the last 7 days"
        />
      </Group>

      <Group title="Bookings">
        <Stat
          label="Pending"
          value={number(data.bookings_pending)}
          hint={`${number(data.bookings_pending_over_2d)} older than 2 days`}
        />
        <Stat label="Confirmed" value={number(data.bookings_confirmed)} hint="All time" />
        <Stat
          label="Declined / cancelled"
          value={`${number(data.bookings_declined)} / ${number(data.bookings_cancelled)}`}
          hint="All time"
        />
        <Stat
          label="Rebook rate"
          value={percent(data.overall_rebook_rate_pct)}
          hint="Families who booked a provider 2+ times"
        />
      </Group>

      <Group title="AI recommendations">
        <Stat
          label="Families"
          value={number(data.ai_families)}
          hint="Families with a saved recommendation set"
        />
        <Stat
          label="Recommendations"
          value={number(data.ai_recommendations)}
          hint="Saved provider matches"
        />
        <Stat
          label="Last generated"
          value={
            data.ai_last_generated ? (
              <span className="text-xl">{formatDate(data.ai_last_generated)}</span>
            ) : (
              "—"
            )
          }
          hint="Most recent recommendation refresh"
        />
      </Group>

      <section>
        <h2 className="font-display text-lg font-bold">Admin sections</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link
            to="/admin/providers"
            className="rounded-3xl bg-surface p-5 ring-1 ring-line transition hover:ring-primary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-xl font-bold">Providers</h3>
              <span className="rounded-full bg-sun-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                Available
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              Search listings, verify providers, and publish or archive them.
            </p>
          </Link>
          <Link
            to="/admin/bookings"
            className="rounded-3xl bg-surface p-5 ring-1 ring-line transition hover:ring-primary/40"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-xl font-bold">Bookings</h3>
              <span className="rounded-full bg-sun-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                Available
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              Review the pending queue, resolve stuck requests, and track rebooking.
            </p>
          </Link>
          {[
            {
              title: "Parents",
              body: "Support parent accounts, children, preferences, and saved schedules.",
            },
            {
              title: "AI recommendations",
              body: "Review recommendation usage and help families when matching goes wrong.",
            },
          ].map((section) => (
            <article key={section.title} className="rounded-3xl bg-surface p-5 ring-1 ring-line">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-xl font-bold">{section.title}</h3>
                <span className="rounded-full bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  Soon
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
