import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin-only reads and writes. The database enforces the same
 * `app_metadata.role = "admin"` check, so a non-admin who bypasses the UI still
 * cannot read the admin view or call these RPCs successfully.
 */

export type AdminStats = {
  providers_total: number;
  providers_public: number;
  providers_archived: number;
  providers_owned: number;
  providers_external: number;
  providers_sample: number;
  providers_verified: number;
  providers_missing_photo: number;
  parents_total: number;
  bookings_pending: number;
  bookings_confirmed: number;
  bookings_declined: number;
  bookings_cancelled: number;
  bookings_pending_over_2d: number;
  overall_rebook_rate_pct: number | null;
  ai_families: number;
  ai_recommendations: number;
  ai_last_generated: string | null;
  logins_total: number;
  active_users_7d: number;
  search_sessions_7d: number;
  avg_search_minutes: number | null;
  unverified_credentials: number;
  stale_external: number;
};

export type AdminProviderOrigin = "owned" | "external" | "sample";

export type AdminProvider = {
  id: string;
  name: string;
  care_type: string;
  address: string | null;
  phone: string | null;
  verified: boolean;
  is_public: boolean;
  listing_origin: AdminProviderOrigin;
  owner_id: string | null;
  website_url: string | null;
  contact_url: string | null;
  source_url: string | null;
  checked_on: string | null;
  schedule_available: boolean;
  photo_key: string | null;
  created_at: string;
  rating: number;
  review_count: number;
  credential_count: number;
  verified_credential_count: number;
};

export type AdminBookingStatus = "pending" | "confirmed" | "declined" | "cancelled";

export type AdminBooking = {
  id: string;
  parent_id: string;
  parent_name: string | null;
  provider_id: string;
  provider_name: string | null;
  care_date: string;
  block: "Morning" | "Afternoon" | "Evening";
  status: AdminBookingStatus;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  is_overdue: boolean;
  parent_provider_confirmed_bookings: number;
  parent_provider_rebooking: boolean;
};

export type AdminParent = {
  parent_id: string;
  name: string;
  email: string | null;
  neighborhood: string | null;
  address: string | null;
  created_at: string;
  children_count: number;
  languages: string[];
  need_blocks: number;
  favorites_count: number;
  bookings_total: number;
  bookings_pending: number;
  bookings_confirmed: number;
  last_care_date: string | null;
  providers_booked: number;
  providers_rebooked: number;
  ai_recommendations: number;
  last_ai_at: string | null;
  chat_messages: number;
  login_count: number;
  last_login_at: string | null;
  search_sessions: number;
  avg_search_minutes: number | null;
  has_preferences: boolean;
  preferences_updated_at: string | null;
};

export type AdminParentPreferences = {
  parent_id: string;
  care_types: string[];
  care_settings: string[];
  arrangement: string | null;
  start_date: string | null;
  budget_min: number | null;
  budget_max: number | null;
  budget_flexibility: string | null;
  preferred_cities: string[];
  max_distance_miles: number | null;
  needs_transportation: boolean;
  must_haves: string[];
  approaches: string[];
  languages_wanted: string[];
  child_needs: string | null;
  diet: string | null;
  communication: string[];
  priorities: string[];
  dealbreakers: string | null;
  notes_for_ai: string | null;
  ai_answer_style: "Short" | "Balanced" | "Detailed";
  updated_at: string;
};

export type AdminParentChild = {
  id: number;
  name: string;
  age: number | null;
};

export type AdminParentScheduleBlock = {
  day_of_week: number;
  block: "Morning" | "Afternoon" | "Evening";
};

export type AdminParentFavorite = {
  provider_id: string;
  name: string;
  care_type: string;
  is_public: boolean;
  created_at: string;
};

export type AdminParentBooking = {
  id: string;
  provider_id: string;
  provider_name: string;
  care_date: string;
  block: "Morning" | "Afternoon" | "Evening";
  status: AdminBookingStatus;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminParentRebook = {
  providers_booked: number;
  providers_rebooked: number;
  confirmed_bookings: number;
  total_rebookings: number;
  last_care_date: string | null;
};

export type AdminParentRecommendation = {
  provider_id: string;
  provider_name: string;
  rank: number;
  match_score: number | null;
  headline: string;
  model: string | null;
  created_at: string;
};

export type AdminParentActivity = {
  login_count: number;
  last_login_at: string | null;
  search_sessions: number;
  avg_search_minutes: number | null;
  last_search_at: string | null;
  chat_messages: number;
};

export type AdminParentDetail = {
  parent: {
    id: string;
    name: string;
    email: string | null;
    neighborhood: string | null;
    blurb: string | null;
    address: string | null;
    created_at: string;
  };
  children: AdminParentChild[];
  languages: string[];
  schedule: AdminParentScheduleBlock[];
  preferences: AdminParentPreferences | null;
  favorites: AdminParentFavorite[];
  bookings: AdminParentBooking[];
  rebook: AdminParentRebook;
  recommendations: AdminParentRecommendation[];
  activity: AdminParentActivity;
};

export const adminKeys = {
  stats: ["admin", "stats"] as const,
  providers: ["admin", "providers"] as const,
  bookings: ["admin", "bookings"] as const,
  parents: ["admin", "parents"] as const,
  parent: (parentId: string) => ["admin", "parent", parentId] as const,
};

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard_stats");
      if (error) throw error;
      return data as AdminStats;
    },
  });
}

export function useAdminProviders() {
  return useQuery({
    queryKey: adminKeys.providers,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_provider_list")
        .select("*")
        .order("is_public", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AdminProvider[];
    },
  });
}

type SetProviderFlagsInput = {
  providerId: string;
  verified?: boolean;
  isPublic?: boolean;
};

export function useSetProviderFlags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ providerId, verified, isPublic }: SetProviderFlagsInput) => {
      const { data, error } = await supabase.rpc("admin_set_provider_flags", {
        p_provider_id: providerId,
        p_verified: verified ?? null,
        p_is_public: isPublic ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.providers });
      void qc.invalidateQueries({ queryKey: adminKeys.stats });
    },
  });
}

export function useAdminBookings() {
  return useQuery({
    queryKey: adminKeys.bookings,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_booking_list")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdminBooking[];
    },
  });
}

type SetBookingStatusInput = {
  bookingId: string;
  status: AdminBookingStatus;
  reason?: string;
};

export function useSetBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, status, reason }: SetBookingStatusInput) => {
      const { data, error } = await supabase.rpc("admin_set_booking_status", {
        p_booking_id: bookingId,
        p_status: status,
        p_reason: reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.bookings });
      void qc.invalidateQueries({ queryKey: adminKeys.stats });
    },
  });
}

export function useAdminParents() {
  return useQuery({
    queryKey: adminKeys.parents,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_parent_list");
      if (error) throw error;
      return (data ?? []) as AdminParent[];
    },
  });
}

export function useAdminParent(parentId: string | null) {
  return useQuery({
    queryKey: adminKeys.parent(parentId ?? ""),
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_parent_detail", {
        p_parent_id: parentId!,
      });
      if (error) throw error;
      return data as AdminParentDetail;
    },
  });
}
