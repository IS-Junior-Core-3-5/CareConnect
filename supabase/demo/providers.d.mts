export const landmarks: { city: string; address: string }[];

export function buildDemoProviders(ownerIds?: string[]): {
  listing: {
    id: string;
    owner_id: string | null;
    listing_origin: "owned" | "sample";
    name: string;
    care_type: "Daycare" | "Preschool" | "Sitter" | "Family Friend";
    address: string;
    phone: string;
    blurb: string;
    bio: string;
    daily_rate: number | null;
    daily_rate_max: number | null;
    distance_miles: null;
    verified: false;
    is_public: true;
    schedule_available: boolean;
    schedule_summary: string | null;
  };
  notes: string[];
  credentials: string[];
  languages: string[];
  availability: { day_of_week: number; block: string }[];
}[];
