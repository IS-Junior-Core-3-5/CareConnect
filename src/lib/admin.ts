import type { User } from "@supabase/supabase-js";

/**
 * Admin access comes from Supabase `app_metadata`, which only the project owner
 * can set (dashboard, SQL, or a service-role Admin API call). Unlike
 * `user_metadata`, a signed-in user cannot edit it themselves.
 *
 * Grant admin access by setting this on the account:
 *   { "role": "admin" }
 *
 * UI checks are only a convenience. Once the panel reads or changes real data,
 * enforce the same role in Row Level Security or an edge function, e.g.:
 *   (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
 */
export function isAdminUser(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === "admin";
}
