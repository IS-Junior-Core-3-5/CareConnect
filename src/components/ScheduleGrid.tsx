import { BLOCKS, BLOCK_HOURS, DAYS, type Schedule } from "@/data/mock";

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
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[84px_repeat(7,1fr)] gap-1.5">
          <div />
          {DAYS.map((d) => (
            <div key={d} className="text-center font-mono text-xs text-ink-faint">
              {d}
            </div>
          ))}
        </div>
        {BLOCKS.map((b, t) => (
          <div key={b} className="mt-1.5 grid grid-cols-[84px_repeat(7,1fr)] gap-1.5">
            <div className="flex flex-col justify-center">
              <span className="font-mono text-[11px] uppercase text-ink-faint">{b}</span>
              <span className="text-[10px] text-ink-faint">{BLOCK_HOURS[b]}</span>
            </div>
            {DAYS.map((d, dayIdx) => {
              const active = schedule[dayIdx][t];
              const cls = `h-11 rounded-lg text-[11px] font-bold transition-colors ${
                active ? on : "bg-background ring-1 ring-line"
              }`;
              return editable ? (
                <button
                  key={d}
                  type="button"
                  aria-label={`${d} ${b}`}
                  aria-pressed={active}
                  onClick={() => onToggle?.(dayIdx, t)}
                  className={`${cls} hover:ring-2 hover:ring-primary`}
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
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[620px]">
        <div className="grid grid-cols-[96px_repeat(7,1fr)] gap-1.5">
          <div />
          {DAYS.map((d) => (
            <div key={d} className="text-center font-mono text-xs text-ink-faint">
              {d}
            </div>
          ))}
        </div>
        {BLOCKS.map((b, t) => (
          <div key={b} className="mt-3">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
              {b} · {BLOCK_HOURS[b]}
            </p>
            <div className="grid grid-cols-[96px_repeat(7,1fr)] gap-1.5">
              <div className="flex items-center font-mono text-[11px] text-ink-faint">YOU NEED</div>
              {DAYS.map((d, i) => (
                <div
                  key={d}
                  className={`h-9 rounded-lg ${parent[i][t] ? "bg-leaf-soft" : "bg-background ring-1 ring-line"}`}
                />
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-[96px_repeat(7,1fr)] gap-1.5">
              <div className="flex items-center truncate font-mono text-[11px] uppercase text-ink-faint">
                {providerLabel}
              </div>
              {DAYS.map((d, i) => (
                <div
                  key={d}
                  className={`h-9 rounded-lg ${provider[i][t] ? "bg-leaf-soft" : "bg-background ring-1 ring-line"}`}
                />
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-[96px_repeat(7,1fr)] gap-1.5">
              <div className="flex items-center font-mono text-[11px] font-medium text-leaf-ink">MATCH</div>
              {DAYS.map((d, i) => {
                const need = parent[i][t];
                const has = provider[i][t];
                if (need && has)
                  return (
                    <div
                      key={d}
                      className="grid h-9 place-items-center rounded-lg bg-leaf text-[11px] font-bold text-white"
                    >
                      ✓
                    </div>
                  );
                if (need && !has)
                  return (
                    <div
                      key={d}
                      className="grid h-9 place-items-center rounded-lg bg-clay text-[11px] font-bold text-white"
                    >
                      ✕
                    </div>
                  );
                return <div key={d} className="h-9 rounded-lg bg-background ring-1 ring-line" />;
              })}
            </div>
          </div>
        ))}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-leaf" /> Covered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-clay" /> Gap in coverage
          </span>
        </div>
      </div>
    </div>
  );
}
