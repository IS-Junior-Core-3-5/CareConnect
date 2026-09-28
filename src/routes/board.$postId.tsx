import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/NavBar";
import { parentById, posts, providerById } from "@/data/mock";

export const Route = createFileRoute("/board/$postId")({
  loader: ({ params }) => {
    const post = posts.find((p) => p.id === params.postId);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return { meta: [{ title: "Thread unavailable — CareConnect" }, { name: "robots", content: "noindex" }] };
    const p = loaderData.post;
    return {
      meta: [
        { title: `${p.title} — CareConnect` },
        { name: "description", content: p.body.slice(0, 155) },
        { property: "og:title", content: `${p.title} — CareConnect` },
        { property: "og:description", content: p.body.slice(0, 155) },
      ],
    };
  },
  component: ThreadPage,
});

function Mentions({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const p = providerById(id);
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
  const { post } = Route.useLoaderData();
  const author = parentById(post.authorId);

  return (
    <AppShell>
      <section className="py-8">
        <Link to="/board" className="text-sm font-semibold text-primary-ink">
          ← Back to message board
        </Link>

        <article className="mt-4 rounded-[28px] bg-surface p-6 ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-primary-ink">
              {post.category}
            </span>
            <span className="text-xs text-ink-faint">{post.date}</span>
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
          <p className="mt-3 max-w-[70ch] text-ink-soft text-pretty">{post.body}</p>
          <Mentions ids={post.mentions} />
        </article>

        <div className="mt-4 space-y-3">
          {post.replies.map((r, i) => {
            const replier = parentById(r.authorId);
            return (
              <div key={i} className="rounded-3xl bg-surface p-5 ring-1 ring-line">
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
                  <span className="text-xs text-ink-faint">{r.date}</span>
                </div>
                <p className="mt-2 max-w-[70ch] text-sm text-ink-soft text-pretty">{r.body}</p>
                <Mentions ids={r.mentions} />
              </div>
            );
          })}
        </div>

        <p className="mt-6 rounded-2xl bg-sun-soft px-4 py-3 text-sm text-ink-soft">
          Replies are turned off in this demo.
        </p>
      </section>
    </AppShell>
  );
}
