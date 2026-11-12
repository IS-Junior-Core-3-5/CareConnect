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

export const adminKeys = {
  stats: ["admin", "stats"] as const,
  providers: ["admin", "providers"] as const,
  bookings: ["admin", "bookings"] as const,
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
