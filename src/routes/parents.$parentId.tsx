import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/NavBar";
import { parentById } from "@/data/mock";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/parents/$parentId")({
  loader: ({ params }) => {
    const parent = parentById(params.parentId);
    if (!parent) throw notFound();
    return { parent };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Parent not found — CareConnect" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.parent.name} — CareConnect parent`;
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData.parent.blurb },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.parent.blurb },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: ParentNotFound,
  component: ParentPage,
});

function ParentNotFound() {
  return (
    <AppShell>
      <p className="py-16 text-center text-ink-soft">
        That parent isn't here. <Link to="/board" className="font-semibold text-primary-ink">Back to the board</Link>
      </p>
    </AppShell>
  );
}

function ParentPage() {
  const { parent } = Route.useLoaderData();
  const { isConnected, toggleConnection } = useApp();
  const on = isConnected(parent.id);
  return (
    <AppShell>
      <section className="mx-auto max-w-2xl py-12">
        <div className="rounded-[28px] bg-surface p-8 ring-1 ring-line">
          <span className="grid size-16 place-items-center rounded-3xl bg-primary-soft font-display text-2xl font-bold text-primary-ink">
            {parent.name[0]}
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">{parent.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">{parent.neighborhood} · Speaks {parent.language}</p>
          <p className="mt-4 text-ink-soft text-pretty">{parent.blurb}</p>
          <p className="mt-4 text-sm">
            <span className="font-semibold">Children:</span>{" "}
            {parent.children.map((c) => `${c.name} (${c.age})`).join(", ")}
          </p>
          <button
            onClick={() => toggleConnection(parent.id)}
            className={`mt-6 rounded-2xl px-6 py-3 text-sm font-semibold transition-colors ${
              on ? "bg-leaf-soft text-leaf-ink" : "bg-primary text-primary-soft hover:bg-primary-ink"
            }`}
          >
            {on ? "Connected ✓" : "Connect"}
          </button>
        </div>
      </section>
    </AppShell>
  );
}
