import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/NavBar";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { QK, useLanguages, useParents } from "@/lib/data";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile — CareConnect" },
      { name: "description", content: "Your CareConnect profile: children, language, saved schedule, favorites and connections." },
      { property: "og:title", content: "My profile — CareConnect" },
      { property: "og:description", content: "Manage your family details, language and parent connections." },
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
  const { me, language, setLanguage, favorites, connections, toggleConnection, refreshMe } = useApp();
  const parents = useParents();
  const languages = useLanguages();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [blurb, setBlurb] = useState("");
  const [busy, setBusy] = useState(false);
  const [kidName, setKidName] = useState("");
  const [kidAge, setKidAge] = useState("3");
  const [newLang, setNewLang] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!me) return;
    setName(me.name);
    setNeighborhood(me.neighborhood);
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
    const { error } = await supabase
      .from("parents")
      .update({ name: name.trim(), neighborhood: neighborhood.trim() || null, blurb: blurb.trim() || null })
      .eq("id", me!.parentId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
    refreshAll();
  }

  async function addChild(e: React.FormEvent) {
    e.preventDefault();
    if (!kidName.trim()) return;
    const { error } = await supabase
      .from("children")
      .insert({ parent_id: me!.parentId, name: kidName.trim(), age: kidAge === "" ? null : Number(kidAge) });
    if (error) { toast.error(error.message); return; }
    setKidName("");
    refreshAll();
  }

  async function removeChild(id: number) {
    const { error } = await supabase.from("children").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refreshAll();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { toast.error(error.message); return; }
    setPassword("");
    toast.success("Password updated");
  }

  const langOptions = Array.from(new Set([language, "English", ...languages.map((l) => l.name)]));

  return (
    <>
      <section className="py-10">
        <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">Personal profile</span>
        <h1 className="mt-1 font-display text-5xl font-bold tracking-tight">{me.name}</h1>
        <p className="mt-2 text-ink-soft">{[me.email, me.neighborhood].filter(Boolean).join(" · ")}</p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <form onSubmit={saveProfile} className="space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-line">
            <h2 className="font-display text-2xl font-bold">About you</h2>
            <div>
              <label className={label} htmlFor="p-name">
                Name
              </label>
              <input id="p-name" required value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label} htmlFor="p-hood">
                Neighborhood
              </label>
              <input
                id="p-hood"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className={field}
              />
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

          <div className="rounded-3xl bg-surface p-6 ring-1 ring-line">
            <h2 className="font-display text-2xl font-bold">Children</h2>
            {me.children.length === 0 ? <p className="mt-3 text-sm text-ink-soft">No children added yet.</p> : null}
            <ul className="mt-3 space-y-2">
              {me.children.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3 text-sm">
                  <span className="font-semibold">{c.name}</span>
                  <span className="ml-auto text-ink-soft">{c.age === null ? "" : `Age ${c.age}`}</span>
                  <button onClick={() => removeChild(c.id)} className="text-xs font-semibold text-ink-soft hover:text-clay">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={addChild} className="mt-3 flex gap-2">
              <input
                value={kidName}
                onChange={(e) => setKidName(e.target.value)}
                className={field}
                placeholder="Child's name"
                aria-label="Child's name"
              />
              <input
                type="number"
                min={0}
                max={17}
                value={kidAge}
                onChange={(e) => setKidAge(e.target.value)}
                className="w-24 rounded-2xl bg-background px-3 py-2 text-sm outline-none ring-1 ring-line"
                aria-label="Age"
              />
              <button className={btn}>Add</button>
            </form>

            <label className={`${label} mt-6`} htmlFor="lang">
              Language
            </label>
            <div className="flex gap-2">
              <select id="lang" value={language} onChange={(e) => setLanguage(e.target.value)} className={field}>
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
                className={field}
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
              <p className="mt-1 text-sm opacity-90">View & edit</p>
            </Link>
            <Link to="/favorites" className="card-lift rounded-3xl bg-sun p-5 text-ink">
              <p className="font-display text-2xl font-bold">Favorites</p>
              <p className="mt-1 text-sm opacity-90">{favorites.length} saved</p>
            </Link>
          </div>
          <Link to="/listing" className="card-lift rounded-3xl bg-surface p-5 ring-1 ring-line">
            <p className="font-display text-2xl font-bold">Offer care?</p>
            <p className="mt-1 text-sm text-ink-soft">Create or edit your provider listing.</p>
          </Link>
          <div className="rounded-3xl bg-surface p-6 ring-1 ring-line">
            <h2 className="font-display text-2xl font-bold">Connections</h2>
            {connections.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">
                No connections yet. Connect with parents from the message board or a provider's past families.
              </p>
            ) : null}
            <ul className="mt-3 space-y-2">
              {connections.map((id) => {
                const p = parents.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <li key={id} className="flex items-center justify-between rounded-2xl bg-background px-4 py-3 text-sm">
                    <Link to="/parents/$parentId" params={{ parentId: id }} className="font-semibold hover:text-primary-ink">
                      {p.name}
                    </Link>
                    <button onClick={() => toggleConnection(id)} className="text-xs font-semibold text-ink-soft hover:text-clay">
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <form onSubmit={changePassword} className="space-y-3 rounded-3xl bg-surface p-6 ring-1 ring-line">
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
