import { Link } from "@tanstack/react-router";
import { photoFor } from "@/components/photos";
import { RatingSummary } from "@/components/StarRating";
import { distanceLabel, priceLabel, type Provider } from "@/lib/model";
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
    <article className="card-lift grid gap-4 rounded-3xl bg-surface p-4 ring-1 ring-line sm:grid-cols-[168px_minmax(0,1fr)]">
      <div className="relative">
        <ProviderPhoto provider={provider} className="aspect-[16/10] w-full rounded-2xl sm:aspect-square" />
        <span className="absolute left-2 top-2">
          <VerifiedBadge verified={provider.verified} />
        </span>
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold tracking-tight">{provider.name}</h2>
              <span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-semibold text-ink-soft">
                {provider.careType}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">{provider.blurb}</p>
          </div>
          <div className="flex shrink-0 items-baseline gap-2 sm:block sm:text-right">
            <p className="font-display text-xl font-bold leading-none">
              {provider.dailyRate === null ? (
                <span className="text-sm font-semibold text-ink-faint">Pricing unavailable</span>
              ) : (
                priceLabel(provider)
              )}
            </p>
            <p className="text-xs text-ink-faint sm:mt-1">{distanceLabel(provider.distance)}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <RatingSummary rating={provider.rating} reviewCount={provider.reviewCount} size="sm" />
          {provider.reviewCount ? <span className="text-ink-faint">·</span> : null}
          <span className="text-ink-soft">{provider.address}</span>
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
            className="whitespace-nowrap rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink sm:px-4"
          >
            View profile
          </Link>
          <Link
            to="/providers/$providerId"
            params={{ providerId: provider.id }}
            hash="compare"
            className="whitespace-nowrap rounded-full border border-line px-3.5 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary-ink sm:px-4"
          >
            <span className="sm:hidden">Compare</span>
            <span className="hidden sm:inline">Compare schedule</span>
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
