import { Link } from "@tanstack/react-router";
import { photoFor } from "@/components/photos";
import { priceLabel, type Provider } from "@/data/mock";
import { useApp } from "@/lib/app-state";

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-leaf px-2 py-1 text-[11px] font-semibold text-white">
      ✓ Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-sun-soft px-2 py-1 text-[11px] font-semibold text-ink-soft">
      Not verified
    </span>
  );
}

export function ProviderPhoto({
  provider,
  className = "",
}: {
  provider: Provider;
  className?: string;
}) {
  const src = photoFor(provider.photo);
  if (!src)
    return (
      <div
        className={`grid place-items-center rounded-2xl bg-primary-soft ${className}`}
        aria-label={`${provider.name} has no photo`}
      >
        <span className="font-display text-3xl font-bold text-primary-ink">
          {provider.name.slice(0, 1)}
        </span>
      </div>
    );
  return (
    <img
      src={src}
      alt={provider.name}
      loading="lazy"
      width={816}
      height={816}
      className={`object-cover ${className}`}
    />
  );
}

export function ProviderCard({ provider }: { provider: Provider }) {
  const { isFavorite, toggleFavorite } = useApp();
  const fav = isFavorite(provider.id);

  return (
    <article className="card-lift grid gap-4 rounded-3xl bg-surface p-4 ring-1 ring-line sm:grid-cols-[168px_1fr]">
      <div className="relative">
        <ProviderPhoto provider={provider} className="aspect-square w-full rounded-2xl" />
        <span className="absolute left-2 top-2">
          <VerifiedBadge verified={provider.verified} />
        </span>
      </div>
      <div className="flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-bold tracking-tight">{provider.name}</h3>
              <span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-semibold text-ink-soft">
                {provider.careType}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">{provider.blurb}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-xl font-bold leading-none">
              {provider.dailyRate === null ? (
                <span className="text-sm font-semibold text-ink-faint">Pricing unavailable</span>
              ) : (
                priceLabel(provider)
              )}
            </p>
            <p className="mt-1 text-xs text-ink-faint">{provider.distance} mi away</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1 font-semibold text-ink">
            <span className="text-sun">★</span> {provider.rating.toFixed(1)}
          </span>
          <span className="text-ink-faint">{provider.reviewCount} reviews</span>
          <span className="text-ink-faint">·</span>
          <span className="text-ink-soft">{provider.neighborhood}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              provider.schedule ? "bg-background text-ink-soft" : "bg-clay-soft text-clay"
            }`}
          >
            {provider.scheduleSummary}
          </span>
          {provider.languages.map((l) => (
            <span key={l} className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-ink-soft">
              {l}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2 pt-4">
          <Link
            to="/providers/$providerId"
            params={{ providerId: provider.id }}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink"
          >
            View profile
          </Link>
          <Link
            to="/providers/$providerId"
            params={{ providerId: provider.id }}
            hash="compare"
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary-ink"
          >
            Compare schedule
          </Link>
          <button
            onClick={() => toggleFavorite(provider.id)}
            aria-label={fav ? `Remove ${provider.name} from favorites` : `Add ${provider.name} to favorites`}
            className={`ml-auto rounded-full p-2 text-lg transition-colors ${
              fav ? "text-clay" : "text-ink-faint hover:text-clay"
            }`}
          >
            {fav ? "♥" : "♡"}
          </button>
        </div>
      </div>
    </article>
  );
}
