import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/NavBar";
import { DayHeader, GRID_COLS, RowLabel, ScheduleGrid } from "@/components/ScheduleGrid";
import { BLOCK_HOURS, BLOCKS, DAYS, type Schedule } from "@/lib/model";
import { useApp } from "@/lib/app-state";
import { useProviders } from "@/lib/data";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "My schedule — CareConnect" },
      {
        name: "description",
        content:
          "Edit the weekly hours your family needs care and overlay caregivers' availability to see where coverage overlaps and where it gaps.",
      },
      { property: "og:title", content: "My schedule — CareConnect" },
      {
        property: "og:description",
        content: "Edit your weekly care hours and overlay provider availability.",
      },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const { schedule, toggleBlock, favorites } = useApp();
  const providers = useProviders();
  const [overlay, setOverlay] = useState<string[]>(favorites.slice(0, 2));
  const [seeded, setSeeded] = useState(favorites.length > 0);
  useEffect(() => {
    if (!seeded && favorites.length) {
      setOverlay(favorites.slice(0, 2));
      setSeeded(true);
    }
  }, [favorites, seeded]);

  const overlaid = overlay
    .map((id) => providers.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined && p.schedule !== null);

  function coverage(day: number, block: number) {
    const need = schedule[day][block];
    if (!need) return "none";
    return overlaid.some((p) => p.schedule![day][block]) ? "covered" : "gap";
  }

  return (
    <AppShell>
      <section className="py-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">My weekly schedule</h1>
        <p className="mt-1 max-w-[60ch] text-sm text-ink-soft">
          Tap any block to add or remove the hours you need covered — changes save automatically. Overlay
          providers below to see where your week is covered and where it gaps.
        </p>

        <div className="mt-6 rounded-3xl bg-surface p-4 ring-1 ring-line sm:rounded-[28px] sm:p-6">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">Editable · hours you need</p>
          <div className="mt-4">
            <ScheduleGrid schedule={schedule} editable onToggle={toggleBlock} />
          </div>
        </div>


        <div className="mt-6 rounded-3xl bg-surface p-4 ring-1 ring-line sm:rounded-[28px] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight">Overlay providers</h2>
              <p className="mt-1 text-sm text-ink-soft">
                Pick from your favorites or add any provider's schedule.
              </p>
            </div>
            <Link to="/providers" className="text-sm font-semibold text-primary-ink">
              Browse all providers
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {providers
              .filter((p) => p.schedule)
              .map((p) => {
                const on = overlay.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setOverlay((prev) =>
                        prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id],
                      )
                    }
                    className={`chip rounded-full px-3 py-1.5 text-xs font-semibold ${
                      on ? "bg-primary text-primary-soft" : "border border-line text-ink-soft hover:border-primary"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
          </div>

          <div className="mt-6 w-full min-w-0">
            <DayHeader />

            {BLOCKS.map((b, t) => (
              <div key={b} className="mt-4">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint sm:text-[11px]">
                  {b} · {BLOCK_HOURS[b]}
                </p>
                <div className={GRID_COLS}>
                  <RowLabel>You need</RowLabel>
                  {DAYS.map((d, i) => {
                    const c = coverage(i, t);
                    return (
                      <div
                        key={d}
                        className={`grid h-8 min-w-0 place-items-center rounded-md text-[11px] font-bold sm:h-9 sm:rounded-lg ${
                          c === "covered"
                            ? "bg-leaf text-white"
                            : c === "gap"
                              ? "bg-clay text-white"
                              : "bg-background ring-1 ring-line"
                        }`}
                      >
                        {c === "covered" ? "✓" : c === "gap" ? "✕" : ""}
                      </div>
                    );
                  })}
                </div>
                {overlaid.map((p) => (
                  <div key={p.id} className={`mt-1 sm:mt-1.5 ${GRID_COLS}`}>
                    <RowLabel>{p.name.split(" ")[0]}</RowLabel>
                    {DAYS.map((d, i) => (
                      <div
                        key={d}
                        className={`h-8 min-w-0 rounded-md sm:h-9 sm:rounded-lg ${
                          (p.schedule as Schedule)[i][t] ? "bg-leaf-soft" : "bg-background ring-1 ring-line"
                        }`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-leaf" /> Covered by an overlaid provider
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-clay" /> Still uncovered
              </span>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
