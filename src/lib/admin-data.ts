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
  blurb: string | null;
  bio: string | null;
  daily_rate: number | null;
  daily_rate_max: number | null;
  distance_miles: number | null;
  latitude: number | null;
  longitude: number | null;
  schedule_summary: string | null;
  profile_photo_path: string | null;
};

export type AdminProviderWrite = {
  id: string;
  name: string;
  care_type: string;
  listing_origin: AdminProviderOrigin;
  is_public: boolean;
  verified: boolean;
  blurb: string | null;
  bio: string | null;
  address: string | null;
  phone: string | null;
  daily_rate: number | null;
  daily_rate_max: number | null;
  distance_miles: number | null;
  schedule_available: boolean;
  schedule_summary: string | null;
  photo_key: string | null;
  website_url: string | null;
  contact_url: string | null;
  source_url: string | null;
  checked_on: string | null;
  latitude: number | null;
  longitude: number | null;
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

/** Fields an admin can write when creating or editing a booking. */
export type AdminBookingWrite = {
  parent_id: string;
  provider_id: string;
  care_date: string;
  block: "Morning" | "Afternoon" | "Evening";
  status: AdminBookingStatus;
  resolution_note: string | null;
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

/** Fields an admin can write when creating or editing a family record. */
export type AdminParentWrite = {
  id: string;
  name: string;
  email: string | null;
  neighborhood: string | null;
  blurb: string | null;
  address: string | null;
};

export type AdminAuditEntry = {
  id: number;
  admin_user_id: string | null;
  admin_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
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

export type AdminAiTopProvider = {
  provider_id: string;
  name: string;
  rank: number;
  match_score: number | null;
  headline: string;
};

export type AdminAiSet = {
  parent_id: string;
  parent_name: string;
  parent_email: string | null;
  neighborhood: string | null;
  has_preferences: boolean;
  preferences_updated_at: string | null;
  recommendation_count: number;
  summary: string | null;
  model: string | null;
  generated_at: string | null;
  top_providers: AdminAiTopProvider[];
  chat_messages: number;
  chat_user_messages: number;
  chat_assistant_messages: number;
  last_chat_at: string | null;
  favorites_count: number;
  bookings_total: number;
  bookings_confirmed: number;
  last_login_at: string | null;
};

export type AdminAiRecommendationDetails = {
  why?: string;
  tradeoffs?: string;
  schedule?: string;
  cost?: string;
  trust?: string;
};

export type AdminAiRecommendation = {
  provider_id: string;
  provider_name: string;
  care_type: string;
  is_public: boolean;
  verified: boolean;
  rating: number;
  review_count: number;
  daily_rate: number | null;
  daily_rate_max: number | null;
  address: string | null;
  rank: number;
  match_score: number | null;
  headline: string;
  details: AdminAiRecommendationDetails;
  summary: string | null;
  model: string | null;
  created_at: string;
};

export type AdminAiDetail = {
  parent: {
    id: string;
    name: string;
    email: string | null;
    neighborhood: string | null;
    children_count: number;
    has_preferences: boolean;
    preferences_updated_at: string | null;
  };
  set: {
    recommendation_count: number;
    summary: string | null;
    model: string | null;
    generated_at: string | null;
  };
  recommendations: AdminAiRecommendation[];
  chat: {
    messages: number;
    user_messages: number;
    assistant_messages: number;
    first_at: string | null;
    last_at: string | null;
    models: (string | null)[];
  };
  context: {
    favorites_count: number;
    bookings_total: number;
    bookings_confirmed: number;
    last_care_date: string | null;
    providers_booked: number;
    providers_rebooked: number;
  };
};

export const adminKeys = {
  stats: ["admin", "stats"] as const,
  providers: ["admin", "providers"] as const,
  bookings: ["admin", "bookings"] as const,
  parents: ["admin", "parents"] as const,
  parent: (parentId: string) => ["admin", "parent", parentId] as const,
  ai: ["admin", "ai"] as const,
  aiDetail: (parentId: string) => ["admin", "ai", parentId] as const,
  audit: ["admin", "audit"] as const,
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

export function useAdminAiSets() {
  return useQuery({
    queryKey: adminKeys.ai,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_ai_list");
      if (error) throw error;
      return (data ?? []) as AdminAiSet[];
    },
  });
}

export function useAdminAiDetail(parentId: string | null) {
  return useQuery({
    queryKey: adminKeys.aiDetail(parentId ?? ""),
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_ai_detail", {
        p_parent_id: parentId!,
      });
      if (error) throw error;
      return data as AdminAiDetail;
    },
  });
}

export function useClearAdminAiRecommendations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (parentId: string) => {
      const { data, error } = await supabase.rpc("admin_clear_ai_recommendations", {
        p_parent_id: parentId,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (_deleted, parentId) => {
      void qc.invalidateQueries({ queryKey: adminKeys.ai });
      void qc.invalidateQueries({ queryKey: adminKeys.aiDetail(parentId) });
      void qc.invalidateQueries({ queryKey: adminKeys.parent(parentId) });
      void qc.invalidateQueries({ queryKey: adminKeys.parents });
      void qc.invalidateQueries({ queryKey: adminKeys.stats });
    },
  });
}

// ---------------------------------------------------------------------------
// Maintain Records: create, edit, and delete providers, bookings, and families.
// Each mutation calls an audited security-definer RPC. The database rejects the
// call for non-admins, so hiding the buttons in the UI is a convenience, not the
// security boundary.
// ---------------------------------------------------------------------------

/** Invalidate every admin read that a record write can change. */
function invalidateRecords(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: adminKeys.providers });
  void qc.invalidateQueries({ queryKey: adminKeys.bookings });
  void qc.invalidateQueries({ queryKey: adminKeys.parents });
  void qc.invalidateQueries({ queryKey: adminKeys.stats });
  void qc.invalidateQueries({ queryKey: adminKeys.audit });
}

function providerArgs(input: AdminProviderWrite) {
  return {
    p_id: input.id,
    p_name: input.name,
    p_care_type: input.care_type,
    p_listing_origin: input.listing_origin,
    p_is_public: input.is_public,
    p_verified: input.verified,
    p_blurb: input.blurb,
    p_bio: input.bio,
    p_address: input.address,
    p_phone: input.phone,
    p_daily_rate: input.daily_rate,
    p_daily_rate_max: input.daily_rate_max,
    p_distance_miles: input.distance_miles,
    p_schedule_available: input.schedule_available,
    p_schedule_summary: input.schedule_summary,
    p_photo_key: input.photo_key,
    p_website_url: input.website_url,
    p_contact_url: input.contact_url,
    p_source_url: input.source_url,
    p_checked_on: input.checked_on,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
  };
}

export function useCreateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminProviderWrite) => {
      const { data, error } = await supabase.rpc("admin_create_provider", providerArgs(input));
      if (error) throw error;
      return data as AdminProvider;
    },
    onSuccess: () => invalidateRecords(qc),
  });
}

export function useUpdateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminProviderWrite) => {
      const { data, error } = await supabase.rpc("admin_update_provider", providerArgs(input));
      if (error) throw error;
      return data as AdminProvider;
    },
    onSuccess: () => invalidateRecords(qc),
  });
}

export function useDeleteProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (providerId: string) => {
      const { data, error } = await supabase.rpc("admin_delete_provider", { p_id: providerId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidateRecords(qc),
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminBookingWrite) => {
      const { data, error } = await supabase.rpc("admin_create_booking", {
        p_parent_id: input.parent_id,
        p_provider_id: input.provider_id,
        p_care_date: input.care_date,
        p_block: input.block,
        p_status: input.status,
        p_resolution_note: input.resolution_note,
      });
      if (error) throw error;
      return data as AdminBooking;
    },
    onSuccess: () => invalidateRecords(qc),
  });
}

export function useUpdateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminBookingWrite & { id: string }) => {
      const { data, error } = await supabase.rpc("admin_update_booking", {
        p_booking_id: input.id,
        p_parent_id: input.parent_id,
        p_provider_id: input.provider_id,
        p_care_date: input.care_date,
        p_block: input.block,
        p_status: input.status,
        p_resolution_note: input.resolution_note,
      });
      if (error) throw error;
      return data as AdminBooking;
    },
    onSuccess: () => invalidateRecords(qc),
  });
}

export function useDeleteBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc("admin_delete_booking", {
        p_booking_id: bookingId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidateRecords(qc),
  });
}

export function useCreateParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminParentWrite) => {
      const { data, error } = await supabase.rpc("admin_create_parent", {
        p_id: input.id,
        p_name: input.name,
        p_email: input.email,
        p_neighborhood: input.neighborhood,
        p_blurb: input.blurb,
        p_address: input.address,
      });
      if (error) throw error;
      return data as AdminParent;
    },
    onSuccess: () => invalidateRecords(qc),
  });
}

export function useUpdateParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminParentWrite) => {
      const { data, error } = await supabase.rpc("admin_update_parent", {
        p_id: input.id,
        p_name: input.name,
        p_email: input.email,
        p_neighborhood: input.neighborhood,
        p_blurb: input.blurb,
        p_address: input.address,
      });
      if (error) throw error;
      return data as AdminParent;
    },
    onSuccess: (_data, input) => {
      invalidateRecords(qc);
      void qc.invalidateQueries({ queryKey: adminKeys.parent(input.id) });
    },
  });
}

export function useDeleteParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (parentId: string) => {
      const { data, error } = await supabase.rpc("admin_delete_parent", { p_id: parentId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidateRecords(qc),
  });
}

// ---------------------------------------------------------------------------
// Audit log viewer. Read-only; the select policy and grant already exist in
// 20261111000000_admin_foundation.sql.
// ---------------------------------------------------------------------------

export function useAdminAuditLog(limit = 500) {
  return useQuery({
    queryKey: adminKeys.audit,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AdminAuditEntry[];
    },
  });
}
