import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { ConfirmDeleteDialog } from "@/components/admin/ConfirmDeleteDialog";
import { UserFormDialog } from "@/components/admin/UserFormDialog";
import { ErrorState, LoadingState } from "@/components/NavBar";
import { useApp } from "@/lib/app-state";
import {
  useAdminUsers,
  useDeleteAdminUser,
  type AdminUser,
  type AdminUserRole,
} from "@/lib/admin-users";
import { formatDate } from "@/lib/model";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [{ title: "Admin users — CareConnect" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminUsers,
});

type RoleFilter = "all" | AdminUserRole;

function lastSeen(iso: string | null) {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
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

function AdminUsers() {
  const users = useAdminUsers();
  const remove = useDeleteAdminUser();
  const { userId } = useApp();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const rows = useMemo(() => users.data ?? [], [users.data]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((user) => {
      if (role !== "all" && user.role !== role) return false;
      if (!needle) return true;
      return (
        (user.email ?? "").toLowerCase().includes(needle) ||
        (user.name ?? "").toLowerCase().includes(needle) ||
        (user.neighborhood ?? "").toLowerCase().includes(needle) ||
        user.id.toLowerCase().includes(needle) ||
        (user.parent_id ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, search, role]);

  const admins = rows.filter((user) => user.role === "admin").length;
  const neverSignedIn = rows.filter((user) => !user.last_sign_in_at).length;
  const active7 = rows.filter(
    (user) =>
      user.last_sign_in_at &&
      Date.now() - new Date(user.last_sign_in_at).getTime() <= 7 * 86_400_000,
  ).length;

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(user: AdminUser) {
    setEditing(user);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(`${deleting.email ?? "User"} deleted`);
        setDeleting(null);
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : "Couldn't delete the user"),
    });
  }

  if (users.isLoading) return <LoadingState label="Loading users…" />;

  if (users.error) {
    return (
      <div>
        <ErrorState error={users.error} />
        <p className="mt-3 text-sm text-ink-soft">
          User maintenance uses the{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">admin-users</code>{" "}
          edge function. Deploy it with{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
            supabase functions deploy admin-users
          </code>{" "}
          and make sure{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
            SUPABASE_SERVICE_ROLE_KEY
          </code>{" "}
          is available to the function, then reload this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Users</h2>
          <p className="mt-1 max-w-[70ch] text-sm text-ink-soft">
            Create, edit, and delete real Supabase Auth accounts. Changing a user also keeps the
            linked family profile in sync. Every write is recorded in the admin audit log.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-soft transition hover:bg-primary-ink"
        >
          Add user
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Accounts" value={rows.length} hint="All Auth users" />
        <Metric label="Admins" value={admins} hint="Can open this panel" />
        <Metric label="Active · 7 days" value={active7} hint="Signed in recently" />
        <Metric label="Never signed in" value={neverSignedIn} hint="Created but unused" />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Email, name, neighborhood, or ID"
            className="rounded-2xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <AdminSelect
          label="Role"
          value={role}
          onChange={setRole}
          options={[
            { value: "all", label: "All roles" },
            { value: "admin", label: "Admins" },
            { value: "parent", label: "Parents" },
          ]}
        />
        {search || role !== "all" ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setRole("all");
            }}
            className="rounded-full border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink"
          >
            Clear
          </button>
        ) : null}
      </div>

      <p className="text-sm text-ink-soft">
        Showing {filtered.length} of {rows.length} account{rows.length === 1 ? "" : "s"}.
      </p>

      {filtered.length ? (
        <div className="overflow-x-auto rounded-3xl bg-surface ring-1 ring-line">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Family profile</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Last sign-in</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const isSelf = user.id === userId;
                return (
                  <tr key={user.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{user.name ?? "Unnamed user"}</div>
                      <div className="break-all text-xs text-ink-soft">
                        {user.email ?? "No email"}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-ink-faint">{user.id}</div>
                      {isSelf ? (
                        <span className="mt-1 inline-block rounded-full bg-sun-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                          You
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
                          user.role === "admin"
                            ? "bg-primary-soft text-primary-ink"
                            : "bg-background text-ink-soft ring-1 ring-line"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.parent_id ? (
                        <>
                          <div className="font-mono text-xs">{user.parent_id}</div>
                          <div className="mt-0.5 text-xs text-ink-soft">
                            {user.neighborhood ?? "No neighborhood"}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-ink-faint">No linked family</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft">
                      {user.created_at ? formatDate(user.created_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-ink-soft">{lastSeen(user.last_sign_in_at)}</div>
                      <div className="mt-0.5 text-xs text-ink-faint">
                        {user.email_confirmed_at ? "Email confirmed" : "Email unconfirmed"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(user)}
                          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-primary/40 hover:text-ink"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => setDeleting(user)}
                          title={isSelf ? "You cannot delete your own account" : undefined}
                          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-clay/40 hover:text-clay disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-3xl bg-surface p-8 text-center text-sm text-ink-soft ring-1 ring-line">
          No users match these filters.
        </p>
      )}

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this user?"
        description={
          deleting
            ? `${deleting.email ?? "This account"} will lose access, and their linked family profile and private data will be deleted.`
            : ""
        }
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
