import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { useProviders } from "@/lib/data";
import { BLOCKS, type Block, type Provider } from "@/lib/model";

type Booking = {
  id: string;
  parent_id: string;
  provider_id: string;
  care_date: string;
  block: Block;
  status: "pending" | "confirmed" | "declined" | "cancelled";
};

const bookingKey = (userId: string | null) => ["care_bookings", userId] as const;

export function RequestCare({ provider }: { provider: Provider }) {
  const { parentId, userId } = useApp();
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [block, setBlock] = useState<Block>("Morning");
  const [busy, setBusy] = useState(false);
  if (!parentId || !provider.ownerId || provider.ownerId === userId || !provider.schedule)
    return null;

  async function request(e: FormEvent) {
    e.preventDefault();
    if (!parentId || !date) return;
    setBusy(true);
    const { error } = await supabase.from("care_bookings").insert({
      parent_id: parentId,
      provider_id: provider.id,
      care_date: date,
      block,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDate("");
    await qc.invalidateQueries({ queryKey: bookingKey(userId) });
    toast.success("Care request sent");
  }

  const localToday = new Date().toLocaleDateString("en-CA");
  return (
    <form onSubmit={request} className="mt-6 rounded-3xl bg-surface p-6 ring-1 ring-line">
      <h2 className="font-display text-2xl font-bold">Request a care block</h2>
      <p className="mt-1 text-sm text-ink-soft">
        The provider will confirm or decline your request.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          Date
          <input
            required
            type="date"
            min={localToday}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-xl bg-background px-3 py-2 ring-1 ring-line"
          />
        </label>
        <label className="text-sm font-medium">
          Time
          <select
            value={block}
            onChange={(e) => setBlock(e.target.value as Block)}
            className="mt-1 block rounded-xl bg-background px-3 py-2 ring-1 ring-line"
          >
            {BLOCKS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <button
          disabled={busy}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-soft disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}

export function CareBookings() {
  const { userId, parentId } = useApp();
  const providers = useProviders();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: bookingKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("care_bookings")
        .select("id, parent_id, provider_id, care_date, block, status")
        .order("care_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });

  async function changeStatus(id: string, status: Booking["status"]) {
    setBusyId(id);
    const { error } = await supabase.from("care_bookings").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: bookingKey(userId) });
    toast.success("Request updated");
  }

  return (
    <section className="mt-6 rounded-3xl bg-surface p-6 ring-1 ring-line">
      <h2 className="font-display text-2xl font-bold">Care requests</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Requests and confirmations are saved to your account.
      </p>
      {query.isLoading ? <p className="mt-4 text-sm">Loading requests…</p> : null}
      {query.error ? (
        <p className="mt-4 text-sm text-clay">Couldn’t load care requests: {query.error.message}</p>
      ) : null}
      {query.data?.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">No care requests yet.</p>
      ) : null}
      <div className="mt-4 space-y-3">
        {query.data?.map((booking) => {
          const mine = booking.parent_id === parentId;
          const provider = providers.find((p) => p.id === booking.provider_id);
          return (
            <div
              key={booking.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background p-4 ring-1 ring-line"
            >
              <div>
                <p className="font-semibold">{provider?.name ?? booking.provider_id}</p>
                <p className="text-sm text-ink-soft">
                  {booking.care_date} · {booking.block} ·{" "}
                  {mine ? "Your request" : "Incoming request"} · {booking.status}
                </p>
              </div>
              <div className="flex gap-2">
                {!mine && booking.status === "pending" ? (
                  <>
                    <button
                      disabled={busyId === booking.id}
                      onClick={() => changeStatus(booking.id, "confirmed")}
                      className="rounded-full bg-leaf px-3 py-1.5 text-sm font-semibold text-white"
                    >
                      Confirm
                    </button>
                    <button
                      disabled={busyId === booking.id}
                      onClick={() => changeStatus(booking.id, "declined")}
                      className="rounded-full border border-line px-3 py-1.5 text-sm"
                    >
                      Decline
                    </button>
                  </>
                ) : null}
                {mine && (booking.status === "pending" || booking.status === "confirmed") ? (
                  <button
                    disabled={busyId === booking.id}
                    onClick={() => changeStatus(booking.id, "cancelled")}
                    className="rounded-full border border-line px-3 py-1.5 text-sm"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
