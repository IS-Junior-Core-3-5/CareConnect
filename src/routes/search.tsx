import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/NavBar";
import { ProviderCard } from "@/components/ProviderCard";
import { parents, posts, providers } from "@/data/mock";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  head: () => ({
    meta: [
      { title: "Search — CareConnect" },
      {
        name: "description",
        content:
          "Search across CareConnect at once: caregivers and centers, other parents, and message board threads.",
      },
      { property: "og:title", content: "Search — CareConnect" },
      {
        property: "og:description",
        content: "One search across caregivers, parents, and message board threads.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const term = q.trim().toLowerCase();

  const matchedProviders = term
    ? providers.filter((p) =>
        [p.name, p.careType, p.blurb, p.bio, p.neighborhood, ...p.languages]
          .join(" ")
          .toLowerCase()
          .includes(term),
      )
    : [];
  const matchedParents = term
    ? parents.filter((p) =>
        [p.name, p.neighborhood, p.blurb, p.language].join(" ").toLowerCase().includes(term),
      )
    : [];
  const matchedPosts = term
    ? posts.filter((p) => [p.title, p.body, p.category].join(" ").toLowerCase().includes(term))
    : [];

  const total = matchedProviders.length + matchedParents.length + matchedPosts.length;

  return (
    <AppShell>
      <section className="py-8">
        <h1 className="font-display text-4xl font-bold tracking-tight">
          {term ? <>Results for “{q}”</> : "Search CareConnect"}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {term
            ? `${total} ${total === 1 ? "match" : "matches"} across providers, parents, and posts`
            : "Use the search bar above to look across providers, parents, and posts."}
        </p>

        {term && total === 0 ? (
          <div className="mt-6 rounded-3xl bg-clay-soft px-5 py-4 text-sm font-medium text-clay">
            Nothing matched “{q}”. Try a neighborhood, a care type, or a caregiver's name.
          </div>
        ) : null}

        {matchedProviders.length ? (
          <div className="mt-8">
            <h2 className="font-display text-2xl font-bold tracking-tight">Providers</h2>
            <div className="mt-4 space-y-4">
              {matchedProviders.map((p) => (
                <ProviderCard key={p.id} provider={p} />
              ))}
            </div>
          </div>
        ) : null}

        {matchedParents.length ? (
          <div className="mt-8">
            <h2 className="font-display text-2xl font-bold tracking-tight">Parents</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {matchedParents.map((p) => (
                <Link
                  key={p.id}
                  to="/parents/$parentId"
                  params={{ parentId: p.id }}
                  className="card-lift rounded-3xl bg-surface p-4 ring-1 ring-line"
                >
                  <p className="font-display text-lg font-bold">{p.name}</p>
                  <p className="mt-1 text-sm text-ink-soft">{p.blurb}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {matchedPosts.length ? (
          <div className="mt-8">
            <h2 className="font-display text-2xl font-bold tracking-tight">Message board</h2>
            <div className="mt-4 space-y-3">
              {matchedPosts.map((p) => (
                <Link
                  key={p.id}
                  to="/board/$postId"
                  params={{ postId: p.id }}
                  className="card-lift block rounded-3xl bg-surface p-4 ring-1 ring-line"
                >
                  <span className="font-mono text-[11px] uppercase tracking-wider text-primary-ink">
                    {p.category}
                  </span>
                  <p className="mt-1 font-display text-lg font-bold">{p.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{p.body}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
