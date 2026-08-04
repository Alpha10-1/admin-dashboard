import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type SosAlert = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  username: string;
  cellphone: string;
  user_role: "rider" | "driver";
  ride_id: string | null;
  share_scope: "emergency_only" | "public";
  lat: number;
  lng: number;
  status: "active" | "resolved";
  created_at: string;
  resolved_at: string | null;
};

type Filter = "active" | "resolved" | "all";

export default function Sos() {
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [filter, setFilter] = useState<Filter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_sos_alerts", {
        status_in: f === "all" ? null : f,
      });
      if (rpcError) throw rpcError;
      setAlerts((data ?? []) as SosAlert[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load SOS alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
    // Emergencies are time-critical — poll faster than other sections.
    const interval = setInterval(() => load(filter), 10_000);
    return () => clearInterval(interval);
  }, [load, filter]);

  const handleResolve = async (a: SosAlert) => {
    if (!confirm(`Mark this SOS alert from ${a.first_name} ${a.last_name} as resolved?`)) return;
    setBusyId(a.id);
    try {
      const { error: rpcError } = await supabase.rpc("admin_resolve_sos", { alert_id_in: a.id });
      if (rpcError) throw rpcError;
      load(filter);
    } catch (e: any) {
      setError(e?.message ?? "Failed to resolve alert.");
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = alerts.filter((a) => a.status === "active").length;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-2 mb-2">
        {filter !== "resolved" && activeCount > 0 && <div className="live-pulse" />}
        <h1 className="font-display font-semibold text-2xl">SOS Alerts</h1>
      </div>
      <p className="text-textFaint text-sm mb-6">
        {filter === "active"
          ? activeCount > 0
            ? `${activeCount} active alert${activeCount === 1 ? "" : "s"} — refreshing every 10s.`
            : "No active alerts right now."
          : `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`}
      </p>

      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-xl p-1 w-fit">
        {(["active", "resolved", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
              filter === f ? "bg-accent text-black" : "text-textDim hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <p className="text-accent text-sm font-medium mb-4">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-textFaint text-sm">
          <div className="live-pulse" /> Loading…
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-textFaint text-sm">Nothing here.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`bg-surface border rounded-2xl p-4 flex items-start justify-between gap-4 ${
                a.status === "active" ? "border-accent/40" : "border-border"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{a.first_name} {a.last_name}</span>
                  <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border border-border text-textFaint">
                    {a.user_role}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${
                      a.status === "active" ? "text-accent border-accent/40" : "text-success border-success/40"
                    }`}
                  >
                    {a.status}
                  </span>
                  {a.share_scope === "public" && (
                    <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border border-warning/40 text-warning">
                      Public share
                    </span>
                  )}
                </div>
                <p className="text-textFaint text-xs mt-1">
                  @{a.username} · {a.cellphone}
                  {a.ride_id && " · during an active ride"}
                </p>
                <a
                  href={`https://www.google.com/maps?q=${a.lat},${a.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent hover:underline mt-1 inline-block"
                >
                  View location ({a.lat.toFixed(5)}, {a.lng.toFixed(5)})
                </a>
                <p className="text-textFaint text-[11px] mt-1">
                  Triggered {new Date(a.created_at).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {a.resolved_at && ` · resolved ${new Date(a.resolved_at).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                </p>
              </div>

              {a.status === "active" && (
                <button
                  onClick={() => handleResolve(a)}
                  disabled={busyId === a.id}
                  className="shrink-0 border border-border text-textDim font-semibold rounded-xl px-3 py-1.5 text-xs hover:text-white transition-colors disabled:opacity-50"
                >
                  {busyId === a.id ? "…" : "Mark Resolved"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
