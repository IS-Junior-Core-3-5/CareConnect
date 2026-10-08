import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, ErrorState, LoadingState } from "@/components/NavBar";
import { MentionPicker } from "@/components/MentionPicker";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { QK, useParents, usePostsQuery } from "@/lib/data";
import { POST_CATEGORIES, slugify } from "@/lib/model";

export const Route = createFileRoute("/board/")({
  head: () => ({
    meta: [
      { title: "Message board — CareConnect" },
      {
        name: "description",
        content:
          "Parent discussions on CareConnect: splitting the week between providers, fair evening rates, bilingual care, and what the verified badge means.",
      },
      { property: "og:title", content: "Message board — CareConnect" },
      {
        property: "og:description",
        content: "Parent threads on schedules, pricing, and provider recommendations.",
      },
    ],
  }),
  component: BoardPage,
});

const categories = ["All", ...POST_CATEGORIES];

function BoardPage() {
  const [cat, setCat] = useState("All");
  const postsQuery = usePostsQuery();
  const posts = postsQuery.data ?? [];
  const [composing, setComposing] = useState(false);
  const parents = useParents();
  const shown = cat === "All" ? posts : posts.filter((p) => p.category === cat);

  return (
    <AppShell>
      <section className="py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">Message board</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Conversations between parents. Provider and parent names link to their profiles.
            </p>
          </div>
          {!composing ? (
            <button
              onClick={() => setComposing(true)}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-soft hover:bg-primary-ink"
            >
              New post
            </button>
          ) : null}
        </div>

        {composing ? <NewPostForm onClose={() => setComposing(false)} /> : null}

        <div className="mt-5 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`chip rounded-full px-3 py-1.5 text-xs font-semibold ${
                cat === c ? "bg-primary text-primary-soft" : "border border-line text-ink-soft hover:border-primary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          {postsQuery.isLoading ? <LoadingState label="Loading posts…" /> : null}
          {postsQuery.error ? <ErrorState error={postsQuery.error} /> : null}
          {!postsQuery.isLoading && shown.length === 0 ? (
            <p className="rounded-3xl bg-surface p-6 text-sm text-ink-soft ring-1 ring-line">
              No posts here yet. Start the conversation.
            </p>
          ) : null}
          {shown.map((post) => {
            const author = parents.find((a) => a.id === post.authorId);
            return (
              <article key={post.id} className="card-lift rounded-3xl bg-surface p-5 ring-1 ring-line">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-primary-ink">
                    {post.category}
                  </span>
                  <span className="text-xs text-ink-faint">{post.date}</span>
                </div>
                <Link to="/board/$postId" params={{ postId: post.id }}>
                  <h2 className="mt-1 font-display text-2xl font-bold tracking-tight hover:text-primary-ink">
                    {post.title}
                  </h2>
                </Link>
                <p className="mt-2 max-w-[70ch] text-sm text-ink-soft text-pretty">{post.body}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  {author ? (
                    <Link
                      to="/parents/$parentId"
                      params={{ parentId: author.id }}
                      className="font-semibold hover:text-primary-ink"
                    >
                      {author.name}
                    </Link>
                  ) : null}
                  <span className="text-ink-faint">
                    {post.replies.length} {post.replies.length === 1 ? "reply" : "replies"}
                  </span>
                  <Link
                    to="/board/$postId"
                    params={{ postId: post.id }}
                    className="ml-auto rounded-full bg-background px-3 py-1.5 text-xs font-semibold text-ink-soft"
                  >
                    Open thread
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

function NewPostForm({ onClose }: { onClose: () => void }) {
  const { parentId } = useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [category, setCategory] = useState<string>(POST_CATEGORIES[0]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parentId) return;
    setBusy(true);
    const id = slugify(title);
    const { error } = await supabase
      .from("posts")
      .insert({ id, author_id: parentId, category, title: title.trim(), body: body.trim() });
    if (!error && mentions.length) {
      const m = await supabase.from("post_mentions").insert(mentions.map((provider_id) => ({ post_id: id, provider_id })));
      if (m.error) toast.error(m.error.message);
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Posted");
    await qc.invalidateQueries({ queryKey: QK.posts });
    onClose();
    navigate({ to: "/board/$postId", params: { postId: id } });
  }

  const field =
    "w-full rounded-2xl bg-background px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-primary";

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-line">
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={field} aria-label="Category">
          {POST_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={field}
          placeholder="Title"
          aria-label="Title"
        />
      </div>
      <textarea
        required
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={field}
        placeholder="What do you want to ask or share?"
        aria-label="Post"
      />
      <MentionPicker value={mentions} onChange={setMentions} />
      <div className="flex gap-2">
        <button disabled={busy} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-soft disabled:opacity-50">
          {busy ? "Posting…" : "Post"}
        </button>
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-soft">
          Cancel
        </button>
      </div>
    </form>
  );
}
