import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AdminCheckbox,
  AdminField,
  AdminTextArea,
  AdminTextInput,
  adminInputClass,
} from "./AdminForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateProvider,
  useUpdateProvider,
  type AdminProvider,
  type AdminProviderOrigin,
  type AdminProviderWrite,
} from "@/lib/admin-data";
import { validateAddress } from "@/lib/geocode";

const CARE_TYPES = ["Daycare", "Preschool", "Sitter", "Family Friend"] as const;
const ORIGINS: AdminProviderOrigin[] = ["owned", "external", "sample"];

type Draft = {
  id: string;
  name: string;
  careType: string;
  listingOrigin: AdminProviderOrigin;
  isPublic: boolean;
  verified: boolean;
  blurb: string;
  bio: string;
  address: string;
  phone: string;
  dailyRate: string;
  dailyRateMax: string;
  distanceMiles: string;
  scheduleAvailable: boolean;
  scheduleSummary: string;
  photoKey: string;
  websiteUrl: string;
  contactUrl: string;
  sourceUrl: string;
  checkedOn: string;
  latitude: string;
  longitude: string;
};

function emptyDraft(): Draft {
  return {
    id: "",
    name: "",
    careType: "Daycare",
    listingOrigin: "owned",
    isPublic: true,
    verified: false,
    blurb: "",
    bio: "",
    address: "",
    phone: "",
    dailyRate: "",
    dailyRateMax: "",
    distanceMiles: "",
    scheduleAvailable: true,
    scheduleSummary: "",
    photoKey: "",
    websiteUrl: "",
    contactUrl: "",
    sourceUrl: "",
    checkedOn: "",
    latitude: "",
    longitude: "",
  };
}

function draftFrom(provider: AdminProvider): Draft {
  const text = (value: string | number | null) => (value === null ? "" : String(value));
  return {
    id: provider.id,
    name: provider.name,
    careType: provider.care_type,
    listingOrigin: provider.listing_origin,
    isPublic: provider.is_public,
    verified: provider.verified,
    blurb: provider.blurb ?? "",
    bio: provider.bio ?? "",
    address: provider.address ?? "",
    phone: provider.phone ?? "",
    dailyRate: text(provider.daily_rate),
    dailyRateMax: text(provider.daily_rate_max),
    distanceMiles: text(provider.distance_miles),
    scheduleAvailable: provider.schedule_available,
    scheduleSummary: provider.schedule_summary ?? "",
    photoKey: provider.photo_key ?? "",
    websiteUrl: provider.website_url ?? "",
    contactUrl: provider.contact_url ?? "",
    sourceUrl: provider.source_url ?? "",
    checkedOn: provider.checked_on ?? "",
    latitude: text(provider.latitude),
    longitude: text(provider.longitude),
  };
}

function numberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Create/edit dialog for the providers table. Both paths call the audited
 * `admin_create_provider` / `admin_update_provider` RPCs.
 */
export function ProviderFormDialog({
  open,
  onOpenChange,
  provider,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: AdminProvider | null;
}) {
  const create = useCreateProvider();
  const update = useUpdateProvider();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [locating, setLocating] = useState(false);

  // Reset the form whenever the dialog opens for a different record.
  useEffect(() => {
    if (!open) return;
    setDraft(provider ? draftFrom(provider) : emptyDraft());
  }, [open, provider]);

  const pending = create.isPending || update.isPending;
  const editing = !!provider;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * Editing the address invalidates the stored point. Clearing the latitude and
   * longitude fields makes that visible, and `submit` fills them again.
   */
  function setAddress(value: string) {
    setDraft((prev) => ({
      ...prev,
      address: value,
      ...(value.trim() === (provider?.address ?? "").trim() ? {} : { latitude: "", longitude: "" }),
    }));
  }

  async function locate() {
    const address = draft.address.trim();
    if (!address) {
      toast.error("Enter an address first");
      return;
    }
    setLocating(true);
    try {
      const match = await validateAddress(address);
      setDraft((prev) => ({
        ...prev,
        latitude: String(match.latitude),
        longitude: String(match.longitude),
      }));
      toast.success(`Found ${match.matchedAddress}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't look up that address");
    } finally {
      setLocating(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) {
      toast.error("Provider name is required");
      return;
    }

    const address = textOrNull(draft.address);
    let latitude = numberOrNull(draft.latitude);
    let longitude = numberOrNull(draft.longitude);

    // Fill missing coordinates from the address. An admin save is not blocked
    // when the Census service cannot match the address, so unusual or brand-new
    // addresses stay editable; the record simply saves without a point.
    if (address && (latitude === null || longitude === null)) {
      try {
        const match = await validateAddress(address);
        latitude = match.latitude;
        longitude = match.longitude;
      } catch (error) {
        toast.warning(
          error instanceof Error
            ? `${error.message} Saving without coordinates.`
            : "Address couldn't be verified. Saving without coordinates.",
        );
      }
    }

    const input: AdminProviderWrite = {
      id: draft.id.trim(),
      name: draft.name.trim(),
      care_type: draft.careType,
      listing_origin: draft.listingOrigin,
      is_public: draft.isPublic,
      verified: draft.verified,
      blurb: textOrNull(draft.blurb),
      bio: textOrNull(draft.bio),
      address,
      phone: textOrNull(draft.phone),
      daily_rate: numberOrNull(draft.dailyRate),
      daily_rate_max: numberOrNull(draft.dailyRateMax),
      distance_miles: numberOrNull(draft.distanceMiles),
      schedule_available: draft.scheduleAvailable,
      schedule_summary: textOrNull(draft.scheduleSummary),
      photo_key: textOrNull(draft.photoKey),
      website_url: textOrNull(draft.websiteUrl),
      contact_url: textOrNull(draft.contactUrl),
      source_url: textOrNull(draft.sourceUrl),
      checked_on: draft.checkedOn || null,
      latitude,
      longitude,
    };

    const mutation = editing ? update : create;
    mutation.mutate(input, {
      onSuccess: () => {
        toast.success(editing ? `${input.name} updated` : `${input.name} created`);
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Couldn't save the provider");
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl border-line bg-surface text-ink sm:rounded-[28px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold">
            {editing ? `Edit ${provider?.name}` : "Add provider"}
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-soft">
            Changes are saved directly to the providers table and recorded in the admin audit log.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminTextInput
              label="Name"
              required
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Sunny Meadows Daycare"
            />
            <AdminTextInput
              label="Provider ID"
              value={draft.id}
              onChange={(e) => set("id", e.target.value)}
              readOnly={editing}
              hint={
                editing
                  ? "The ID is the URL slug and cannot change."
                  : "Leave blank to generate a slug from the name."
              }
              placeholder="sunny-meadows"
            />
            <AdminField label="Care type">
              <select
                value={draft.careType}
                onChange={(e) => set("careType", e.target.value)}
                className={adminInputClass}
              >
                {CARE_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Listing origin">
              <select
                value={draft.listingOrigin}
                onChange={(e) => set("listingOrigin", e.target.value as AdminProviderOrigin)}
                className={adminInputClass}
              >
                {ORIGINS.map((origin) => (
                  <option key={origin} value={origin}>
                    {origin}
                  </option>
                ))}
              </select>
            </AdminField>
          </div>

          <div className="flex flex-wrap gap-2">
            <AdminCheckbox
              label="Public"
              checked={draft.isPublic}
              onChange={(value) => set("isPublic", value)}
            />
            <AdminCheckbox
              label="Verified"
              checked={draft.verified}
              onChange={(value) => set("verified", value)}
            />
            <AdminCheckbox
              label="Schedule available"
              checked={draft.scheduleAvailable}
              onChange={(value) => set("scheduleAvailable", value)}
            />
          </div>

          <AdminTextArea
            label="Short blurb"
            rows={2}
            value={draft.blurb}
            onChange={(e) => set("blurb", e.target.value)}
            placeholder="One or two sentences shown on the provider card."
          />
          <AdminTextArea
            label="Bio"
            rows={3}
            value={draft.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="Longer description for the provider page."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <AdminTextInput
              label="Address"
              value={draft.address}
              onChange={(e) => setAddress(e.target.value)}
              hint="Saving fills missing latitude and longitude from this address."
            />
            <AdminTextInput
              label="Phone"
              value={draft.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
            <AdminTextInput
              label="Daily rate (low)"
              type="number"
              min={0}
              step="0.01"
              value={draft.dailyRate}
              onChange={(e) => set("dailyRate", e.target.value)}
            />
            <AdminTextInput
              label="Daily rate (high)"
              type="number"
              min={0}
              step="0.01"
              value={draft.dailyRateMax}
              onChange={(e) => set("dailyRateMax", e.target.value)}
            />
            <AdminTextInput
              label="Distance (miles)"
              type="number"
              min={0}
              step="0.1"
              value={draft.distanceMiles}
              onChange={(e) => set("distanceMiles", e.target.value)}
            />
            <AdminTextInput
              label="Last checked"
              type="date"
              value={draft.checkedOn}
              onChange={(e) => set("checkedOn", e.target.value)}
            />
            <AdminTextInput
              label="Latitude"
              type="number"
              step="0.000001"
              value={draft.latitude}
              onChange={(e) => set("latitude", e.target.value)}
            />
            <AdminTextInput
              label="Longitude"
              type="number"
              step="0.000001"
              value={draft.longitude}
              onChange={(e) => set("longitude", e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={locate}
                disabled={locating || !draft.address.trim()}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-primary-ink transition-colors hover:bg-primary-soft disabled:opacity-60"
              >
                {locating ? "Looking up…" : "Find coordinates from address"}
              </button>
              <span className="text-xs text-ink-faint">
                Uses the U.S. Census geocoder. Blank fields are filled on save.
              </span>
            </div>
          </div>

          <AdminTextArea
            label="Schedule summary"
            rows={2}
            value={draft.scheduleSummary}
            onChange={(e) => set("scheduleSummary", e.target.value)}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <AdminTextInput
              label="Photo key"
              value={draft.photoKey}
              onChange={(e) => set("photoKey", e.target.value)}
              hint="File name under public/demo-provider-photos, e.g. careconnect-demo-1-1.jpg"
            />
            <AdminTextInput
              label="Website URL"
              value={draft.websiteUrl}
              onChange={(e) => set("websiteUrl", e.target.value)}
            />
            <AdminTextInput
              label="Contact URL"
              value={draft.contactUrl}
              onChange={(e) => set("contactUrl", e.target.value)}
            />
            <AdminTextInput
              label="Source URL"
              value={draft.sourceUrl}
              onChange={(e) => set("sourceUrl", e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-soft disabled:opacity-50"
            >
              {pending ? "Saving…" : editing ? "Save changes" : "Create provider"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
