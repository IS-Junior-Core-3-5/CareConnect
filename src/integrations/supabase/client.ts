import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const isBrowser = typeof window !== "undefined";

export const supabase = createClient(url, key, {
  auth: {
    // Keep users logged in between visits (browser only; the server render has no session).
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
  },
});
