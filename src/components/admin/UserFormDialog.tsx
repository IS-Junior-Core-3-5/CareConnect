import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminField, AdminTextInput, adminInputClass } from "./AdminForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateAdminUser,
  useUpdateAdminUser,
  type AdminUser,
  type AdminUserRole,
} from "@/lib/admin-users";

type Draft = {
  email: string;
  password: string;
  name: string;
  neighborhood: string;
  role: AdminUserRole;
};

function emptyDraft(): Draft {
  return { email: "", password: "", name: "", neighborhood: "", role: "parent" };
}

/**
 * Create/edit dialog for real Supabase Auth accounts. Submits to the
 * admin-only `admin-users` edge function, which also keeps the linked parents
 * row in sync.
 */
export function UserFormDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser | null;
}) {
  const create = useCreateAdminUser();
  const update = useUpdateAdminUser();
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  useEffect(() => {
    if (!open) return;
    setDraft(
      user
        ? {
            email: user.email ?? "",
            password: "",
            name: user.name ?? "",
            neighborhood: user.neighborhood ?? "",
            role: user.role,
          }
        : emptyDraft(),
    );
  }, [open, user]);

  const pending = create.isPending || update.isPending;
  const editing = !!user;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!editing && draft.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (editing && draft.password && draft.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    const onSuccess = () => {
      toast.success(editing ? "User updated" : "User created");
      onOpenChange(false);
    };
    const onError = (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Couldn't save the user");

    if (editing && user) {
      update.mutate(
        {
          id: user.id,
          email: draft.email.trim(),
          password: draft.password,
          name: draft.name.trim(),
          neighborhood: draft.neighborhood.trim(),
          role: draft.role,
        },
        { onSuccess, onError },
      );
    } else {
      create.mutate(
        {
          email: draft.email.trim(),
          password: draft.password,
          name: draft.name.trim(),
          neighborhood: draft.neighborhood.trim(),
          role: draft.role,
        },
        { onSuccess, onError },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl border-line bg-surface text-ink sm:rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold">
            {editing ? `Edit ${user?.email ?? "user"}` : "Add user"}
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-soft">
            Creates a real login account and keeps the linked family profile in sync. Every change
            is recorded in the admin audit log.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminTextInput
              label="Email"
              type="email"
              required
              autoComplete="off"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
            />
            <AdminTextInput
              label={editing ? "New password" : "Password"}
              type="password"
              required={!editing}
              minLength={6}
              autoComplete="new-password"
              value={draft.password}
              onChange={(e) => set("password", e.target.value)}
              hint={
                editing ? "Leave blank to keep the current password." : "At least 6 characters."
              }
            />
            <AdminTextInput
              label="Name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Jordan Hale"
            />
            <AdminTextInput
              label="Neighborhood"
              value={draft.neighborhood}
              onChange={(e) => set("neighborhood", e.target.value)}
              placeholder="Provo"
            />
            <AdminField label="Role">
              <select
                value={draft.role}
                onChange={(e) => set("role", e.target.value as AdminUserRole)}
                className={adminInputClass}
              >
                <option value="parent">Parent</option>
                <option value="admin">Admin</option>
              </select>
            </AdminField>
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-soft disabled:opacity-50"
            >
              {pending ? "Saving…" : editing ? "Save changes" : "Create user"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
