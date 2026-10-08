import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/NavBar";
import { useParents, usePosts } from "@/lib/data";

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

const categories = ["All", "Schedules", "Pricing", "Recommendations"];

function BoardPage() {
  const [cat, setCat] = useState("All");
  const posts = usePosts();
  const parents = useParents();
  const shown = cat === "All" ? posts : posts.filter((p) => p.category === cat);

  return (
    <AppShell>
      <section className="py-8">
        <h1 className="font-display text-4xl font-bold tracking-tight">Message board</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Conversations between parents. Provider and parent names link to their profiles.
        </p>

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
