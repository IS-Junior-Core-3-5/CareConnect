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

export function emptySchedule(): Schedule {
  return DAYS.map(() => BLOCKS.map(() => false));
}

function sched(spec: Partial<Record<Day, Block[]>>): Schedule {
  return DAYS.map((d) => BLOCKS.map((b) => (spec[d] ?? []).includes(b)));
}

const WEEKDAY_DAY: Partial<Record<Day, Block[]>> = {
  Mon: ["Morning", "Afternoon"],
  Tue: ["Morning", "Afternoon"],
  Wed: ["Morning", "Afternoon"],
  Thu: ["Morning", "Afternoon"],
  Fri: ["Morning", "Afternoon"],
};

export type CareType = "Daycare" | "Preschool" | "Sitter" | "Family Friend";

export type Review = {
  author: string;
  date: string;
  text: string;
  scores: { experience: number; values: number; communication: number; safety: number };
};

export type Provider = {
  id: string;
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
  distance: number;
  rating: number;
  reviewCount: number;
  verified: boolean;
  licenses: string[];
  languages: string[];
  schedule: Schedule | null;
  scheduleSummary: string;
  pastFamilies: string[];
  reviews: Review[];
};

export type Parent = {
  id: string;
  name: string;
  email: string;
  language: string;
  neighborhood: string;
  children: { name: string; age: number }[];
  blurb: string;
  schedule: Schedule;
};

export const parents: Parent[] = [
  {
    id: "p-jordan",
    name: "Jordan Hale",
    email: "jordan.hale@example.com",
    language: "English",
    neighborhood: "Maplewood",
    children: [
      { name: "Ivy", age: 2 },
      { name: "Theo", age: 6 },
    ],
    blurb: "Two kids, one very full calendar. Looking for weekday coverage near Maplewood.",
    schedule: sched({
      ...WEEKDAY_DAY,
      Thu: ["Morning", "Afternoon", "Evening"],
    }),
  },
  {
    id: "p-amara",
    name: "Amara Boateng",
    email: "amara.b@example.com",
    language: "English, Twi",
    neighborhood: "Riverside",
    children: [{ name: "Kofi", age: 4 }],
    blurb: "Nurse on rotating shifts — I lean on evening and weekend care.",
    schedule: sched({
      Mon: ["Evening"],
      Wed: ["Evening"],
      Fri: ["Afternoon", "Evening"],
      Sat: ["Morning", "Afternoon"],
    }),
  },
  {
    id: "p-luis",
    name: "Luis Moreno",
    email: "luis.moreno@example.com",
    language: "Spanish, English",
    neighborhood: "Oak Hill",
    children: [
      { name: "Sofia", age: 3 },
      { name: "Mateo", age: 8 },
    ],
    blurb: "Bilingual household. Spanish-speaking care is a big plus for us.",
    schedule: sched({
      Mon: ["Afternoon"],
      Tue: ["Afternoon"],
      Wed: ["Afternoon"],
      Thu: ["Afternoon"],
      Fri: ["Afternoon"],
    }),
  },
  {
    id: "p-nina",
    name: "Nina Petrova",
    email: "nina.p@example.com",
    language: "Russian, English",
    neighborhood: "Larkspur",
    children: [{ name: "Anya", age: 1 }],
    blurb: "First-time parent, working from home three days a week.",
    schedule: sched({
      Tue: ["Morning"],
      Wed: ["Morning"],
      Thu: ["Morning"],
    }),
  },
];

function review(
  author: string,
  date: string,
  text: string,
  e: number,
  v: number,
  c: number,
  s: number,
): Review {
  return { author, date, text, scores: { experience: e, values: v, communication: c, safety: s } };
}

export const providers: Provider[] = [
  {
    id: "maya-okafor",
    name: "Maya Okafor",
    careType: "Sitter",
    photo: "maya",
    gallery: ["maya"],
    blurb: "Full-day sitter with six years of infant and toddler experience.",
    bio: "I've cared for families in Maplewood since 2018, mostly full-day weekday care for infants and toddlers. My days run on a gentle rhythm: outdoor time in the morning, lunch and nap, then art or music in the afternoon. I handle school pickup and drop-off for older siblings too.",
    dailyRate: 190,
    dailyRateMax: 240,
    pricingNotes: [
      "Full day (7am – 6pm): $190",
      "Two children: $240",
      "Evening add-on after 6pm: $28/hr",
    ],
    neighborhood: "Maplewood",
    distance: 1.2,
    rating: 4.9,
    reviewCount: 127,
    verified: true,
    licenses: ["Pediatric CPR & First Aid", "State background check (2026)", "Safe Sleep certified"],
    languages: ["English", "Igbo"],
    schedule: sched(WEEKDAY_DAY),
    scheduleSummary: "Mon–Fri · 7am–6pm",
    pastFamilies: ["p-jordan", "p-nina"],
    reviews: [
      review(
        "Jordan Hale",
        "March 2026",
        "Maya has been with us for two years. She sends a short note every afternoon about naps and meals — I never have to ask.",
        5,
        5,
        5,
        5,
      ),
      review(
        "Nina Petrova",
        "January 2026",
        "Calm with a fussy newborn and unfailingly punctual. She reorganized our whole nap routine in a week.",
        5,
        4,
        5,
        5,
      ),
    ],
  },
  {
    id: "daniel-reyes",
    name: "Daniel Reyes",
    careType: "Sitter",
    photo: "daniel",
    gallery: ["daniel"],
    blurb: "After-school care and homework help for school-age kids.",
    bio: "Former middle-school teacher, now doing after-school care three afternoons a week. I pick up from Riverside Elementary, we do homework first, then a walk to the park or a board game. I keep a reading log for each kid.",
    dailyRate: 110,
    dailyRateMax: null,
    pricingNotes: ["Afternoon block (3pm – 7pm): $110", "Sibling rate: +$35"],
    neighborhood: "Riverside",
    distance: 2.8,
    rating: 4.7,
    reviewCount: 84,
    verified: true,
    licenses: ["Pediatric CPR", "State background check (2025)", "Teaching license (lapsed)"],
    languages: ["English", "Spanish"],
    schedule: sched({
      Tue: ["Afternoon", "Evening"],
      Thu: ["Afternoon", "Evening"],
      Fri: ["Afternoon", "Evening"],
    }),
    scheduleSummary: "Tue, Thu, Fri · 3pm–7pm",
    pastFamilies: ["p-luis"],
    reviews: [
      review(
        "Luis Moreno",
        "February 2026",
        "Mateo's reading went up two levels. Daniel switches to Spanish at home with him, which we love.",
        5,
        5,
        4,
        5,
      ),
    ],
  },
  {
    id: "sunny-meadows",
    name: "Sunny Meadows Daycare",
    careType: "Daycare",
    photo: "sunny",
    gallery: ["sunny"],
    blurb: "Licensed neighborhood daycare with meals and a fenced play yard.",
    bio: "A ten-child home daycare in Oak Hill, run by Priya Nair and one assistant. Meals and snacks are included and made in-house. Ages one through ten, with a separate quiet room for nappers.",
    dailyRate: 145,
    dailyRateMax: null,
    pricingNotes: ["Full day (8am – 5pm): $145", "Meals and snacks included", "Half day: $85"],
    neighborhood: "Oak Hill",
    distance: 3.5,
    rating: 5.0,
    reviewCount: 203,
    verified: true,
    licenses: [
      "State daycare license #DC-4471",
      "Annual health inspection (passed 2026)",
      "Staff CPR certified",
    ],
    languages: ["English", "Hindi", "Malayalam"],
    schedule: sched({
      Mon: ["Morning", "Afternoon"],
      Tue: ["Morning", "Afternoon"],
      Wed: ["Morning", "Afternoon"],
      Thu: ["Morning", "Afternoon"],
      Fri: ["Morning", "Afternoon"],
      Sat: ["Morning"],
    }),
    scheduleSummary: "Mon–Sat · 8am–5pm",
    pastFamilies: ["p-luis", "p-jordan"],
    reviews: [
      review(
        "Luis Moreno",
        "March 2026",
        "Sofia asks to go on Saturdays. The meals alone are worth the rate.",
        5,
        5,
        5,
        5,
      ),
      review(
        "Jordan Hale",
        "December 2025",
        "Very organized. Monthly newsletter, clear sick-day policy, no surprises on the invoice.",
        5,
        4,
        5,
        5,
      ),
    ],
  },
  {
    id: "little-lantern",
    name: "Little Lantern Preschool",
    careType: "Preschool",
    photo: "lantern",
    gallery: ["lantern"],
    blurb: "Play-based preschool mornings for ages three to five.",
    bio: "A morning preschool program built around play, outdoor time, and early literacy. Two teachers per eight children. Parents join for a Friday sing-along once a month.",
    dailyRate: 96,
    dailyRateMax: null,
    pricingNotes: ["Morning session (8:30am – 12:30pm): $96", "Billed monthly, 4-week terms"],
    neighborhood: "Larkspur",
    distance: 4.1,
    rating: 4.8,
    reviewCount: 61,
    verified: true,
    licenses: ["State preschool license #PS-1180", "Fire safety inspection (2026)"],
    languages: ["English", "French"],
    schedule: sched({
      Mon: ["Morning"],
      Tue: ["Morning"],
      Wed: ["Morning"],
      Thu: ["Morning"],
      Fri: ["Morning"],
    }),
    scheduleSummary: "Mon–Fri · 8:30am–12:30pm",
    pastFamilies: ["p-nina"],
    reviews: [
      review(
        "Nina Petrova",
        "February 2026",
        "Warm teachers and a genuinely calm room. Anya cried for two days and then never again.",
        4,
        5,
        5,
        5,
      ),
    ],
  },
  {
    id: "grace-lindqvist",
    name: "Grace Lindqvist",
    careType: "Family Friend",
    photo: "grace",
    gallery: ["grace"],
    blurb: "Retired teacher offering weekend and evening care for neighbors.",
    bio: "Retired after thirty years in first grade. I watch a few neighborhood kids on evenings and weekends — mostly dinner, a book, and bedtime. I don't take on full-time placements.",
    dailyRate: null,
    dailyRateMax: null,
    pricingNotes: [],
    neighborhood: "Maplewood",
    distance: 0.9,
    rating: 4.6,
    reviewCount: 18,
    verified: false,
    licenses: ["Pediatric CPR (self-reported)"],
    languages: ["English", "Swedish"],
    schedule: sched({
      Fri: ["Evening"],
      Sat: ["Morning", "Afternoon", "Evening"],
      Sun: ["Afternoon", "Evening"],
    }),
    scheduleSummary: "Fri evening, Sat–Sun",
    pastFamilies: ["p-amara"],
    reviews: [
      review(
        "Amara Boateng",
        "January 2026",
        "Grace is the reason I can take Saturday shifts. Kofi adores her.",
        5,
        5,
        4,
        4,
      ),
    ],
  },
  {
    id: "harborview-kids",
    name: "Harborview Kids Center",
    careType: "Daycare",
    photo: "harborview",
    gallery: ["harborview"],
    blurb: "Large center with extended hours for shift-working parents.",
    bio: "A 60-child center near the hospital district with extended hours, including evenings. Separate infant, toddler, and preschool rooms, each with its own lead teacher.",
    dailyRate: 132,
    dailyRateMax: 168,
    pricingNotes: [
      "Standard day (6:30am – 6pm): $132",
      "Extended day to 9pm: $168",
      "Infant room: +$20/day",
    ],
    neighborhood: "Riverside",
    distance: 5.4,
    rating: 4.3,
    reviewCount: 312,
    verified: true,
    licenses: ["State daycare license #DC-2209", "Accredited by NAEYC"],
    languages: ["English", "Twi", "Tagalog"],
    schedule: sched({
      Mon: ["Morning", "Afternoon", "Evening"],
      Tue: ["Morning", "Afternoon", "Evening"],
      Wed: ["Morning", "Afternoon", "Evening"],
      Thu: ["Morning", "Afternoon", "Evening"],
      Fri: ["Morning", "Afternoon", "Evening"],
    }),
    scheduleSummary: "Mon–Fri · 6:30am–9pm",
    pastFamilies: ["p-amara"],
    reviews: [
      review(
        "Amara Boateng",
        "March 2026",
        "The late pickup is a lifesaver on night shifts. It's a big place, so you have to ask for details.",
        4,
        4,
        3,
        5,
      ),
    ],
  },
  {
    id: "tomas-albright",
    name: "Tomás Albright",
    careType: "Sitter",
    photo: null,
    gallery: [],
    blurb: "Occasional date-night and weekend sitter.",
    bio: "I sit for a handful of families on weekends, mostly evenings. New to CareConnect — schedule still being set up.",
    dailyRate: 85,
    dailyRateMax: null,
    pricingNotes: ["Evening block (5pm – 11pm): $85"],
    neighborhood: "Oak Hill",
    distance: 3.1,
    rating: 4.4,
    reviewCount: 9,
    verified: false,
    licenses: [],
    languages: ["English"],
    schedule: null,
    scheduleSummary: "Schedule unavailable",
    pastFamilies: [],
    reviews: [
      review("Nina Petrova", "November 2025", "Friendly and on time for a last-minute evening.", 4, 4, 4, 4),
    ],
  },
  {
    id: "willow-bend",
    name: "Willow Bend Preschool Co-op",
    careType: "Preschool",
    photo: "willow",
    gallery: ["willow"],
    blurb: "Parent co-op preschool — families share teaching shifts.",
    bio: "A co-op: every family takes one classroom shift per month, which keeps tuition low. Mixed-age room, heavy on outdoor play, rain or shine. Membership is by term.",
    dailyRate: null,
    dailyRateMax: null,
    pricingNotes: [],
    neighborhood: "Larkspur",
    distance: 4.8,
    rating: 4.5,
    reviewCount: 34,
    verified: true,
    licenses: ["State preschool license #PS-0922"],
    languages: ["English"],
    schedule: sched({
      Mon: ["Morning"],
      Wed: ["Morning"],
      Fri: ["Morning"],
    }),
    scheduleSummary: "Mon, Wed, Fri · 9am–12pm",
    pastFamilies: ["p-jordan"],
    reviews: [
      review(
        "Jordan Hale",
        "October 2025",
        "You get out what you put in. The shift requirement is real, but Theo loved his year here.",
        4,
        5,
        4,
        4,
      ),
    ],
  },
];

export type Post = {
  id: string;
  title: string;
  authorId: string;
  category: string;
  date: string;
  body: string;
  mentions: string[];
  replies: { authorId: string; date: string; body: string; mentions: string[] }[];
};

export const posts: Post[] = [
  {
    id: "split-week",
    title: "Anyone splitting the week between two providers?",
    authorId: "p-jordan",
    category: "Schedules",
    date: "March 12, 2026",
    body: "We have Maya Okafor Monday through Wednesday and are trying to fill Thursday and Friday. Has anyone made a two-provider week work without the kids melting down? Curious whether consistency matters more than convenience here.",
    mentions: ["maya-okafor"],
    replies: [
      {
        authorId: "p-luis",
        date: "March 12, 2026",
        body: "We do exactly this. Sunny Meadows Daycare two days, a sitter the other three. The trick was keeping the same nap window at both places.",
        mentions: ["sunny-meadows"],
      },
      {
        authorId: "p-nina",
        date: "March 13, 2026",
        body: "Two weeks of grumpiness, then totally fine. Little Lantern Preschool was flexible about the transition.",
        mentions: ["little-lantern"],
      },
    ],
  },
  {
    id: "evening-rates",
    title: "What's a fair evening rate right now?",
    authorId: "p-amara",
    category: "Pricing",
    date: "March 9, 2026",
    body: "I'm on rotating night shifts and paying for evening blocks most weeks. Rates I'm seeing range from $85 to $168 a day depending on the place. What are people actually paying for after-6pm care?",
    mentions: ["harborview-kids"],
    replies: [
      {
        authorId: "p-jordan",
        date: "March 9, 2026",
        body: "$28/hr for evening add-on with our sitter. Feels standard for the neighborhood.",
        mentions: [],
      },
    ],
  },
  {
    id: "bilingual-care",
    title: "Recommendations for Spanish-speaking care?",
    authorId: "p-luis",
    category: "Recommendations",
    date: "March 4, 2026",
    body: "We want Sofia hearing Spanish outside the house too. Daniel Reyes has been great for Mateo after school — anyone know of daycare or preschool options with Spanish-speaking staff?",
    mentions: ["daniel-reyes"],
    replies: [
      {
        authorId: "p-amara",
        date: "March 5, 2026",
        body: "Harborview Kids Center has staff in a few languages, worth asking which room.",
        mentions: ["harborview-kids"],
      },
    ],
  },
  {
    id: "verified-meaning",
    title: "How much weight do you give the Verified badge?",
    authorId: "p-nina",
    category: "Recommendations",
    date: "February 27, 2026",
    body: "Grace Lindqvist isn't verified on here but half the block has used her for years. Do you treat the badge as a hard requirement or just one signal among several?",
    mentions: ["grace-lindqvist"],
    replies: [
      {
        authorId: "p-jordan",
        date: "February 27, 2026",
        body: "One signal. For a center I want the license; for a neighbor I want references.",
        mentions: [],
      },
      {
        authorId: "p-luis",
        date: "February 28, 2026",
        body: "Same. Willow Bend Preschool Co-op is verified and I still asked for three references.",
        mentions: ["willow-bend"],
      },
    ],
  },
];

export function providerById(id: string) {
  return providers.find((p) => p.id === id);
}

export function parentById(id: string) {
  return parents.find((p) => p.id === id);
}

export function priceLabel(p: Provider) {
  if (p.dailyRate === null) return "Pricing unavailable";
  if (p.dailyRateMax) return `$${p.dailyRate}–$${p.dailyRateMax}/day`;
  return `$${p.dailyRate}/day`;
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
