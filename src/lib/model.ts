export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const BLOCKS = ["Morning", "Afternoon", "Evening"] as const;
export const BLOCK_HOURS: Record<Block, string> = {
  Morning: "7am – 12pm",
  Afternoon: "12pm – 5pm",
  Evening: "5pm – 9pm",
};

export type Day = (typeof DAYS)[number];
export type Block = (typeof BLOCKS)[number];
/** 7 days x 3 blocks grid of booleans. */
export type Schedule = boolean[][];

export const CARE_TYPES = ["Daycare", "Preschool", "Sitter", "Family Friend"] as const;
export type CareType = (typeof CARE_TYPES)[number];

export const POST_CATEGORIES = ["Schedules", "Pricing", "Recommendations"] as const;

export type Scores = { experience: number; values: number; communication: number; safety: number };

export type Review = {
  id: number;
  parentId: string;
  author: string;
  date: string;
  reviewedOn: string;
  text: string;
  scores: Scores;
};

export type Provider = {
  id: string;
  ownerId: string | null;
  name: string;
  careType: CareType;
  photo: string | null;
  gallery: string[];
  blurb: string;
  bio: string;
  /** Daily rate in dollars; null means pricing unavailable. */
  dailyRate: number | null;
  dailyRateMax: number | null;
  pricingNotes: string[];
  neighborhood: string;
  /** null = distance unknown */
  distance: number | null;
  rating: number;
  reviewCount: number;
  verified: boolean;
  licenses: string[];
  languages: string[];
  /** null = schedule unavailable */
  schedule: Schedule | null;
  scheduleSummary: string;
  pastFamilies: string[];
  reviews: Review[];
};

export type Child = { id: number; name: string; age: number | null };

export type Parent = {
  id: string;
  authUserId: string | null;
  name: string;
  neighborhood: string;
  /** Comma-separated, for display */
  language: string;
  languages: string[];
  children: Child[];
  blurb: string;
  schedule: Schedule;
};

export type Reply = { id: number; authorId: string; date: string; body: string; mentions: string[] };

export type Post = {
  id: string;
  title: string;
  authorId: string;
  category: string;
  date: string;
  createdAt: string;
  body: string;
  mentions: string[];
  replies: Reply[];
};

export function emptySchedule(): Schedule {
  return DAYS.map(() => BLOCKS.map(() => false));
}

/** Rows like {day_of_week, block} -> 7x3 grid */
export function scheduleFromRows(rows: { day_of_week: number; block: string }[]): Schedule {
  const s = emptySchedule();
  for (const r of rows) {
    const t = BLOCKS.indexOf(r.block as Block);
    if (r.day_of_week >= 0 && r.day_of_week < 7 && t >= 0) s[r.day_of_week][t] = true;
  }
  return s;
}

/** 7x3 grid -> rows of [day, block] */
export function scheduleToRows(s: Schedule): { day_of_week: number; block: Block }[] {
  const rows: { day_of_week: number; block: Block }[] = [];
  s.forEach((row, d) => row.forEach((on, t) => on && rows.push({ day_of_week: d, block: BLOCKS[t] })));
  return rows;
}

export function scheduleCount(s: Schedule) {
  return s.flat().filter(Boolean).length;
}

export function priceLabel(p: Pick<Provider, "dailyRate" | "dailyRateMax">) {
  if (p.dailyRate === null) return "Pricing unavailable";
  if (p.dailyRateMax) return `$${p.dailyRate}–$${p.dailyRateMax}/day`;
  return `$${p.dailyRate}/day`;
}

export function distanceLabel(d: number | null) {
  return d === null ? "Distance unknown" : `${d} mi away`;
}

export function overlapCount(a: Schedule, b: Schedule) {
  let n = 0;
  for (let d = 0; d < DAYS.length; d++)
    for (let t = 0; t < BLOCKS.length; t++) if (a[d][t] && b[d][t]) n++;
  return n;
}

export function gapCount(parent: Schedule, provider: Schedule) {
  let n = 0;
  for (let d = 0; d < DAYS.length; d++)
    for (let t = 0; t < BLOCKS.length; t++) if (parent[d][t] && !provider[d][t]) n++;
  return n;
}

export function formatDate(iso: string, withDay = true) {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Date-only values (stored as midnight UTC) are shown as that calendar day everywhere.
  const dateOnly = iso.length === 10 || /T00:00:00(\.0+)?(\+00:00|Z)$/.test(iso);
  const base: Intl.DateTimeFormatOptions = withDay
    ? { month: "long", day: "numeric", year: "numeric" }
    : { month: "long", year: "numeric" };
  return d.toLocaleDateString("en-US", dateOnly ? { ...base, timeZone: "UTC" } : base);
}

export function slugify(text: string) {
  const base = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .slice(0, 40)
    .replace(/-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "item"}-${suffix}`;
}
