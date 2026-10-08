import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, ErrorState, LoadingState } from "@/components/NavBar";
import { ScheduleCompare } from "@/components/ScheduleGrid";
import { useApp } from "@/lib/app-state";
import { useParent } from "@/lib/data";
import { overlapCount, scheduleCount } from "@/lib/model";

export const Route = createFileRoute("/parents/$parentId")({
  head: () => ({
    meta: [
      { title: "Parent profile — CareConnect" },
      { name: "description", content: "A CareConnect parent's profile." },
    ],
  }),
  component: ParentPage,
});

function ParentPage() {
  const { parentId } = Route.useParams();
  const { parent, isLoading, error } = useParent(parentId);
  const { isConnected, toggleConnection, parentId: myId, schedule } = useApp();

  if (isLoading)
    return (
      <AppShell>
        <LoadingState label="Loading profile…" />
      </AppShell>
    );
  if (error)
    return (
      <AppShell>
        <ErrorState error={error} />
      </AppShell>
    );
  if (!parent)
    return (
      <AppShell>
        <p className="py-16 text-center text-ink-soft">
          That parent isn't here.{" "}
          <Link to="/board" className="font-semibold text-primary-ink">
            Back to the board
          </Link>
        </p>
      </AppShell>
    );

  const on = isConnected(parent.id);
  const isMe = parent.id === myId;
  const shared = overlapCount(schedule, parent.schedule);

  return (
    <AppShell>
      <section className="mx-auto max-w-3xl space-y-6 py-12">
        <div className="rounded-[28px] bg-surface p-8 ring-1 ring-line">
          <span className="grid size-16 place-items-center rounded-3xl bg-primary-soft font-display text-2xl font-bold text-primary-ink">
            {parent.name[0]}
          </span>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">{parent.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {[parent.neighborhood, parent.language && `Speaks ${parent.language}`].filter(Boolean).join(" · ")}
          </p>
          {parent.blurb ? <p className="mt-4 text-ink-soft text-pretty">{parent.blurb}</p> : null}
          {parent.children.length ? (
            <p className="mt-4 text-sm">
              <span className="font-semibold">Children:</span>{" "}
              {parent.children.map((c) => `${c.name} (${c.age ?? "?"})`).join(", ")}
            </p>
          ) : null}
          {isMe ? (
            <Link
              to="/profile"
              className="mt-6 inline-block rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-soft"
            >
              Edit my profile
            </Link>
          ) : (
            <button
              onClick={() => toggleConnection(parent.id)}
              className={`mt-6 rounded-2xl px-6 py-3 text-sm font-semibold transition-colors ${
                on ? "bg-leaf-soft text-leaf-ink" : "bg-primary text-primary-soft hover:bg-primary-ink"
              }`}
            >
              {on ? "Connected ✓" : "Connect"}
            </button>
          )}
        </div>

        {!isMe && scheduleCount(parent.schedule) > 0 ? (
          <div className="rounded-[28px] bg-surface p-6 ring-1 ring-line">
            <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">Compare schedules</span>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">
              You both need care in {shared} {shared === 1 ? "block" : "blocks"}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Shared blocks could be a chance to split a sitter or carpool.
            </p>
            <div className="mt-5">
              <ScheduleCompare
                parent={schedule}
                provider={parent.schedule}
                providerLabel={parent.name.split(" ")[0].toUpperCase()}
              />
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
