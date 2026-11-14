import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/NavBar";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { QK, useLanguages } from "@/lib/data";
import { addressNeedsFixing, validateAddress } from "@/lib/geocode";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile — CareConnect" },
      {
        name: "description",
        content: "Your CareConnect profile: children, language, saved schedule and favorites.",
      },
      { property: "og:title", content: "My profile — CareConnect" },
      { property: "og:description", content: "Manage your family details, language and schedule." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const field =
  "w-full rounded-2xl bg-background px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-primary";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint";
const btn =
  "rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink disabled:opacity-50";

function ProfilePage() {
  return (
    <AppShell>
      <ProfileBody />
    </AppShell>
  );
}

function ProfileBody() {
  const { me, language, setLanguage, favorites, refreshMe } = useApp();
  const languages = useLanguages();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [addressNote, setAddressNote] = useState("");
  const [blurb, setBlurb] = useState("");
  const [busy, setBusy] = useState(false);
  const [kidName, setKidName] = useState("");
  const [kidAge, setKidAge] = useState("3");
  const [newLang, setNewLang] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!me) return;
    setName(me.name);
    setAddress(me.address);
    setBlurb(me.blurb);
  }, [me]);

  if (!me) return null;

  const refreshAll = () => {
    refreshMe();
    qc.invalidateQueries({ queryKey: QK.parents });
  };

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    const nextAddress = address.trim();
    const addressChanged = nextAddress !== me!.address.trim();

    // Check a new address before saving it. A Census match also gives us the
    // coordinates, so the distance filter never has to geocode this address.
    // Only an address the geocoder rejects blocks the save; if the service is
    // down we save the address and fill the point on a later save.
    let coordinates: {
      latitude?: number | null;
      longitude?: number | null;
      geocoded_at?: string | null;
    } = {};
    if (nextAddress && addressChanged) {
      try {
        const match = await validateAddress(nextAddress);
        coordinates = {
          latitude: match.latitude,
          longitude: match.longitude,
          geocoded_at: new Date().toISOString(),
        };
        setAddressNote(`Address verified: ${match.matchedAddress}`);
      } catch (error) {
        if (addressNeedsFixing(error)) {
          setBusy(false);
          setAddressNote("");
          toast.error(error instanceof Error ? error.message : "Check the address and try again.");
          return;
        }
        coordinates = { latitude: null, longitude: null, geocoded_at: null };
        setAddressNote("");
        toast.warning(
          "We couldn't verify the address right now. It was saved and will be checked again next time.",
        );
      }
    } else if (!nextAddress) {
      coordinates = { latitude: null, longitude: null, geocoded_at: null };
      setAddressNote("");
    }

    const { error: profileError } = await supabase
      .from("parents")
      .update({ name: name.trim(), blurb: blurb.trim() || null })
      .eq("id", me!.parentId);
    if (profileError) {
      setBusy(false);
      toast.error(profileError.message);
      return;
    }
    const { error: addressError } = await supabase.from("parent_private_addresses").upsert(
      {
        parent_id: me!.parentId,
        address: nextAddress || null,
        ...coordinates,
      },
      { onConflict: "parent_id" },
    );
    setBusy(false);
    if (addressError) {
      toast.error(addressError.message);
      return;
    }
    toast.success("Profile saved");
    refreshAll();
  }

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    if (!kidName.trim()) return;
    const { error } = await supabase.from("children").insert({
      parent_id: me!.parentId,
      name: kidName.trim(),
      age: kidAge === "" ? null : Number(kidAge),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setKidName("");
    refreshAll();
  }

  async function removeChild(id: number) {
    const { error } = await supabase.from("children").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refreshAll();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    toast.success("Password updated");
  }

  const langOptions = Array.from(new Set([language, "English", ...languages.map((l) => l.name)]));

  return (
    <>
      <section className="py-10">
        <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">
          Personal profile
        </span>
        <h1 className="mt-1 font-display text-4xl sm:text-5xl font-bold tracking-tight">
          {me.name}
        </h1>
        <p className="mt-2 text-ink-soft">{me.email}</p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-4">
          <form
            onSubmit={saveProfile}
            className="space-y-4 rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6"
          >
            <h2 className="font-display text-2xl font-bold">About you</h2>
            <div>
              <label className={label} htmlFor="p-name">
                Name
              </label>
              <input
                id="p-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={label} htmlFor="p-address">
                Address
              </label>
              <input
                id="p-address"
                autoComplete="street-address"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setAddressNote("");
                }}
                className={field}
                placeholder="Street address, city, state, ZIP"
              />
              <p className="mt-1 text-xs text-ink-faint">
                This address is private to your account. It is checked against the U.S. Census
                address database when you save, so distance filtering can locate it.
              </p>
              {addressNote ? (
                <p className="mt-1 text-xs font-medium text-primary-ink">{addressNote}</p>
              ) : null}
            </div>
            <div>
              <label className={label} htmlFor="p-blurb">
                About your family
              </label>
              <textarea
                id="p-blurb"
                rows={3}
                value={blurb}
                onChange={(e) => setBlurb(e.target.value)}
                className={field}
                placeholder="What kind of care are you looking for?"
              />
            </div>
            <button disabled={busy} className={btn}>
              {busy ? "Saving…" : "Save profile"}
            </button>
          </form>

          <div className="rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6">
            <h2 className="font-display text-2xl font-bold">Children</h2>
            {me.children.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">No children added yet.</p>
            ) : null}
            <ul className="mt-3 space-y-2">
              {me.children.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3 text-sm"
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="ml-auto text-ink-soft">
                    {c.age === null ? "" : `Age ${c.age}`}
                  </span>
                  <button
                    onClick={() => removeChild(c.id)}
                    className="text-xs font-semibold text-ink-soft hover:text-clay"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <form
              onSubmit={addChild}
              className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex"
            >
              <input
                value={kidName}
                onChange={(e) => setKidName(e.target.value)}
                className={`${field} col-span-2 min-w-0 sm:col-span-1`}
                placeholder="Child's name"
                aria-label="Child's name"
              />
              <input
                type="number"
                min={0}
                max={17}
                value={kidAge}
                onChange={(e) => setKidAge(e.target.value)}
                className="w-full min-w-0 rounded-2xl bg-background px-3 py-2 text-sm outline-none ring-1 ring-line sm:w-24"
                aria-label="Age"
              />
              <button className={`${btn} whitespace-nowrap`}>Add child</button>
            </form>

            <label className={`${label} mt-6`} htmlFor="lang">
              Language
            </label>
            <div className="flex gap-2">
              <select
                id="lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className={field}
              >
                {langOptions.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newLang.trim()) setLanguage(newLang.trim());
                setNewLang("");
              }}
              className="mt-2 flex gap-2"
            >
              <input
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                className={`${field} min-w-0`}
                placeholder="Not listed? Type a language"
                aria-label="Other language"
              />
              <button className={btn}>Use</button>
            </form>
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Link to="/schedule" className="card-lift rounded-3xl bg-primary p-5 text-primary-soft">
              <p className="font-display text-2xl font-bold">Saved schedule</p>
              <p className="mt-1 text-sm">View & edit</p>
            </Link>
            <Link to="/favorites" className="card-lift rounded-3xl bg-sun p-5 text-ink">
              <p className="font-display text-2xl font-bold">Favorites</p>
              <p className="mt-1 text-sm">{favorites.length} saved</p>
            </Link>
          </div>
          <Link to="/preferences" className="card-lift rounded-3xl bg-leaf p-5 text-white">
            <p className="font-display text-2xl font-bold">AI preferences</p>
            <p className="mt-1 text-sm">
              Budget, must-haves, approach, kids' needs and more, so the AI's picks fit your family.
            </p>
          </Link>
          <Link to="/listing" className="card-lift rounded-3xl bg-surface p-5 ring-1 ring-line">
            <p className="font-display text-2xl font-bold">Offer care?</p>
            <p className="mt-1 text-sm text-ink-soft">Create or edit your provider listing.</p>
          </Link>
          <form
            onSubmit={changePassword}
            className="space-y-3 rounded-3xl bg-surface p-5 ring-1 ring-line sm:p-6"
          >
            <h2 className="font-display text-2xl font-bold">Change password</h2>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
              placeholder="New password (6+ characters)"
              aria-label="New password"
            />
            <button className={btn}>Update password</button>
          </form>
        </div>
      </div>
    </>
  );
}
