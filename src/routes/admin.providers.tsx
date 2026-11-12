import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "@/components/NavBar";
import { Stars } from "@/components/StarRating";
import {
  useAdminProviders,
  useSetProviderFlags,
  type AdminProvider,
  type AdminProviderOrigin,
} from "@/lib/admin-data";
import { formatDate } from "@/lib/model";

export const Route = createFileRoute("/admin/providers")({
  head: () => ({
    meta: [{ title: "Admin providers — CareConnect" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminProviders,
});

type OriginFilter = "all" | AdminProviderOrigin;
type VisibilityFilter = "all" | "public" | "archived";
type VerifiedFilter = "all" | "verified" | "unverified";

const ORIGIN_LABEL: Record<AdminProviderOrigin, string> = {
  owned: "Owned",
  external: "External",
  sample: "Sample",
};

const ORIGIN_CLASS: Record<AdminProviderOrigin, string> = {
  owned: "bg-primary-soft text-primary-ink",
  external: "bg-sun-soft text-ink-soft",
  sample: "bg-background text-ink-faint",
};

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-2xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdminProviders() {
  const { data, isLoading, error } = useAdminProviders();
  const setFlags = useSetProviderFlags();

  const [search, setSearch] = useState("");
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [verification, setVerification] = useState<VerifiedFilter>("all");

  const providers = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return providers.filter((provider) => {
      if (origin !== "all" && provider.listing_origin !== origin) return false;
      if (visibility === "public" && !provider.is_public) return false;
      if (visibility === "archived" && provider.is_public) return false;
      if (verification === "verified" && !provider.verified) return false;
      if (verification === "unverified" && provider.verified) return false;
      if (!needle) return true;
      return (
        provider.name.toLowerCase().includes(needle) ||
        provider.id.toLowerCase().includes(needle) ||
        provider.care_type.toLowerCase().includes(needle) ||
        (provider.address ?? "").toLowerCase().includes(needle)
      );
    });
  }, [providers, search, origin, visibility, verification]);

  function updateFlags(provider: AdminProvider, flags: { verified?: boolean; isPublic?: boolean }) {
    setFlags.mutate(
      { providerId: provider.id, ...flags },
      {
        onSuccess: () => {
          const parts = [
            flags.verified === undefined ? null : flags.verified ? "verified" : "unverified",
            flags.isPublic === undefined ? null : flags.isPublic ? "published" : "archived",
          ].filter(Boolean);
          toast.success(`${provider.name} ${parts.join(" and ")}`);
        },
        onError: (mutationError) => {
          toast.error(
            mutationError instanceof Error ? mutationError.message : "Couldn't update the listing",
          );
        },
      },
    );
  }

  if (isLoading) return <LoadingState label="Loading providers…" />;

  if (error) {
    return (
      <div>
        <ErrorState error={error} />
        <p className="text-sm text-ink-soft">
          The admin migration may not be applied yet. Run{" "}
          <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
            supabase/migrations/20261111000000_admin_foundation.sql
          </code>{" "}
          in the Supabase SQL editor, then reload this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold">Providers</h2>
        <p className="mt-1 max-w-[70ch] text-sm text-ink-soft">
          Verify listings, publish or archive them, and spot directory data that needs a refresh.
          Changes are recorded in the admin audit log.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-3xl bg-surface p-4 ring-1 ring-line">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            Search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, ID, care type, or address"
            className="rounded-2xl border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <Select
          label="Origin"
          value={origin}
          onChange={setOrigin}
          options={[
            { value: "all", label: "All origins" },
            { value: "owned", label: "Owned" },
            { value: "external", label: "External" },
            { value: "sample", label: "Sample" },
          ]}
        />
        <Select
          label="Visibility"
          value={visibility}
          onChange={setVisibility}
          options={[
            { value: "all", label: "All listings" },
            { value: "public", label: "Public" },
            { value: "archived", label: "Archived" },
          ]}
        />
        <Select
          label="Verification"
          value={verification}
          onChange={setVerification}
          options={[
            { value: "all", label: "Any status" },
            { value: "verified", label: "Verified" },
            { value: "unverified", label: "Unverified" },
          ]}
        />
      </div>

      <p className="text-sm text-ink-soft">
        Showing {filtered.length} of {providers.length} listing{providers.length === 1 ? "" : "s"}.
      </p>

      {filtered.length ? (
        <div className="overflow-x-auto rounded-3xl bg-surface ring-1 ring-line">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Origin</th>
                <th className="px-4 py-3 font-medium">Verified</th>
                <th className="px-4 py-3 font-medium">Visibility</th>
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium">Checked</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((provider) => {
                const pending =
                  setFlags.isPending && setFlags.variables?.providerId === provider.id;
                const stale =
                  provider.listing_origin === "external" &&
                  (!provider.checked_on ||
                    provider.checked_on < new Date(Date.now() - 180 * 86400000).toISOString());

                return (
                  <tr key={provider.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{provider.name}</div>
                      <div className="text-xs text-ink-soft">
                        {provider.care_type}
                        {provider.address ? ` · ${provider.address}` : ""}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono text-ink-faint">{provider.id}</span>
                        {provider.website_url ? (
                          <a
                            href={provider.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-primary-ink hover:underline"
                          >
                            Website
                          </a>
                        ) : null}
                        {provider.source_url ? (
                          <a
                            href={provider.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-primary-ink hover:underline"
                          >
                            Source
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${ORIGIN_CLASS[provider.listing_origin]}`}
                      >
                        {ORIGIN_LABEL[provider.listing_origin]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full ${provider.verified ? "bg-primary" : "bg-line"}`}
                          aria-hidden="true"
                        />
                        <span className="font-medium">
                          {provider.verified ? "Verified" : "Unverified"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-ink-soft">
                        {provider.verified_credential_count}/{provider.credential_count} credentials
                        verified
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-medium ${provider.is_public ? "text-ink" : "text-ink-faint"}`}
                      >
                        {provider.is_public ? "Public" : "Archived"}
                      </span>
                      <div className="mt-1 text-xs text-ink-soft">
                        {provider.owner_id ? "Has owner" : "No owner"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {provider.review_count ? (
                        <div className="flex items-center gap-1.5">
                          <Stars value={provider.rating} size="sm" />
                          <span className="font-mono text-xs text-ink-soft">
                            {provider.rating} ({provider.review_count})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-faint">No reviews</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {provider.checked_on ? (
                        <span className={stale ? "font-semibold text-clay" : ""}>
                          {formatDate(provider.checked_on)}
                        </span>
                      ) : provider.listing_origin === "external" ? (
                        <span className="font-semibold text-clay">Never checked</span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => updateFlags(provider, { verified: !provider.verified })}
                          className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-primary/40 hover:text-ink disabled:opacity-50"
                        >
                          {provider.verified ? "Unverify" : "Verify"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (
                              provider.is_public &&
                              !window.confirm(
                                `Archive ${provider.name}? It will be hidden from parents.`,
                              )
                            )
                              return;
                            updateFlags(provider, { isPublic: !provider.is_public });
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                            provider.is_public
                              ? "border border-line text-ink-soft hover:border-clay/40 hover:text-clay"
                              : "bg-primary text-primary-soft hover:opacity-90"
                          }`}
                        >
                          {provider.is_public ? "Archive" : "Publish"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-3xl bg-surface p-8 text-center text-sm text-ink-soft ring-1 ring-line">
          No providers match these filters.
        </p>
      )}
    </div>
  );
}
