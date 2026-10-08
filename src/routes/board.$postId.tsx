import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, ErrorState, LoadingState } from "@/components/NavBar";
import { MentionPicker } from "@/components/MentionPicker";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { QK, useParents, usePost, useProviders } from "@/lib/data";
import type { Post } from "@/lib/model";

export const Route = createFileRoute("/board/$postId")({
  head: () => ({
    meta: [
      { title: "Message board thread — CareConnect" },
      { name: "description", content: "A CareConnect message board conversation." },
    ],
  }),
  component: ThreadPage,
});

function Mentions({ ids }: { ids: string[] }) {
  const providers = useProviders();
  if (!ids.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const p = providers.find((x) => x.id === id);
        if (!p) return null;
        return (
          <Link
            key={id}
            to="/providers/$providerId"
            params={{ providerId: id }}
            className="chip rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary-ink"
          >
            {p.name} →
          </Link>
        );
      })}
    </div>
  );
}

function ThreadPage() {
  const { postId } = Route.useParams();
  const { post, isLoading, error } = usePost(postId);

  return (
    <AppShell>
      <section className="py-8">
        <Link to="/board" className="text-sm font-semibold text-primary-ink">
          ← Back to message board
        </Link>
        {isLoading ? (
          <LoadingState label="Loading thread…" />
        ) : error ? (
          <ErrorState error={error} />
        ) : !post ? (
          <p className="py-16 text-center text-ink-soft">This thread doesn't exist or was deleted.</p>
        ) : (
          <Thread post={post} />
        )}
      </section>
    </AppShell>
  );
}

function Thread({ post }: { post: Post }) {
  const parents = useParents();
  const { parentId } = useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const author = parents.find((p) => p.id === post.authorId);
  const refresh = () => qc.invalidateQueries({ queryKey: QK.posts });

  async function deletePost() {
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Post deleted");
    await refresh();
    navigate({ to: "/board" });
  }

  async function deleteReply(id: number) {
    const { error } = await supabase.from("post_replies").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  return (
    <>
      <article className="mt-4 rounded-[28px] bg-surface p-6 ring-1 ring-line">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-primary-ink">{post.category}</span>
          <span className="text-xs text-ink-faint">{post.date}</span>
          {post.authorId === parentId ? (
            <button onClick={deletePost} className="ml-auto text-xs font-semibold text-clay">
              Delete post
            </button>
          ) : null}
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{post.title}</h1>
        {author ? (
          <Link
            to="/parents/$parentId"
            params={{ parentId: author.id }}
            className="mt-2 inline-block text-sm font-semibold hover:text-primary-ink"
          >
            {author.name}
          </Link>
        ) : null}
        <p className="mt-3 max-w-[70ch] whitespace-pre-line text-ink-soft text-pretty">{post.body}</p>
        <Mentions ids={post.mentions} />
      </article>

      <div className="mt-4 space-y-3">
        {post.replies.map((r) => {
          const replier = parents.find((p) => p.id === r.authorId);
          return (
            <div key={r.id} className="rounded-3xl bg-surface p-5 ring-1 ring-line">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {replier ? (
                  <Link
                    to="/parents/$parentId"
                    params={{ parentId: replier.id }}
                    className="font-semibold hover:text-primary-ink"
                  >
                    {replier.name}
                  </Link>
                ) : (
                  <span className="font-semibold">A parent</span>
                )}
                <span className="flex items-center gap-3 text-xs text-ink-faint">
                  {r.date}
                  {r.authorId === parentId ? (
                    <button onClick={() => deleteReply(r.id)} className="font-semibold text-clay">
                      Delete
                    </button>
                  ) : null}
                </span>
              </div>
              <p className="mt-2 max-w-[70ch] whitespace-pre-line text-sm text-ink-soft text-pretty">{r.body}</p>
              <Mentions ids={r.mentions} />
            </div>
          );
        })}
      </div>

      <ReplyForm postId={post.id} onDone={refresh} />
    </>
  );
}

function ReplyForm({ postId, onDone }: { postId: string; onDone: () => void }) {
  const { parentId } = useApp();
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parentId || !body.trim()) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("post_replies")
      .insert({ post_id: postId, author_id: parentId, body: body.trim() })
      .select("id")
      .single();
    if (!error && data && mentions.length) {
      const m = await supabase
        .from("reply_mentions")
        .insert(mentions.map((provider_id) => ({ reply_id: data.id, provider_id })));
      if (m.error) toast.error(m.error.message);
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setBody("");
    setMentions([]);
    setShowTags(false);
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-line">
      <label htmlFor="reply" className="block font-display text-xl font-bold">
        Reply
      </label>
      <textarea
        id="reply"
        required
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share what worked for your family…"
        className="w-full rounded-2xl bg-background px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-primary"
      />
      {showTags ? <MentionPicker value={mentions} onChange={setMentions} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={busy}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-soft disabled:opacity-50"
        >
          {busy ? "Posting…" : "Post reply"}
        </button>
        {!showTags ? (
          <button type="button" onClick={() => setShowTags(true)} className="text-sm font-semibold text-primary-ink">
            Tag a provider
          </button>
        ) : null}
      </div>
    </form>
  );
}
