import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { ErrorState, LoadingState } from "@/components/NavBar";
import { useAdminAiSets, type AdminAiSet } from "@/lib/admin-data";
import { formatDate } from "@/lib/model";

export const Route = createFileRoute("/admin/ai/")({
  head: () => ({
    meta: [
      { title: "Admin AI recommendations — CareConnect" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAi,
});

type ActivityFilter = "all" | "recs" | "chat" | "chat-only" | "stale";
type SortKey = "recent" | "recommendations" | "chat" | "name";

const DAY = 86_400_000;
const STALE_DAYS = 30;

function dateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function lastActivity(row: AdminAiSet) {
  const generated = row.generated_at ? new Date(row.generated_at).getTime() : 0;
  const chat = row.last_chat_at ? new Date(row.last_chat_at).getTime() : 0;
  return Math.max(generated, chat);
}

function isStale(row: AdminAiSet, now: number) {
  if (!row.generated_at || row.recommendation_count === 0) return false;
  return now - new Date(row.generated_at).getTime() > STALE_DAYS * DAY;
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

function AdminAi() {
  const query = useAdminAiSets();

  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [model, setModel] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const now = Date.now();

  const models = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.model).filter((value): value is string => !!value)),
      ).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (activity === "recs" && row.recommendation_count === 0) return false;
        if (activity === "chat" && row.chat_messages === 0) return false;
        if (activity === "chat-only" && (row.recommendation_count > 0 || row.chat_messages === 0)) {
          return false;
        }
        if (activity === "stale" && !isStale(row, now)) return false;
        if (model !== "all" && row.model !== model) return false;
        if (!needle) return true;
        return (
          row.parent_name.toLowerCase().includes(needle) ||
          row.parent_id.toLowerCase().includes(needle) ||
          (row.parent_email ?? "").toLowerCase().includes(needle) ||
          (row.neighborhood ?? "").toLowerCase().includes(needle) ||
          (row.summary ?? "").toLowerCase().includes(needle) ||
          row.top_providers.some((provider) => provider.name.toLowerCase().includes(needle))
        );
      })
      .sort((a, b) => {
        if (sort === "name") return a.parent_name.localeCompare(b.parent_name);
        if (sort === "recommendations") return b.recommendation_count - a.recommendation_count;
        if (sort === "chat") return b.chat_messages - a.chat_messages;
        return lastActivity(b) - lastActivity(a);
      });
  }, [rows, search, activity, model, sort, now]);

  const withRecs = rows.filter((row) => row.recommendation_count > 0).length;
  const withChat = rows.filter((row) => row.chat_messages > 0).length;
  const stale = rows.filter((row) => isStale(row, now)).length;
  const chatOnly = rows.filter(
    (row) => row.recommendation_count === 0 && row.chat_messages > 0,
  ).length;
  const activeFilters = search !== "" || activity !== "all" || model !== "all" || sort !== "recent";

  if (query.isLoading) return <LoadingState label="Loading AI recommendations…" />;

  if (query.error) {
    return (
      <div>
        <ErrorState error={query.error} />
        <p className="text-sm text-ink-soft">
          The admin AI migration may not be applied yet. Run{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
            supabase/migrations/20261114000000_admin_ai.sql
          </code>{" "}
          in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold">AI recommendations</h2>
        <p className="mt-1 max-w-[70ch] text-sm text-ink-soft">
          Review saved recommendation sets and AI chat usage. Open a family to see why each provider
          was chosen, or clear a stale set so the next visit regenerates it. Chat message content is
          not shown here.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Families tracked" value={rows.length} hint="With saved matches or chat" />
        <Metric
          label="Saved sets"
          value={withRecs}
          hint={`${stale} older than ${STALE_DAYS} days`}
        />
        <Metric label="Chat active" value={withChat} hint="At least one message" />
        <Metric label="Chat only" value={chatOnly} hint="No saved recommendation set" />
      </div>

      {stale > 0 && activity !== "stale" ? (
        <button
          type="button"
          onClick={() => setActivity("stale")}
          className="flex w-full flex-wrap items-center justify-between gap-3 rounded-3xl bg-sun-soft/60 px-5 py-4 text-left text-sm ring-1 ring-sun/20 transition hover:ring-sun/40"
        >
          <span>
            <span className="font-semibold">
              {stale} recommendation set{stale === 1 ? " is" : "s are"} older than {STALE_DAYS} days
            </span>
            <span className="mt-0.5 block text-ink-soft">
              Stale matches may no longer reflect a family's schedule or preferences. Review them
              before clearing.
            </span>
          </span>
          <span className="font-semibold text-ink-soft">Show stale →</span>
        </button>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Family, email, neighborhood, summary, or provider"
            className="rounded-2xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <AdminSelect
          label="Activity"
          value={activity}
          onChange={setActivity}
          options={[
            { value: "all", label: "Any AI activity" },
            { value: "recs", label: "Has saved matches" },
            { value: "chat", label: "Has chat activity" },
            { value: "chat-only", label: "Chat without matches" },
            { value: "stale", label: `Stale ${STALE_DAYS}+ days` },
          ]}
        />
        <AdminSelect
          label="Model"
          value={model}
          onChange={setModel}
          options={[
            { value: "all", label: "All models" },
            ...models.map((value) => ({ value, label: value })),
          ]}
        />
        <AdminSelect
          label="Sort"
          value={sort}
          onChange={setSort}
          options={[
            { value: "recent", label: "Recent activity" },
            { value: "recommendations", label: "Most matches" },
            { value: "chat", label: "Most chat" },
            { value: "name", label: "Family name" },
          ]}
        />
        {activeFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActivity("all");
              setModel("all");
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
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-3 font-medium">Family</th>
                <th className="px-4 py-3 font-medium">Saved set</th>
                <th className="px-4 py-3 font-medium">Top matches</th>
                <th className="px-4 py-3 font-medium">AI chat</th>
                <th className="px-4 py-3 font-medium">Context</th>
                <th className="px-4 py-3 text-right font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.parent_id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to="/admin/ai/$parentId"
                      params={{ parentId: row.parent_id }}
                      className="font-semibold hover:text-primary-ink hover:underline"
                    >
                      {row.parent_name}
                    </Link>
                    <div className="font-mono text-xs text-ink-faint">{row.parent_id}</div>
                    {row.parent_email ? (
                      <a
                        href={`mailto:${row.parent_email}`}
                        className="mt-0.5 block break-all text-xs text-primary-ink hover:underline"
                      >
                        {row.parent_email}
                      </a>
                    ) : null}
                    <div className="mt-1 text-xs text-ink-soft">
                      {row.neighborhood || "No neighborhood"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {row.recommendation_count > 0 ? (
                      <>
                        <div className="font-medium">
                          {row.recommendation_count} match
                          {row.recommendation_count === 1 ? "" : "es"}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-soft">
                          Generated {dateTime(row.generated_at)}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-faint">
                          {row.model || "Model not recorded"}
                        </div>
                        {isStale(row, now) ? (
                          <span className="mt-1 inline-block rounded-full bg-clay-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-clay">
                            Stale
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-ink-faint">No saved set</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.top_providers.length ? (
                      <ul className="space-y-1">
                        {row.top_providers.map((provider) => (
                          <li key={provider.provider_id} className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-ink-faint">
                              #{provider.rank}
                            </span>
                            <span className="max-w-[26ch] truncate font-medium">
                              {provider.name}
                            </span>
                            {provider.match_score !== null ? (
                              <span className="rounded-full bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] text-primary-ink">
                                {provider.match_score}%
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.chat_messages > 0 ? (
                      <>
                        <div className="font-medium">
                          {row.chat_messages} message{row.chat_messages === 1 ? "" : "s"}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-soft">
                          {row.chat_user_messages} parent · {row.chat_assistant_messages} assistant
                        </div>
                        <div className="mt-0.5 text-xs text-ink-faint">
                          Last {dateTime(row.last_chat_at)}
                        </div>
                      </>
                    ) : (
                      <span className="text-ink-faint">No chat yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-ink-soft">
                      {row.has_preferences ? "Preferences saved" : "No preferences"}
                      {row.preferences_updated_at ? (
                        <span className="block text-ink-faint">
                          Updated {formatDate(row.preferences_updated_at)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-ink-soft">
                      {row.favorites_count} favorite{row.favorites_count === 1 ? "" : "s"} ·{" "}
                      {row.bookings_total} booking{row.bookings_total === 1 ? "" : "s"}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-faint">
                      Last login {row.last_login_at ? dateTime(row.last_login_at) : "never"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/admin/ai/$parentId"
                      params={{ parentId: row.parent_id }}
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
