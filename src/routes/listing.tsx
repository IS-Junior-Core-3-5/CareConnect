import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, LoadingState } from "@/components/NavBar";
import { ProviderPhoto } from "@/components/ProviderCard";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { QK, useLanguages, useProvidersQuery } from "@/lib/data";
import {
  providerPhotoExtensions,
  providerPhotoMaxBytes,
  providerPhotoStorage,
  providerPhotoUrl,
} from "@/lib/provider-photo";
import {
  CARE_TYPES,
  emptySchedule,
  scheduleToRows,
  slugify,
  type CareType,
  type Provider,
  type Schedule,
} from "@/lib/model";

export const Route = createFileRoute("/listing")({
  head: () => ({
    meta: [
      { title: "My listing — CareConnect" },
      {
        name: "description",
        content: "Offer child care on CareConnect: care type, pricing, schedule and availability.",
      },
    ],
  }),
  component: ListingPage,
});

function ListingPage() {
  return (
    <AppShell>
      <ListingBody />
    </AppShell>
  );
}

function ListingBody() {
  const { userId } = useApp();
  const q = useProvidersQuery();
  if (q.isLoading) return <LoadingState label="Loading your listing…" />;
  const mine = q.data?.find((p) => p.ownerId === userId) ?? null;
  return <ListingForm key={mine?.id ?? "new"} existing={mine} />;
}

const field =
  "w-full rounded-2xl bg-background px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-primary";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint";

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

function ListingForm({ existing }: { existing: Provider | null }) {
  const { userId, me } = useApp();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const allLanguages = useLanguages();

  const [name, setName] = useState(existing?.name ?? me?.name ?? "");
  const [careType, setCareType] = useState<CareType>(existing?.careType ?? "Sitter");
  const [blurb, setBlurb] = useState(existing?.blurb ?? "");
  const [bio, setBio] = useState(existing?.bio ?? "");
  const [rate, setRate] = useState(existing?.dailyRate?.toString() ?? "");
  const [rateMax, setRateMax] = useState(existing?.dailyRateMax?.toString() ?? "");
  const [pricingNotes, setPricingNotes] = useState(existing?.pricingNotes.join("\n") ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [distance, setDistance] = useState(existing?.distance?.toString() ?? "");
  const [languages, setLanguages] = useState<string[]>(existing?.languages ?? ["English"]);
  const [otherLang, setOtherLang] = useState("");
  const [licenses, setLicenses] = useState(existing?.licenses.join("\n") ?? "");
  const [hasSchedule, setHasSchedule] = useState(existing ? existing.schedule !== null : true);
  const [schedule, setSchedule] = useState<Schedule>(existing?.schedule ?? emptySchedule());
  const [scheduleSummary, setScheduleSummary] = useState(
    existing && existing.schedule ? existing.scheduleSummary : "",
  );
  const [listingId, setListingId] = useState(existing?.id);
  const [savedPhoto, setSavedPhoto] = useState(existing?.profilePhotoPath ?? null);
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [draggingPhoto, setDraggingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => setConfirmDelete(false), [existing]);

  useEffect(() => {
    if (!newPhoto) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(newPhoto);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [newPhoto]);

  function choosePhoto(files: FileList | null) {
    if (busy || !files?.length) return;
    const file = files[0];
    if (files.length !== 1) {
      setPhotoError("Choose one profile picture at a time.");
      return;
    }
    if (
      !providerPhotoExtensions.has(file.type) ||
      file.size > providerPhotoMaxBytes ||
      !file.size
    ) {
      setPhotoError("Choose a JPEG, PNG, or WebP image up to 5 MB.");
      return;
    }
    setPhotoError("");
    setNewPhoto(file);
    setRemovePhoto(false);
  }

  async function deleteUnusedPhoto(path: string | null) {
    if (path) await providerPhotoStorage.remove([path]).catch(() => undefined);
  }

  const langOptions = Array.from(
    new Set([...allLanguages.map((l) => l.name), ...languages]),
  ).sort();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || busy) return;
    const dailyRate = rate === "" ? null : Number(rate);
    const dailyRateMax = rateMax === "" ? null : Number(rateMax);
    if (dailyRate !== null && dailyRateMax !== null && dailyRateMax < dailyRate) {
      toast.error("The highest rate can't be lower than the starting rate.");
      return;
    }
    setBusy(true);
    try {
      const id = listingId ?? slugify(name);
      let uploadedPath: string | null = null;
      if (newPhoto) {
        const extension = providerPhotoExtensions.get(newPhoto.type);
        uploadedPath = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error } = await providerPhotoStorage.upload(uploadedPath, newPhoto);
        if (error) throw error;
      }
      const photoChanged = !!uploadedPath || removePhoto;
      const nextPhoto = uploadedPath ?? (removePhoto ? null : savedPhoto);
      const row = {
        ...(photoChanged ? { profile_photo_path: nextPhoto } : {}),
        name: name.trim(),
        care_type: careType,
        blurb: blurb.trim() || null,
        bio: bio.trim() || null,
        daily_rate: dailyRate,
        daily_rate_max: dailyRateMax,
        address: address.trim() || null,
        phone: phone.trim() || null,
        distance_miles: distance === "" ? null : Number(distance),
        schedule_available: hasSchedule,
        schedule_summary: hasSchedule ? scheduleSummary.trim() || null : null,
      };
      const res = listingId
        ? await supabase.from("providers").update(row).eq("id", id).select("id").single()
        : await supabase
            .from("providers")
            .insert({ ...row, id, owner_id: userId })
            .select("id")
            .single();
      if (res.error) {
        // A missing HTTP response leaves the outcome uncertain. Keep the file in that case.
        if (res.status > 0 && res.status < 500) await deleteUnusedPhoto(uploadedPath);
        throw res.error;
      }
      setListingId(id);
      if (photoChanged) {
        setSavedPhoto(nextPhoto);
        setNewPhoto(null);
        setPhotoError("");
        setRemovePhoto(false);
        await deleteUnusedPhoto(savedPhoto);
      }

      // Child rows are updated by diff instead of delete-then-insert, so a
      // failed request can never leave the listing half-empty.

      // Pricing notes: update matching rows in place, add new ones, drop extras.
      const { data: noteRows, error: noteReadError } = await supabase
        .from("provider_pricing_notes")
        .select("id, note, sort_order")
        .eq("provider_id", id)
        .order("sort_order");
      if (noteReadError) throw noteReadError;
      const existingNotes = (noteRows ?? []) as { id: number; note: string; sort_order: number }[];
      const notes = lines(pricingNotes);
      for (let i = 0; i < Math.min(existingNotes.length, notes.length); i++) {
        if (existingNotes[i].note === notes[i] && existingNotes[i].sort_order === i) continue;
        const r = await supabase
          .from("provider_pricing_notes")
          .update({ note: notes[i], sort_order: i })
          .eq("id", existingNotes[i].id);
        if (r.error) throw r.error;
      }
      const addedNotes = notes.slice(existingNotes.length);
      if (addedNotes.length) {
        const r = await supabase.from("provider_pricing_notes").insert(
          addedNotes.map((note, i) => ({
            provider_id: id,
            note,
            sort_order: existingNotes.length + i,
          })),
        );
        if (r.error) throw r.error;
      }
      const removedNotes = existingNotes.slice(notes.length).map((n) => n.id);
      if (removedNotes.length) {
        const r = await supabase.from("provider_pricing_notes").delete().in("id", removedNotes);
        if (r.error) throw r.error;
      }

      // Credentials are verified by admins, and this form is not allowed to set
      // that flag. Update them in place (add new names, remove dropped ones) so
      // editing a listing never resets existing verification.
      const lic = [...new Set(lines(licenses))];
      const { data: credRows, error: credReadError } = await supabase
        .from("provider_credentials")
        .select("id, name")
        .eq("provider_id", id);
      if (credReadError) throw credReadError;
      const existingCreds = (credRows ?? []) as { id: number; name: string }[];
      const existingCredNames = new Set(existingCreds.map((c) => c.name));
      const addedCreds = lic.filter((name) => !existingCredNames.has(name));
      if (addedCreds.length) {
        const r = await supabase
          .from("provider_credentials")
          .insert(addedCreds.map((name) => ({ provider_id: id, name })));
        if (r.error) throw r.error;
      }
      const wantedCreds = new Set(lic);
      const removedCreds = existingCreds.filter((c) => !wantedCreds.has(c.name)).map((c) => c.id);
      if (removedCreds.length) {
        const r = await supabase.from("provider_credentials").delete().in("id", removedCreds);
        if (r.error) throw r.error;
      }

      // Languages: add first, then remove dropped ones.
      if (languages.length) {
        const missing = languages.filter((l) => !allLanguages.some((x) => x.name === l));
        if (missing.length) {
          const r = await supabase.from("languages").upsert(
            missing.map((n) => ({ name: n })),
            { onConflict: "name", ignoreDuplicates: true },
          );
          if (r.error) throw r.error;
        }
        const { data: langRows, error: langError } = await supabase
          .from("languages")
          .select("id, name")
          .in("name", languages);
        if (langError) throw langError;
        const wantedLanguageIds = new Set((langRows ?? []).map((l) => l.id));
        const { data: currentLanguages, error: currentLanguageError } = await supabase
          .from("provider_languages")
          .select("language_id")
          .eq("provider_id", id);
        if (currentLanguageError) throw currentLanguageError;
        const currentLanguageIds = new Set((currentLanguages ?? []).map((l) => l.language_id));
        const addedLanguages = [...wantedLanguageIds].filter((lid) => !currentLanguageIds.has(lid));
        if (addedLanguages.length) {
          const r = await supabase
            .from("provider_languages")
            .insert(addedLanguages.map((language_id) => ({ provider_id: id, language_id })));
          if (r.error) throw r.error;
        }
        const removedLanguages = [...currentLanguageIds].filter(
          (lid) => !wantedLanguageIds.has(lid),
        );
        if (removedLanguages.length) {
          const r = await supabase
            .from("provider_languages")
            .delete()
            .eq("provider_id", id)
            .in("language_id", removedLanguages);
          if (r.error) throw r.error;
        }
      } else {
        // No languages selected: clear any existing rows.
        const r = await supabase.from("provider_languages").delete().eq("provider_id", id);
        if (r.error) throw r.error;
      }

      // Availability: add first, then remove dropped blocks.
      const desiredBlocks = hasSchedule ? scheduleToRows(schedule) : [];
      const blockKey = (d: number, b: string) => `${d}:${b}`;
      const desiredKeys = new Set(desiredBlocks.map((r) => blockKey(r.day_of_week, r.block)));
      const { data: currentAvailability, error: availabilityError } = await supabase
        .from("provider_availability")
        .select("day_of_week, block")
        .eq("provider_id", id);
      if (availabilityError) throw availabilityError;
      const currentKeys = new Set(
        (currentAvailability ?? []).map((r) => blockKey(r.day_of_week, r.block)),
      );
      const addedBlocks = desiredBlocks.filter(
        (r) => !currentKeys.has(blockKey(r.day_of_week, r.block)),
      );
      if (addedBlocks.length) {
        const r = await supabase
          .from("provider_availability")
          .insert(addedBlocks.map((b) => ({ provider_id: id, ...b })));
        if (r.error) throw r.error;
      }
      for (const b of currentAvailability ?? []) {
        if (desiredKeys.has(blockKey(b.day_of_week, b.block))) continue;
        const r = await supabase
          .from("provider_availability")
          .delete()
          .match({ provider_id: id, day_of_week: b.day_of_week, block: b.block });
        if (r.error) throw r.error;
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: QK.providers }),
        qc.invalidateQueries({ queryKey: QK.languages }),
      ]);
      toast.success(existing ? "Listing updated" : "Listing published");
      navigate({ to: "/providers/$providerId", params: { providerId: id } });
    } catch (err) {
      console.error(err);
      toast.error(
        `Couldn't save all listing changes. ${err && typeof err === "object" && "message" in err ? err.message : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    const { error } = await supabase.from("providers").delete().eq("id", existing.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await deleteUnusedPhoto(savedPhoto);
    toast.success("Listing deleted");
    await qc.invalidateQueries({ queryKey: QK.providers });
    navigate({ to: "/providers" });
  }

  const previewUrl =
    photoPreview ?? (!removePhoto && savedPhoto ? providerPhotoUrl(savedPhoto) : null);

  return (
    <section className="py-8">
      <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">
        Provider listing
      </span>
      <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight">
        {existing ? "Edit your listing" : "Offer care on CareConnect"}
      </h1>
      <p className="mt-1 max-w-[60ch] text-sm text-ink-soft">
        Parents search and filter by these details. Leave the price empty if you'd rather not list
        one — it will show as "Ask provider for rates".
        {existing ? (
          <>
            {" "}
            <Link
              to="/providers/$providerId"
              params={{ providerId: existing.id }}
              className="font-semibold text-primary-ink"
            >
              View your public profile
            </Link>
          </>
        ) : null}
      </p>

      <form onSubmit={save} className="mt-6 grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
          <h2 className="font-display text-2xl font-bold">Basics</h2>
          <div>
            <label className={label} htmlFor="l-photo">
              Profile picture
            </label>
            <div
              onDragEnter={(event) => {
                if (!event.dataTransfer.types.includes("Files")) return;
                event.preventDefault();
                if (busy) return;
                dragDepth.current += 1;
                setDraggingPhoto(true);
              }}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes("Files")) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = busy ? "none" : "copy";
              }}
              onDragLeave={() => {
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (dragDepth.current === 0) setDraggingPhoto(false);
              }}
              onDrop={(event) => {
                if (!event.dataTransfer.types.includes("Files")) return;
                event.preventDefault();
                dragDepth.current = 0;
                setDraggingPhoto(false);
                choosePhoto(event.dataTransfer.files);
              }}
              className={`flex flex-wrap items-center gap-4 rounded-2xl border-2 border-dashed p-4 transition-colors ${
                draggingPhoto && !busy
                  ? "border-primary bg-primary-soft"
                  : "border-line bg-background"
              }`}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Listing picture preview"
                  className="size-24 shrink-0 rounded-xl object-cover"
                />
              ) : existing && !removePhoto ? (
                <ProviderPhoto provider={existing} className="size-24 shrink-0 rounded-xl" />
              ) : (
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface text-primary-ink">
                  <ImagePlus className="size-5" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0 flex-1 basis-40">
                <p className="text-sm font-semibold">Drag and drop a photo here</p>
                <p id="l-photo-help" className="mt-1 text-xs text-ink-soft">
                  One JPEG, PNG, or WebP up to 5 MB. Your photo becomes public when you save.
                </p>
                <input
                  id="l-photo"
                  ref={photoInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={(event) => {
                    choosePhoto(event.currentTarget.files);
                    event.currentTarget.value = "";
                  }}
                  aria-describedby="l-photo-help"
                  hidden
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => photoInput.current?.click()}
                  aria-describedby="l-photo-help"
                  className="mt-3 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-semibold text-primary-ink hover:border-primary disabled:opacity-50"
                >
                  {newPhoto || (savedPhoto && !removePhoto) ? "Change photo" : "Choose photo"}
                </button>
              </div>
            </div>
            {photoError ? (
              <p role="alert" className="mt-2 text-sm text-clay">
                {photoError}
              </p>
            ) : null}
            {newPhoto || removePhoto ? (
              <p role="status" className="mt-2 break-words text-xs text-ink-soft">
                {newPhoto
                  ? `Selected: ${newPhoto.name}. Save to publish it.`
                  : "The uploaded photo will be removed when you save."}
              </p>
            ) : null}
            {newPhoto || savedPhoto ? (
              <button
                type="button"
                disabled={busy}
                className="mt-2 text-sm font-semibold text-primary-ink hover:underline disabled:opacity-50"
                onClick={() => {
                  setPhotoError("");
                  if (newPhoto) setNewPhoto(null);
                  else setRemovePhoto(!removePhoto);
                }}
              >
                {newPhoto
                  ? "Discard selected photo"
                  : removePhoto
                    ? "Keep uploaded photo"
                    : "Remove uploaded photo"}
              </button>
            ) : null}
          </div>
          <div>
            <label className={label} htmlFor="l-name">
              Listing name
            </label>
            <input
              id="l-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="l-type">
                Care type
              </label>
              <select
                id="l-type"
                value={careType}
                onChange={(e) => setCareType(e.target.value as CareType)}
                className={field}
              >
                {CARE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="l-address">
                Address
              </label>
              <input
                id="l-address"
                required
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={field}
                placeholder="Street address, city, state, ZIP"
              />
            </div>
          </div>
          <div>
            <label className={label} htmlFor="l-phone">
              Contact phone
            </label>
            <input
              id="l-phone"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={field}
              placeholder="(555) 555-5555"
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              Your address and phone number appear on your public provider profile.
            </p>
          </div>
          <div>
            <label className={label} htmlFor="l-blurb">
              One-line summary
            </label>
            <input
              id="l-blurb"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              className={field}
              placeholder="After-school care and homework help"
            />
          </div>
          <div>
            <label className={label} htmlFor="l-bio">
              About your care
            </label>
            <textarea
              id="l-bio"
              rows={5}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <span className={label}>Languages</span>
            <div className="flex flex-wrap gap-1.5">
              {langOptions.map((l) => {
                const on = languages.includes(l);
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() =>
                      setLanguages((prev) => (on ? prev.filter((x) => x !== l) : [...prev, l]))
                    }
                    className={`chip rounded-full px-3 py-1.5 text-xs font-semibold ${
                      on ? "bg-primary-soft text-primary-ink" : "border border-line text-ink-soft"
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={otherLang}
                onChange={(e) => setOtherLang(e.target.value)}
                className={field}
                placeholder="Add another language"
                aria-label="Add another language"
              />
              <button
                type="button"
                onClick={() => {
                  const v = otherLang.trim();
                  if (v && !languages.includes(v)) setLanguages((p) => [...p, v]);
                  setOtherLang("");
                }}
                className="rounded-2xl border border-line px-4 text-sm font-semibold text-ink-soft"
              >
                Add
              </button>
            </div>
          </div>
          <div>
            <label className={label} htmlFor="l-lic">
              Licenses & certifications (one per line)
            </label>
            <textarea
              id="l-lic"
              rows={3}
              value={licenses}
              onChange={(e) => setLicenses(e.target.value)}
              className={field}
              placeholder={"Pediatric CPR\nState background check (2026)"}
            />
            <p className="mt-1 text-[11px] text-ink-faint">
              The Verified badge is added by CareConnect after review, not by the listing owner.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
            <h2 className="font-display text-2xl font-bold">Pricing</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={label} htmlFor="l-rate">
                  Daily rate ($)
                </label>
                <input
                  id="l-rate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label className={label} htmlFor="l-rmax">
                  Up to ($)
                </label>
                <input
                  id="l-rmax"
                  type="number"
                  min={0}
                  step="0.01"
                  value={rateMax}
                  onChange={(e) => setRateMax(e.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label className={label} htmlFor="l-dist">
                  Distance (mi)
                </label>
                <input
                  id="l-dist"
                  type="number"
                  min={0}
                  step="0.1"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  className={field}
                />
              </div>
            </div>
            <div>
              <label className={label} htmlFor="l-notes">
                Price details (one per line)
              </label>
              <textarea
                id="l-notes"
                rows={3}
                value={pricingNotes}
                onChange={(e) => setPricingNotes(e.target.value)}
                className={field}
                placeholder={"Full day (7am – 6pm): $190\nSibling rate: +$35"}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">Availability</h2>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={hasSchedule}
                  onChange={(e) => setHasSchedule(e.target.checked)}
                />
                Show my schedule
              </label>
            </div>
            {hasSchedule ? (
              <>
                <ScheduleGrid
                  schedule={schedule}
                  editable
                  onToggle={(d, t) =>
                    setSchedule((prev) =>
                      prev.map((row, di) =>
                        di === d ? row.map((v, ti) => (ti === t ? !v : v)) : row,
                      ),
                    )
                  }
                />
                <div>
                  <label className={label} htmlFor="l-sum">
                    Hours summary
                  </label>
                  <input
                    id="l-sum"
                    value={scheduleSummary}
                    onChange={(e) => setScheduleSummary(e.target.value)}
                    className={field}
                    placeholder="Mon–Fri · 7am–6pm"
                  />
                </div>
              </>
            ) : (
              <p className="rounded-2xl bg-clay-soft px-4 py-3 text-sm font-medium text-clay">
                Your listing will say "Schedule unavailable" and won't appear in schedule matches.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={busy}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-soft hover:bg-primary-ink disabled:opacity-50"
            >
              {busy ? "Saving…" : existing ? "Save changes" : "Publish listing"}
            </button>
            {existing ? (
              confirmDelete ? (
                <span className="flex items-center gap-2 text-sm">
                  Delete this listing and its reviews?
                  <button
                    type="button"
                    disabled={busy}
                    onClick={remove}
                    className="font-semibold text-clay"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="font-semibold text-ink-soft"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="ml-auto text-sm font-semibold text-clay"
                >
                  Delete listing
                </button>
              )
            ) : null}
          </div>
        </div>
      </form>
    </section>
  );
}
