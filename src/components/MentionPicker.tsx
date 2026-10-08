import { useProviders } from "@/lib/data";

/** Tag providers in a post or reply. */
export function MentionPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const providers = useProviders();
  if (!providers.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">Tag providers (optional)</p>
      <div className="flex flex-wrap gap-1.5">
        {providers.map((p) => {
          const on = value.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}
              className={`chip rounded-full px-3 py-1.5 text-xs font-semibold ${
                on ? "bg-primary-soft text-primary-ink" : "border border-line text-ink-soft hover:border-primary"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
