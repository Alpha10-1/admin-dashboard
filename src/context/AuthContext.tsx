import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, usernameToAuthEmail } from "../lib/supabase";

type AdminProfile = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
};

type AuthState = {
  loading: boolean;
  admin: AdminProfile | null;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadProfile() {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setAdmin(null);
      setLoading(false);
      return;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, first_name, last_name, is_admin")
      .eq("id", userId)
      .single();

    if (profileError || !data?.is_admin) {
      // Signed in, but not an admin — don't leave a stray session sitting
      // around granting access to nothing but confusing state.
      await supabase.auth.signOut();
      setAdmin(null);
      setError(!profileError ? "This account doesn't have admin access." : null);
      setLoading(false);
      return;
    }

    setAdmin(data as AdminProfile);
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(usernameOrEmail: string, password: string) {
    setError(null);
    const input = usernameOrEmail.trim();
    // Staff-only admin accounts (created via Admins -> "New admin account")
    // log in with a real email; existing app accounts log in with their
    // app username, same as the mobile app.
    const email = input.includes("@") ? input.toLowerCase() : usernameToAuthEmail(input);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError("Incorrect username/email or password.");
      throw signInError;
    }
    // onAuthStateChange -> loadProfile() handles the is_admin check.
  }

  async function signOut() {
    await supabase.auth.signOut();
    setAdmin(null);
  }

  return (
    <AuthContext.Provider value={{ loading, admin, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
