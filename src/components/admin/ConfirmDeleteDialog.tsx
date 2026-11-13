import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Shared hard-delete confirmation. Every delete in the admin CRUD screens goes
 * through this dialog so a destructive action always needs an explicit click.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete permanently",
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-line bg-surface text-ink sm:rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-sm text-ink-soft">{description}</DialogDescription>
        </DialogHeader>
        <p className="rounded-2xl bg-clay-soft/60 px-4 py-3 text-sm font-medium text-clay">
          This cannot be undone. The delete is recorded in the admin audit log.
        </p>
        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Deleting…" : confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
