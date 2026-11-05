import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { useProviders } from "@/lib/data";
import { priceLabel, type Provider } from "@/lib/model";

/**
 * Chat with the CareConnect AI (Google Gemini via the recommend-providers Edge Function, mode "chat").
 * The function sees the parent's profile and every provider, and saves both sides of the
 * conversation to public.ai_chat_messages so it survives refreshes.
 */

type Msg = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  provider_ids?: string[];
  pending?: boolean;
};

const STARTERS = [
  "Recommend a provider that covers my whole schedule",
  "Best full-day daycare under $150/day?",
  "Find a Spanish-speaking sitter for evenings",
  "Who's best for my kids' ages?",
  "Compare my favorites",
];

const chatKey = (parentId: string | null) => ["ai_chat", parentId] as const;

export function AiChat({ page = false }: { page?: boolean }) {
  const { parentId, isFavorite, toggleFavorite } = useApp();
  const providers = useProviders();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [optimistic, setOptimistic] = useState<Msg | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: msgs = [], isLoading } = useQuery({
    queryKey: chatKey(parentId),
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_chat_messages")
        .select("id, role, content, provider_ids")
        .eq("parent_id", parentId!)
        .order("created_at")
        .order("id")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  const send = useMutation({
    mutationFn: async (message: string) => {
      const { data, error } = await supabase.functions.invoke("recommend-providers", {
        method: "POST",
        body: { mode: "chat", message },
      });
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(body?.error ?? error.message);
      }
      if (data?.error) throw new Error(data.error);
      return data as { reply: string };
    },
    onMutate: (message) => setOptimistic({ id: "pending", role: "user", content: message }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: chatKey(parentId) });
      setOptimistic(null);
    },
    onError: (e: Error, message) => {
      setOptimistic(null);
      setText(message); // give the text back so it can be resent
      toast.error(e.message);
    },
  });

  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_chat_messages").delete().eq("parent_id", parentId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKey(parentId) }),
    onError: (e: Error) => toast.error(e.message),
  });

  const shown: Msg[] = [
    ...msgs,
    ...(optimistic ? [optimistic] : []),
    ...(send.isPending ? [{ id: "typing", role: "assistant" as const, content: "Thinking…", pending: true }] : []),
  ];

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length]);

  if (!parentId) return null;

  const submit = (message: string) => {
    const m = message.trim();
    if (!m || send.isPending) return;
    setText("");
    send.mutate(m);
  };

  return (
    <section className={page ? "py-8" : "py-6"} id="ai-chat">
      <div className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:rounded-[28px] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">AI assistant</span>
            {page ? (
              <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Ask for a recommendation</h1>
            ) : (
              <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">Chat about your care options</h2>
            )}
            <p className="mt-1 max-w-[52ch] text-sm text-ink-soft text-pretty">
              Ask for exactly what you need, like "a verified sitter for Saturday mornings near me". The AI checks your schedule, kids' ages and languages against every provider and shows its picks.
            </p>
          </div>
          {msgs.length ? (
            <button
              onClick={() => clear.mutate()}
              disabled={clear.isPending || send.isPending}
              className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary-ink disabled:opacity-50"
            >
              Clear chat
            </button>
          ) : null}
        </div>

        <div
          ref={listRef}
          className={`mt-5 flex ${page ? "h-[60vh] min-h-[360px]" : "max-h-[60vh] min-h-[220px]"} flex-col gap-3 overflow-y-auto rounded-2xl bg-background p-3 ring-1 ring-line sm:p-4`}
        >
          {isLoading ? <p className="text-sm text-ink-soft">Loading…</p> : null}
          {!isLoading && shown.length === 0 ? (
            <div className="m-auto max-w-md text-center">
              <p className="text-sm text-ink-soft">Start with a question, or tap one:</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-primary hover:text-primary-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {shown.map((m) => {
            const picks = (m.provider_ids ?? [])
              .map((id) => providers.find((p) => p.id === id))
              .filter((p): p is Provider => !!p);
            return (
              <div key={m.id} className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}>
                <p
                  className={`max-w-[92%] sm:max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm text-pretty ${
                    m.role === "user"
                      ? "rounded-br-md bg-primary text-primary-soft"
                      : `rounded-bl-md bg-surface text-ink ring-1 ring-line ${m.pending ? "animate-pulse text-ink-soft" : ""}`
                  }`}
                >
                  {m.role === "assistant" ? renderBold(m.content) : m.content}
                </p>
                {picks.length ? (
                  <div className="grid w-full gap-2 sm:max-w-[85%] sm:grid-cols-2 xl:grid-cols-3">
                    {picks.map((p, i) => (
                      <PickCard
                        key={p.id}
                        p={p}
                        rank={i + 1}
                        saved={isFavorite(p.id)}
                        onSave={() => toggleFavorite(p.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(text);
          }}
          className="mt-3 flex items-end gap-2 rounded-3xl bg-background p-2 ring-1 ring-line"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(text);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Ask for a recommendation…"
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={!text.trim() || send.isPending}
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink disabled:opacity-50"
          >
            Send
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-faint">AI answers can be wrong. Check each provider's profile.</p>
      </div>
    </section>
  );
}

/** Shows **text** as bold (Gemini sometimes uses it) without rendering any HTML. */
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

function PickCard({ p, rank, saved, onSave }: { p: Provider; rank: number; saved: boolean; onSave: () => void }) {
  return (
    <div className="flex flex-col rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-xs text-ink-faint">Pick #{rank}</span>
          <Link
            to="/providers/$providerId"
            params={{ providerId: p.id }}
            className="block font-display text-lg font-bold leading-tight hover:text-primary-ink"
          >
            {p.name}
          </Link>
        </div>
        {p.verified ? (
          <span className="shrink-0 rounded-full bg-leaf-soft px-2 py-0.5 text-[11px] font-semibold text-leaf-ink">
            Verified
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        {p.careType} · {p.neighborhood} · {priceLabel(p)}
      </p>
      {p.reviewCount ? (
        <p className="mt-0.5 text-xs text-ink-soft">
          ★ {p.rating} ({p.reviewCount} review{p.reviewCount === 1 ? "" : "s"})
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Link
          to="/providers/$providerId"
          params={{ providerId: p.id }}
          className="flex-1 rounded-full bg-primary px-3 py-1.5 text-center text-xs font-semibold text-primary-soft transition-colors hover:bg-primary-ink"
        >
          View profile
        </Link>
        <button
          onClick={onSave}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            saved
              ? "border-primary bg-primary-soft text-primary-ink"
              : "border-line text-ink-soft hover:border-primary hover:text-primary-ink"
          }`}
        >
          {saved ? "♥ Saved" : "♡ Save"}
        </button>
      </div>
    </div>
  );
}
