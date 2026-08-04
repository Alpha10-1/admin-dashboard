import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { admin, loading, error, signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!loading && admin) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!username.trim() || !password) {
      setLocalError("Enter your username and password.");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(username, password);
    } catch {
      // error state surfaced via useAuth().error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="live-pulse" />
          <span className="font-display font-semibold text-lg tracking-tight">
            ride-native <span className="text-textFaint font-body font-normal">admin</span>
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4"
        >
          <div>
            <h1 className="font-display font-semibold text-xl">Sign in</h1>
            <p className="text-textFaint text-sm mt-1">
              Use your ride-native admin account.
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-textDim uppercase tracking-wide">Username or Email</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              placeholder="jane.driver or jane@company.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-textDim uppercase tracking-wide">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              placeholder="••••••••"
            />
          </label>

          {(localError || error) && (
            <p className="text-accent text-sm font-medium">{localError ?? error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 bg-accent text-black font-semibold rounded-xl py-2.5 text-sm disabled:opacity-50 hover:brightness-110 transition"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-textFaint text-xs text-center mt-6">
          Admin access only. Contact another admin if you need an account.
        </p>
      </div>
    </div>
  );
}
