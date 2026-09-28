import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ScheduleGrid } from "@/components/ScheduleGrid";
import { emptySchedule, type Schedule } from "@/data/mock";
import { useApp } from "@/lib/app-state";

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
          <span className="inline-flex items-center gap-2 rounded-full bg-sun-soft px-3 py-1.5 text-xs font-semibold text-ink-soft">
            <span className="size-1.5 rounded-full bg-sun" /> 8 verified providers in this demo
          </span>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.02] tracking-tight text-balance">
            Find care that <span className="italic text-primary">fits your week</span>.
          </h1>
          <p className="mt-4 max-w-[46ch] text-lg text-ink-soft text-pretty">
            CareConnect matches you with trusted, background-checked caregivers — then lines up their
            availability with yours, so the schedule just clicks.
          </p>
          <p className="mt-6 rounded-2xl bg-surface px-4 py-3 text-sm text-ink-soft ring-1 ring-line">
            This is a demo. Any email and password will sign you in as Jordan Hale.
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

            <div className="mt-6">{mode === "login" ? <LoginForm /> : <SignupForm />}</div>
          </div>
        </section>
      </main>
    </div>
  );
}

const field =
  "w-full rounded-2xl bg-background px-4 py-3 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-primary";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-faint";

function LoginForm() {
  const navigate = useNavigate();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        navigate({ to: "/home" });
      }}
      className="space-y-4"
    >
      <div>
        <label className={label} htmlFor="email">
          Email
        </label>
        <input id="email" type="email" required className={field} placeholder="jordan.hale@example.com" />
      </div>
      <div>
        <label className={label} htmlFor="password">
          Password
        </label>
        <input id="password" type="password" required className={field} placeholder="••••••••" />
      </div>
      <button className="w-full rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink">
        Log in
      </button>
      <p className="text-center text-xs text-ink-faint">
        Forgot password? Not in this demo — just press log in.
      </p>
    </form>
  );
}

function SignupForm() {
  const navigate = useNavigate();
  const { setParentName, setLanguage, setSchedule } = useApp();
  const [name, setName] = useState("");
  const [lang, setLang] = useState("English");
  const [childCount, setChildCount] = useState(1);
  const [ages, setAges] = useState<string[]>(["3"]);
  const [draft, setDraft] = useState<Schedule>(emptySchedule);

  function setCount(n: number) {
    setChildCount(n);
    setAges((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? "3"));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) setParentName(name.trim());
        setLanguage(lang);
        setSchedule(draft);
        navigate({ to: "/home" });
      }}
      className="space-y-5"
    >
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
          <label className={label} htmlFor="signup-email">
            Email
          </label>
          <input id="signup-email" type="email" required className={field} placeholder="you@example.com" />
        </div>
        <div>
          <label className={label} htmlFor="lang">
            Language preference
          </label>
          <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)} className={field}>
            <option>English</option>
            <option>Spanish</option>
            <option>French</option>
            <option>Russian</option>
            <option>Twi</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="children">
            Number of children
          </label>
          <select
            id="children"
            value={childCount}
            onChange={(e) => setCount(Number(e.target.value))}
            className={field}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className={label}>Ages of children</span>
        <div className="flex flex-wrap gap-2">
          {ages.map((a, i) => (
            <input
              key={i}
              type="number"
              min={0}
              max={17}
              value={a}
              onChange={(e) =>
                setAges((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
              }
              className="w-20 rounded-2xl bg-background px-3 py-2 text-sm outline-none ring-1 ring-line focus:ring-2 focus:ring-primary"
              aria-label={`Age of child ${i + 1}`}
            />
          ))}
        </div>
      </div>

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

      <button className="w-full rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-soft transition-colors hover:bg-primary-ink">
        Create account
      </button>
      <p className="text-center text-xs text-ink-faint">
        Already have one?{" "}
        <Link to="/home" className="font-semibold text-primary-ink">
          Skip straight into the demo
        </Link>
        .
      </p>
    </form>
  );
}
