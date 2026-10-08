import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, ErrorState, LoadingState } from "@/components/NavBar";
import { ProviderPhoto, VerifiedBadge } from "@/components/ProviderCard";
import { ScheduleCompare } from "@/components/ScheduleGrid";
import { supabase } from "@/integrations/supabase/client";
import { distanceLabel, gapCount, overlapCount, priceLabel, type Provider, type Scores } from "@/lib/model";
import { useApp } from "@/lib/app-state";
import { QK, useParents, useProvider } from "@/lib/data";

export const Route = createFileRoute("/providers/$providerId")({
  head: () => ({
    meta: [
      { title: "Provider profile — CareConnect" },
      { name: "description", content: "Pricing, schedule, ratings and reviews for a CareConnect provider." },
    ],
  }),
  component: ProviderProfilePage,
});

function ProviderProfilePage() {
  const { providerId } = Route.useParams();
  const { provider, isLoading, error } = useProvider(providerId);
  return (
    <AppShell>
      {isLoading ? (
        <LoadingState label="Loading provider…" />
      ) : error ? (
        <ErrorState error={error} />
      ) : !provider ? (
        <p className="py-16 text-center text-ink-soft">
          That provider isn't listed.{" "}
          <Link to="/providers" className="font-semibold text-primary-ink">
            Back to providers
          </Link>
        </p>
      ) : (
        <ProviderProfile provider={provider} />
      )}
    </AppShell>
  );
}

function ProviderProfile({ provider }: { provider: Provider }) {
  const { schedule, isFavorite, toggleFavorite, isConnected, toggleConnection, userId, parentId } = useApp();
  const parents = useParents();
  const qc = useQueryClient();
  const isOwner = !!userId && provider.ownerId === userId;
  const usedThem = !!parentId && provider.pastFamilies.includes(parentId);

  async function toggleUsed() {
    if (!parentId) return;
    const { error } = usedThem
      ? await supabase.from("provider_past_families").delete().match({ provider_id: provider.id, parent_id: parentId })
      : await supabase.from("provider_past_families").insert({ provider_id: provider.id, parent_id: parentId });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: QK.providers });
  }
  const fav = isFavorite(provider.id);

  const covered = provider.schedule ? overlapCount(schedule, provider.schedule) : 0;
  const gaps = provider.schedule ? gapCount(schedule, provider.schedule) : 0;

  const avg = (key: "experience" | "values" | "communication" | "safety") =>
    provider.reviews.length
      ? (
          provider.reviews.reduce((s, r) => s + r.scores[key], 0) / provider.reviews.length
        ).toFixed(1)
      : "—";

  return (
    <>
      <div className="py-8">
        <Link to="/providers" className="text-sm font-semibold text-primary-ink">
          ← Back to providers
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <section className="overflow-hidden rounded-[28px] bg-surface ring-1 ring-line">
              <ProviderPhoto provider={provider} className="h-64 w-full sm:h-80" />
              <div className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="font-display text-4xl font-bold tracking-tight">{provider.name}</h1>
                      <VerifiedBadge verified={provider.verified} />
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {provider.careType} · {provider.neighborhood} · {distanceLabel(provider.distance)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isOwner ? (
                      <Link
                        to="/listing"
                        className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-primary"
                      >
                        Edit my listing
                      </Link>
                    ) : null}
                    <button
                      onClick={() => toggleFavorite(provider.id)}
                      className={`chip rounded-full px-4 py-2 text-sm font-semibold ${
                        fav ? "bg-clay-soft text-clay" : "border border-line text-ink-soft hover:border-primary"
                      }`}
                    >
                      {fav ? "♥ In favorites" : "♡ Add to favorites"}
                    </button>
                    <a
                      href="#compare"
                      className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink"
                    >
                      Compare schedule
                    </a>
                  </div>
                </div>

                <p className="mt-5 max-w-[68ch] text-ink-soft text-pretty">{provider.bio}</p>

                <div className="mt-5 flex flex-wrap gap-1.5">
                  {provider.languages.map((l) => (
                    <span
                      key={l}
                      className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-ink-soft"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            <section id="compare" className="scroll-mt-24 rounded-[28px] bg-surface p-6 ring-1 ring-line">
              <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">
                Compare schedule
              </span>
              <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
                Your week vs. {provider.name}
              </h2>
              {provider.schedule ? (
                <>
                  <div className="mt-5">
                    <ScheduleCompare
                      parent={schedule}
                      provider={provider.schedule}
                      providerLabel={provider.name.split(" ")[0].toUpperCase()}
                    />
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-leaf-soft px-4 py-3">
                    <p className="text-sm font-medium text-leaf-ink">
                      {covered} of your {covered + gaps} needed blocks are covered
                      {gaps > 0 ? ` — ${gaps} gap${gaps === 1 ? "" : "s"} to fill.` : " — a full match."}
                    </p>
                    <Link
                      to="/schedule"
                      className="rounded-full bg-leaf px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-leaf-ink"
                    >
                      Open my schedule
                    </Link>
                  </div>
                </>
              ) : (
                <p className="mt-4 rounded-2xl bg-clay-soft px-4 py-3 text-sm font-medium text-clay">
                  Schedule unavailable — this provider is excluded from schedule matches.
                </p>
              )}
            </section>

            <section className="rounded-[28px] bg-surface p-6 ring-1 ring-line">
              <h2 className="font-display text-2xl font-bold tracking-tight">Ratings & reviews</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ["Experience", "experience"],
                    ["Values", "values"],
                    ["Communication", "communication"],
                    ["Safety", "safety"],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key} className="rounded-2xl bg-background p-4">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">{label}</p>
                    <p className="mt-1 font-display text-2xl font-bold">{avg(key)}</p>
                  </div>
                ))}
              </div>
              {provider.reviews.length === 0 ? (
                <p className="mt-4 text-sm text-ink-soft">No reviews yet.</p>
              ) : null}
              <div className="mt-5 space-y-4">
                {provider.reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-background p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to="/parents/$parentId"
                        params={{ parentId: r.parentId }}
                        className="font-semibold hover:text-primary-ink"
                      >
                        {r.author}
                        {r.parentId === parentId ? " (you)" : ""}
                      </Link>
                      <p className="text-xs text-ink-faint">{r.date}</p>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-ink-faint">
                      Experience {r.scores.experience} · Values {r.scores.values} · Communication{" "}
                      {r.scores.communication} · Safety {r.scores.safety}
                    </p>
                    {r.text ? <p className="mt-2 text-sm text-ink-soft text-pretty">{r.text}</p> : null}
                  </div>
                ))}
              </div>
              {!isOwner ? <ReviewForm provider={provider} /> : null}
            </section>

            <section className="rounded-[28px] bg-surface p-6 ring-1 ring-line">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl font-bold tracking-tight">Past families</h2>
                {!isOwner ? (
                  <button
                    onClick={toggleUsed}
                    className={`chip rounded-full px-4 py-2 text-sm font-semibold ${
                      usedThem ? "bg-leaf-soft text-leaf-ink" : "border border-line text-ink-soft hover:border-primary"
                    }`}
                  >
                    {usedThem ? "✓ We've used this provider" : "We've used this provider"}
                  </button>
                ) : null}
              </div>
              {provider.pastFamilies.length === 0 ? (
                <p className="mt-3 text-sm text-ink-soft">No past families listed yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {provider.pastFamilies.map((pid) => {
                    const parent = parents.find((x) => x.id === pid);
                    if (!parent) return null;
                    const connected = isConnected(pid);
                    const isMe = pid === parentId;
                    return (
                      <li
                        key={pid}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background p-4"
                      >
                        <div>
                          <Link
                            to="/parents/$parentId"
                            params={{ parentId: pid }}
                            className="font-semibold hover:text-primary-ink"
                          >
                            {parent.name}
                          </Link>
                          <p className="text-sm text-ink-soft">
                            {[parent.neighborhood, parent.children.map((c) => `${c.name} (${c.age ?? "?"})`).join(", ")]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        {isMe ? (
                          <span className="text-sm font-semibold text-ink-faint">You</span>
                        ) : (
                        <button
                          onClick={() => toggleConnection(pid)}
                          className={`chip rounded-full px-4 py-2 text-sm font-semibold ${
                            connected
                              ? "bg-leaf-soft text-leaf-ink"
                              : "bg-primary text-primary-soft hover:bg-primary-ink"
                          }`}
                        >
                          {connected ? "Connected" : "Connect"}
                        </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-6 lg:col-span-4">
            <section className="rounded-[28px] bg-surface p-6 ring-1 ring-line">
              <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">Pricing</p>
              {provider.dailyRate === null ? (
                <p className="mt-2 rounded-2xl bg-clay-soft px-3 py-2 text-sm font-semibold text-clay">
                  Pricing unavailable
                </p>
              ) : (
                <>
                  <p className="mt-1 font-display text-3xl font-bold">{priceLabel(provider)}</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                    {provider.pricingNotes.map((n, i) => (
                      <li key={i}>· {n}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="rounded-[28px] bg-surface p-6 ring-1 ring-line">
              <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">Hours</p>
              <p
                className={`mt-1 font-semibold ${provider.schedule ? "" : "text-clay"}`}
              >
                {provider.scheduleSummary}
              </p>
              <p className="mt-4 font-mono text-xs uppercase tracking-wider text-ink-faint">
                Licenses & certifications
              </p>
              {provider.licenses.length ? (
                <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
                  {provider.licenses.map((l, i) => (
                    <li key={i}>· {l}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-soft">None on file.</p>
              )}
            </section>

            <section className="rounded-[28px] bg-surface p-6 ring-1 ring-line">
              <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">Location</p>
              <p className="mt-1 font-semibold">
                {provider.neighborhood} · {distanceLabel(provider.distance)}
              </p>
              <div className="mt-3 grid h-40 place-items-center rounded-2xl bg-leaf-soft">
                <span className="font-mono text-xs uppercase tracking-[0.15em] text-leaf-ink/60">
                  Map placeholder
                </span>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

const SCORE_FIELDS: [keyof Scores, string][] = [
  ["experience", "Experience"],
  ["values", "Values"],
  ["communication", "Communication"],
  ["safety", "Safety"],
];

function ReviewForm({ provider }: { provider: Provider }) {
  const { parentId } = useApp();
  const qc = useQueryClient();
  const mine = provider.reviews.find((r) => r.parentId === parentId);
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState<Scores>(
    mine?.scores ?? { experience: 5, values: 5, communication: 5, safety: 5 },
  );
  const [text, setText] = useState(mine?.text ?? "");
  const [busy, setBusy] = useState(false);

  if (!parentId) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("reviews").upsert(
      {
        provider_id: provider.id,
        parent_id: parentId,
        body: text.trim() || null,
        score_experience: scores.experience,
        score_values: scores.values,
        score_communication: scores.communication,
        score_safety: scores.safety,
        reviewed_on: new Date().toISOString().slice(0, 10),
      },
      { onConflict: "provider_id,parent_id" },
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(mine ? "Review updated" : "Review posted");
    setOpen(false);
    qc.invalidateQueries({ queryKey: QK.providers });
  }

  async function remove() {
    if (!mine) return;
    setBusy(true);
    const { error } = await supabase.from("reviews").delete().eq("id", mine.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Review deleted");
    setOpen(false);
    setText("");
    qc.invalidateQueries({ queryKey: QK.providers });
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-soft hover:bg-primary-ink"
      >
        {mine ? "Edit your review" : "Write a review"}
      </button>
    );

  return (
    <form onSubmit={save} className="mt-5 space-y-4 rounded-2xl bg-background p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SCORE_FIELDS.map(([key, label]) => (
          <label key={key} className="text-sm">
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-ink-faint">{label}</span>
            <select
              value={scores[key]}
              onChange={(e) => setScores((s) => ({ ...s, [key]: Number(e.target.value) }))}
              className="w-full rounded-xl bg-surface px-3 py-2 ring-1 ring-line"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="What was your experience like?"
        className="w-full rounded-xl bg-surface px-3 py-2 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-soft disabled:opacity-50"
        >
          {mine ? "Save review" : "Post review"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft">
          Cancel
        </button>
        {mine ? (
          <button type="button" disabled={busy} onClick={remove} className="ml-auto text-sm font-semibold text-clay">
            Delete review
          </button>
        ) : null}
      </div>
    </form>
  );
}
