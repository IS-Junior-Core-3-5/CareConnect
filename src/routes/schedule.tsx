import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/NavBar";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import { BLOCKS, DAYS, providerById, providers, type Schedule } from "@/data/mock";
import { useApp } from "@/lib/app-state";

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
  const [overlay, setOverlay] = useState<string[]>(favorites.slice(0, 2));

  const overlaid = overlay
    .map(providerById)
    .filter((p): p is NonNullable<typeof p> => p !== undefined && p.schedule !== null);

  function coverage(day: number, block: number) {
    const need = schedule[day][block];
    if (!need) return "none";
    return overlaid.some((p) => p.schedule![day][block]) ? "covered" : "gap";
  }

  return (
    <AppShell>
      <section className="py-8">
        <h1 className="font-display text-4xl font-bold tracking-tight">My weekly schedule</h1>
        <p className="mt-1 max-w-[60ch] text-sm text-ink-soft">
          Tap any block to add or remove the hours you need covered. Overlay providers below to see where
          your week is covered and where it gaps.
        </p>

        <div className="mt-6 rounded-[28px] bg-surface p-6 ring-1 ring-line">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-faint">Editable · hours you need</p>
          <div className="mt-4">
            <ScheduleGrid schedule={schedule} editable onToggle={toggleBlock} />
          </div>
        </div>

        <div className="mt-6 rounded-[28px] bg-surface p-6 ring-1 ring-line">
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

          <div className="mt-6 overflow-x-auto">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[110px_repeat(7,1fr)] gap-1.5">
                <div />
                {DAYS.map((d) => (
                  <div key={d} className="text-center font-mono text-xs text-ink-faint">
                    {d}
                  </div>
                ))}
              </div>

              {BLOCKS.map((b, t) => (
                <div key={b} className="mt-4">
                  <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-ink-faint">{b}</p>
                  <div className="grid grid-cols-[110px_repeat(7,1fr)] gap-1.5">
                    <div className="flex items-center font-mono text-[11px] text-ink-faint">YOU NEED</div>
                    {DAYS.map((d, i) => {
                      const c = coverage(i, t);
                      return (
                        <div
                          key={d}
                          className={`h-9 rounded-lg ${
                            c === "covered"
                              ? "bg-leaf text-white"
                              : c === "gap"
                                ? "bg-clay text-white"
                                : "bg-background ring-1 ring-line"
                          } grid place-items-center text-[11px] font-bold`}
                        >
                          {c === "covered" ? "✓" : c === "gap" ? "✕" : ""}
                        </div>
                      );
                    })}
                  </div>
                  {overlaid.map((p) => (
                    <div key={p.id} className="mt-1.5 grid grid-cols-[110px_repeat(7,1fr)] gap-1.5">
                      <div className="flex items-center truncate font-mono text-[11px] uppercase text-ink-faint">
                        {p.name.split(" ")[0]}
                      </div>
                      {DAYS.map((d, i) => (
                        <div
                          key={d}
                          className={`h-9 rounded-lg ${
                            (p.schedule as Schedule)[i][t] ? "bg-leaf-soft" : "bg-background ring-1 ring-line"
                          }`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ))}

              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-leaf" /> Covered by an overlaid provider
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-clay" /> Still uncovered
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
