/* eslint-disable @typescript-eslint/no-explicit-any -- untyped Supabase admin payloads */
// Supabase Edge Function: admin-users
// Admin-only user maintenance for the IS401 "Maintain Users" screen.
//
// Actions:
//   { action: "list" }
//   { action: "create", email, password, name?, neighborhood?, role? }
//   { action: "update", id, email?, password?, name?, neighborhood?, role? }
//   { action: "delete", id }
//
// The caller is authenticated with their normal JWT first. Only after that
// check passes does the function create a service-role client. The service-role
// key never reaches the browser. Every write is recorded in admin_audit_log.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

type Role = "parent" | "admin";

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function roleOf(user: any): Role {
  return user?.app_metadata?.role === "admin" ? "admin" : "parent";
}

function userRow(user: any, parent: any) {
  return {
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    banned_until: user.banned_until ?? null,
    role: roleOf(user),
    name: parent?.name ?? user.user_metadata?.name ?? null,
    neighborhood: parent?.neighborhood ?? user.user_metadata?.neighborhood ?? null,
    parent_id: parent?.id ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) {
      return json({ error: "User management is not configured on the server." }, 500);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization) return json({ error: "Sign in required." }, 401);
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Sign in required." }, 401);

    // 1. Verify the caller is a signed-in admin before using the service role.
    //    The token is passed explicitly because this client never stores a
    //    session (persistSession is false).
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerData, error: callerError } = await caller.auth.getUser(token);
    const callerUser = callerData?.user;
    if (callerError || !callerUser) return json({ error: "Sign in required." }, 401);
    if (callerUser.app_metadata?.role !== "admin") {
      return json({ error: "Admin access required." }, 403);
    }

    // 2. Service-role client. This key stays inside the edge function.
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    async function audit(
      actionName: string,
      targetId: string,
      details: Record<string, unknown>,
    ) {
      const { error } = await admin.from("admin_audit_log").insert({
        admin_user_id: callerUser.id,
        admin_email: callerUser.email ?? null,
        action: actionName,
        target_type: "user",
        target_id: targetId,
        details,
      });
      // The auth change already happened, so do not fail the request if the
      // audit insert fails. Surface it in the function logs instead.
      if (error) console.error("admin-users audit failed", error.message);
    }

    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) return json({ error: error.message }, 400);

      const users = data?.users ?? [];
      const ids = users.map((user: any) => user.id);
      const { data: parents, error: parentError } = ids.length
        ? await admin
            .from("parents")
            .select("id, auth_user_id, name, email, neighborhood")
            .in("auth_user_id", ids)
        : { data: [], error: null };
      if (parentError) return json({ error: parentError.message }, 400);

      const byAuthId = new Map((parents ?? []).map((parent: any) => [parent.auth_user_id, parent]));
      return json({
        users: users
          .map((user: any) => userRow(user, byAuthId.get(user.id)))
          .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at))),
      });
    }

    if (action === "create") {
      const email = clean(body.email)?.toLowerCase();
      const password = typeof body.password === "string" ? body.password : "";
      const name = clean(body.name);
      const neighborhood = clean(body.neighborhood);
      const role: Role = body.role === "admin" ? "admin" : "parent";

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Enter a valid email address." }, 400);
      }
      if (password.length < 6) {
        return json({ error: "Password must be at least 6 characters." }, 400);
      }

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role },
        user_metadata: {
          name: name ?? email.split("@")[0],
          neighborhood,
        },
      });
      if (error) return json({ error: error.message }, 400);
      const user = data?.user;
      if (!user) return json({ error: "The user could not be created." }, 500);

      // The sign-up trigger normally creates the family row. Upsert keeps the
      // two records in sync if the trigger is missing or skipped.
      const parentRow = {
        id: user.id,
        auth_user_id: user.id,
        name: name ?? email.split("@")[0],
        email,
        neighborhood,
      };
      const { data: parent, error: parentError } = await admin
        .from("parents")
        .upsert(parentRow, { onConflict: "id" })
        .select("id, auth_user_id, name, email, neighborhood")
        .maybeSingle();
      if (parentError) return json({ error: parentError.message }, 400);

      await audit("user.create", user.id, { email, role, name: parentRow.name });
      return json({ user: userRow(user, parent) });
    }

    if (action === "update") {
      const id = clean(body.id);
      if (!id) return json({ error: "User id is required." }, 400);

      const { data: currentData, error: currentError } = await admin.auth.admin.getUserById(id);
      if (currentError || !currentData?.user) {
        return json({ error: currentError?.message ?? "User not found." }, 404);
      }
      const current = currentData.user;
      const currentRole = roleOf(current);
      const role: Role = body.role === "admin" ? "admin" : "parent";

      if (id === callerUser.id && role !== "admin") {
        return json({ error: "You cannot remove your own admin role." }, 400);
      }

      const email = clean(body.email)?.toLowerCase() ?? current.email ?? null;
      const password = typeof body.password === "string" ? body.password : "";
      if (password && password.length < 6) {
        return json({ error: "Password must be at least 6 characters." }, 400);
      }

      const name = clean(body.name) ?? current.user_metadata?.name ?? null;
      const neighborhood =
        clean(body.neighborhood) ?? current.user_metadata?.neighborhood ?? null;

      const { data, error } = await admin.auth.admin.updateUserById(id, {
        ...(email ? { email } : {}),
        ...(password ? { password } : {}),
        app_metadata: { ...(current.app_metadata ?? {}), role },
        user_metadata: { ...(current.user_metadata ?? {}), name, neighborhood },
      });
      if (error) return json({ error: error.message }, 400);
      const user = data?.user;
      if (!user) return json({ error: "The user could not be updated." }, 500);

      const { data: existingParent } = await admin
        .from("parents")
        .select("id")
        .eq("auth_user_id", id)
        .maybeSingle();

      let parent;
      if (existingParent) {
        const { data: updated, error: parentError } = await admin
          .from("parents")
          .update({ name, email, neighborhood })
          .eq("id", existingParent.id)
          .select("id, auth_user_id, name, email, neighborhood")
          .maybeSingle();
        if (parentError) return json({ error: parentError.message }, 400);
        parent = updated;
      } else {
        const { data: inserted, error: parentError } = await admin
          .from("parents")
          .insert({ id: user.id, auth_user_id: user.id, name, email, neighborhood })
          .select("id, auth_user_id, name, email, neighborhood")
          .maybeSingle();
        if (parentError) return json({ error: parentError.message }, 400);
        parent = inserted;
      }

      await audit("user.update", id, {
        email,
        role,
        previous_role: currentRole,
        password_changed: !!password,
      });
      return json({ user: userRow(user, parent) });
    }

    if (action === "delete") {
      const id = clean(body.id);
      if (!id) return json({ error: "User id is required." }, 400);
      if (id === callerUser.id) {
        return json({ error: "You cannot delete your own account." }, 400);
      }

      const { data: currentData, error: currentError } = await admin.auth.admin.getUserById(id);
      if (currentError || !currentData?.user) {
        return json({ error: currentError?.message ?? "User not found." }, 404);
      }
      const current = currentData.user;

      // Delete the family record first. This cascades to the family's private
      // data (children, favorites, bookings, preferences, and so on).
      const { error: parentError } = await admin
        .from("parents")
        .delete()
        .eq("auth_user_id", id);
      if (parentError) return json({ error: parentError.message }, 400);

      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 400);

      await audit("user.delete", id, {
        email: current.email ?? null,
        role: roleOf(current),
      });
      return json({ deleted: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("admin-users failed", error);
    return json({ error: "Something went wrong managing users." }, 500);
  }
});
