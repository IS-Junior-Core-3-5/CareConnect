import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/lib/app-state";
import { useLanguages, useProviders } from "@/lib/data";
import { emptySchedule, scheduleToRows, type Schedule } from "@/lib/model";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — CareConnect" },
      {
        name: "description",
        content:
          "Sign in to CareConnect or create a parent account with your children's ages and the weekly hours you need care.",
      },
      { property: "og:title", content: "Sign in — CareConnect" },
      {
        property: "og:description",
        content: "Sign in or create a CareConnect parent account and save your weekly care schedule.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const { session, authLoading } = useApp();
  const navigate = useNavigate();
  const verified = useProviders().filter((p) => p.verified).length;

  useEffect(() => {
    if (!authLoading && session) navigate({ to: "/home" });
  }, [authLoading, session, navigate]);

  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-5">
        <span className="grid size-9 place-items-center rounded-2xl bg-primary text-primary-soft">
          <span className="font-display text-lg font-bold leading-none">C</span>
        </span>
        <span className="font-display text-xl font-bold tracking-tight">CareConnect</span>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 lg:grid-cols-12 lg:items-start">
        <section className="lg:col-span-5 lg:pt-10">
          {verified > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-sun-soft px-3 py-1.5 text-xs font-semibold text-ink-soft">
              <span className="size-1.5 rounded-full bg-sun" /> {verified} verified providers
            </span>
          ) : null}
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.02] tracking-tight text-balance">
            Find care that <span className="italic text-primary">fits your week</span>.
          </h1>
          <p className="mt-4 max-w-[46ch] text-lg text-ink-soft text-pretty">
            CareConnect matches you with trusted, background-checked caregivers — then lines up their
            availability with yours, so the schedule just clicks.
          </p>
        </section>

        <section className="lg:col-span-7">
          <div className="rounded-[28px] bg-surface p-6 ring-1 ring-line sm:p-8">
            <div className="flex gap-1 rounded-full bg-background p-1">
              <button
                onClick={() => setMode("login")}
                className={`chip flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                  mode === "login" ? "bg-primary text-primary-soft" : "text-ink-soft"
                }`}
              >
                Log in
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`chip flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                  mode === "signup" ? "bg-primary text-primary-soft" : "text-ink-soft"
                }`}
              >
                Create account
              </button>
            </div>

            <div className="mt-6">
              {mode === "login" ? <LoginForm /> : <SignupForm onDone={() => setMode("login")} />}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const field =
  "w-full rounded-2xl bg-background px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-primary";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint";
const primaryBtn =
  "w-full rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink disabled:opacity-50";

function Notice({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p
      className={`rounded-2xl px-4 py-3 text-sm font-medium ${
        tone === "error" ? "bg-clay-soft text-clay" : "bg-leaf-soft text-leaf-ink"
      }`}
    >
      {children}
    </p>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError(error.message);
    navigate({ to: "/home" });
  }

  async function resetPassword() {
    if (!email.trim()) return setError("Enter your email first, then press Forgot password.");
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/profile`,
    });
    if (error) setError(error.message);
    else setInfo("Check your email for a link to reset your password.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={field}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className={label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
          placeholder="••••••••"
        />
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {info ? <Notice tone="ok">{info}</Notice> : null}
      <button disabled={busy} className={primaryBtn}>
        {busy ? "Logging in…" : "Log in"}
      </button>
      <p className="text-center text-xs text-ink-faint">
        <button type="button" onClick={resetPassword} className="font-semibold text-primary-ink">
          Forgot password?
        </button>
      </p>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const languages = useLanguages();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [lang, setLang] = useState("English");
  const [kids, setKids] = useState<{ name: string; age: string }[]>([{ name: "", age: "3" }]);
  const [draft, setDraft] = useState<Schedule>(emptySchedule);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const langOptions = Array.from(new Set(["English", ...languages.map((l) => l.name)]));

  function setCount(n: number) {
    setKids((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? { name: "", age: "3" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/home`,
        // The database turns this into your parent profile, children and schedule.
        data: {
          name: name.trim(),
          neighborhood: neighborhood.trim(),
          language: lang,
          children: kids.map((k, i) => ({ name: k.name.trim() || `Child ${i + 1}`, age: k.age })),
          schedule: scheduleToRows(draft).map((r) => [r.day_of_week, r.block]),
        },
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) navigate({ to: "/home" });
    else setSent(true);
  }

  if (sent)
    return (
      <div className="space-y-4">
        <Notice tone="ok">
          Account created. Check {email} for a confirmation link, then log in.
        </Notice>
        <button onClick={onDone} className={primaryBtn}>
          Go to log in
        </button>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="name">
            Full name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={field}
            placeholder="Jordan Hale"
          />
        </div>
        <div>
          <label className={label} htmlFor="neighborhood">
            Neighborhood
          </label>
          <input
            id="neighborhood"
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            className={field}
            placeholder="Maplewood"
          />
        </div>
        <div>
          <label className={label} htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className={label} htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
            placeholder="At least 6 characters"
          />
        </div>
        <div>
          <label className={label} htmlFor="lang">
            Language preference
          </label>
          <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)} className={field}>
            {langOptions.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="children">
            Number of children
          </label>
          <select
            id="children"
            value={kids.length}
            onChange={(e) => setCount(Number(e.target.value))}
            className={field}
          >
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {kids.length ? (
        <div>
          <span className={label}>Children</span>
          <div className="space-y-2">
            {kids.map((k, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={k.name}
                  onChange={(e) =>
                    setKids((prev) => prev.map((v, idx) => (idx === i ? { ...v, name: e.target.value } : v)))
                  }
                  className={field}
                  placeholder={`Child ${i + 1} name`}
                  aria-label={`Name of child ${i + 1}`}
                />
                <input
                  type="number"
                  min={0}
                  max={17}
                  value={k.age}
                  onChange={(e) =>
                    setKids((prev) => prev.map((v, idx) => (idx === i ? { ...v, age: e.target.value } : v)))
                  }
                  className="w-24 rounded-2xl bg-background px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-primary"
                  aria-label={`Age of child ${i + 1}`}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <span className={label}>Weekly hours you need care</span>
        <p className="mb-3 text-sm text-ink-soft">
          Tap the blocks you need covered. This becomes your saved schedule.
        </p>
        <ScheduleGrid
          schedule={draft}
          editable
          onToggle={(d, t) =>
            setDraft((prev) => prev.map((row, di) => (di === d ? row.map((v, ti) => (ti === t ? !v : v)) : row)))
          }
        />
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      <button disabled={busy} className={primaryBtn}>
        {busy ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
