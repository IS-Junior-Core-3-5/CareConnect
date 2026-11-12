import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
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
  useAdminAiDetail,
  useClearAdminAiRecommendations,
  type AdminAiRecommendation,
  type AdminAiRecommendationDetails,
} from "@/lib/admin-data";
import { formatDate } from "@/lib/model";

export const Route = createFileRoute("/admin/ai/$parentId")({
  head: () => ({
    meta: [
      { title: "Admin AI recommendations — CareConnect" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAiDetailPage,
});

const DETAIL_FIELDS: { key: keyof AdminAiRecommendationDetails; label: string }[] = [
  { key: "why", label: "Why this fits" },
  { key: "tradeoffs", label: "Tradeoffs" },
  { key: "schedule", label: "Schedule fit" },
  { key: "cost", label: "Cost" },
  { key: "trust", label: "Trust" },
];

function dateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function rateLabel(rec: AdminAiRecommendation) {
  if (rec.daily_rate === null) return "Pricing unavailable";
  if (rec.daily_rate_max !== null && rec.daily_rate_max !== rec.daily_rate) {
    return `$${rec.daily_rate}–$${rec.daily_rate_max} / day`;
  }
  return `$${rec.daily_rate} / day`;
}

function RecommendationCard({ rec }: { rec: AdminAiRecommendation }) {
  const details = rec.details ?? {};
  return (
    <article className="rounded-3xl bg-background p-4 ring-1 ring-line sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ink px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-surface">
              #{rec.rank}
            </span>
            <h3 className="font-display text-lg font-bold tracking-tight">
              {rec.is_public ? (
                <Link
                  to="/providers/$providerId"
                  params={{ providerId: rec.provider_id }}
                  className="hover:text-primary-ink hover:underline"
                >
                  {rec.provider_name}
                </Link>
              ) : (
                rec.provider_name
              )}
            </h3>
            {rec.verified ? (
              <span className="rounded-full bg-leaf-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-leaf-ink">
                Verified
              </span>
            ) : null}
            {rec.is_public ? null : (
              <span className="rounded-full bg-clay-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-clay">
                Archived
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-soft">{rec.care_type}</p>
        </div>
        {rec.match_score !== null ? (
          <span className="rounded-full bg-primary-soft px-3 py-1.5 font-mono text-xs font-semibold text-primary-ink">
            {rec.match_score}% match
          </span>
        ) : null}
      </div>

      <p className="mt-3 max-w-[80ch] text-sm font-medium">{rec.headline}</p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-soft">
        <span>
          {rec.review_count > 0
            ? `${rec.rating} ★ · ${rec.review_count} review${rec.review_count === 1 ? "" : "s"}`
            : "No reviews yet"}
        </span>
        <span>{rateLabel(rec)}</span>
        {rec.address ? <span>{rec.address}</span> : null}
        <span className="font-mono text-ink-faint">{rec.provider_id}</span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {DETAIL_FIELDS.map((field) => {
          const text = details[field.key];
          if (!text) return null;
          return (
            <Field key={field.key} label={field.label}>
              <p className="text-ink-soft text-pretty">{text}</p>
            </Field>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        {rec.model ? `${rec.model} · ` : ""}
        Generated {dateTime(rec.created_at)}
      </p>
    </article>
  );
}

function AdminAiDetailPage() {
  const { parentId } = Route.useParams();
  const query = useAdminAiDetail(parentId);
  const clearMutation = useClearAdminAiRecommendations();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (query.isLoading) return <LoadingState label="Loading AI recommendations…" />;

  if (query.error) {
    return (
      <div>
        <ErrorState error={query.error} />
        <p className="text-sm text-ink-soft">
          The admin AI migration may not be applied yet. Run{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
            supabase/migrations/20261114000000_admin_ai.sql
          </code>{" "}
          in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  const detail = query.data;
  if (!detail) return null;

  const { parent, set, recommendations, chat, context } = detail;

  function clearRecommendations() {
    clearMutation.mutate(parent.id, {
      onSuccess: (deleted) => {
        toast.success(
          `Cleared ${deleted} saved match${deleted === 1 ? "" : "es"}. The family will get a fresh set on their next visit.`,
        );
        setConfirmOpen(false);
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Couldn't clear the recommendation set",
        );
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/ai" className="text-sm font-semibold text-ink-soft hover:text-ink">
          ← Back to AI recommendations
        </Link>
        <Link
          to="/admin/parents/$parentId"
          params={{ parentId: parent.id }}
          className="text-sm font-semibold text-primary-ink hover:underline"
        >
          Open family support view →
        </Link>
      </div>

      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {parent.name}
              </h2>
              <span className="rounded-full bg-sun-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                Private admin view
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-ink-faint">{parent.id}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
              {parent.email ? (
                <a href={`mailto:${parent.email}`} className="text-primary-ink hover:underline">
                  {parent.email}
                </a>
              ) : (
                <span>No email on file</span>
              )}
              <span>{parent.neighborhood || "No neighborhood"}</span>
              <span>
                {parent.children_count} {parent.children_count === 1 ? "child" : "children"}
              </span>
              <span>
                {parent.has_preferences
                  ? `Preferences saved ${dateTime(parent.preferences_updated_at)}`
                  : "No saved preferences"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Saved matches"
          value={set.recommendation_count}
          hint={set.generated_at ? `Generated ${dateTime(set.generated_at)}` : "No saved set"}
        />
        <Metric
          label="AI chat"
          value={chat.messages}
          hint={`${chat.user_messages} parent · ${chat.assistant_messages} assistant`}
        />
        <Metric label="Favorites" value={context.favorites_count} hint="Saved providers" />
        <Metric
          label="Bookings"
          value={context.bookings_total}
          hint={`${context.bookings_confirmed} confirmed`}
        />
      </div>

      <Section
        title="Saved recommendation set"
        description="The matches the family currently sees, including the AI's explanation for each one."
      >
        {set.recommendation_count > 0 ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-sun-soft/50 p-4 ring-1 ring-sun/20">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                What the AI saw this family needing
              </span>
              <p className="mt-1 text-sm text-ink-soft text-pretty">
                {set.summary || "No summary was saved for this set."}
              </p>
              <p className="mt-2 text-xs text-ink-faint">
                {set.model ? `${set.model} · ` : ""}
                Generated {dateTime(set.generated_at)}
              </p>
            </div>
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <RecommendationCard key={rec.provider_id} rec={rec} />
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-2xl bg-background p-4 text-sm text-ink-soft ring-1 ring-line">
            This family has no saved recommendation set right now. They get a fresh set the next
            time they open AI recommendations.
          </p>
        )}
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title="AI chat activity"
          description="Usage only. Message content stays private and is not shown to admins."
        >
          {chat.messages > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Messages" value={chat.messages} />
              <Metric
                label="Last message"
                value={<span className="text-lg">{dateTime(chat.last_at)}</span>}
              />
              <Metric label="Parent messages" value={chat.user_messages} />
              <Metric label="Assistant messages" value={chat.assistant_messages} />
              <div className="sm:col-span-2">
                <Field label="Models">
                  {chat.models.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {chat.models.map((model, index) => (
                        <span
                          key={`${model ?? "unknown"}-${index}`}
                          className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-ink-soft ring-1 ring-line"
                        >
                          {model ?? "Not recorded"}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-ink-faint">Not recorded</span>
                  )}
                </Field>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-faint">No AI chat activity yet.</p>
          )}
        </Section>

        <Section
          title="Family context"
          description="Signals that shape matching. The full family record is in the parents section."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric
              label="Preferences"
              value={parent.has_preferences ? "Saved" : "None"}
              hint={
                parent.preferences_updated_at ? dateTime(parent.preferences_updated_at) : undefined
              }
            />
            <Metric label="Favorites" value={context.favorites_count} />
            <Metric
              label="Bookings"
              value={context.bookings_total}
              hint={`${context.bookings_confirmed} confirmed`}
            />
            <Metric
              label="Rebooking"
              value={`${context.providers_rebooked} / ${context.providers_booked}`}
              hint="Providers rebooked"
            />
            <div className="sm:col-span-2">
              <Field label="Last confirmed care">
                <span className={context.last_care_date ? "" : "text-ink-faint"}>
                  {context.last_care_date
                    ? formatDate(context.last_care_date)
                    : "No confirmed care"}
                </span>
              </Field>
            </div>
          </div>
        </Section>
      </div>

      {set.recommendation_count > 0 ? (
        <Section
          title="Support action"
          description="Use this when a saved set is clearly wrong or out of date."
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background p-4 ring-1 ring-line">
            <div className="max-w-[60ch]">
              <p className="text-sm font-medium">Clear saved recommendations</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                Deletes the cached matches for this family. They get a fresh set on their next
                visit, and chat history is untouched. The action is recorded in the audit log.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="rounded-full border border-clay/40 px-4 py-2 text-sm font-semibold text-clay transition hover:bg-clay-soft"
            >
              Clear matches
            </button>
          </div>
        </Section>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-3xl border-line bg-surface text-ink sm:rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold">
              Clear saved recommendations?
            </DialogTitle>
            <DialogDescription className="text-sm text-ink-soft">
              This removes {set.recommendation_count} cached match
              {set.recommendation_count === 1 ? "" : "es"} for {parent.name}. They will get a fresh
              set the next time they open AI recommendations. Chat history is not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
            >
              Keep matches
            </button>
            <button
              type="button"
              disabled={clearMutation.isPending}
              onClick={clearRecommendations}
              className="rounded-full bg-clay px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {clearMutation.isPending ? "Clearing…" : "Clear matches"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
