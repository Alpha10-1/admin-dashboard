import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type DriverSummary = {
  driver_id: string;
  first_name: string;
  last_name: string;
  username: string;
  avg_rating: number | null;
  rating_count: number;
  flagged_for_review: boolean;
};

type RatingDetail = {
  id: string;
  ride_id: string;
  rider_first_name: string;
  rider_last_name: string;
  stars: number;
  comment: string | null;
  created_at: string;
};

type Filter = "flagged" | "all";

function Stars({ value }: { value: number }) {
  return (
    <span className="font-mono text-sm">
      {"★".repeat(value)}
      <span className="text-textFaint">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export default function Ratings() {
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("flagged");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<DriverSummary | null>(null);
  const [details, setDetails] = useState<RatingDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (searchTerm = "", flaggedOnly = true) => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_driver_ratings", {
        flagged_only_in: flaggedOnly,
        search_in: searchTerm || null,
      });
      if (rpcError) throw rpcError;
      setDrivers((data ?? []) as DriverSummary[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load ratings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("", filter === "flagged");
  }, [filter, load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search, filter === "flagged");
  };

  const openDriver = useCallback(async (d: DriverSummary) => {
    setSelected(d);
    setDetailsLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_get_driver_rating_detail", {
        driver_id_in: d.driver_id,
      });
      if (rpcError) throw rpcError;
      setDetails((data ?? []) as RatingDetail[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load rating history.");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const clearFlag = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("admin_clear_driver_rating_flag", {
        driver_id_in: selected.driver_id,
      });
      if (rpcError) throw rpcError;
      setSelected((prev) => (prev ? { ...prev, flagged_for_review: false } : prev));
      setDrivers((prev) =>
        filter === "flagged"
          ? prev.filter((d) => d.driver_id !== selected.driver_id)
          : prev.map((d) => (d.driver_id === selected.driver_id ? { ...d, flagged_for_review: false } : d))
      );
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to clear flag.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 min-w-0 p-8 overflow-y-auto">
        <h1 className="font-display font-semibold text-2xl">Ratings</h1>
        <p className="text-textFaint text-sm mt-1 mb-6">
          {filter === "flagged"
            ? `${drivers.length} driver${drivers.length === 1 ? "" : "s"} flagged for review`
            : `${drivers.length} rated driver${drivers.length === 1 ? "" : "s"}`}
        </p>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
            {(["flagged", "all"] as Filter[]).map((f) => (
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

          <form onSubmit={handleSearch} className="flex gap-2 max-w-md flex-1">
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
        </div>

        {error && <p className="text-accent text-sm font-medium mb-4">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-textFaint text-sm">
            <div className="live-pulse" /> Loading…
          </div>
        ) : drivers.length === 0 ? (
          <p className="text-textFaint text-sm">
            {filter === "flagged" ? "No drivers currently flagged." : "No rated drivers found."}
          </p>
        ) : (
          <div className="flex flex-col gap-2 max-w-2xl">
            {drivers.map((d) => (
              <button
                key={d.driver_id}
                onClick={() => openDriver(d)}
                className={`text-left bg-surface border rounded-2xl p-4 flex items-center justify-between transition-colors ${
                  selected?.driver_id === d.driver_id ? "border-accent" : "border-border hover:border-borderStrong"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{d.first_name} {d.last_name}</span>
                    {d.flagged_for_review && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border text-warning border-warning/40">
                        Flagged
                      </span>
                    )}
                  </div>
                  <p className="text-textFaint text-xs mt-1">@{d.username}</p>
                </div>
                <div className="text-right">
                  <Stars value={Math.round(d.avg_rating ?? 0)} />
                  <p className="text-textFaint text-xs mt-0.5">
                    {d.avg_rating?.toFixed(2) ?? "—"} · {d.rating_count} rating{d.rating_count === 1 ? "" : "s"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      <div className="w-96 shrink-0 border-l border-border p-6 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-textFaint text-sm">
            Select a driver
          </div>
        ) : (
          <>
            <p className="font-semibold text-sm">{selected.first_name} {selected.last_name}</p>
            <p className="text-textFaint text-xs mb-4">@{selected.username}</p>

            <div className="bg-surface border border-border rounded-2xl p-4 mb-4">
              <span className="text-textFaint text-xs uppercase tracking-wide font-medium">Average</span>
              <div className="flex items-center gap-2 mt-1">
                <Stars value={Math.round(selected.avg_rating ?? 0)} />
                <span className="font-mono text-sm text-textDim">
                  {selected.avg_rating?.toFixed(2) ?? "—"} ({selected.rating_count})
                </span>
              </div>
            </div>

            {selected.flagged_for_review && (
              <button
                onClick={clearFlag}
                disabled={busy}
                className="w-full bg-accent text-black font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 hover:brightness-110 transition mb-6"
              >
                {busy ? "Clearing…" : "Clear flag — reviewed, no action needed"}
              </button>
            )}

            <span className="text-xs font-medium text-textDim uppercase tracking-wide">Rating history</span>
            {detailsLoading ? (
              <div className="flex items-center gap-2 text-textFaint text-sm mt-3">
                <div className="live-pulse" /> Loading…
              </div>
            ) : details.length === 0 ? (
              <p className="text-textFaint text-sm mt-3">No ratings yet.</p>
            ) : (
              <div className="flex flex-col gap-2 mt-3">
                {details.map((r) => (
                  <div key={r.id} className="bg-surface border border-border rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <Stars value={r.stars} />
                      <span className="text-textFaint text-[11px]">
                        {new Date(r.created_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    <p className="text-textFaint text-xs mt-1">
                      {r.rider_first_name} {r.rider_last_name}
                    </p>
                    {r.comment && <p className="text-textDim text-xs mt-1">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
