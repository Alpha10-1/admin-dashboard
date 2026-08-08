import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type SubscriptionRow = {
  driver_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  cellphone: string;
  status: "none" | "inactive" | "active" | "past_due" | "blocked" | "canceled";
  billing_cycle_count: number | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  card_last4: string | null;
  card_brand: string | null;
  canceled_at: string | null;
  subscribed_at: string | null;
};

type Payment = {
  id: string;
  billing_cycle_number: number;
  amount_cents: number;
  status: "pending" | "success" | "failed";
  failure_reason: string | null;
  attempted_at: string;
  paid_at: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  none: "text-textFaint border-border",
  inactive: "text-textFaint border-border",
  active: "text-success border-success/40",
  past_due: "text-warning border-warning/40",
  blocked: "text-accent border-accent/40",
  canceled: "text-textFaint border-border",
};

const STATUS_FILTERS = ["all", "past_due", "blocked", "active", "inactive", "none", "canceled"] as const;

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format((cents ?? 0) / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DriverSubscriptions() {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<SubscriptionRow | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [graceDays, setGraceDays] = useState("7");
  const [compDays, setCompDays] = useState("30");
  const [submitting, setSubmitting] = useState<"grace" | "comp" | "cancel" | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const load = useCallback(async (searchTerm = "", status: (typeof STATUS_FILTERS)[number] = "all") => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_driver_subscriptions", {
        search_in: searchTerm || null,
        status_in: status === "all" ? null : status,
      });
      if (rpcError) throw rpcError;
      setRows((data ?? []) as SubscriptionRow[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load driver subscriptions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(search, statusFilter);
  };

  const handleFilter = (status: (typeof STATUS_FILTERS)[number]) => {
    setStatusFilter(status);
    load(search, status);
  };

  const openDriver = useCallback(async (row: SubscriptionRow) => {
    setSelected(row);
    setConfirmingCancel(false);
    setPaymentsLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_get_driver_subscription_payments", {
        driver_id_in: row.driver_id,
      });
      if (rpcError) throw rpcError;
      setPayments((data ?? []) as Payment[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load payment history.");
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const refreshSelected = async () => {
    await load(search, statusFilter);
  };

  const handleExtendGrace = async () => {
    if (!selected) return;
    const days = parseInt(graceDays, 10);
    if (!days || days <= 0) {
      setError("Enter a positive number of days.");
      return;
    }
    setSubmitting("grace");
    try {
      const { error: rpcError } = await supabase.rpc("admin_extend_driver_grace_period", {
        driver_id_in: selected.driver_id,
        days_in: days,
      });
      if (rpcError) throw rpcError;
      setError(null);
      await refreshSelected();
      openDriver({ ...selected });
    } catch (e: any) {
      setError(e?.message ?? "Failed to extend grace period.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleComp = async () => {
    if (!selected) return;
    const days = parseInt(compDays, 10);
    if (!days || days <= 0) {
      setError("Enter a positive number of days.");
      return;
    }
    setSubmitting("comp");
    try {
      const { error: rpcError } = await supabase.rpc("admin_comp_driver_subscription", {
        driver_id_in: selected.driver_id,
        days_in: days,
      });
      if (rpcError) throw rpcError;
      setError(null);
      await refreshSelected();
      openDriver({ ...selected });
    } catch (e: any) {
      setError(e?.message ?? "Failed to comp subscription.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleCancel = async () => {
    if (!selected) return;
    setSubmitting("cancel");
    try {
      const { error: rpcError } = await supabase.rpc("admin_cancel_driver_subscription", {
        driver_id_in: selected.driver_id,
      });
      if (rpcError) throw rpcError;
      setError(null);
      setConfirmingCancel(false);
      await refreshSelected();
      openDriver({ ...selected });
    } catch (e: any) {
      setError(e?.message ?? "Failed to cancel subscription.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 min-w-0 p-8 overflow-y-auto">
        <h1 className="font-display font-semibold text-2xl">Driver Subscriptions</h1>
        <p className="text-textFaint text-sm mt-1 mb-6">
          {rows.length} driver{rows.length === 1 ? "" : "s"}
        </p>

        <form onSubmit={handleSearch} className="flex gap-2 mb-4 max-w-md">
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

        <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit mb-6 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => handleFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
                statusFilter === s ? "bg-accent text-black" : "text-textDim hover:text-white"
              }`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>

        {error && <p className="text-accent text-sm font-medium mb-4">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 text-textFaint text-sm">
            <div className="live-pulse" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-textFaint text-sm">No drivers found.</p>
        ) : (
          <div className="flex flex-col gap-2 max-w-2xl">
            {rows.map((r) => (
              <button
                key={r.driver_id}
                onClick={() => openDriver(r)}
                className={`text-left bg-surface border rounded-2xl p-4 flex items-center justify-between transition-colors ${
                  selected?.driver_id === r.driver_id ? "border-accent" : "border-border hover:border-borderStrong"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{r.first_name} {r.last_name}</span>
                    <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status]}`}>
                      {r.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-textFaint text-xs mt-1">@{r.username}</p>
                  {r.card_last4 && (
                    <p className="text-textDim text-xs mt-1">{r.card_brand ?? "Card"} •••• {r.card_last4}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {r.status === "past_due" && r.grace_period_ends_at && (
                    <p className="text-warning text-xs font-medium">Grace ends {formatDate(r.grace_period_ends_at)}</p>
                  )}
                  {r.status === "active" && r.current_period_end && (
                    <p className="text-textFaint text-xs">Renews {formatDate(r.current_period_end)}</p>
                  )}
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
            <p className="text-textFaint text-xs mb-4">@{selected.username} · {selected.email}</p>

            <div className="bg-surface border border-border rounded-2xl p-4 mb-6">
              <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[selected.status]}`}>
                {selected.status.replace("_", " ")}
              </span>
              <div className="mt-3 flex flex-col gap-1 text-xs text-textDim">
                {selected.card_last4 && <p>{selected.card_brand ?? "Card"} •••• {selected.card_last4}</p>}
                {selected.billing_cycle_count != null && <p>Billing cycle #{selected.billing_cycle_count}</p>}
                {selected.current_period_end && <p>Current period ends {formatDate(selected.current_period_end)}</p>}
                {selected.grace_period_ends_at && <p>Grace period ends {formatDate(selected.grace_period_ends_at)}</p>}
                {selected.canceled_at && <p>Canceled {formatDate(selected.canceled_at)}</p>}
                {selected.status === "none" && <p>Never started checkout.</p>}
              </div>
            </div>

            <div className="flex flex-col gap-4 mb-6">
              {(selected.status === "past_due" || selected.status === "blocked") && (
                <div>
                  <span className="text-xs font-medium text-textDim uppercase tracking-wide">Extend grace period</span>
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      min={1}
                      value={graceDays}
                      onChange={(e) => setGraceDays(e.target.value)}
                      className="w-20 bg-surfaceRaised border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                    />
                    <button
                      onClick={handleExtendGrace}
                      disabled={submitting !== null}
                      className="flex-1 bg-accent text-black font-semibold rounded-xl px-3.5 py-2 text-xs disabled:opacity-50 hover:brightness-110 transition"
                    >
                      {submitting === "grace" ? "…" : `+${graceDays || 0} days, unblock`}
                    </button>
                  </div>
                </div>
              )}

              <div>
                <span className="text-xs font-medium text-textDim uppercase tracking-wide">Comp free access</span>
                <div className="flex gap-2 mt-2">
                  <input
                    type="number"
                    min={1}
                    value={compDays}
                    onChange={(e) => setCompDays(e.target.value)}
                    className="w-20 bg-surfaceRaised border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                  />
                  <button
                    onClick={handleComp}
                    disabled={submitting !== null}
                    className="flex-1 border border-border text-textDim font-semibold rounded-xl px-3.5 py-2 text-xs hover:text-white transition-colors disabled:opacity-50"
                  >
                    {submitting === "comp" ? "…" : `Comp ${compDays || 0} days`}
                  </button>
                </div>
              </div>

              {selected.status !== "none" && selected.status !== "canceled" && (
                <div>
                  {!confirmingCancel ? (
                    <button
                      onClick={() => setConfirmingCancel(true)}
                      className="text-textDim hover:text-accent font-semibold text-xs transition-colors"
                    >
                      Cancel subscription
                    </button>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-textFaint flex-1">Force-cancel this driver's subscription?</span>
                      <button
                        onClick={() => setConfirmingCancel(false)}
                        className="text-textDim text-xs font-semibold px-2"
                      >
                        No
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={submitting !== null}
                        className="bg-accent text-black font-semibold rounded-xl px-3 py-1.5 text-xs disabled:opacity-50 hover:brightness-110 transition"
                      >
                        {submitting === "cancel" ? "…" : "Confirm"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <span className="text-xs font-medium text-textDim uppercase tracking-wide">Payment history</span>
            {paymentsLoading ? (
              <div className="flex items-center gap-2 text-textFaint text-sm mt-3">
                <div className="live-pulse" /> Loading…
              </div>
            ) : payments.length === 0 ? (
              <p className="text-textFaint text-sm mt-3">No payment attempts yet.</p>
            ) : (
              <div className="flex flex-col gap-2 mt-3">
                {payments.map((p) => (
                  <div key={p.id} className="bg-surface border border-border rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold">{formatMoney(p.amount_cents)}</span>
                      <span
                        className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${
                          p.status === "success"
                            ? "text-success border-success/40"
                            : p.status === "failed"
                            ? "text-accent border-accent/40"
                            : "text-warning border-warning/40"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <p className="text-textFaint text-[11px] mt-1">Cycle #{p.billing_cycle_number} · {formatDate(p.attempted_at)}</p>
                    {p.failure_reason && <p className="text-accent text-xs mt-1">{p.failure_reason}</p>}
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