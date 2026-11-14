import { useState } from "react";
import { providerPhotoUrl } from "@/lib/provider-photo";
import { Link } from "@tanstack/react-router";
import { demoPhotoFor, hasDemoWordmark, illustrationFor, photoFor } from "@/components/photos";
import { RatingSummary } from "@/components/StarRating";
import { priceLabel, providerDisplayAddress, type Provider } from "@/lib/model";
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

export function ProviderListingBadge({ provider }: { provider: Provider }) {
  if (provider.isDemo) {
    return (
      <span className="rounded-full bg-surface px-2 py-1 text-xs font-semibold text-ink-soft">
        Fictional listing
      </span>
    );
  }
  return provider.listingOrigin === "external" ? (
    <span className="rounded-full bg-sun-soft px-2 py-1 text-xs font-semibold text-ink-soft">
      External listing
    </span>
  ) : (
    <VerifiedBadge verified={provider.verified} />
  );
}

const photoBrand = {
  Daycare: { label: "Childcare center", color: "text-amber-200" },
  Preschool: { label: "Early learning", color: "text-emerald-200" },
  Sitter: { label: "Babysitting", color: "text-sky-200" },
  "Family Friend": { label: "Backup care", color: "text-rose-200" },
};

export function ProviderPhoto({
  provider,
  className = "",
}: {
  provider: Provider;
  className?: string;
}) {
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const uploaded = provider.profilePhotoPath ? providerPhotoUrl(provider.profilePhotoPath) : null;
  const demoPhoto = demoPhotoFor(provider);
  const photo =
    provider.listingOrigin === "external"
      ? null
      : [uploaded, demoPhoto, photoFor(provider.photo)].find(
          (url) => url && !failedPhotos.includes(url),
        );
  const generatedDemoPhoto = !!photo && photo === demoPhoto;
  const wordmark = generatedDemoPhoto && hasDemoWordmark(provider.id);
  const brand = photoBrand[provider.careType];

  return (
    <div
      className={`relative isolate overflow-hidden ${wordmark ? "bg-[#fbf1db]" : "bg-primary-soft"} ${className}`}
    >
      <img
        src={photo ?? illustrationFor(provider)}
        alt={photo && photo !== demoPhoto ? provider.name : ""}
        onError={photo ? () => setFailedPhotos((failed) => [...failed, photo]) : undefined}
        loading="lazy"
        decoding="async"
        className={
          wordmark
            ? "absolute inset-x-0 top-0 h-[calc(100%-1.25rem)] w-full object-contain"
            : "absolute inset-0 size-full object-cover"
        }
      />
      {generatedDemoPhoto ? (
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 bottom-0 px-2.5 text-white ${wordmark ? "flex h-5 items-center justify-center bg-stone-900" : "bg-gradient-to-t from-black/90 via-black/65 to-transparent pb-2 pt-5"}`}
        >
          {wordmark ? null : (
            <span className="block text-xs leading-tight font-semibold">{provider.name}</span>
          )}
          <span
            className={`block text-[9px] leading-tight font-semibold uppercase tracking-wide ${brand.color}`}
          >
            {brand.label}
          </span>
        </div>
      ) : null}
      {!photo ? (
        <span className="absolute bottom-2 right-2 rounded-full bg-surface px-2 py-1 text-xs font-semibold text-ink-soft">
          Illustration
        </span>
      ) : null}
    </div>
  );
}

export function ProviderCard({
  provider,
  distanceMiles,
}: {
  provider: Provider;
  distanceMiles?: number;
}) {
  const { isFavorite, toggleFavorite } = useApp();
  const fav = isFavorite(provider.id);

  return (
    <article className="card-lift grid gap-4 rounded-3xl bg-surface p-4 ring-1 ring-line sm:grid-cols-[168px_minmax(0,1fr)]">
      <div className="relative">
        <ProviderPhoto
          provider={provider}
          className={`w-full rounded-2xl sm:aspect-square ${provider.isDemo ? "aspect-[4/3]" : "aspect-[16/10]"}`}
        />
        <span className="absolute left-2 top-2">
          <ProviderListingBadge provider={provider} />
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
          <p className="max-w-48 text-sm font-semibold text-primary-ink sm:text-right">
            {priceLabel(provider)}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <RatingSummary rating={provider.rating} reviewCount={provider.reviewCount} size="sm" />
          {provider.reviewCount ? <span className="text-ink-faint">·</span> : null}
          <span className="text-ink-soft">{providerDisplayAddress(provider)}</span>
          {distanceMiles !== undefined ? (
            <span className="font-medium text-primary-ink">{distanceMiles.toFixed(1)} mi away</span>
          ) : null}
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
            <span
              key={l}
              className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-ink-soft"
            >
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
          {provider.schedule || provider.externalProfile?.hours.kind === "published" ? (
            <Link
              to="/providers/$providerId"
              params={{ providerId: provider.id }}
              hash="compare"
              className="whitespace-nowrap rounded-full border border-line px-3.5 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary-ink sm:px-4"
            >
              <span className="sm:hidden">Compare</span>
              <span className="hidden sm:inline">Compare schedule</span>
            </Link>
          ) : null}
          <button
            onClick={() => toggleFavorite(provider.id)}
            aria-label={
              fav ? `Remove ${provider.name} from favorites` : `Add ${provider.name} to favorites`
            }
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
