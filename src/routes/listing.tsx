import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, LoadingState } from "@/components/NavBar";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { QK, useLanguages, useProvidersQuery } from "@/lib/data";
import {
  CARE_TYPES,
  emptySchedule,
  scheduleToRows,
  slugify,
  type CareType,
  type Provider,
  type Schedule,
} from "@/lib/model";

export const Route = createFileRoute("/listing")({
  head: () => ({
    meta: [
      { title: "My listing — CareConnect" },
      {
        name: "description",
        content: "Offer child care on CareConnect: care type, pricing, schedule and availability.",
      },
    ],
  }),
  component: ListingPage,
});

function ListingPage() {
  return (
    <AppShell>
      <ListingBody />
    </AppShell>
  );
}

function ListingBody() {
  const { userId } = useApp();
  const q = useProvidersQuery();
  if (q.isLoading) return <LoadingState label="Loading your listing…" />;
  const mine = q.data?.find((p) => p.ownerId === userId) ?? null;
  return <ListingForm key={mine?.id ?? "new"} existing={mine} />;
}

const field =
  "w-full rounded-2xl bg-background px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-primary";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint";

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

function ListingForm({ existing }: { existing: Provider | null }) {
  const { userId, me } = useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const allLanguages = useLanguages();

  const [name, setName] = useState(existing?.name ?? me?.name ?? "");
  const [careType, setCareType] = useState<CareType>(existing?.careType ?? "Sitter");
  const [blurb, setBlurb] = useState(existing?.blurb ?? "");
  const [bio, setBio] = useState(existing?.bio ?? "");
  const [rate, setRate] = useState(existing?.dailyRate?.toString() ?? "");
  const [rateMax, setRateMax] = useState(existing?.dailyRateMax?.toString() ?? "");
  const [pricingNotes, setPricingNotes] = useState(existing?.pricingNotes.join("\n") ?? "");
  const [neighborhood, setNeighborhood] = useState(existing?.neighborhood ?? me?.neighborhood ?? "");
  const [distance, setDistance] = useState(existing?.distance?.toString() ?? "");
  const [languages, setLanguages] = useState<string[]>(existing?.languages ?? ["English"]);
  const [otherLang, setOtherLang] = useState("");
  const [licenses, setLicenses] = useState(existing?.licenses.join("\n") ?? "");
  const [hasSchedule, setHasSchedule] = useState(existing ? existing.schedule !== null : true);
  const [schedule, setSchedule] = useState<Schedule>(existing?.schedule ?? emptySchedule());
  const [scheduleSummary, setScheduleSummary] = useState(
    existing && existing.schedule ? existing.scheduleSummary : "",
  );
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => setConfirmDelete(false), [existing]);

  const langOptions = Array.from(new Set([...allLanguages.map((l) => l.name), ...languages])).sort();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const dailyRate = rate === "" ? null : Number(rate);
    const dailyRateMax = rateMax === "" ? null : Number(rateMax);
    if (dailyRate !== null && dailyRateMax !== null && dailyRateMax < dailyRate)
      { toast.error("The highest rate can't be lower than the starting rate."); return; }
    setBusy(true);
    try {
      const id = existing?.id ?? slugify(name);
      const row = {
        name: name.trim(),
        care_type: careType,
        blurb: blurb.trim() || null,
        bio: bio.trim() || null,
        daily_rate: dailyRate,
        daily_rate_max: dailyRateMax,
        neighborhood: neighborhood.trim() || null,
        distance_miles: distance === "" ? null : Number(distance),
        schedule_available: hasSchedule,
        schedule_summary: hasSchedule ? scheduleSummary.trim() || null : null,
      };
      const res = existing
        ? await supabase.from("providers").update(row).eq("id", id)
        : await supabase.from("providers").insert({ ...row, id, owner_id: userId });
      if (res.error) throw res.error;

      // Replace the child rows with what's in the form.
      for (const t of ["provider_pricing_notes", "provider_credentials", "provider_languages", "provider_availability"]) {
        const d = await supabase.from(t).delete().eq("provider_id", id);
        if (d.error) throw d.error;
      }
      const notes = lines(pricingNotes);
      if (notes.length) {
        const r = await supabase
          .from("provider_pricing_notes")
          .insert(notes.map((note, i) => ({ provider_id: id, note, sort_order: i })));
        if (r.error) throw r.error;
      }
      const lic = lines(licenses);
      if (lic.length) {
        const r = await supabase.from("provider_credentials").insert(lic.map((n) => ({ provider_id: id, name: n })));
        if (r.error) throw r.error;
      }
      if (languages.length) {
        const missing = languages.filter((l) => !allLanguages.some((x) => x.name === l));
        if (missing.length) {
          const r = await supabase
            .from("languages")
            .upsert(missing.map((n) => ({ name: n })), { onConflict: "name", ignoreDuplicates: true });
          if (r.error) throw r.error;
        }
        const { data: langRows, error } = await supabase.from("languages").select("id, name").in("name", languages);
        if (error) throw error;
        const r = await supabase
          .from("provider_languages")
          .insert((langRows ?? []).map((l) => ({ provider_id: id, language_id: l.id })));
        if (r.error) throw r.error;
      }
      if (hasSchedule) {
        const rows = scheduleToRows(schedule).map((r) => ({ provider_id: id, ...r }));
        if (rows.length) {
          const r = await supabase.from("provider_availability").insert(rows);
          if (r.error) throw r.error;
        }
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: QK.providers }),
        qc.invalidateQueries({ queryKey: QK.languages }),
      ]);
      toast.success(existing ? "Listing updated" : "Listing published");
      navigate({ to: "/providers/$providerId", params: { providerId: id } });
    } catch (err) {
      console.error(err);
      toast.error(`Couldn't save your listing. ${err instanceof Error ? err.message : ""}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    const { error } = await supabase.from("providers").delete().eq("id", existing.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing deleted");
    await qc.invalidateQueries({ queryKey: QK.providers });
    navigate({ to: "/providers" });
  }

  return (
    <section className="py-8">
      <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">Provider listing</span>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">
        {existing ? "Edit your listing" : "Offer care on CareConnect"}
      </h1>
      <p className="mt-1 max-w-[60ch] text-sm text-ink-soft">
        Parents search and filter by these details. Leave the price empty if you'd rather not list one — it will show as
        "Pricing unavailable".
        {existing ? (
          <>
            {" "}
            <Link to="/providers/$providerId" params={{ providerId: existing.id }} className="font-semibold text-primary-ink">
              View your public profile
            </Link>
          </>
        ) : null}
      </p>

      <form onSubmit={save} className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line">
          <h2 className="font-display text-2xl font-bold">Basics</h2>
          <div>
            <label className={label} htmlFor="l-name">
              Listing name
            </label>
            <input id="l-name" required value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="l-type">
                Care type
              </label>
              <select
                id="l-type"
                value={careType}
                onChange={(e) => setCareType(e.target.value as CareType)}
                className={field}
              >
                {CARE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="l-hood">
                Neighborhood
              </label>
              <input id="l-hood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={field} />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="l-blurb">
              One-line summary
            </label>
            <input
              id="l-blurb"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              className={field}
              placeholder="After-school care and homework help"
            />
          </div>
          <div>
            <label className={label} htmlFor="l-bio">
              About your care
            </label>
            <textarea id="l-bio" rows={5} value={bio} onChange={(e) => setBio(e.target.value)} className={field} />
          </div>
          <div>
            <span className={label}>Languages</span>
            <div className="flex flex-wrap gap-1.5">
              {langOptions.map((l) => {
                const on = languages.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLanguages((prev) => (on ? prev.filter((x) => x !== l) : [...prev, l]))}
                    className={`chip rounded-full px-3 py-1.5 text-xs font-semibold ${
                      on ? "bg-primary-soft text-primary-ink" : "border border-line text-ink-soft"
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={otherLang}
                onChange={(e) => setOtherLang(e.target.value)}
                className={field}
                placeholder="Add another language"
                aria-label="Add another language"
              />
              <button
                type="button"
                onClick={() => {
                  const v = otherLang.trim();
                  if (v && !languages.includes(v)) setLanguages((p) => [...p, v]);
                  setOtherLang("");
                }}
                className="rounded-2xl border border-line px-4 text-sm font-semibold text-ink-soft"
              >
                Add
              </button>
            </div>
          </div>
          <div>
            <label className={label} htmlFor="l-lic">
              Licenses & certifications (one per line)
            </label>
            <textarea
              id="l-lic"
              rows={3}
              value={licenses}
              onChange={(e) => setLicenses(e.target.value)}
              className={field}
              placeholder={"Pediatric CPR\nState background check (2026)"}
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              The Verified badge is added by CareConnect after review, not by the listing owner.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line">
            <h2 className="font-display text-2xl font-bold">Pricing</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={label} htmlFor="l-rate">
                  Daily rate ($)
                </label>
                <input id="l-rate" type="number" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className={field} />
              </div>
              <div>
                <label className={label} htmlFor="l-rmax">
                  Up to ($)
                </label>
                <input id="l-rmax" type="number" min={0} step="0.01" value={rateMax} onChange={(e) => setRateMax(e.target.value)} className={field} />
              </div>
              <div>
                <label className={label} htmlFor="l-dist">
                  Distance (mi)
                </label>
                <input id="l-dist" type="number" min={0} step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} className={field} />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="l-notes">
                Price details (one per line)
              </label>
              <textarea
                id="l-notes"
                rows={3}
                value={pricingNotes}
                onChange={(e) => setPricingNotes(e.target.value)}
                className={field}
                placeholder={"Full day (7am – 6pm): $190\nSibling rate: +$35"}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">Availability</h2>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={hasSchedule} onChange={(e) => setHasSchedule(e.target.checked)} />
                Show my schedule
              </label>
            </div>
            {hasSchedule ? (
              <>
                <ScheduleGrid
                  schedule={schedule}
                  editable
                  onToggle={(d, t) =>
                    setSchedule((prev) => prev.map((row, di) => (di === d ? row.map((v, ti) => (ti === t ? !v : v)) : row)))
                  }
                />
                <div>
                  <label className={label} htmlFor="l-sum">
                    Hours summary
                  </label>
                  <input
                    id="l-sum"
                    value={scheduleSummary}
                    onChange={(e) => setScheduleSummary(e.target.value)}
                    className={field}
                    placeholder="Mon–Fri · 7am–6pm"
                  />
                </div>
              </>
            ) : (
              <p className="rounded-2xl bg-clay-soft px-4 py-3 text-sm font-medium text-clay">
                Your listing will say "Schedule unavailable" and won't appear in schedule matches.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={busy}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-soft hover:bg-primary-ink disabled:opacity-50"
            >
              {busy ? "Saving…" : existing ? "Save changes" : "Publish listing"}
            </button>
            {existing ? (
              confirmDelete ? (
                <span className="flex items-center gap-2 text-sm">
                  Delete this listing and its reviews?
                  <button type="button" disabled={busy} onClick={remove} className="font-semibold text-clay">
                    Yes, delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="font-semibold text-ink-soft">
                    Cancel
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="ml-auto text-sm font-semibold text-clay">
                  Delete listing
                </button>
              )
            ) : null}
          </div>
        </div>
      </form>
    </section>
  );
}
