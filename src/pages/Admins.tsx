import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type AdminRow = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
};

type FoundUser = AdminRow & { is_admin: boolean };

export default function Admins() {
  const { admin: me } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [found, setFound] = useState<FoundUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "", password: "", username: "", firstName: "", lastName: "", cellphone: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("list_admins");
      if (rpcError) throw rpcError;
      setAdmins((data ?? []) as AdminRow[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load admins.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setFound(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("find_user_by_username", {
        username_in: query.trim(),
      });
      if (rpcError) throw rpcError;
      const row = data?.[0];
      if (!row) {
        setSearchError("No user found with that username.");
      } else {
        setFound(row as FoundUser);
      }
    } catch (e: any) {
      setSearchError(e?.message ?? "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const handleGrant = async () => {
    if (!found) return;
    setBusyId(found.id);
    try {
      const { error: rpcError } = await supabase.rpc("set_admin_status", {
        target_user_id: found.id,
        is_admin_in: true,
      });
      if (rpcError) throw rpcError;
      setFound({ ...found, is_admin: true });
      loadAdmins();
    } catch (e: any) {
      setSearchError(e?.message ?? "Failed to grant admin access.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Remove admin access for this account?")) return;
    setBusyId(id);
    try {
      const { error: rpcError } = await supabase.rpc("set_admin_status", {
        target_user_id: id,
        is_admin_in: false,
      });
      if (rpcError) throw rpcError;
      loadAdmins();
    } catch (e: any) {
      setError(e?.message ?? "Failed to revoke admin access.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    const { email, password, username, firstName, lastName } = createForm;
    if (!email.trim() || !password || !username.trim() || !firstName.trim() || !lastName.trim()) {
      setCreateError("Email, password, username, first name, and last name are required.");
      return;
    }
    setCreating(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("admin-create-account", {
        body: {
          email: email.trim(),
          password,
          username: username.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          cellphone: createForm.cellphone.trim(),
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setCreateSuccess(`Admin account created for ${email}.`);
      setCreateForm({ email: "", password: "", username: "", firstName: "", lastName: "", cellphone: "" });
      loadAdmins();
    } catch (e: any) {
      setCreateError(e?.message ?? "Failed to create account.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="font-display font-semibold text-2xl">Admins</h1>
      <p className="text-textFaint text-sm mt-1 mb-8">
        Grant or revoke admin access. Both riders and drivers can be made admins.
      </p>

      <section className="bg-surface border border-border rounded-2xl p-5 mb-8">
        <h2 className="text-sm font-semibold mb-3">Grant access</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Exact username"
            autoCapitalize="none"
            className="flex-1 bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={searching}
            className="bg-accent text-black font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 hover:brightness-110 transition"
          >
            {searching ? "Searching…" : "Find"}
          </button>
        </form>

        {searchError && <p className="text-accent text-sm font-medium mt-3">{searchError}</p>}

        {found && (
          <div className="mt-4 flex items-center justify-between bg-surfaceRaised border border-border rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{found.first_name} {found.last_name}</p>
              <p className="text-textFaint text-xs">@{found.username} · {found.role}</p>
            </div>
            {found.is_admin ? (
              <span className="text-xs text-success font-semibold uppercase tracking-wide">Already admin</span>
            ) : (
              <button
                onClick={handleGrant}
                disabled={busyId === found.id}
                className="bg-accent text-black font-semibold rounded-xl px-3.5 py-2 text-xs disabled:opacity-50 hover:brightness-110 transition"
              >
                {busyId === found.id ? "Granting…" : "Grant Admin"}
              </button>
            )}
          </div>
        )}
      </section>

      <section className="bg-surface border border-border rounded-2xl p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold">New admin account</h2>
            <p className="text-textFaint text-xs mt-0.5">
              For staff who've never used the rider/driver app — sets their email and password directly.
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="text-xs font-semibold text-textDim hover:text-white border border-border rounded-xl px-3 py-1.5 transition-colors"
          >
            {showCreateForm ? "Cancel" : "+ New"}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateAccount} className="flex flex-col gap-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <input
                value={createForm.firstName}
                onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                placeholder="First name"
                className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
              <input
                value={createForm.lastName}
                onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                placeholder="Last name"
                className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
            </div>
            <input
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              placeholder="Username (for display in the dashboard)"
              autoCapitalize="none"
              className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
            />
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="Login email"
              className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
            />
            <input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="Password (min 8 characters)"
              className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
            />
            <input
              value={createForm.cellphone}
              onChange={(e) => setCreateForm({ ...createForm, cellphone: e.target.value })}
              placeholder="Cellphone (optional)"
              className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
            />

            {createError && <p className="text-accent text-sm font-medium">{createError}</p>}
            {createSuccess && <p className="text-success text-sm font-medium">{createSuccess}</p>}

            <button
              type="submit"
              disabled={creating}
              className="self-start bg-accent text-black font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 hover:brightness-110 transition"
            >
              {creating ? "Creating…" : "Create Admin Account"}
            </button>
          </form>
        )}
      </section>

      <section>
        <h2 className="text-textFaint text-xs uppercase tracking-wide font-semibold mb-3">
          Current admins
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-textFaint text-sm">
            <div className="live-pulse" /> Loading…
          </div>
        ) : error ? (
          <p className="text-accent text-sm font-medium">{error}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {admins.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between bg-surface border border-border rounded-xl px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {a.first_name} {a.last_name}
                    {a.id === me?.id && <span className="text-textFaint font-normal"> (you)</span>}
                  </p>
                  <p className="text-textFaint text-xs">@{a.username} · {a.role}</p>
                </div>
                {a.id !== me?.id && (
                  <button
                    onClick={() => handleRevoke(a.id)}
                    disabled={busyId === a.id}
                    className="text-xs text-textDim hover:text-accent font-semibold uppercase tracking-wide disabled:opacity-50 transition-colors"
                  >
                    {busyId === a.id ? "Removing…" : "Revoke"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
