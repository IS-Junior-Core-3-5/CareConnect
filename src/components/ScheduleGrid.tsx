import { BLOCKS, BLOCK_HOURS, DAYS, type Block, type Schedule } from "@/lib/model";

/**
 * Weekly grids are 7 day columns + 1 label column. On phones the label column
 * shrinks and labels shorten so the whole week fits without sideways scrolling.
 */
export const GRID_COLS =
  "grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-1 sm:grid-cols-[6rem_repeat(7,minmax(0,1fr))] sm:gap-1.5";

const SHORT_BLOCK: Record<Block, string> = { Morning: "AM", Afternoon: "PM", Evening: "Eve" };
const SHORT_HOURS: Record<Block, string> = { Morning: "7–12", Afternoon: "12–5", Evening: "5–9" };

export function DayHeader() {
  return (
    <div className={GRID_COLS}>
      <div />
      {DAYS.map((d) => (
        <div key={d} className="text-center font-mono text-[10px] text-ink-faint sm:text-xs">
          <span className="sm:hidden">{d.slice(0, 2)}</span>
          <span className="hidden sm:inline">{d}</span>
        </div>
      ))}
    </div>
  );
}

export function BlockLabel({ block, withHours = true }: { block: Block; withHours?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col justify-center leading-tight">
      <span className="font-mono text-[10px] uppercase text-ink-faint sm:text-[11px]">
        <span className="sm:hidden">{SHORT_BLOCK[block]}</span>
        <span className="hidden sm:inline">{block}</span>
      </span>
      {withHours ? (
        <span className="text-[9px] text-ink-faint sm:text-[10px]">
          <span className="sm:hidden">{SHORT_HOURS[block]}</span>
          <span className="hidden sm:inline">{BLOCK_HOURS[block]}</span>
        </span>
      ) : null}
    </div>
  );
}

export function RowLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`flex min-w-0 items-center truncate font-mono text-[9px] uppercase text-ink-faint sm:text-[11px] ${className}`}
    >
      <span className="truncate">{children}</span>
    </div>
  );
}

export function ScheduleGrid({
  schedule,
  editable = false,
  onToggle,
  tone = "leaf",
}: {
  schedule: Schedule;
  editable?: boolean;
  onToggle?: (day: number, block: number) => void;
  tone?: "leaf" | "primary";
}) {
  const on = tone === "leaf" ? "bg-leaf text-white" : "bg-primary text-primary-soft";
  return (
    <div className="w-full min-w-0">
      <DayHeader />
      {BLOCKS.map((b, t) => (
        <div key={b} className={`mt-1 sm:mt-1.5 ${GRID_COLS}`}>
          <BlockLabel block={b} />
          {DAYS.map((d, dayIdx) => {
            const active = schedule[dayIdx][t];
            const cls = `h-11 min-w-0 rounded-lg text-[11px] font-bold transition-colors ${
              active ? on : "bg-background ring-1 ring-line"
            }`;
            return editable ? (
              <button
                key={d}
                type="button"
                aria-label={`${d} ${b}`}
                aria-pressed={active}
                onClick={() => onToggle?.(dayIdx, t)}
                className={`${cls} hover:ring-2 hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
              >
                {active ? "✓" : ""}
              </button>
            ) : (
              <div key={d} className={cls} />
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ScheduleCompare({
  parent,
  provider,
  providerLabel,
}: {
  parent: Schedule;
  provider: Schedule;
  providerLabel: string;
}) {
  const cell = "h-8 min-w-0 rounded-md sm:h-9 sm:rounded-lg";
  return (
    <div className="w-full min-w-0">
      <DayHeader />
      {BLOCKS.map((b, t) => (
        <div key={b} className="mt-3">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-faint sm:text-[11px]">
            {b} · {BLOCK_HOURS[b]}
          </p>
          <div className={GRID_COLS}>
            <RowLabel>You need</RowLabel>
            {DAYS.map((d, i) => (
              <div key={d} className={`${cell} ${parent[i][t] ? "bg-leaf-soft" : "bg-background ring-1 ring-line"}`} />
            ))}
          </div>
          <div className={`mt-1 sm:mt-1.5 ${GRID_COLS}`}>
            <RowLabel>{providerLabel}</RowLabel>
            {DAYS.map((d, i) => (
              <div
                key={d}
                className={`${cell} ${provider[i][t] ? "bg-leaf-soft" : "bg-background ring-1 ring-line"}`}
              />
            ))}
          </div>
          <div className={`mt-1 sm:mt-1.5 ${GRID_COLS}`}>
            <RowLabel className="font-medium text-leaf-ink">Match</RowLabel>
            {DAYS.map((d, i) => {
              const need = parent[i][t];
              const has = provider[i][t];
              if (need && has)
                return (
                  <div key={d} className={`${cell} grid place-items-center bg-leaf text-[11px] font-bold text-white`}>
                    ✓
                  </div>
                );
              if (need && !has)
                return (
                  <div key={d} className={`${cell} grid place-items-center bg-clay text-[11px] font-bold text-white`}>
                    ✕
                  </div>
                );
              return <div key={d} className={`${cell} bg-background ring-1 ring-line`} />;
            })}
          </div>
        </div>
      ))}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-leaf" /> Covered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-clay" /> Gap in coverage
        </span>
      </div>
    </div>
  );
}
