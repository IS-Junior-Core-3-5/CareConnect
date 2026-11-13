import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { BookingFormDialog } from "@/components/admin/BookingFormDialog";
import { ConfirmDeleteDialog } from "@/components/admin/ConfirmDeleteDialog";
import { ErrorState, LoadingState } from "@/components/NavBar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAdminBookings,
  useAdminStats,
  useDeleteBooking,
  useSetBookingStatus,
  type AdminBooking,
  type AdminBookingStatus,
} from "@/lib/admin-data";
import { downloadCsv } from "@/lib/csv";
import { formatDate } from "@/lib/model";

export const Route = createFileRoute("/admin/bookings")({
  head: () => ({
    meta: [{ title: "Admin bookings — CareConnect" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminBookings,
});

type StatusFilter = "all" | AdminBookingStatus;
type DateFilter = "all" | "upcoming" | "past" | "overdue";
type ReasonTarget = { booking: AdminBooking; status: "declined" | "cancelled" };

const STATUS_LABEL: Record<AdminBookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<AdminBookingStatus, string> = {
  pending: "bg-sun-soft text-ink-soft",
  confirmed: "bg-leaf-soft text-leaf-ink",
  declined: "bg-clay-soft text-clay",
  cancelled: "bg-background text-ink-faint ring-1 ring-line",
};

const STATUS_ORDER: Record<AdminBookingStatus, number> = {
  pending: 0,
  confirmed: 1,
  declined: 2,
  cancelled: 3,
};

const BOOKING_COLUMNS: { key: keyof AdminBooking; label: string }[] = [
  { key: "id", label: "booking_id" },
  { key: "care_date", label: "care_date" },
  { key: "block", label: "block" },
  { key: "status", label: "status" },
  { key: "parent_id", label: "parent_id" },
  { key: "parent_name", label: "parent_name" },
  { key: "provider_id", label: "provider_id" },
  { key: "provider_name", label: "provider_name" },
  { key: "is_overdue", label: "overdue" },
  { key: "parent_provider_confirmed_bookings", label: "parent_provider_confirmed_bookings" },
  { key: "parent_provider_rebooking", label: "parent_provider_rebooking" },
  { key: "resolution_note", label: "resolution_note" },
  { key: "created_at", label: "created_at" },
  { key: "updated_at", label: "updated_at" },
];

function ageLabel(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={`rounded-3xl p-4 ring-1 ${
        tone === "warn" ? "bg-clay-soft/50 ring-clay/20" : "bg-surface ring-line"
      }`}
    >
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      <p className="mt-1 font-display text-2xl font-bold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

function AdminBookings() {
  const bookings = useAdminBookings();
  const stats = useAdminStats();
  const statusMutation = useSetBookingStatus();
  const remove = useDeleteBooking();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [reasonFor, setReasonFor] = useState<ReasonTarget | null>(null);
  const [reason, setReason] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBooking | null>(null);
  const [deleting, setDeleting] = useState<AdminBooking | null>(null);

  const today = new Date().toLocaleDateString("en-CA");
  const rows = useMemo(() => bookings.data ?? [], [bookings.data]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows
      .filter((booking) => {
        if (status !== "all" && booking.status !== status) return false;
        if (dateFilter === "upcoming" && booking.care_date < today) return false;
        if (dateFilter === "past" && booking.care_date >= today) return false;
        if (dateFilter === "overdue" && !booking.is_overdue) return false;
        if (!needle) return true;
        return (
          (booking.parent_name ?? "").toLowerCase().includes(needle) ||
          (booking.provider_name ?? "").toLowerCase().includes(needle) ||
          booking.parent_id.toLowerCase().includes(needle) ||
          booking.provider_id.toLowerCase().includes(needle) ||
          booking.id.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
        const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (byStatus !== 0) return byStatus;
        return a.care_date.localeCompare(b.care_date);
      });
  }, [rows, search, status, dateFilter, today]);

  function download() {
    if (!filtered.length) {
      toast.error("No bookings match these filters");
      return;
    }
    downloadCsv(
      `careconnect-bookings-${new Date().toISOString().slice(0, 10)}.csv`,
      BOOKING_COLUMNS,
      filtered,
    );
    toast.success(
      `Exported ${filtered.length} booking${filtered.length === 1 ? "" : "s"}. Store the file securely.`,
    );
  }

  function mutationError(error: unknown) {
    toast.error(error instanceof Error ? error.message : "Couldn't update the booking");
  }

  function confirmBooking(booking: AdminBooking) {
    statusMutation.mutate(
      { bookingId: booking.id, status: "confirmed" },
      {
        onSuccess: () => toast.success("Booking confirmed"),
        onError: mutationError,
      },
    );
  }

  function submitReason() {
    if (!reasonFor) return;
    statusMutation.mutate(
      {
        bookingId: reasonFor.booking.id,
        status: reasonFor.status,
        reason: reason.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(reasonFor.status === "declined" ? "Request declined" : "Booking cancelled");
          setReasonFor(null);
          setReason("");
        },
        onError: mutationError,
      },
    );
  }

  const activeFilters = search !== "" || status !== "all" || dateFilter !== "all";
  const s = stats.data;
  const totalBookings = s
    ? s.bookings_pending + s.bookings_confirmed + s.bookings_declined + s.bookings_cancelled
    : null;

  if (bookings.isLoading) return <LoadingState label="Loading bookings…" />;

  if (bookings.error) {
    return (
      <div>
        <ErrorState error={bookings.error} />
        <p className="text-sm text-ink-soft">
          The admin bookings migration may not be applied yet. Run{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
            supabase/migrations/20261112000000_admin_bookings.sql
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
          <h2 className="font-display text-xl font-bold">Bookings</h2>
          <p className="mt-1 max-w-[70ch] text-sm text-ink-soft">
            Watch care requests across the marketplace, step in when a request is stuck, and track
            rebooking. Admin status changes are recorded in the audit log with an optional reason.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-soft transition hover:bg-primary-ink"
          >
            Add booking
          </button>
          <button
            type="button"
            onClick={download}
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-primary/40 hover:text-ink"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Metric
          label="Pending"
          value={s ? s.bookings_pending : "—"}
          hint={s ? `${s.bookings_pending_over_2d} over 2 days` : undefined}
        />
        <Metric label="Confirmed" value={s ? s.bookings_confirmed : "—"} />
        <Metric label="Declined" value={s ? s.bookings_declined : "—"} />
        <Metric label="Cancelled" value={s ? s.bookings_cancelled : "—"} />
        <Metric
          label="Overdue"
          value={s ? s.bookings_pending_over_2d : "—"}
          hint="Pending over 2 days"
          tone={s && s.bookings_pending_over_2d > 0 ? "warn" : "default"}
        />
        <Metric
          label="Rebook rate"
          value={s?.overall_rebook_rate_pct == null ? "—" : `${s.overall_rebook_rate_pct}%`}
          hint={totalBookings == null ? undefined : `${totalBookings} total requests`}
        />
      </div>

      {s &&
      s.bookings_pending_over_2d > 0 &&
      !(status === "pending" && dateFilter === "overdue") ? (
        <button
          type="button"
          onClick={() => {
            setStatus("pending");
            setDateFilter("overdue");
          }}
          className="flex w-full flex-wrap items-center justify-between gap-3 rounded-3xl bg-clay-soft/60 px-5 py-4 text-left text-sm ring-1 ring-clay/20 transition hover:ring-clay/40"
        >
          <span>
            <span className="font-semibold">
              {s.bookings_pending_over_2d} overdue request
              {s.bookings_pending_over_2d === 1 ? "" : "s"}
            </span>
            <span className="mt-0.5 block text-ink-soft">
              Pending for more than 2 days. Review or resolve them now.
            </span>
          </span>
          <span className="font-semibold text-clay">Show overdue →</span>
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
            placeholder="Family, provider, or booking ID"
            className="rounded-2xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <AdminSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            { value: "pending", label: "Pending" },
            { value: "confirmed", label: "Confirmed" },
            { value: "declined", label: "Declined" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <AdminSelect
          label="Dates"
          value={dateFilter}
          onChange={setDateFilter}
          options={[
            { value: "all", label: "All dates" },
            { value: "upcoming", label: "Upcoming" },
            { value: "past", label: "Past" },
            { value: "overdue", label: "Overdue only" },
          ]}
        />
        {activeFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatus("all");
              setDateFilter("all");
            }}
            className="rounded-full border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:text-ink"
          >
            Clear
          </button>
        ) : null}
      </div>

      <p className="text-sm text-ink-soft">
        Showing {filtered.length} of {rows.length} booking{rows.length === 1 ? "" : "s"}.
      </p>

      {filtered.length ? (
        <div className="overflow-x-auto rounded-3xl bg-surface ring-1 ring-line">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-3 font-medium">Care</th>
                <th className="px-4 py-3 font-medium">Family</th>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Requested</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((booking) => {
                const pending =
                  statusMutation.isPending && statusMutation.variables?.bookingId === booking.id;
                const isPast = booking.care_date < today;
                const resolved = booking.status === "declined" || booking.status === "cancelled";

                return (
                  <tr key={booking.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{formatDate(booking.care_date)}</div>
                      <div className="text-xs text-ink-soft">
                        {booking.block}
                        {isPast ? " · past" : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{booking.parent_name ?? "Unknown family"}</div>
                      <div className="font-mono text-xs text-ink-faint">{booking.parent_id}</div>
                      {booking.parent_provider_rebooking ? (
                        <span className="mt-1 inline-block rounded-full bg-primary-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-ink">
                          Rebooking
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {booking.provider_name ?? booking.provider_id}
                      </div>
                      <div className="font-mono text-xs text-ink-faint">{booking.provider_id}</div>
                      {booking.parent_provider_confirmed_bookings > 0 ? (
                        <div className="mt-1 text-xs text-ink-soft">
                          {booking.parent_provider_confirmed_bookings} confirmed together
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${STATUS_CLASS[booking.status]}`}
                      >
                        {STATUS_LABEL[booking.status]}
                      </span>
                      {booking.resolution_note ? (
                        <p className="mt-1.5 max-w-[26ch] text-xs text-ink-soft">
                          {booking.resolution_note}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div>{ageLabel(booking.created_at)}</div>
                      {booking.is_overdue ? (
                        <div className="text-xs font-semibold text-clay">Overdue</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {booking.status === "pending" && !isPast ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => confirmBooking(booking)}
                            className="rounded-full bg-leaf px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Confirm
                          </button>
                        ) : null}
                        {booking.status === "pending" ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              setReason("");
                              setReasonFor({ booking, status: "declined" });
                            }}
                            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-clay/40 hover:text-clay disabled:opacity-50"
                          >
                            Decline
                          </button>
                        ) : null}
                        {booking.status === "pending" || booking.status === "confirmed" ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              setReason("");
                              setReasonFor({ booking, status: "cancelled" });
                            }}
                            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-clay/40 hover:text-clay disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        ) : null}
                        {resolved ? (
                          <span className="py-1.5 text-xs text-ink-faint">Resolved</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(booking);
                            setFormOpen(true);
                          }}
                          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-primary/40 hover:text-ink"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(booking)}
                          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-clay/40 hover:text-clay"
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
          No bookings match these filters.
        </p>
      )}

      <Dialog
        open={!!reasonFor}
        onOpenChange={(open) => {
          if (!open) {
            setReasonFor(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="rounded-3xl border-line bg-surface text-ink sm:rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold">
              {reasonFor?.status === "declined" ? "Decline this request?" : "Cancel this booking?"}
            </DialogTitle>
            <DialogDescription className="text-sm text-ink-soft">
              {reasonFor
                ? `${reasonFor.booking.parent_name ?? "This family"} · ${formatDate(
                    reasonFor.booking.care_date,
                  )} · ${reasonFor.booking.block}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Reason (optional)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Shown to the family and provider on the request."
              className="rounded-2xl border border-line bg-background px-3 py-2 text-sm font-normal text-ink outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => {
                setReasonFor(null);
                setReason("");
              }}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
            >
              Back
            </button>
            <button
              type="button"
              disabled={statusMutation.isPending}
              onClick={submitReason}
              className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {statusMutation.isPending
                ? "Saving…"
                : reasonFor?.status === "declined"
                  ? "Decline request"
                  : "Cancel booking"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BookingFormDialog open={formOpen} onOpenChange={setFormOpen} booking={editing} />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete this booking?"
        description={
          deleting
            ? `${deleting.parent_name ?? deleting.parent_id} · ${formatDate(
                deleting.care_date,
              )} · ${deleting.block} will be permanently deleted.`
            : ""
        }
        pending={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success("Booking deleted");
              setDeleting(null);
            },
            onError: (mutationError) =>
              toast.error(
                mutationError instanceof Error
                  ? mutationError.message
                  : "Couldn't delete the booking",
              ),
          });
        }}
      />
    </div>
  );
}
