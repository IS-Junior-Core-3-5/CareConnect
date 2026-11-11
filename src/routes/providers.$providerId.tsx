import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { RequestCare } from "@/components/CareBookings";
import { AppShell, ErrorState, LoadingState } from "@/components/NavBar";
import { ProviderListingBadge, ProviderPhoto } from "@/components/ProviderCard";
import { demoActivityFor } from "@/components/photos";
import {
  ExternalLocation,
  OfficialLink,
  PublishedSchedule,
  SourceNote,
} from "@/components/ExternalProfileDetails";
import { ScheduleCompare } from "@/components/ScheduleGrid";
import { RatingSummary, Stars, StarInput } from "@/components/StarRating";
import { supabase } from "@/integrations/supabase/client";
import {
  formatDate,
  gapCount,
  overlapCount,
  priceLabel,
  providerDisplayAddress,
  type Provider,
  type Review,
  type Scores,
} from "@/lib/model";
import {
  previewSchedule,
  supportsPracticeRequest,
  usePreviewFavorites,
} from "@/lib/provider-preview";
import { useApp } from "@/lib/app-state";
import { QK, useParents, usePreviewProviders, useProvider } from "@/lib/data";

export const Route = createFileRoute("/providers/$providerId")({
  head: () => ({
    meta: [
      { title: "Provider profile — CareConnect" },
      {
        name: "description",
        content: "Pricing, schedule, ratings and reviews for a CareConnect provider.",
      },
    ],
  }),
  component: ProviderProfilePage,
});

function ProviderProfilePage() {
  const { providerId } = Route.useParams();
  const { preview } = Route.useSearch();
  const { userId } = useApp();
  const live = useProvider(providerId, !!userId, !preview);
  const previewQuery = usePreviewProviders(!!preview);
  const { provider, isLoading, error } = preview
    ? { ...previewQuery, provider: previewQuery.data?.find((p) => p.id === providerId) }
    : live;
  return (
    <AppShell publicPage>
      {isLoading ? (
        <LoadingState label="Loading provider…" />
      ) : error ? (
        <ErrorState error={error} />
      ) : !provider ? (
        <p className="py-16 text-center text-ink-soft">
          That provider isn't listed.{" "}
          <Link to="/providers" search={{ preview }} className="font-semibold text-primary-ink">
            Back to providers
          </Link>
        </p>
      ) : (
        <ProviderProfile key={providerId} provider={provider} preview={!!preview} />
      )}
    </AppShell>
  );
}

function ProviderProfile({ provider, preview }: { provider: Provider; preview: boolean }) {
  const { schedule: savedSchedule, isFavorite, toggleFavorite, userId, parentId } = useApp();
  const schedule = preview && !userId ? previewSchedule : savedSchedule;
  const previewFavorites = usePreviewFavorites(preview);
  const parents = useParents(!!userId && !preview);
  const qc = useQueryClient();
  const isOwner = !!userId && provider.ownerId === userId;
  const usedThem = !!parentId && provider.pastFamilies.includes(parentId);

  async function toggleUsed() {
    if (!parentId) return;
    const { error } = usedThem
      ? await supabase
          .from("provider_past_families")
          .delete()
          .match({ provider_id: provider.id, parent_id: parentId })
      : await supabase
          .from("provider_past_families")
          .insert({ provider_id: provider.id, parent_id: parentId });
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: QK.providers });
  }
  const fav = preview ? previewFavorites.favorites.includes(provider.id) : isFavorite(provider.id);
  const toggleSaved = preview ? previewFavorites.toggle : toggleFavorite;
  const external = provider.listingOrigin === "external";
  const activity = demoActivityFor(provider);
  const details = provider.externalProfile;

  const covered = provider.schedule ? overlapCount(schedule, provider.schedule) : 0;
  const gaps = provider.schedule ? gapCount(schedule, provider.schedule) : 0;

  const avg = (key: "experience" | "values" | "communication" | "safety") =>
    provider.reviews.length
      ? (provider.reviews.reduce((s, r) => s + r.scores[key], 0) / provider.reviews.length).toFixed(
          1,
        )
      : "—";

  const overallFor = (r: Review) =>
    (r.scores.experience + r.scores.values + r.scores.communication + r.scores.safety) / 4;

  const distribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: provider.reviews.filter((r) => Math.round(overallFor(r)) === stars).length,
  }));

  return (
    <>
      <div className="py-8">
        <Link
          to="/providers"
          search={preview ? { preview: true } : {}}
          className="text-sm font-semibold text-primary-ink"
        >
          ← Back to providers
        </Link>

        {!preview || supportsPracticeRequest(provider.id) ? (
          <RequestCare provider={provider} practice={preview} />
        ) : null}

        <div className="mt-4 grid gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-6 lg:col-span-8">
            <section
              className={`overflow-hidden rounded-3xl bg-surface ring-1 ring-line sm:rounded-[28px] ${provider.isDemo ? "p-5 sm:flex sm:items-start sm:gap-6 sm:p-6" : ""}`}
            >
              <ProviderPhoto
                provider={provider}
                className={
                  provider.isDemo
                    ? "aspect-[4/3] w-full shrink-0 rounded-2xl sm:aspect-square sm:w-44 lg:w-52"
                    : external
                      ? "aspect-[16/9] w-full rounded-none lg:aspect-auto lg:h-72"
                      : "h-56 w-full rounded-none sm:h-80"
                }
              />
              <div className={provider.isDemo ? "mt-4 min-w-0 flex-1 sm:mt-0" : "p-5 sm:p-6"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                        {provider.name}
                      </h1>
                      <ProviderListingBadge provider={provider} />
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {[provider.careType, providerDisplayAddress(provider)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {provider.isDemo ? (
                      <p className="mt-1 text-xs text-ink-soft">
                        Fictional profile with generated imagery.
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <RatingSummary rating={provider.rating} reviewCount={provider.reviewCount} />
                      {provider.reviewCount ? (
                        <a
                          href="#reviews"
                          className="text-sm font-semibold text-primary-ink hover:underline"
                        >
                          Read {provider.reviewCount === 1 ? "review" : "reviews"}
                        </a>
                      ) : null}
                    </div>
                    {/* Price and hours live in the sidebar on desktop; on phones show them up top. */}
                    <div className="mt-3 flex flex-wrap gap-1.5 lg:hidden">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          provider.dailyRate === null && !details?.pricing
                            ? "bg-clay-soft text-clay"
                            : "bg-primary-soft text-primary-ink"
                        }`}
                      >
                        {priceLabel(provider)}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          provider.schedule
                            ? "bg-background text-ink-soft"
                            : "bg-clay-soft text-clay"
                        }`}
                      >
                        {provider.scheduleSummary}
                      </span>
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    {isOwner ? (
                      <Link
                        to="/listing"
                        className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft hover:border-primary"
                      >
                        Edit my listing
                      </Link>
                    ) : null}
                    <button
                      onClick={() => toggleSaved(provider.id)}
                      className={`chip flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold sm:flex-none ${
                        fav
                          ? "bg-clay-soft text-clay"
                          : "border border-line text-ink-soft hover:border-primary"
                      }`}
                    >
                      {fav ? "♥ In favorites" : "♡ Add to favorites"}
                    </button>
                    <a
                      href="#compare"
                      className="flex-1 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink sm:flex-none"
                    >
                      Compare schedule
                    </a>
                  </div>
                </div>

                <p className="mt-5 max-w-[68ch] text-ink-soft text-pretty">{provider.bio}</p>
                {details?.photos ? (
                  <div className="mt-4">
                    <OfficialLink href={details.photos.url}>{details.photos.label}</OfficialLink>
                    <SourceNote {...details.photos} />
                  </div>
                ) : null}
                {external ? (
                  <div className="mt-5 rounded-2xl bg-leaf-soft p-4 text-sm text-ink-soft">
                    <p>
                      Contact this provider directly to confirm current availability, pricing, and
                      terms. CareConnect does not book care with this provider.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      {provider.contactUrl ? (
                        <a
                          href={provider.contactUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary-ink underline"
                        >
                          {details && "serviceArea" in details.location
                            ? "Request a sitter"
                            : "Contact or request a tour"}{" "}
                          ↗
                        </a>
                      ) : null}
                      {provider.websiteUrl ? (
                        <a
                          href={provider.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary-ink underline"
                        >
                          Official website ↗
                        </a>
                      ) : null}
                    </div>
                    {provider.sourceUrl ? (
                      <p className="mt-3 text-xs">
                        Source:{" "}
                        <a
                          href={provider.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          provider website ↗
                        </a>{" "}
                        · Checked {provider.checkedOn}
                      </p>
                    ) : null}
                  </div>
                ) : null}

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
            {activity ? (
              <figure className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
                <img
                  src={activity.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="aspect-video w-full object-cover"
                />
                <figcaption className="px-5 py-3 text-sm text-ink-soft">
                  <span className="font-semibold text-ink">{provider.name}</span>
                  <span> · {activity.caption} · Generated image</span>
                </figcaption>
              </figure>
            ) : null}

            <section
              id="compare"
              className="scroll-mt-24 rounded-3xl bg-surface p-5 ring-1 ring-line sm:rounded-[28px] sm:p-6"
            >
              <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">
                Compare schedule
              </span>
              <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
                Your week vs. {provider.name}
              </h2>
              {details ? (
                <PublishedSchedule
                  hours={details.hours}
                  schedule={schedule}
                  signedIn={!!parentId}
                  contactUrl={provider.contactUrl}
                />
              ) : provider.schedule ? (
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
                      {gaps > 0
                        ? ` — ${gaps} gap${gaps === 1 ? "" : "s"} to fill.`
                        : " — a full match."}
                    </p>
                    {preview && !userId ? (
                      <span className="text-sm text-leaf-ink">Uses an example family schedule</span>
                    ) : (
                      <Link
                        to="/schedule"
                        className="rounded-full bg-leaf px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-leaf-ink"
                      >
                        Open my schedule
                      </Link>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-4 rounded-2xl bg-clay-soft px-4 py-3 text-sm font-medium text-clay">
                  Schedule unavailable — this provider is excluded from schedule matches.
                </p>
              )}
            </section>

            <section
              id="reviews"
              hidden={preview}
              className="scroll-mt-24 rounded-3xl bg-surface p-5 ring-1 ring-line sm:rounded-[28px] sm:p-6"
            >
              {details?.reviews ? (
                <div className="mb-5 rounded-2xl bg-background p-4">
                  <h2 className="mb-2 font-display text-xl font-bold">External reviews</h2>
                  <OfficialLink href={details.reviews.url}>{details.reviews.label}</OfficialLink>
                  <SourceNote {...details.reviews} />
                </div>
              ) : null}
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight">
                    CareConnect reviews
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft">
                    {!userId
                      ? "Sign in to read or write CareConnect reviews."
                      : provider.reviewCount
                        ? `Rated by ${provider.reviewCount} ${provider.reviewCount === 1 ? "family" : "families"} who used ${provider.name}.`
                        : `No ratings yet — be the first family to rate ${provider.name}.`}
                  </p>
                </div>
              </div>

              {provider.reviewCount ? (
                <div className="mt-5 grid gap-5 rounded-2xl bg-background p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-5">
                  <div className="flex flex-col items-center justify-center gap-1 sm:border-r sm:border-line sm:pr-6">
                    <p className="font-display text-5xl font-bold leading-none">
                      {provider.rating.toFixed(1)}
                    </p>
                    <Stars value={provider.rating} size="lg" />
                    <p className="text-xs text-ink-faint">
                      {provider.reviewCount} {provider.reviewCount === 1 ? "review" : "reviews"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {distribution.map(({ stars, count }) => {
                      const pct = Math.round((count / provider.reviewCount) * 100);
                      return (
                        <div key={stars} className="flex items-center gap-2 text-xs">
                          <span className="w-8 shrink-0 text-right font-mono text-ink-faint">
                            {stars}★
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-sun"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-5 shrink-0 text-right font-mono text-ink-faint">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {provider.reviewCount ? (
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
                      <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
                        {label}
                      </p>
                      <p className="mt-1 font-display text-2xl font-bold">{avg(key)}</p>
                      <Stars value={Number(avg(key)) || 0} size="sm" className="mt-1" />
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                {provider.reviews.map((r) => (
                  <div key={r.id} className="rounded-2xl bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <Link
                        to="/parents/$parentId"
                        params={{ parentId: r.parentId }}
                        className="font-semibold hover:text-primary-ink"
                      >
                        {r.author}
                        {r.parentId === parentId ? " (you)" : ""}
                      </Link>
                      <div className="flex items-center gap-2">
                        <Stars value={overallFor(r)} size="sm" />
                        <span className="font-mono text-xs font-semibold text-ink-soft">
                          {overallFor(r).toFixed(1)}
                        </span>
                        <p className="text-xs text-ink-faint">{r.date}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {SCORE_FIELDS.map(([key, label]) => (
                        <span
                          key={key}
                          className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-soft ring-1 ring-line"
                        >
                          {label} <span className="font-semibold text-ink">{r.scores[key]}</span>
                        </span>
                      ))}
                    </div>
                    {r.text ? (
                      <p className="mt-2 text-sm text-ink-soft text-pretty">{r.text}</p>
                    ) : null}
                  </div>
                ))}
              </div>
              {!preview && !isOwner ? <ReviewForm provider={provider} /> : null}
            </section>

            {parentId && !preview ? (
              <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:rounded-[28px] sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-2xl font-bold tracking-tight">Past families</h2>
                  {!isOwner ? (
                    <button
                      onClick={toggleUsed}
                      className={`chip rounded-full px-4 py-2 text-sm font-semibold ${
                        usedThem
                          ? "bg-leaf-soft text-leaf-ink"
                          : "border border-line text-ink-soft hover:border-primary"
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
                              {[
                                parent.children
                                  .map((c) => `${c.name} (${c.age ?? "?"})`)
                                  .join(", "),
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          {isMe ? (
                            <span className="text-sm font-semibold text-ink-faint">You</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ) : null}
          </div>

          <aside className="min-w-0 space-y-6 lg:col-span-4">
            <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:rounded-[28px] sm:p-6">
              <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">Pricing</p>
              {details?.pricing ? (
                <div className="mt-2 text-sm">
                  <p className="font-semibold">{details.pricing.summary}</p>
                  <p className="mt-1 text-ink-soft">{details.pricing.detail}</p>
                  <p className="mt-2">
                    <OfficialLink href={details.pricing.sourceUrl}>
                      {details.pricing.linkLabel}
                    </OfficialLink>
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Checked {formatDate(details.pricing.checkedOn)}
                  </p>
                </div>
              ) : provider.dailyRate === null ? (
                <p className="mt-2 rounded-2xl bg-clay-soft px-3 py-2 text-sm font-semibold text-clay">
                  {priceLabel(provider)}
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

            <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:rounded-[28px] sm:p-6">
              <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">
                {external ? "Schedule information" : "Care availability"}
              </p>
              <p className={`mt-1 font-semibold ${provider.schedule ? "" : "text-clay"}`}>
                {provider.scheduleSummary}
              </p>
              {details?.training ? (
                <div className="mt-4">
                  <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">
                    Provider-reported training
                  </p>
                  <p className="mt-2 text-sm text-ink-soft">{details.training.text}</p>
                  <SourceNote {...details.training} />
                </div>
              ) : !external ? (
                <>
                  <p className="mt-4 font-mono text-xs uppercase tracking-wider text-ink-faint">
                    Licenses & certifications
                  </p>
                  {provider.licenses.length ? (
                    <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
                      {provider.licenses.map((license) => (
                        <li key={license}>· {license}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-ink-soft">None on file.</p>
                  )}
                </>
              ) : null}
            </section>

            <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:rounded-[28px] sm:p-6">
              <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">Contact</p>
              {provider.isDemo ? (
                <p className="mt-1 text-sm text-ink-soft">{provider.phone} · Sample phone</p>
              ) : provider.phone ? (
                <a
                  className="mt-1 block font-semibold text-primary-ink hover:underline"
                  href={`tel:${provider.phone.replace(/[^+\d]/g, "")}`}
                >
                  {provider.phone}
                </a>
              ) : (
                <p className="mt-1 text-sm text-ink-soft">Phone not provided</p>
              )}
              <p className="mt-4 font-mono text-xs uppercase tracking-wider text-ink-faint">
                {provider.isDemo ? "Map reference" : "Location"}
              </p>
              {details ? (
                <ExternalLocation provider={provider} location={details.location} />
              ) : (
                <p className="mt-1 font-semibold">{provider.address || "Address not provided"}</p>
              )}
              {provider.isDemo ? (
                <p className="mt-2 text-sm text-ink-soft">
                  Public landmark used to calculate distance.
                </p>
              ) : null}
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

  const overall = (scores.experience + scores.values + scores.communication + scores.safety) / 4;

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
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(mine ? "Review updated" : "Review posted");
    setOpen(false);
    qc.invalidateQueries({ queryKey: QK.providers });
  }

  async function remove() {
    if (!mine) return;
    setBusy(true);
    const { error } = await supabase.from("reviews").delete().eq("id", mine.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
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
      <div>
        <p className="font-display text-lg font-bold tracking-tight">
          {mine ? "Your review" : "Rate this provider"}
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">
          Tap the stars for each category. Your overall score updates as you go.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SCORE_FIELDS.map(([key, label]) => (
          <StarInput
            key={key}
            label={label}
            value={scores[key]}
            onChange={(n) => setScores((s) => ({ ...s, [key]: n }))}
            disabled={busy}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm ring-1 ring-line">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
          Overall
        </span>
        <Stars value={overall} size="sm" />
        <span className="font-semibold text-ink">{overall.toFixed(1)}</span>
        <span className="text-ink-faint">out of 5</span>
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
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft"
        >
          Cancel
        </button>
        {mine ? (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="ml-auto text-sm font-semibold text-clay"
          >
            Delete review
          </button>
        ) : null}
      </div>
    </form>
  );
}
