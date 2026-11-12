import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { ErrorState, LoadingState } from "@/components/NavBar";
import { useAdminParents, type AdminParent } from "@/lib/admin-data";
import { formatDate } from "@/lib/model";

export const Route = createFileRoute("/admin/parents/")({
  head: () => ({
    meta: [{ title: "Admin parents — CareConnect" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminParents,
});

type ActivityFilter = "all" | "active7" | "inactive30" | "never";
type BookingFilter = "all" | "with" | "without";
type SortKey = "recent" | "name" | "bookings" | "login";

const DAY = 86_400_000;

function lastSeen(iso: string | null) {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4 ring-1 ring-line">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      <p className="mt-1 font-display text-2xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv(rows: AdminParent[]) {
  const columns: { key: keyof AdminParent; label: string }[] = [
    { key: "parent_id", label: "parent_id" },
    { key: "name", label: "name" },
    { key: "email", label: "email" },
    { key: "neighborhood", label: "neighborhood" },
    { key: "address", label: "address" },
    { key: "created_at", label: "joined_at" },
    { key: "children_count", label: "children" },
    { key: "languages", label: "languages" },
    { key: "need_blocks", label: "needed_blocks" },
    { key: "favorites_count", label: "favorites" },
    { key: "bookings_total", label: "bookings_total" },
    { key: "bookings_pending", label: "bookings_pending" },
    { key: "bookings_confirmed", label: "bookings_confirmed" },
    { key: "last_care_date", label: "last_care_date" },
    { key: "providers_booked", label: "providers_booked" },
    { key: "providers_rebooked", label: "providers_rebooked" },
    { key: "ai_recommendations", label: "ai_recommendations" },
    { key: "last_ai_at", label: "last_ai_at" },
    { key: "chat_messages", label: "ai_chat_messages" },
    { key: "login_count", label: "login_count" },
    { key: "last_login_at", label: "last_login_at" },
    { key: "search_sessions", label: "search_sessions" },
    { key: "avg_search_minutes", label: "avg_search_minutes" },
    { key: "has_preferences", label: "has_preferences" },
    { key: "preferences_updated_at", label: "preferences_updated_at" },
  ];

  const lines = [
    columns.map((column) => csvCell(column.label)).join(","),
    ...rows.map((row) =>
      columns
        .map((column) => {
          const value = row[column.key];
          return csvCell(Array.isArray(value) ? value.join("; ") : value);
        })
        .join(","),
    ),
  ];

  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `careconnect-parents-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function AdminParents() {
  const parentsQuery = useAdminParents();

  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const rows = useMemo(() => parentsQuery.data ?? [], [parentsQuery.data]);
  const now = Date.now();

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const result = rows.filter((parent) => {
      if (activity === "active7") {
        if (!parent.last_login_at || now - new Date(parent.last_login_at).getTime() > 7 * DAY)
          return false;
      }
      if (activity === "inactive30") {
        if (!parent.last_login_at || now - new Date(parent.last_login_at).getTime() < 30 * DAY)
          return false;
      }
      if (activity === "never" && parent.last_login_at) return false;
      if (bookingFilter === "with" && parent.bookings_total === 0) return false;
      if (bookingFilter === "without" && parent.bookings_total > 0) return false;
      if (!needle) return true;
      return (
        parent.name.toLowerCase().includes(needle) ||
        parent.parent_id.toLowerCase().includes(needle) ||
        (parent.email ?? "").toLowerCase().includes(needle) ||
        (parent.neighborhood ?? "").toLowerCase().includes(needle) ||
        (parent.address ?? "").toLowerCase().includes(needle)
      );
    });

    return result.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "bookings") return b.bookings_total - a.bookings_total;
      if (sort === "login") {
        const aTime = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
        const bTime = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
        return bTime - aTime;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [rows, search, activity, bookingFilter, sort, now]);

  const active7 = rows.filter(
    (parent) => parent.last_login_at && now - new Date(parent.last_login_at).getTime() <= 7 * DAY,
  ).length;
  const withBookings = rows.filter((parent) => parent.bookings_total > 0).length;
  const withPreferences = rows.filter((parent) => parent.has_preferences).length;

  const activeFilters =
    search !== "" || activity !== "all" || bookingFilter !== "all" || sort !== "recent";

  function download() {
    if (!filtered.length) {
      toast.error("No families match these filters");
      return;
    }
    exportCsv(filtered);
    toast.success(
      `Exported ${filtered.length} famil${filtered.length === 1 ? "y" : "ies"}. Store the file securely.`,
    );
  }

  if (parentsQuery.isLoading) return <LoadingState label="Loading families…" />;

  if (parentsQuery.error) {
    return (
      <div>
        <ErrorState error={parentsQuery.error} />
        <p className="text-sm text-ink-soft">
          The admin parents migration may not be applied yet. Run{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
            supabase/migrations/20261113000000_admin_parents.sql
          </code>{" "}
          in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Parents</h2>
          <p className="mt-1 max-w-[70ch] text-sm text-ink-soft">
            Read-only support view for family accounts. Contact details, children, preferences,
            favorites, and booking history are private and only visible to admins. CSV exports
            contain that private data, so store them securely.
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-soft transition hover:bg-primary-ink"
        >
          Export CSV
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Families" value={rows.length} hint="Parent profiles" />
        <Metric label="Active · 7 days" value={active7} hint="Signed in recently" />
        <Metric label="With bookings" value={withBookings} hint="At least one request" />
        <Metric
          label="AI preferences"
          value={withPreferences}
          hint="Families who saved preferences"
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, neighborhood, address, or family ID"
            className="rounded-2xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <AdminSelect
          label="Activity"
          value={activity}
          onChange={setActivity}
          options={[
            { value: "all", label: "Any activity" },
            { value: "active7", label: "Active in 7 days" },
            { value: "inactive30", label: "Inactive 30+ days" },
            { value: "never", label: "Never signed in" },
          ]}
        />
        <AdminSelect
          label="Bookings"
          value={bookingFilter}
          onChange={setBookingFilter}
          options={[
            { value: "all", label: "All families" },
            { value: "with", label: "With bookings" },
            { value: "without", label: "No bookings" },
          ]}
        />
        <AdminSelect
          label="Sort"
          value={sort}
          onChange={setSort}
          options={[
            { value: "recent", label: "Newest first" },
            { value: "name", label: "Name" },
            { value: "bookings", label: "Most bookings" },
            { value: "login", label: "Recent login" },
          ]}
        />
        {activeFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActivity("all");
              setBookingFilter("all");
              setSort("recent");
            }}
            className="rounded-full border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink"
          >
            Clear
          </button>
        ) : null}
      </div>

      <p className="text-sm text-ink-soft">
        Showing {filtered.length} of {rows.length} famil{rows.length === 1 ? "y" : "ies"}.
      </p>

      {filtered.length ? (
        <div className="overflow-x-auto rounded-3xl bg-surface ring-1 ring-line">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-3 font-medium">Family</th>
                <th className="px-4 py-3 font-medium">Children</th>
                <th className="px-4 py-3 font-medium">Care needs</th>
                <th className="px-4 py-3 font-medium">Bookings</th>
                <th className="px-4 py-3 font-medium">Activity</th>
                <th className="px-4 py-3 font-medium">AI</th>
                <th className="px-4 py-3 text-right font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((parent) => (
                <tr key={parent.parent_id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to="/admin/parents/$parentId"
                      params={{ parentId: parent.parent_id }}
                      className="font-semibold hover:text-primary-ink hover:underline"
                    >
                      {parent.name}
                    </Link>
                    <div className="font-mono text-xs text-ink-faint">{parent.parent_id}</div>
                    {parent.email ? (
                      <a
                        href={`mailto:${parent.email}`}
                        className="mt-0.5 block break-all text-xs text-primary-ink hover:underline"
                      >
                        {parent.email}
                      </a>
                    ) : (
                      <div className="mt-0.5 text-xs text-ink-faint">No email</div>
                    )}
                    <div className="mt-1 text-xs text-ink-soft">
                      {parent.neighborhood || parent.address || "No location"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {parent.children_count} {parent.children_count === 1 ? "child" : "children"}
                    </div>
                    {parent.languages.length ? (
                      <div className="mt-1 text-xs text-ink-soft">
                        {parent.languages.join(", ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {parent.need_blocks} {parent.need_blocks === 1 ? "block" : "blocks"} / week
                    </div>
                    <div className="mt-1 text-xs text-ink-soft">
                      {parent.favorites_count} favorite{parent.favorites_count === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{parent.bookings_total} total</div>
                    <div className="mt-0.5 text-xs text-ink-soft">
                      {parent.bookings_confirmed} confirmed · {parent.bookings_pending} pending
                    </div>
                    <div className="mt-0.5 text-xs text-ink-soft">
                      {parent.last_care_date
                        ? `Last care ${formatDate(parent.last_care_date)}`
                        : "No confirmed care yet"}
                    </div>
                    {parent.providers_rebooked > 0 ? (
                      <span className="mt-1 inline-block rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-ink">
                        {parent.providers_rebooked} rebooked
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{lastSeen(parent.last_login_at)}</div>
                    <div className="mt-0.5 text-xs text-ink-soft">
                      {parent.login_count} login{parent.login_count === 1 ? "" : "s"} ·{" "}
                      {parent.search_sessions} search session
                      {parent.search_sessions === 1 ? "" : "s"}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-faint">
                      Joined {formatDate(parent.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {parent.has_preferences ? "Preferences saved" : "No preferences"}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-soft">
                      {parent.ai_recommendations} recommendation
                      {parent.ai_recommendations === 1 ? "" : "s"}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-faint">
                      {parent.chat_messages} chat message{parent.chat_messages === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/admin/parents/$parentId"
                      params={{ parentId: parent.parent_id }}
                      className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-primary/40 hover:text-ink"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-3xl bg-surface p-8 text-center text-sm text-ink-soft ring-1 ring-line">
          No families match these filters.
        </p>
      )}
    </div>
  );
}
