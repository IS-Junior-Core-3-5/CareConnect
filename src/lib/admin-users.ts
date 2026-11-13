import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminKeys } from "@/lib/admin-data";

/**
 * Maintain Users: real Supabase Auth accounts.
 *
 * Browsers cannot use the service-role key, so all Auth user reads and writes go
 * through the `admin-users` edge function. That function verifies the caller's
 * admin role before it creates a service-role client, and records every write in
 * admin_audit_log.
 */

export type AdminUserRole = "parent" | "admin";

export type AdminUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  role: AdminUserRole;
  name: string | null;
  neighborhood: string | null;
  parent_id: string | null;
};

export type AdminUserCreate = {
  email: string;
  password: string;
  name: string;
  neighborhood: string;
  role: AdminUserRole;
};

export type AdminUserUpdate = {
  id: string;
  email: string;
  /** Leave blank to keep the current password. */
  password: string;
  name: string;
  neighborhood: string;
  role: AdminUserRole;
};

export const adminUserKeys = {
  all: ["admin", "users"] as const,
};

type FunctionError = {
  message?: string;
  context?: { json?: () => Promise<unknown> };
};

/** Invoke the edge function and surface its JSON `error` message when present. */
async function invokeAdminUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    let message = (error as FunctionError).message ?? "User management request failed";
    const context = (error as FunctionError).context;
    if (context?.json) {
      try {
        const payload = (await context.json()) as { error?: string } | null;
        if (payload?.error) message = payload.error;
      } catch {
        // Keep the original message if the response is not JSON.
      }
    }
    throw new Error(message);
  }
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: adminUserKeys.all,
    queryFn: async () => {
      const data = await invokeAdminUsers<{ users: AdminUser[] }>({ action: "list" });
      return data.users ?? [];
    },
  });
}

function invalidateUsers(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: adminUserKeys.all });
  // A user write can create, edit, or cascade-delete the linked family record.
  void qc.invalidateQueries({ queryKey: adminKeys.parents });
  void qc.invalidateQueries({ queryKey: adminKeys.stats });
  void qc.invalidateQueries({ queryKey: adminKeys.audit });
}

export function useCreateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminUserCreate) => {
      const data = await invokeAdminUsers<{ user: AdminUser }>({ action: "create", ...input });
      return data.user;
    },
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: AdminUserUpdate) => {
      const data = await invokeAdminUsers<{ user: AdminUser }>({ action: "update", id, ...input });
      return data.user;
    },
    onSuccess: () => invalidateUsers(qc),
  });
}

export function useDeleteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await invokeAdminUsers<{ deleted: boolean }>({ action: "delete", id });
      return id;
    },
    onSuccess: () => invalidateUsers(qc),
  });
}
