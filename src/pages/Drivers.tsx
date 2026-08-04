import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Driver = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  cellphone: string;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  is_online: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  license_plate: string | null;
  created_at: string;
};

const VERIFICATION_STYLE: Record<string, string> = {
  unverified: "text-textFaint border-border",
  pending: "text-warning border-warning/40",
  verified: "text-success border-success/40",
  rejected: "text-accent border-accent/40",
};

export default function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async (searchTerm = "") => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_drivers", {
        search_in: searchTerm || null,
      });
      if (rpcError) throw rpcError;
      setDrivers((data ?? []) as Driver[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load drivers.");
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

  const handleSuspend = async (d: Driver) => {
    setBusyId(d.id);
    try {
      const { error: rpcError } = await supabase.rpc("admin_set_suspended", {
        target_user_id: d.id,
        suspended_in: true,
        reason_in: reason.trim() || null,
      });
      if (rpcError) throw rpcError;
      setSuspendingId(null);
      setReason("");
      load(search);
    } catch (e: any) {
      setError(e?.message ?? "Failed to suspend driver.");
    } finally {
      setBusyId(null);
    }
  };

  const handleUnsuspend = async (d: Driver) => {
    setBusyId(d.id);
    try {
      const { error: rpcError } = await supabase.rpc("admin_set_suspended", {
        target_user_id: d.id,
        suspended_in: false,
      });
      if (rpcError) throw rpcError;
      load(search);
    } catch (e: any) {
      setError(e?.message ?? "Failed to unsuspend driver.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display font-semibold text-2xl">Drivers</h1>
      <p className="text-textFaint text-sm mt-1 mb-6">{drivers.length} driver{drivers.length === 1 ? "" : "s"}</p>

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
      ) : drivers.length === 0 ? (
        <p className="text-textFaint text-sm">No drivers found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {drivers.map((d) => (
            <div key={d.id} className="bg-surface border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{d.first_name} {d.last_name}</span>
                    {d.is_online && <div className="w-2 h-2 rounded-full bg-success" title="Online" />}
                    <span
                      className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${VERIFICATION_STYLE[d.verification_status]}`}
                    >
                      {d.verification_status}
                    </span>
                    {d.is_suspended && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border border-accent/40 text-accent">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-textFaint text-xs mt-1">
                    @{d.username} · {d.email} · {d.cellphone}
                  </p>
                  <p className="text-textDim text-xs mt-1">
                    {d.vehicle_make && d.vehicle_model
                      ? `${d.vehicle_make} ${d.vehicle_model} · ${d.license_plate ?? "no plate on file"}`
                      : "No vehicle on file"}
                  </p>
                  {d.is_suspended && d.suspension_reason && (
                    <p className="text-accent text-xs mt-1">Reason: {d.suspension_reason}</p>
                  )}
                </div>

                <div className="shrink-0">
                  {d.is_suspended ? (
                    <button
                      onClick={() => handleUnsuspend(d)}
                      disabled={busyId === d.id}
                      className="border border-border text-textDim font-semibold rounded-xl px-3 py-1.5 text-xs hover:text-white transition-colors disabled:opacity-50"
                    >
                      {busyId === d.id ? "…" : "Unsuspend"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setSuspendingId(suspendingId === d.id ? null : d.id)}
                      className="text-textDim hover:text-accent font-semibold text-xs px-2 transition-colors"
                    >
                      Suspend
                    </button>
                  )}
                </div>
              </div>

              {suspendingId === d.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (shown to the driver)"
                    className="flex-1 bg-surfaceRaised border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors"
                  />
                  <button
                    onClick={() => handleSuspend(d)}
                    disabled={busyId === d.id}
                    className="bg-accent text-black font-semibold rounded-xl px-3.5 py-2 text-xs disabled:opacity-50 hover:brightness-110 transition"
                  >
                    {busyId === d.id ? "…" : "Confirm Suspend"}
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
