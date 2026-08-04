import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at build/boot rather than silently making broken requests.
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in."
  );
}

// Deliberately the anon key, not the service role key. This app relies on
// the same RLS + is_admin-gated RPCs as the mobile app (see
// 0016_lockdown_profile_security.sql and 0017_admin_dashboard_stats.sql) —
// never embed the service role key in a browser-shipped app; that key
// bypasses RLS entirely and must only ever live server-side.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Ride-native authenticates by username, not email — the mobile app
// synthesizes an internal address the user never sees (see
// usernameToAuthEmail in the mobile app's src/lib/auth.ts). Admin accounts
// are regular accounts promoted via set_admin_status, so they log in with
// that same synthesized email under the hood.
export function usernameToAuthEmail(username: string): string {
  return `${username.trim().toLowerCase()}@ridenative.internal`;
}
