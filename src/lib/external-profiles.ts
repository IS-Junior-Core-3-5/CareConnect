type Sourced = { sourceUrl: string; checkedOn: string };
type LinkFact = Sourced & { url: string; label: string };

type PublishedHours = Sourced & {
  kind: "published";
  label: string;
  summary: string;
  note: string;
  days: readonly number[];
  startMinute: number;
  endMinute: number;
};

export type ExternalProfile = {
  photos?: LinkFact;
  contactUrl?: string;
  reviews?: LinkFact;
  pricing?: Sourced & { summary: string; detail: string; linkLabel: string };
  hours: PublishedHours | (Sourced & { kind: "variable"; summary: string });
  location: Sourced & ({ address: string } | { serviceArea: string });
  training?: Sourced & { text: string };
};

const checkedOn = "2026-11-06";
const pricingCheckedOn = "2026-11-07";
const lesPetits = "https://lespetitsprovo.com/";
const kidsVillage = "https://kidsvillage.com/";
const kidsEnrollment = "https://kidsvillage.com/2026-27-registration/";
const guardian = "https://www.guardianangelbaby.com/utah";
const montessori = "https://montessoriutah.com/";
const wayToGrow = "https://kidswaytogrow.com/";
const weekdays = [0, 1, 2, 3, 4];

// Editorial facts for researched rows. These hours describe the
// provider's publication, so they stay separate from bookable availability.
const profiles: Readonly<Record<string, ExternalProfile>> = {
  "montessori-learning-center-lindon": {
    pricing: {
      summary: "Monthly tuition",
      detail: "Monthly rates vary by program and days per week.",
      linkLabel: "View published monthly tuition",
      sourceUrl: montessori + "tuition/",
      checkedOn: pricingCheckedOn,
    },
    photos: {
      label: "View official school gallery",
      url: montessori + "gallery/",
      sourceUrl: montessori + "gallery/",
      checkedOn,
    },
    reviews: {
      label: "Read reviews on the Montessori Learning Center site",
      url: montessori + "reviews/",
      sourceUrl: montessori + "reviews/",
      checkedOn,
    },
    hours: {
      kind: "published",
      label: "Published program hours",
      summary: "Five-day Junior Preschool (ages 2–4): Monday–Friday, 9:00 a.m.–12:30 p.m.",
      note: "This comparison uses one option on the school’s tuition page. Ask about other schedules and openings.",
      days: weekdays,
      startMinute: 9 * 60,
      endMinute: 12 * 60 + 30,
      sourceUrl: montessori + "tuition/",
      checkedOn,
    },
    location: {
      address: "310 S. 400 W., Lindon, UT 84042",
      sourceUrl: montessori + "contact/",
      checkedOn,
    },
    training: {
      text: "The school reports Montessori-certified staff and says all staff are CPR certified and trained in first aid. CareConnect has not verified individual credentials.",
      sourceUrl: montessori + "montessori/",
      checkedOn,
    },
  },
  "way-to-grow-american-fork": {
    pricing: {
      summary: "Full-time, part-time, or drop-in",
      detail:
        "Rates vary by age group. Drop-in care has a daily rate. Call or email the center for amounts.",
      linkLabel: "See tuition and drop-in details",
      sourceUrl: wayToGrow + "faq/",
      checkedOn: pricingCheckedOn,
    },
    reviews: {
      label: "Read provider-hosted parent testimonials",
      url: wayToGrow + "#:~:text=What%20Parents%20Say%20About%20Us",
      sourceUrl: wayToGrow,
      checkedOn,
    },
    hours: {
      kind: "published",
      label: "Published operating hours",
      summary: "Monday–Friday, 6:30 a.m.–6:30 p.m.",
      note: "These are the center’s operating hours. Ask Way to Grow about openings and the hours offered for your child.",
      days: weekdays,
      startMinute: 6 * 60 + 30,
      endMinute: 18 * 60 + 30,
      sourceUrl: wayToGrow + "faq/",
      checkedOn,
    },
    location: {
      address: "218 N. Center St., American Fork, UT 84003",
      sourceUrl: wayToGrow,
      checkedOn,
    },
    training: {
      text: "Way to Grow says at least one staff member certified in CPR and first aid is always present. CareConnect has not verified individual credentials.",
      sourceUrl: wayToGrow + "faq/",
      checkedOn,
    },
  },
  "les-petits-provo": {
    pricing: {
      summary: "Monthly tuition",
      detail:
        "Tuition includes meals and snacks. Les Petits says it accepts Utah DWS childcare assistance.",
      linkLabel: "View published tuition",
      sourceUrl: lesPetits + "daycare-tuition",
      checkedOn: pricingCheckedOn,
    },
    photos: {
      label: "View official gallery and virtual tour",
      url: lesPetits + "#:~:text=Photo%20Gallery",
      sourceUrl: lesPetits,
      checkedOn,
    },
    hours: {
      kind: "published",
      label: "Published operating hours",
      summary: "Monday–Friday, 7:00 a.m.–5:45 p.m.",
      note: "These are the center’s operating hours. Ask Les Petits about openings and the hours offered for your child.",
      days: weekdays,
      startMinute: 7 * 60,
      endMinute: 17 * 60 + 45,
      sourceUrl: lesPetits,
      checkedOn,
    },
    location: { address: "795 W Center St, Provo, UT 84601", sourceUrl: lesPetits, checkedOn },
  },
  "kids-village-orem": {
    pricing: {
      summary: "Tuition by program",
      detail:
        "Tuition varies with the number of days and the session length. The school lists a separate registration fee.",
      linkLabel: "View enrollment and tuition",
      sourceUrl: kidsEnrollment,
      checkedOn: pricingCheckedOn,
    },
    photos: {
      label: "View official school photos",
      url: kidsVillage,
      sourceUrl: kidsVillage,
      checkedOn,
    },
    reviews: {
      label: "Read reviews on the Kids Village site",
      url: kidsVillage + "#:~:text=See%20What%20Parents%20are%20Saying",
      sourceUrl: kidsVillage,
      checkedOn,
    },
    hours: {
      kind: "published",
      label: "Published program window · 2026–27",
      summary: "Tater Tots morning program: Monday–Friday, 8:45–11:45 a.m.",
      note: "This example applies to one enrollment option. The school also offers other schedules. Confirm class hours, drop-off, pickup, and openings with Kids Village.",
      days: weekdays,
      startMinute: 8 * 60 + 45,
      endMinute: 11 * 60 + 45,
      sourceUrl: kidsEnrollment,
      checkedOn,
    },
    location: {
      address: "1641 N. State Street, Orem, UT 84057",
      sourceUrl: "https://kidsvillage.com/contact/",
      checkedOn,
    },
  },
  "guardian-angel-babysitting-utah": {
    pricing: {
      summary: "Hourly babysitting",
      detail:
        "A four-hour minimum applies. The provider lists a reservation deposit and accepts major credit cards.",
      linkLabel: "View rates and reservation terms",
      sourceUrl: "https://www.guardianangelbaby.com/sitter/index",
      checkedOn: pricingCheckedOn,
    },
    contactUrl: "https://www.guardianangelbaby.com/sitter/index",
    photos: {
      label: "View photos on the provider site",
      url: guardian,
      sourceUrl: guardian,
      checkedOn,
    },
    reviews: {
      label: "Read provider-hosted testimonials",
      url: "https://www.guardianangelbaby.com/#:~:text=Testimonials",
      sourceUrl: "https://www.guardianangelbaby.com/",
      checkedOn,
    },
    hours: {
      kind: "variable",
      summary: "Hours vary by sitter and request.",
      sourceUrl: "https://www.guardianangelbaby.com/sitter/index",
      checkedOn,
    },
    location: {
      serviceArea: "Comes to you in its listed Provo service area",
      sourceUrl: guardian,
      checkedOn,
    },
    training: {
      text: "Guardian Angel states that its sitters are trained in CPR and first aid. CareConnect has not verified individual credentials.",
      sourceUrl: guardian,
      checkedOn,
    },
  },
};

export function getExternalProfile(id: string): ExternalProfile | null {
  return Object.hasOwn(profiles, id) ? profiles[id] : null;
}
