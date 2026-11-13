import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { ErrorState, LoadingState } from "@/components/NavBar";
import { useAdminAuditLog, type AdminAuditEntry } from "@/lib/admin-data";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [{ title: "Admin audit log — CareConnect" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminAudit,
});

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Render one audit detail value without dumping raw JSON at the reader. */
function detailValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function AdminAudit() {
  const audit = useAdminAuditLog();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState("all");
  const [action, setAction] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  const rows = useMemo(() => audit.data ?? [], [audit.data]);

  const targets = useMemo(
    () => Array.from(new Set(rows.map((row) => row.target_type))).sort(),
    [rows],
  );
  const actions = useMemo(() => Array.from(new Set(rows.map((row) => row.action))).sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (target !== "all" && row.target_type !== target) return false;
      if (action !== "all" && row.action !== action) return false;
      if (!needle) return true;
      return (
        row.action.toLowerCase().includes(needle) ||
        row.target_type.toLowerCase().includes(needle) ||
        (row.target_id ?? "").toLowerCase().includes(needle) ||
        (row.admin_email ?? "").toLowerCase().includes(needle) ||
        JSON.stringify(row.details).toLowerCase().includes(needle)
      );
    });
  }, [rows, search, target, action]);

  function details(row: AdminAuditEntry) {
    const entries = Object.entries(row.details ?? {});
    if (!entries.length) return <p className="text-xs text-ink-faint">No details recorded.</p>;
    return (
      <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <dt className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              {key}
            </dt>
            <dd className="min-w-0 break-words text-ink-soft">{detailValue(value)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  if (audit.isLoading) return <LoadingState label="Loading audit log…" />;

  if (audit.error) {
    return (
      <div>
        <ErrorState error={audit.error} />
        <p className="mt-3 text-sm text-ink-soft">
          The audit table is created by{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
            supabase/migrations/20261111000000_admin_foundation.sql
          </code>
          . Apply the admin migrations, then reload this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold">Audit log</h2>
        <p className="mt-1 max-w-[70ch] text-sm text-ink-soft">
          Every admin write is recorded here: provider, booking, family, user, AI, and status
          changes. The newest {rows.length} entries are loaded. Admin-only; this view is read-only.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Action, admin, target ID, or details"
            className="rounded-2xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <AdminSelect
          label="Target"
          value={target}
          onChange={setTarget}
          options={[
            { value: "all", label: "All targets" },
            ...targets.map((value) => ({ value, label: value })),
          ]}
        />
        <AdminSelect
          label="Action"
          value={action}
          onChange={setAction}
          options={[
            { value: "all", label: "All actions" },
            ...actions.map((value) => ({ value, label: value })),
          ]}
        />
        {search || target !== "all" || action !== "all" ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setTarget("all");
              setAction("all");
            }}
            className="rounded-full border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink"
          >
            Clear
          </button>
        ) : null}
      </div>

      <p className="text-sm text-ink-soft">
        Showing {filtered.length} of {rows.length} entr{rows.length === 1 ? "y" : "ies"}.
      </p>

      {filtered.length ? (
        <div className="overflow-x-auto rounded-3xl bg-surface ring-1 ring-line">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 text-right font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-soft">
                      {when(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-ink-soft">
                        {row.admin_email ?? "Unknown admin"}
                      </div>
                      {row.admin_user_id ? (
                        <div className="font-mono text-[10px] text-ink-faint">
                          {row.admin_user_id}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft ring-1 ring-line">
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium">{row.target_type}</div>
                      {row.target_id ? (
                        <div className="break-all font-mono text-[10px] text-ink-faint">
                          {row.target_id}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                        className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-primary/40 hover:text-ink"
                      >
                        {expanded === row.id ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {expanded === row.id ? (
                    <tr key={`${row.id}-details`} className="border-b border-line/60 last:border-0">
                      <td colSpan={5} className="bg-background/60 px-4 py-3">
                        {details(row)}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-3xl bg-surface p-8 text-center text-sm text-ink-soft ring-1 ring-line">
          No audit entries match these filters.
        </p>
      )}
    </div>
  );
}
