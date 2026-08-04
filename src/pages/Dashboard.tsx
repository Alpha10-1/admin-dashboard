import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Stats = {
  total_riders: number;
  total_drivers: number;
  verified_drivers: number;
  pending_verifications: number;
  active_rides: number;
  scheduled_rides: number;
  rides_today: number;
  revenue_today_cents: number;
  revenue_week_cents: number;
  revenue_month_cents: number;
  open_sos_alerts: number;
  pending_support_conversations: number;
};

function formatFare(cents: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    (cents ?? 0) / 100
  );
}

function StatCard({
  label,
  value,
  live,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  live?: boolean;
  tone?: "default" | "warning" | "danger";
}) {
  const toneColor =
    tone === "warning" ? "text-warning" : tone === "danger" ? "text-accent" : "text-white";
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {live && <div className="live-pulse" />}
        <span className="text-textFaint text-xs uppercase tracking-wide font-medium">{label}</span>
      </div>
      <span className={`font-mono font-medium text-3xl ${toneColor}`}>{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_admin_dashboard_stats");
      if (rpcError) throw rpcError;
      setStats(data as Stats);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load dashboard stats.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const needsAttention =
    !!stats && (stats.pending_verifications > 0 || stats.open_sos_alerts > 0 || stats.pending_support_conversations > 0);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display font-semibold text-2xl">Dashboard</h1>
          <p className="text-textFaint text-sm mt-1">Live overview of the platform right now.</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-sm font-medium text-textDim hover:text-white border border-border rounded-xl px-3.5 py-2 transition-colors disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-textFaint text-sm">
          <div className="live-pulse" /> Loading…
        </div>
      ) : error ? (
        <p className="text-accent text-sm font-medium">{error}</p>
      ) : stats ? (
        <div className="flex flex-col gap-8">
          {needsAttention && (
            <section>
              <h2 className="text-textFaint text-xs uppercase tracking-wide font-semibold mb-3">
                Needs attention
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  label="Pending Verifications"
                  value={stats.pending_verifications}
                  tone={stats.pending_verifications > 0 ? "warning" : "default"}
                />
                <StatCard
                  label="Open SOS Alerts"
                  value={stats.open_sos_alerts}
                  tone={stats.open_sos_alerts > 0 ? "danger" : "default"}
                  live={stats.open_sos_alerts > 0}
                />
                <StatCard
                  label="Awaiting Support Reply"
                  value={stats.pending_support_conversations}
                  tone={stats.pending_support_conversations > 0 ? "warning" : "default"}
                />
              </div>
            </section>
          )}

          <section>
            <h2 className="text-textFaint text-xs uppercase tracking-wide font-semibold mb-3">
              Right now
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Active Rides" value={stats.active_rides} live={stats.active_rides > 0} />
              <StatCard label="Scheduled Rides" value={stats.scheduled_rides} />
              <StatCard label="Completed Today" value={stats.rides_today} />
            </div>
          </section>

          <section>
            <h2 className="text-textFaint text-xs uppercase tracking-wide font-semibold mb-3">
              Revenue
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Today" value={formatFare(stats.revenue_today_cents)} />
              <StatCard label="This Week" value={formatFare(stats.revenue_week_cents)} />
              <StatCard label="This Month" value={formatFare(stats.revenue_month_cents)} />
            </div>
          </section>

          <section>
            <h2 className="text-textFaint text-xs uppercase tracking-wide font-semibold mb-3">
              Community
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Riders" value={stats.total_riders} />
              <StatCard label="Total Drivers" value={stats.total_drivers} />
              <StatCard label="Verified Drivers" value={stats.verified_drivers} />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
