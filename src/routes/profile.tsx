import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/NavBar";
import { parentById, parents } from "@/data/mock";
import { useApp } from "@/lib/app-state";

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

function ProfilePage() {
  const { parentName, language, setLanguage, favorites, connections, toggleConnection } = useApp();
  const me = parents[0];
  return (
    <AppShell>
      <section className="py-10">
        <span className="font-mono text-xs uppercase tracking-wider text-primary-ink">Personal profile</span>
        <h1 className="mt-1 font-display text-5xl font-bold tracking-tight">{parentName}</h1>
        <p className="mt-2 text-ink-soft">{me.email} · {me.neighborhood}</p>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-surface p-6 ring-1 ring-line">
          <h2 className="font-display text-2xl font-bold">Children</h2>
          <ul className="mt-3 space-y-2">
            {me.children.map((c) => (
              <li key={c.name} className="flex justify-between rounded-2xl bg-background px-4 py-3 text-sm">
                <span className="font-semibold">{c.name}</span>
                <span className="text-ink-soft">Age {c.age}</span>
              </li>
            ))}
          </ul>
          <label className="mt-6 mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint" htmlFor="lang">
            Language
          </label>
          <select
            id="lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-2xl bg-background px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-primary"
          >
            {["English", "Spanish", "French", "Russian", "Twi"].map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div className="grid gap-4">
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
          <div className="rounded-3xl bg-surface p-6 ring-1 ring-line">
            <h2 className="font-display text-2xl font-bold">Connections</h2>
            {connections.length === 0 ? <p className="mt-3 text-sm text-ink-soft">No connections yet.</p> : null}
            <ul className="mt-3 space-y-2">
              {connections.map((id) => {
                const p = parentById(id);
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
        </div>
      </div>
    </AppShell>
  );
}
