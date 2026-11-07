import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/NavBar";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { CARE_TYPES } from "@/lib/model";

/**
 * In-depth care preferences for the AI (public.parent_preferences, one private row per parent).
 * The recommend-providers Edge Function reads this row for both AI recommendations and the chat.
 */

export const Route = createFileRoute("/preferences")({
  head: () => ({
    meta: [
      { title: "AI preferences — CareConnect" },
      {
        name: "description",
        content: "Tell CareConnect's AI exactly what your family needs so its recommendations fit.",
      },
    ],
  }),
  component: PreferencesPage,
});

const CARE_SETTINGS = ["In our home", "Provider's home", "Center / school"];
const ARRANGEMENTS = [
  "Full-time",
  "Part-time",
  "Occasional / drop-in",
  "Before & after school",
  "Date nights / evenings",
];
const BUDGET_FLEX = ["Strict", "Somewhat flexible", "Flexible"] as const;
const CITIES = [
  "Provo",
  "Orem",
  "Lindon",
  "American Fork",
  "Lehi",
  "Pleasant Grove",
  "Springville",
  "Spanish Fork",
];
const MUST_HAVES = [
  "Verified on CareConnect",
  "State licensed",
  "CPR / first aid certified",
  "Background check",
  "References available",
  "Meals / snacks included",
  "Outdoor play daily",
  "Small group size",
  "Infant care",
  "Special-needs experience",
  "Pet-free",
  "Non-smoking",
  "Daily photo updates",
  "Accepts subsidies",
];
const APPROACHES = [
  "Play-based",
  "Montessori",
  "Reggio Emilia",
  "Academic / kindergarten prep",
  "Nature / outdoor",
  "Faith-based",
  "Bilingual / immersion",
  "Arts & music",
];
const COMMUNICATION = ["Text", "Phone call", "App messages", "Email", "Daily report", "In person at pickup"];
const PRIORITY_OPTIONS = ["Schedule fit", "Cost", "Safety & trust", "Location", "Teaching approach", "Language"];
const STYLES = ["Short", "Balanced", "Detailed"] as const;

type Prefs = {
  care_types: string[];
  care_settings: string[];
  arrangement: string | null;
  start_date: string | null;
  budget_min: number | null;
  budget_max: number | null;
  budget_flexibility: (typeof BUDGET_FLEX)[number] | null;
  preferred_cities: string[];
  max_distance_miles: number | null;
  needs_transportation: boolean;
  must_haves: string[];
  approaches: string[];
  languages_wanted: string[];
  child_needs: string | null;
  diet: string | null;
  communication: string[];
  priorities: string[];
  dealbreakers: string | null;
  notes_for_ai: string | null;
  ai_answer_style: (typeof STYLES)[number];
};

const EMPTY: Prefs = {
  care_types: [],
  care_settings: [],
  arrangement: null,
  start_date: null,
  budget_min: null,
  budget_max: null,
  budget_flexibility: null,
  preferred_cities: [],
  max_distance_miles: null,
  needs_transportation: false,
  must_haves: [],
  approaches: [],
  languages_wanted: [],
  child_needs: null,
  diet: null,
  communication: [],
  priorities: [],
  dealbreakers: null,
  notes_for_ai: null,
  ai_answer_style: "Balanced",
};

const COLS = Object.keys(EMPTY).join(", ");

const field =
  "w-full rounded-2xl bg-background px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-primary";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint";
const btn =
  "rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink disabled:opacity-50";

export const prefsKey = (parentId: string | null) => ["parent_preferences", parentId] as const;

function PreferencesPage() {
  return (
    <AppShell>
      <PreferencesBody />
    </AppShell>
  );
}

function PreferencesBody() {
  const { parentId, me, language } = useApp();
  const qc = useQueryClient();
  const [p, setP] = useState<Prefs>(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: prefsKey(parentId),
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parent_preferences")
        .select(`${COLS}, updated_at`)
        .eq("parent_id", parentId!)
        .maybeSingle();
      if (error) throw error;
      return data as (Prefs & { updated_at: string }) | null;
    },
  });

  useEffect(() => {
    if (data) setP({ ...EMPTY, ...data });
    else if (data === null) setP({ ...EMPTY, languages_wanted: language ? [language] : [] });
  }, [data, language]);

  if (!me) return null;

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setP((x) => ({ ...x, [k]: v }));
  const toggle = (k: keyof Prefs, v: string) =>
    setP((x) => {
      const list = x[k] as string[];
      return { ...x, [k]: list.includes(v) ? list.filter((i) => i !== v) : [...list, v] };
    });
  const blank = (s: string | null) => (s && s.trim() ? s.trim() : null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (p.budget_min !== null && p.budget_max !== null && p.budget_min > p.budget_max) {
      toast.error("Budget minimum is higher than the maximum.");
      return;
    }
    setSaving(true);
    const row = {
      ...p,
      parent_id: parentId!,
      child_needs: blank(p.child_needs),
      diet: blank(p.diet),
      dealbreakers: blank(p.dealbreakers),
      notes_for_ai: blank(p.notes_for_ai),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("parent_preferences").upsert(row, { onConflict: "parent_id" });
    setSaving(false);
    if (error) {
      toast.error(`Couldn't save preferences. ${error.message}`);
      return;
    }
    qc.invalidateQueries({ queryKey: prefsKey(parentId) });
    toast.success("Preferences saved. The AI will use them from now on.");
  }

  const filled = [
    p.care_types.length,
    p.arrangement,
    p.budget_max,
    p.preferred_cities.length,
    p.must_haves.length,
    p.approaches.length,
    p.priorities.length,
    p.child_needs,
    p.notes_for_ai,
  ].filter(Boolean).length;

  return (
    <form onSubmit={save} className="pb-24">
      <section className="flex flex-wrap items-end justify-between gap-4 py-10">
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">AI preferences</span>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Tell the AI what your family needs
          </h1>
          <p className="mt-3 text-ink-soft text-pretty">
            The more you fill in, the better the AI's recommendations and chat answers fit. Everything here is
            private to your account and is only used by the AI. Your schedule, children's ages and language come
            from <Link to="/schedule" className="font-semibold text-primary-ink underline-offset-2 hover:underline">your schedule</Link> and{" "}
            <Link to="/profile" className="font-semibold text-primary-ink underline-offset-2 hover:underline">profile</Link>.
          </p>
        </div>
        <div className="rounded-2xl bg-surface px-4 py-3 text-sm ring-1 ring-line">
          <p className="font-semibold">{filled}/9 key sections filled</p>
          <p className="text-xs text-ink-soft">
            {data?.updated_at ? `Last saved ${new Date(data.updated_at).toLocaleDateString()}` : "Not saved yet"}
          </p>
        </div>
      </section>

      {isLoading ? <p className="text-sm text-ink-soft">Loading…</p> : null}

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card title="Type of care" n="01">
          <Chips label="Care types" options={[...CARE_TYPES]} value={p.care_types} onToggle={(v) => toggle("care_types", v)} />
          <Chips label="Where" options={CARE_SETTINGS} value={p.care_settings} onToggle={(v) => toggle("care_settings", v)} />
          <div>
            <span className={label}>Arrangement</span>
            <div className="flex flex-wrap gap-2">
              {ARRANGEMENTS.map((a) => (
                <Chip key={a} on={p.arrangement === a} onClick={() => set("arrangement", p.arrangement === a ? null : a)}>
                  {a}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <label className={label} htmlFor="start">Start date</label>
            <input
              id="start"
              type="date"
              value={p.start_date ?? ""}
              onChange={(e) => set("start_date", e.target.value || null)}
              className={`${field} sm:max-w-xs`}
            />
          </div>
        </Card>

        <Card title="Budget" n="02">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="bmin">Min $/day</label>
              <input
                id="bmin"
                type="number"
                min={0}
                step={5}
                inputMode="numeric"
                value={p.budget_min ?? ""}
                onChange={(e) => set("budget_min", e.target.value === "" ? null : Number(e.target.value))}
                className={field}
                placeholder="e.g. 60"
              />
            </div>
            <div>
              <label className={label} htmlFor="bmax">Max $/day</label>
              <input
                id="bmax"
                type="number"
                min={0}
                step={5}
                inputMode="numeric"
                value={p.budget_max ?? ""}
                onChange={(e) => set("budget_max", e.target.value === "" ? null : Number(e.target.value))}
                className={field}
                placeholder="e.g. 150"
              />
            </div>
          </div>
          <div>
            <span className={label}>How firm is it?</span>
            <div className="flex flex-wrap gap-2">
              {BUDGET_FLEX.map((f) => (
                <Chip key={f} on={p.budget_flexibility === f} onClick={() => set("budget_flexibility", p.budget_flexibility === f ? null : f)}>
                  {f}
                </Chip>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Location" n="03">
          <Chips
            label="Preferred cities"
            options={Array.from(new Set([...CITIES, ...p.preferred_cities]))}
            value={p.preferred_cities}
            onToggle={(v) => toggle("preferred_cities", v)}
            addPlaceholder="Add a city"
          />
          <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
            <div>
              <label className={label} htmlFor="dist">Max distance (miles)</label>
              <input
                id="dist"
                type="number"
                min={1}
                max={100}
                value={p.max_distance_miles ?? ""}
                onChange={(e) => set("max_distance_miles", e.target.value === "" ? null : Number(e.target.value))}
                className={field}
                placeholder="e.g. 10"
              />
            </div>
            <label className="flex items-center gap-3 rounded-2xl bg-background px-4 py-3 text-sm ring-1 ring-line">
              <input
                type="checkbox"
                checked={p.needs_transportation}
                onChange={(e) => set("needs_transportation", e.target.checked)}
                className="size-4 accent-primary"
              />
              Need pickup / drop-off help
            </label>
          </div>
        </Card>

        <Card title="Must-haves" n="04">
          <Chips label="Required" options={MUST_HAVES} value={p.must_haves} onToggle={(v) => toggle("must_haves", v)} />
          <div>
            <label className={label} htmlFor="deal">Dealbreakers</label>
            <textarea
              id="deal"
              rows={2}
              maxLength={1000}
              value={p.dealbreakers ?? ""}
              onChange={(e) => set("dealbreakers", e.target.value)}
              className={field}
              placeholder="e.g. No screen time, no more than 8 kids per caregiver"
            />
          </div>
        </Card>

        <Card title="Teaching approach & language" n="05">
          <Chips label="Approach" options={APPROACHES} value={p.approaches} onToggle={(v) => toggle("approaches", v)} />
          <Chips
            label="Languages the caregiver should speak"
            options={Array.from(new Set(["English", "Spanish", ...p.languages_wanted]))}
            value={p.languages_wanted}
            onToggle={(v) => toggle("languages_wanted", v)}
            addPlaceholder="Add a language"
          />
        </Card>

        <Card title="About your kids" n="06">
          <div>
            <label className={label} htmlFor="needs">Needs the caregiver should know</label>
            <textarea
              id="needs"
              rows={3}
              maxLength={1000}
              value={p.child_needs ?? ""}
              onChange={(e) => set("child_needs", e.target.value)}
              className={field}
              placeholder="Allergies, medical or developmental needs, potty training, nap schedule, personality…"
            />
          </div>
          <div>
            <label className={label} htmlFor="diet">Diet</label>
            <input
              id="diet"
              maxLength={500}
              value={p.diet ?? ""}
              onChange={(e) => set("diet", e.target.value)}
              className={field}
              placeholder="e.g. Vegetarian, no nuts, bottle-fed"
            />
          </div>
        </Card>

        <Card title="Communication" n="07">
          <Chips
            label="How you want to hear from the caregiver"
            options={COMMUNICATION}
            value={p.communication}
            onToggle={(v) => toggle("communication", v)}
          />
        </Card>

        <Card title="What matters most" n="08">
          <p className="-mt-1 text-sm text-ink-soft">Tap in order of importance. The AI weighs #1 the most.</p>
          <div className="flex flex-wrap gap-2">
            {PRIORITY_OPTIONS.map((o) => {
              const i = p.priorities.indexOf(o);
              return (
                <Chip key={o} on={i >= 0} onClick={() => toggle("priorities", o)}>
                  {i >= 0 ? <span className="mr-1 font-mono">#{i + 1}</span> : null}
                  {o}
                </Chip>
              );
            })}
          </div>
        </Card>

        <Card title="Instructions for the AI" n="09" wide>
          <div>
            <label className={label} htmlFor="notes">Anything else the AI should know</label>
            <textarea
              id="notes"
              rows={4}
              maxLength={2000}
              value={p.notes_for_ai ?? ""}
              onChange={(e) => set("notes_for_ai", e.target.value)}
              className={field}
              placeholder="e.g. We both work hospital shifts that change weekly. Our son is shy and does best in small groups. We'd love a caregiver who can help with reading."
            />
          </div>
          <div>
            <span className={label}>Answer style</span>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <Chip key={s} on={p.ai_answer_style === s} onClick={() => set("ai_answer_style", s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3">
          <p className="hidden text-sm text-ink-soft sm:block">Saved preferences are used by AI recommendations and the AI chat.</p>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/assistant" className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-soft hover:text-ink">
              Open AI chat
            </Link>
            <button disabled={saving} className={btn}>
              {saving ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Card({ title, n, wide, children }: { title: string; n: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6 ${wide ? "lg:col-span-2" : ""}`}>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-ink-faint">{n}</span>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        on
          ? "border-primary bg-primary text-primary-soft"
          : "border-line bg-background text-ink-soft hover:border-primary hover:text-primary-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Chips({
  label: text,
  options,
  value,
  onToggle,
  addPlaceholder,
}: {
  label: string;
  options: string[];
  value: string[];
  onToggle: (v: string) => void;
  addPlaceholder?: string;
}) {
  const [extra, setExtra] = useState("");
  const add = () => {
    const v = extra.trim().slice(0, 40);
    if (v && !value.includes(v)) onToggle(v);
    setExtra("");
  };
  return (
    <div>
      <span className={label}>{text}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} on={value.includes(o)} onClick={() => onToggle(o)}>
            {o}
          </Chip>
        ))}
      </div>
      {addPlaceholder ? (
        <div className="mt-2 flex gap-2">
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            className={`${field} min-w-0 py-2`}
            placeholder={addPlaceholder}
            aria-label={addPlaceholder}
          />
          <button type="button" onClick={add} className="rounded-full border border-line px-4 text-sm font-semibold text-ink-soft hover:border-primary hover:text-primary-ink">
            Add
          </button>
        </div>
      ) : null}
    </div>
  );
}
