import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Rider = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  cellphone: string;
  is_suspended: boolean;
  suspension_reason: string | null;
  created_at: string;
};

export default function Riders() {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async (searchTerm = "") => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_riders", {
        search_in: searchTerm || null,
      });
      if (rpcError) throw rpcError;
      setRiders((data ?? []) as Rider[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load riders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search);
  };

  const handleSuspend = async (r: Rider) => {
    setBusyId(r.id);
    try {
      const { error: rpcError } = await supabase.rpc("admin_set_suspended", {
        target_user_id: r.id,
        suspended_in: true,
        reason_in: reason.trim() || null,
      });
      if (rpcError) throw rpcError;
      setSuspendingId(null);
      setReason("");
      load(search);
    } catch (e: any) {
      setError(e?.message ?? "Failed to suspend rider.");
    } finally {
      setBusyId(null);
    }
  };

  const handleUnsuspend = async (r: Rider) => {
    setBusyId(r.id);
    try {
      const { error: rpcError } = await supabase.rpc("admin_set_suspended", {
        target_user_id: r.id,
        suspended_in: false,
      });
      if (rpcError) throw rpcError;
      load(search);
    } catch (e: any) {
      setError(e?.message ?? "Failed to unsuspend rider.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display font-semibold text-2xl">Riders</h1>
      <p className="text-textFaint text-sm mt-1 mb-6">{riders.length} rider{riders.length === 1 ? "" : "s"}</p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or username"
          className="flex-1 bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          className="border border-border text-textDim font-semibold rounded-xl px-4 py-2.5 text-sm hover:text-white transition-colors"
        >
          Search
        </button>
      </form>

      {error && <p className="text-accent text-sm font-medium mb-4">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-textFaint text-sm">
          <div className="live-pulse" /> Loading…
        </div>
      ) : riders.length === 0 ? (
        <p className="text-textFaint text-sm">No riders found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {riders.map((r) => (
            <div key={r.id} className="bg-surface border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{r.first_name} {r.last_name}</span>
                    {r.is_suspended && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border border-accent/40 text-accent">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-textFaint text-xs mt-1">
                    @{r.username} · {r.email} · {r.cellphone}
                  </p>
                  <p className="text-textFaint text-xs mt-1">
                    Joined {new Date(r.created_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                  {r.is_suspended && r.suspension_reason && (
                    <p className="text-accent text-xs mt-1">Reason: {r.suspension_reason}</p>
                  )}
                </div>

                <div className="shrink-0">
                  {r.is_suspended ? (
                    <button
                      onClick={() => handleUnsuspend(r)}
                      disabled={busyId === r.id}
                      className="border border-border text-textDim font-semibold rounded-xl px-3 py-1.5 text-xs hover:text-white transition-colors disabled:opacity-50"
                    >
                      {busyId === r.id ? "…" : "Unsuspend"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setSuspendingId(suspendingId === r.id ? null : r.id)}
                      className="text-textDim hover:text-accent font-semibold text-xs px-2 transition-colors"
                    >
                      Suspend
                    </button>
                  )}
                </div>
              </div>

              {suspendingId === r.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (shown to the rider)"
                    className="flex-1 bg-surfaceRaised border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors"
                  />
                  <button
                    onClick={() => handleSuspend(r)}
                    disabled={busyId === r.id}
                    className="bg-accent text-black font-semibold rounded-xl px-3.5 py-2 text-xs disabled:opacity-50 hover:brightness-110 transition"
                  >
                    {busyId === r.id ? "…" : "Confirm Suspend"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
