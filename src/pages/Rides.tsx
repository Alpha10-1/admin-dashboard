import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type RideRow = {
  id: string;
  status: string;
  ride_tier: "economy" | "comfort" | "xl";
  rider_id: string;
  rider_name: string;
  rider_username: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_username: string | null;
  pickup_label: string;
  destination_label: string;
  estimated_fare_cents: number | null;
  final_fare_cents: number | null;
  cancellation_fee_cents: number | null;
  cancelled_by: "rider" | "driver" | null;
  requested_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  total_count: number;
};

type RideDetail = {
  ride: RideRow & { pickup_address: string; destination_address: string; demand_multiplier: number };
  rider: { id: string; first_name: string; last_name: string; username: string; cellphone: string };
  driver: { id: string; first_name: string; last_name: string; username: string; cellphone: string } | null;
  trip_slip: any | null;
  stops: { sequence: number; label: string; address: string; reached_at: string | null }[];
  status_log: { status: string; created_at: string }[];
  offers: { amount_cents: number; proposed_by: string; status: string; created_at: string }[];
  messages: { sender_id: string; body: string; created_at: string }[];
};

const PAGE_SIZE = 50;

const STATUS_STYLE: Record<string, string> = {
  scheduled: "text-textFaint border-border",
  requested: "text-warning border-warning/40",
  accepted: "text-warning border-warning/40",
  driver_en_route: "text-warning border-warning/40",
  driver_arrived: "text-warning border-warning/40",
  in_progress: "text-success border-success/40",
  completed: "text-textDim border-border",
  cancelled: "text-accent border-accent/40",
};

function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function Rides() {
  const [rides, setRides] = useState<RideRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RideDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (searchTerm: string, statusFilter: string, pageIn: number) => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_rides_admin", {
        search_in: searchTerm || null,
        status_in: statusFilter || null,
        limit_in: PAGE_SIZE,
        offset_in: pageIn * PAGE_SIZE,
      });
      if (rpcError) throw rpcError;
      const rows = (data ?? []) as RideRow[];
      setRides(rows);
      setTotal(rows[0]?.total_count ?? 0);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load rides.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(search, status, page);
  }, [load, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    load(search, status, 0);
  };

  const handleStatusChange = (s: string) => {
    setStatus(s);
    setPage(0);
    load(search, s, 0);
  };

  const openRide = useCallback(async (r: RideRow) => {
    setSelectedId(r.id);
    setDetailLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_ride_detail", { ride_id_in: r.id });
      if (rpcError) throw rpcError;
      setDetail(data as RideDetail);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load ride detail.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex h-screen">
      <div className="flex-1 min-w-0 p-8 overflow-y-auto">
        <h1 className="font-display font-semibold text-2xl">Rides</h1>
        <p className="text-textFaint text-sm mt-1 mb-6">{total} ride{total === 1 ? "" : "s"}</p>

        <div className="flex gap-2 mb-4 flex-wrap">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by rider or driver"
              className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors w-64"
            />
            <button
              type="submit"
              className="border border-border text-textDim font-semibold rounded-xl px-4 py-2.5 text-sm hover:text-white transition-colors"
            >
              Search
            </button>
          </form>

          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
          >
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="requested">Requested</option>
            <option value="accepted">Accepted</option>
            <option value="driver_en_route">Driver en route</option>
            <option value="driver_arrived">Driver arrived</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {error && <p className="text-accent text-sm font-medium mb-4">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-textFaint text-sm">
            <div className="live-pulse" /> Loading…
          </div>
        ) : rides.length === 0 ? (
          <p className="text-textFaint text-sm">No rides found.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {rides.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openRide(r)}
                  className={`text-left bg-surface border rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors ${
                    selectedId === r.id ? "border-accent" : "border-border hover:border-borderStrong"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{r.rider_name}</span>
                      <span className="text-textFaint text-xs">→</span>
                      <span className="text-sm">{r.driver_name ?? "no driver"}</span>
                      <span
                        className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status] ?? "text-textFaint border-border"}`}
                      >
                        {r.status.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-textFaint border border-border rounded-full px-2 py-0.5">
                        {r.ride_tier}
                      </span>
                    </div>
                    <p className="text-textFaint text-xs mt-1 truncate">
                      {r.pickup_label} → {r.destination_label}
                    </p>
                    <p className="text-textFaint text-[11px] mt-1">{formatDate(r.requested_at)}</p>
                  </div>
                  <span className="font-mono font-medium text-sm shrink-0">
                    {formatMoney(r.final_fare_cents ?? r.estimated_fare_cents)}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="border border-border text-textDim font-semibold rounded-xl px-3.5 py-2 text-xs hover:text-white transition-colors disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-textFaint text-xs">Page {page + 1} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
                disabled={page + 1 >= totalPages}
                className="border border-border text-textDim font-semibold rounded-xl px-3.5 py-2 text-xs hover:text-white transition-colors disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* Detail panel */}
      <div className="w-[26rem] shrink-0 border-l border-border p-6 overflow-y-auto">
        {!selectedId ? (
          <div className="h-full flex items-center justify-center text-textFaint text-sm">Select a ride</div>
        ) : detailLoading || !detail ? (
          <div className="flex items-center gap-2 text-textFaint text-sm">
            <div className="live-pulse" /> Loading…
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[detail.ride.status] ?? "text-textFaint border-border"}`}
                >
                  {detail.ride.status.replace(/_/g, " ")}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-textFaint border border-border rounded-full px-2 py-0.5">
                  {detail.ride.ride_tier}
                </span>
              </div>
              <p className="text-sm mt-2">
                <span className="font-semibold">{detail.rider.first_name} {detail.rider.last_name}</span>
                <span className="text-textFaint"> (@{detail.rider.username}, {detail.rider.cellphone})</span>
              </p>
              {detail.driver && (
                <p className="text-sm text-textDim mt-0.5">
                  Driver: {detail.driver.first_name} {detail.driver.last_name}
                  <span className="text-textFaint"> (@{detail.driver.username}, {detail.driver.cellphone})</span>
                </p>
              )}
            </div>

            <div>
              <span className="text-xs font-medium text-textDim uppercase tracking-wide">Route</span>
              <p className="text-sm mt-1">{detail.ride.pickup_address}</p>
              {detail.stops.map((s) => (
                <p key={s.sequence} className="text-sm text-textDim mt-1">↳ {s.address}</p>
              ))}
              <p className="text-sm mt-1">→ {detail.ride.destination_address}</p>
            </div>

            {detail.trip_slip ? (
              <div className="bg-surface border border-border rounded-2xl p-4">
                <span className="text-xs font-medium text-textDim uppercase tracking-wide">Fare breakdown</span>
                <div className="mt-2 flex flex-col gap-1 text-sm">
                  <div className="flex justify-between"><span className="text-textFaint">Distance</span><span>{detail.trip_slip.actual_distance_km?.toFixed(1)} km</span></div>
                  <div className="flex justify-between"><span className="text-textFaint">Duration</span><span>{detail.trip_slip.actual_duration_min?.toFixed(0)} min</span></div>
                  <div className="flex justify-between"><span className="text-textFaint">Base fare</span><span>{formatMoney(detail.trip_slip.base_fare_cents)}</span></div>
                  <div className="flex justify-between"><span className="text-textFaint">Booking fee</span><span>{formatMoney(detail.trip_slip.booking_fee_cents)}</span></div>
                  <div className="flex justify-between"><span className="text-textFaint">Demand multiplier</span><span>×{detail.trip_slip.demand_multiplier}</span></div>
                  <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1"><span>Final fare</span><span>{formatMoney(detail.trip_slip.final_fare_cents)}</span></div>
                  {detail.trip_slip.cancellation_fee_cents && (
                    <div className="flex justify-between text-accent"><span>Cancellation fee</span><span>{formatMoney(detail.trip_slip.cancellation_fee_cents)}</span></div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-between text-sm">
                <span className="text-textFaint">Estimated fare</span>
                <span>{formatMoney(detail.ride.estimated_fare_cents)}</span>
              </div>
            )}

            {detail.offers.length > 0 && (
              <div>
                <span className="text-xs font-medium text-textDim uppercase tracking-wide">Negotiation</span>
                <div className="flex flex-col gap-1.5 mt-2">
                  {detail.offers.map((o, i) => (
                    <p key={i} className="text-sm text-textDim">
                      {o.proposed_by} offered {formatMoney(o.amount_cents)} — <span className="text-textFaint">{o.status}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="text-xs font-medium text-textDim uppercase tracking-wide">Status history</span>
              <div className="flex flex-col gap-1.5 mt-2">
                {detail.status_log.map((l, i) => (
                  <p key={i} className="text-xs text-textFaint">
                    {formatDate(l.created_at)} — {l.status.replace(/_/g, " ")}
                  </p>
                ))}
              </div>
            </div>

            {detail.messages.length > 0 && (
              <div>
                <span className="text-xs font-medium text-textDim uppercase tracking-wide">Chat ({detail.messages.length})</span>
                <div className="flex flex-col gap-2 mt-2">
                  {detail.messages.map((m, i) => (
                    <div key={i} className="bg-surface border border-border rounded-xl px-3 py-2 text-sm">
                      {m.body}
                      <p className="text-textFaint text-[11px] mt-0.5">{formatDate(m.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
