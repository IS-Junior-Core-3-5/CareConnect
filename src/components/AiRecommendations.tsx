import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RatingSummary } from "@/components/StarRating";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { useProviders } from "@/lib/data";

/**
 * AI recommendations: Google Gemini (via the recommend-providers Edge Function) analyzes the
 * parent's profile against every provider. Each pick has preset questions; the answers
 * were written by the AI in the same run, so clicking one just reveals it.
 */

type Details = { why?: string; tradeoffs?: string; schedule?: string; cost?: string; trust?: string };
type Rec = {
  provider_id: string;
  rank: number;
  match_score: number | null;
  headline: string;
  details: Details;
  summary: string | null;
  created_at: string;
};

const QUESTIONS: { key: keyof Details; label: string }[] = [
  { key: "why", label: "Why this one?" },
  { key: "tradeoffs", label: "Any trade-offs?" },
  { key: "schedule", label: "Does it fit my schedule?" },
  { key: "cost", label: "What will it cost?" },
  { key: "trust", label: "Can I trust them?" },
];

const recKey = (parentId: string | null) => ["ai_recommendations", parentId] as const;

export function AiRecommendations() {
  const { parentId } = useApp();
  const providers = useProviders();
  const qc = useQueryClient();

  const { data: recs = [], isLoading } = useQuery({
    queryKey: recKey(parentId),
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_recommendations")
        .select("provider_id, rank, match_score, headline, details, summary, created_at")
        .eq("parent_id", parentId!)
        .order("rank");
      if (error) throw error;
      return (data ?? []) as Rec[];
    },
  });

  const run = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("recommend-providers", { method: "POST" });
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(body?.error ?? error.message);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recKey(parentId) }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!parentId) return null;

  const summary = recs[0]?.summary;
  const updated = recs[0]?.created_at ? new Date(recs[0].created_at).toLocaleDateString() : null;

  return (
    <section id="recommendations" className="py-6">
      <div className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:rounded-[28px] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">AI recommendations</span>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">Best matches for your family</h2>
            <p className="mt-1 max-w-[52ch] text-sm text-ink-soft text-pretty">
              AI compares your schedule, kids' ages, languages, service address and reviews against every provider.
            </p>
          </div>
          <button
            onClick={() => run.mutate()}
            disabled={run.isPending}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink disabled:opacity-50"
          >
            {run.isPending ? "Analyzing your profile…" : recs.length ? "Re-run analysis" : "Get my recommendations"}
          </button>
        </div>

        {summary ? (
          <p className="mt-5 rounded-2xl bg-sun-soft px-4 py-3 text-sm text-ink-soft">
            <span className="font-semibold text-ink">What you need most: </span>
            {summary}
          </p>
        ) : null}

        {run.isPending ? (
          <p className="mt-5 text-sm text-ink-soft">The AI is reading your profile and every provider. This can take up to a minute.</p>
        ) : null}
        {isLoading ? <p className="mt-5 text-sm text-ink-soft">Loading…</p> : null}
        {!isLoading && recs.length === 0 && !run.isPending ? (
          <p className="mt-5 text-sm text-ink-soft">
            No recommendations yet. Keep your schedule and profile up to date, then run the analysis.
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {recs.map((r) => {
            const p = providers.find((x) => x.id === r.provider_id);
            return (
              <RecCard
                key={r.provider_id}
                rec={r}
                name={p?.name ?? r.provider_id}
                rating={p?.rating ?? 0}
                reviewCount={p?.reviewCount ?? 0}
                meta={
                  p
                    ? `${p.careType} · ${p.address} · ${p.dailyRate != null ? `${p.dailyRate}/day` : "Pricing unavailable"}`
                    : ""
                }
              />
            );
          })}
        </div>

        {updated ? <p className="mt-4 text-xs text-ink-faint">Last analyzed {updated} · AI picks can be wrong, check each profile.</p> : null}
      </div>
    </section>
  );
}

function RecCard({
  rec,
  name,
  meta,
  rating,
  reviewCount,
}: {
  rec: Rec;
  name: string;
  meta: string;
  rating: number;
  reviewCount: number;
}) {
  const [open, setOpen] = useState<keyof Details | null>(null);
  const answer = open ? rec.details?.[open] : null;

  return (
    <div className="flex flex-col rounded-3xl bg-background p-5 ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-xs text-ink-faint">#{rec.rank}</span>
          <Link
            to="/providers/$providerId"
            params={{ providerId: rec.provider_id }}
            className="block font-display text-xl font-bold leading-tight hover:text-primary-ink"
          >
            {name}
          </Link>
          {meta ? <p className="mt-0.5 text-xs text-ink-soft">{meta}</p> : null}
          {reviewCount ? (
            <RatingSummary
              rating={rating}
              reviewCount={reviewCount}
              size="sm"
              className="mt-1 text-xs"
            />
          ) : null}
        </div>
        {rec.match_score != null ? (
          <span className="shrink-0 rounded-full bg-leaf-soft px-2.5 py-1 text-xs font-semibold text-leaf-ink">
            {rec.match_score}% match
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-ink text-pretty">{rec.headline}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {QUESTIONS.filter((q) => rec.details?.[q.key]).map((q) => (
          <button
            key={q.key}
            onClick={() => setOpen(open === q.key ? null : q.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              open === q.key
                ? "border-primary bg-primary text-primary-soft"
                : "border-line bg-surface text-ink-soft hover:border-primary hover:text-primary-ink"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {answer ? <p className="mt-3 rounded-2xl bg-surface p-3 text-sm text-ink-soft text-pretty">{answer}</p> : null}
    </div>
  );
}
