import { useId, useState } from "react";
import { Star } from "lucide-react";

export type StarSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<StarSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-6 w-6",
};

function StarPiece({ fill, size }: { fill: number; size: StarSize }) {
  const clamped = Math.max(0, Math.min(1, fill));

  return (
    <span className={`relative inline-flex shrink-0 ${SIZE_CLASS[size]}`} aria-hidden="true">
      <Star className="h-full w-full text-sun-soft" fill="currentColor" strokeWidth={1.5} />
      {clamped > 0 ? (
        <Star
          className="absolute inset-0 h-full w-full text-sun"
          fill="currentColor"
          strokeWidth={1.5}
          style={{ clipPath: `inset(0 ${100 - clamped * 100}% 0 0)` }}
        />
      ) : null}
    </span>
  );
}

/** Read-only 0–5 star display. Supports fractional values like 4.6. */
export function Stars({
  value,
  size = "md",
  className = "",
}: {
  value: number;
  size?: StarSize;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={clamped > 0 ? `${clamped.toFixed(1)} out of 5 stars` : "No star rating yet"}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <StarPiece key={i} fill={clamped - i} size={size} />
      ))}
    </span>
  );
}

/** Stars plus the numeric average and review count. */
export function RatingSummary({
  rating,
  reviewCount,
  size = "md",
  className = "",
}: {
  rating: number;
  reviewCount: number;
  size?: StarSize;
  className?: string;
}) {
  if (!reviewCount) {
    return <span className={`text-sm text-ink-faint ${className}`}>No reviews yet</span>;
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      <Stars value={rating} size={size} />
      <span className="font-semibold text-ink">{rating.toFixed(1)}</span>
      <span className="text-ink-faint">
        ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
      </span>
    </span>
  );
}

/** Accessible 1–5 star picker built from native radio inputs. */
export function StarInput({
  label,
  value,
  onChange,
  disabled = false,
  name,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  name?: string;
}) {
  const autoName = useId();
  const groupName = name ?? autoName;
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
        {label}
      </legend>
      <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            onMouseEnter={() => {
              if (!disabled) setHover(n);
            }}
            onFocus={() => setHover(0)}
            className={`cursor-pointer rounded-md p-0.5 transition-transform hover:scale-110 focus-within:ring-2 focus-within:ring-primary ${
              disabled ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            <input
              type="radio"
              name={groupName}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              disabled={disabled}
              className="sr-only"
            />
            <Star
              className={`h-5 w-5 transition-colors sm:h-6 sm:w-6 ${
                n <= shown ? "text-sun" : "text-sun-soft"
              }`}
              fill="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <span className="sr-only">{n} out of 5 stars</span>
          </label>
        ))}
        <span className="ml-2 font-mono text-sm font-semibold text-ink-soft">{value}/5</span>
      </div>
    </fieldset>
  );
}
