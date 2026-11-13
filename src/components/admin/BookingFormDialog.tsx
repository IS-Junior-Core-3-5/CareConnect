import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminField, AdminTextArea, adminInputClass } from "./AdminForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAdminParents,
  useAdminProviders,
  useCreateBooking,
  useUpdateBooking,
  type AdminBooking,
  type AdminBookingStatus,
  type AdminBookingWrite,
} from "@/lib/admin-data";

const BLOCKS = ["Morning", "Afternoon", "Evening"] as const;
const STATUSES: AdminBookingStatus[] = ["pending", "confirmed", "declined", "cancelled"];

type Draft = {
  parentId: string;
  providerId: string;
  careDate: string;
  block: AdminBookingWrite["block"];
  status: AdminBookingStatus;
  note: string;
};

function today() {
  return new Date().toLocaleDateString("en-CA");
}

function emptyDraft(): Draft {
  return {
    parentId: "",
    providerId: "",
    careDate: today(),
    block: "Morning",
    status: "pending",
    note: "",
  };
}

/**
 * Create/edit dialog for care_bookings. The audited admin RPCs allow any field
 * to change, including the family, provider, date, and status.
 */
export function BookingFormDialog({
  open,
  onOpenChange,
  booking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: AdminBooking | null;
}) {
  const parents = useAdminParents();
  const providers = useAdminProviders();
  const create = useCreateBooking();
  const update = useUpdateBooking();
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  useEffect(() => {
    if (!open) return;
    setDraft(
      booking
        ? {
            parentId: booking.parent_id,
            providerId: booking.provider_id,
            careDate: booking.care_date,
            block: booking.block,
            status: booking.status,
            note: booking.resolution_note ?? "",
          }
        : emptyDraft(),
    );
  }, [open, booking]);

  const pending = create.isPending || update.isPending;
  const editing = !!booking;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.parentId) {
      toast.error("Choose a family");
      return;
    }
    if (!draft.providerId) {
      toast.error("Choose a provider");
      return;
    }
    if (!draft.careDate) {
      toast.error("Choose a care date");
      return;
    }

    const input: AdminBookingWrite = {
      parent_id: draft.parentId,
      provider_id: draft.providerId,
      care_date: draft.careDate,
      block: draft.block,
      status: draft.status,
      resolution_note: draft.note.trim() || null,
    };

    const callbacks = {
      onSuccess: () => {
        toast.success(editing ? "Booking updated" : "Booking created");
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Couldn't save the booking");
      },
    };

    if (editing && booking) {
      update.mutate({ ...input, id: booking.id }, callbacks);
    } else {
      create.mutate(input, callbacks);
    }
  }

  const parentOptions = parents.data ?? [];
  const providerOptions = providers.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl border-line bg-surface text-ink sm:rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold">
            {editing ? "Edit booking" : "Add booking"}
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-soft">
            Admin writes bypass the family/provider guard and are recorded in the admin audit log.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="Family">
              <select
                value={draft.parentId}
                onChange={(e) => set("parentId", e.target.value)}
                className={adminInputClass}
                required
              >
                <option value="">Choose a family…</option>
                {parentOptions.map((parent) => (
                  <option key={parent.parent_id} value={parent.parent_id}>
                    {parent.name} ({parent.parent_id})
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Provider">
              <select
                value={draft.providerId}
                onChange={(e) => set("providerId", e.target.value)}
                className={adminInputClass}
                required
              >
                <option value="">Choose a provider…</option>
                {providerOptions.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.id})
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Care date">
              <input
                type="date"
                value={draft.careDate}
                onChange={(e) => set("careDate", e.target.value)}
                className={adminInputClass}
                required
              />
            </AdminField>
            <AdminField label="Time block">
              <select
                value={draft.block}
                onChange={(e) => set("block", e.target.value as Draft["block"])}
                className={adminInputClass}
              >
                {BLOCKS.map((block) => (
                  <option key={block}>{block}</option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Status">
              <select
                value={draft.status}
                onChange={(e) => set("status", e.target.value as AdminBookingStatus)}
                className={adminInputClass}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </AdminField>
          </div>

          <AdminTextArea
            label="Resolution note"
            rows={3}
            value={draft.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Optional note shown to the family and provider."
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
              {pending ? "Saving…" : editing ? "Save changes" : "Create booking"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
