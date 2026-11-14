import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminTextArea, AdminTextInput } from "./AdminForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateParent,
  useUpdateParent,
  type AdminParent,
  type AdminParentWrite,
} from "@/lib/admin-data";
import { validateAddress } from "@/lib/geocode";

type Draft = {
  id: string;
  name: string;
  email: string;
  neighborhood: string;
  blurb: string;
  address: string;
};

function emptyDraft(): Draft {
  return { id: "", name: "", email: "", neighborhood: "", blurb: "", address: "" };
}

/**
 * Create/edit dialog for the parents (family) table. This maintains the family
 * record only; use Maintain Users to create the matching login account.
 */
export function ParentFormDialog({
  open,
  onOpenChange,
  parent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent: AdminParent | null;
}) {
  const create = useCreateParent();
  const update = useUpdateParent();
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  useEffect(() => {
    if (!open) return;
    setDraft(
      parent
        ? {
            id: parent.parent_id,
            name: parent.name,
            email: parent.email ?? "",
            neighborhood: parent.neighborhood ?? "",
            blurb: "",
            address: parent.address ?? "",
          }
        : emptyDraft(),
    );
  }, [open, parent]);

  const pending = create.isPending || update.isPending;
  const editing = !!parent;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) {
      toast.error("Family name is required");
      return;
    }

    const address = draft.address.trim() || null;
    // Warn about an address the Census geocoder cannot place. This does not
    // block the save: the family can correct it from their profile page.
    if (address && address !== (parent?.address ?? null)) {
      try {
        await validateAddress(address);
      } catch (error) {
        toast.warning(
          error instanceof Error
            ? `${error.message} The family can fix it from their profile.`
            : "Address couldn't be verified. The family can fix it from their profile.",
        );
      }
    }

    const input: AdminParentWrite = {
      id: draft.id.trim(),
      name: draft.name.trim(),
      email: draft.email.trim() || null,
      neighborhood: draft.neighborhood.trim() || null,
      blurb: draft.blurb.trim() || null,
      address,
    };

    const mutation = editing ? update : create;
    mutation.mutate(input, {
      onSuccess: () => {
        toast.success(editing ? `${input.name} updated` : `${input.name} created`);
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Couldn't save the family");
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl border-line bg-surface text-ink sm:rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold">
            {editing ? `Edit ${parent?.name}` : "Add family record"}
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-soft">
            This creates a family profile, not a login. Use Maintain Users when a family needs to
            sign in. Writes are recorded in the admin audit log.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminTextInput
              label="Family name"
              required
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Jordan Hale"
            />
            <AdminTextInput
              label="Family ID"
              value={draft.id}
              onChange={(e) => set("id", e.target.value)}
              readOnly={editing}
              hint={
                editing
                  ? "The family ID cannot change."
                  : "Leave blank to generate an ID from the name."
              }
              placeholder="p-jordan-hale"
            />
            <AdminTextInput
              label="Email"
              type="email"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="family@example.com"
            />
            <AdminTextInput
              label="Neighborhood"
              value={draft.neighborhood}
              onChange={(e) => set("neighborhood", e.target.value)}
              placeholder="Provo"
            />
          </div>

          <AdminTextInput
            label="Private address"
            value={draft.address}
            onChange={(e) => set("address", e.target.value)}
            hint="Stored in parent_private_addresses; only admins and the family can read it. Checked against the U.S. Census address database when changed."
          />

          <AdminTextArea
            label="Notes / blurb"
            rows={3}
            value={draft.blurb}
            onChange={(e) => set("blurb", e.target.value)}
            placeholder="Optional internal notes about this family."
          />

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
              {pending ? "Saving…" : editing ? "Save changes" : "Create family"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
