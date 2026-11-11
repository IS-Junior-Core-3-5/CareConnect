// Public landmarks used only to exercise distance filtering in the demo.
export const landmarks = [
  { city: "Provo", address: "550 N University Ave, Provo, UT 84601" },
  { city: "Orem", address: "58 N State St, Orem, UT 84057" },
  { city: "American Fork", address: "64 S 100 E, American Fork, UT 84003" },
  { city: "Pleasant Grove", address: "30 E Center St, Pleasant Grove, UT 84062" },
  { city: "Lehi", address: "131 N 100 E, Lehi, UT 84043" },
  { city: "Springville", address: "45 S Main St, Springville, UT 84663" },
  { city: "Spanish Fork", address: "80 S Main St, Spanish Fork, UT 84660" },
];

const names = [
  "Paper Kite",
  "Pebble Path",
  "Tumbleleaf",
  "Paintbox Trail",
  "Buttonwood",
  "Acorn Bridge",
  "Cloudberry",
  "Bluebell Corner",
  "Cedar Pocket",
  "Maple Loop",
  "Crayon Creek",
  "Puddle Jump",
  "Silver Juniper",
  "Little Compass",
  "Fern Hollow",
  "Dandelion Lane",
  "Firefly Porch",
  "Honeycomb Hill",
];

const sitterNames = [
  "Nia Whitaker",
  "Evan Park",
  "Elena Vega",
  "Lydia Wells",
  "Anika Rao",
  "Owen Hartley",
  "Janelle Brooks",
  "Samira Haddad",
  "Camila Ríos",
  "Marcus Fields",
  "Mara Santos",
  "Nora Bell",
  "Denise Holloway",
  "June Lin",
  "Ravi Mehta",
  "Clara Bennett",
];

const familyFriendNames = [
  "Rosa Navarro",
  "Calvin Brooks",
  "Leah Begay",
  "Mina Cho",
  "Diane Keller",
  "Tessa Coleman",
  "Marisol Vega",
  "Graham Ellis",
];

const programs = [
  {
    type: "Daycare",
    count: 18,
    base: 65,
    suffix: "Daycare",
    activities: [
      "outdoor play and shared lunches",
      "music and sensory play",
      "quiet reading and garden time",
    ],
    schedules: [
      {
        days: [0, 1, 2, 3, 4],
        blocks: ["Morning", "Afternoon"],
        summary: "Weekdays · mornings and afternoons",
      },
      { days: [0, 1, 2, 3, 4], blocks: ["Morning"], summary: "Weekday mornings" },
      {
        days: [0, 2, 4],
        blocks: ["Morning", "Afternoon"],
        summary: "Mon, Wed, Fri · mornings and afternoons",
      },
    ],
    pricingNote: "Daily rates vary by the length of care.",
  },
  {
    type: "Preschool",
    count: 14,
    base: 38,
    suffix: "Preschool",
    activities: [
      "story circles and early literacy games",
      "open-ended art and building",
      "nature projects and counting games",
    ],
    schedules: [
      { days: [0, 2, 4], blocks: ["Morning"], summary: "Mon, Wed, Fri · mornings" },
      { days: [1, 3], blocks: ["Afternoon"], summary: "Tue and Thu · afternoons" },
      { days: [0, 1, 2, 3, 4], blocks: ["Morning"], summary: "Weekday mornings" },
    ],
    pricingNote: "Daily rate for a preschool session.",
  },
  {
    type: "Sitter",
    count: 16,
    base: 80,
    names: sitterNames,
    activities: [
      "after-school snacks and homework time",
      "board games and a calm bedtime routine",
      "outdoor games and crafts",
    ],
    schedules: [
      { days: [0, 1, 2, 3, 4], blocks: ["Afternoon"], summary: "Weekday afternoons" },
      { days: [4, 5, 6], blocks: ["Evening"], summary: "Fri to Sun · evenings" },
      { days: [5, 6], blocks: ["Morning", "Afternoon"], summary: "Weekend days" },
    ],
    pricingNote: "Daily rates vary by the hours requested.",
  },
  {
    type: "Family Friend",
    count: 8,
    base: 30,
    names: familyFriendNames,
    activities: [
      "occasional backup care and puzzles",
      "weekend play and reading",
      "after-school activities and snack time",
    ],
    schedules: [
      { days: [5, 6], blocks: ["Morning"], summary: "Weekend mornings" },
      { days: [1, 3], blocks: ["Afternoon"], summary: "Tue and Thu · afternoons" },
      { days: [4, 5], blocks: ["Evening"], summary: "Fri and Sat · evenings" },
    ],
    pricingNote: "Daily rates for occasional backup care.",
  },
];

export function buildDemoProviders(ownerIds = []) {
  return programs.flatMap((program, programIndex) =>
    Array.from({ length: program.count }, (_, index) => {
      const { city, address } = landmarks[(index + programIndex) % landmarks.length];
      const number = programIndex * 20 + index;
      const ownerId = programIndex === 0 ? ownerIds[index] : undefined;
      const name = program.names?.[index] ?? `${names[index]} ${program.suffix}`;
      const activity = program.activities[index % program.activities.length];
      const schedule =
        index % 11 === 10 ? null : program.schedules[index % program.schedules.length];
      const dailyRate = index % 9 === 8 ? null : program.base + ((index * 7) % 75);
      return {
        listing: {
          id: `careconnect-demo-${programIndex + 1}-${index + 1}`,
          name,
          care_type: program.type,
          address,
          phone: `801-555-${String(100 + number).padStart(4, "0")}`,
          blurb: program.names
            ? `Childcare in ${city} with ${activity}.`
            : `${program.type} in ${city} with ${activity}.`,
          bio: program.names
            ? `I make time for ${activity} and work with families to keep familiar routines. Tell me what helps your child feel comfortable in a new setting.`
            : `At ${name}, we make room for ${activity}. Our day gives children time to explore, settle into familiar routines, and connect with each other.`,
          daily_rate: dailyRate,
          daily_rate_max: dailyRate !== null && index % 3 === 0 ? dailyRate + 25 : null,
          distance_miles: null,
          verified: false,
          is_public: true,
          listing_origin: ownerId ? "owned" : "sample",
          owner_id: ownerId ?? null,
          schedule_available: schedule !== null,
          schedule_summary: schedule?.summary ?? null,
        },
        notes: dailyRate === null ? [] : [program.pricingNote],
        credentials: index % 4 === 0 ? ["Example CPR and First Aid training (fictional)"] : [],
        languages: index % 4 === 0 ? ["English", "Spanish"] : ["English"],
        availability:
          schedule?.days.flatMap((day_of_week) =>
            schedule.blocks.map((block) => ({ day_of_week, block })),
          ) ?? [],
      };
    }),
  );
}
