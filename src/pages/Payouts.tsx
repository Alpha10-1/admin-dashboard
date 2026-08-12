import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type PayoutRequest = {
  id: string;
  driver_id: string;
  driver_first_name: string;
  driver_last_name: string;
  driver_username: string;
  amount_cents: number;
  fee_cents: number;
  status: "pending" | "approved" | "paid" | "rejected";
  bank_name: string;
  bank_account_holder: string;
  bank_account_number: string;
  bank_branch_code: string | null;
  admin_notes: string | null;
  requested_at: string;
  processed_at: string | null;
};

type Filter = "pending" | "approved" | "paid" | "rejected" | "all";

const STATUS_STYLE: Record<string, string> = {
  pending: "text-warning border-warning/40",
  approved: "text-accent border-accent/40",
  paid: "text-success border-success/40",
  rejected: "text-textFaint border-border",
};

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    (cents ?? 0) / 100
  );
}

export default function Payouts() {
  const [rows, setRows] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_payout_requests", {
        status_in: null,
      });
      if (rpcError) throw rpcError;
      setRows((data ?? []) as PayoutRequest[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load payout requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => filter === "all" || r.status === filter);
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const handleApprove = async (row: PayoutRequest) => {
    setBusyId(row.id);
    try {
      const { error: rpcError } = await supabase.rpc("admin_approve_payout_request", {
        request_id_in: row.id,
        admin_notes_in: null,
      });
      if (rpcError) throw rpcError;
      load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to approve payout request.");
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkPaid = async (row: PayoutRequest) => {
    setBusyId(row.id);
    try {
      const { error: rpcError } = await supabase.rpc("admin_mark_payout_paid", {
        request_id_in: row.id,
        admin_notes_in: notes.trim() || null,
      });
      if (rpcError) throw rpcError;
      setNotes("");
      load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to mark payout as paid.");
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async (row: PayoutRequest) => {
    setBusyId(row.id);
    try {
      const { error: rpcError } = await supabase.rpc("admin_reject_payout_request", {
        request_id_in: row.id,
        admin_notes_in: notes.trim() || null,
      });
      if (rpcError) throw rpcError;
      setRejectingId(null);
      setNotes("");
      load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to reject payout request.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display font-semibold text-2xl">Payouts</h1>
        <button
          onClick={load}
          className="text-sm font-medium text-textDim hover:text-white border border-border rounded-xl px-3.5 py-2 transition-colors"
        >
          Refresh
        </button>
      </div>
      <p className="text-textFaint text-sm mb-6">
        {pendingCount > 0
          ? `${pendingCount} payout${pendingCount > 1 ? "s" : ""} awaiting review.`
          : "All caught up."}
      </p>

      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-xl p-1 w-fit">
        {(["pending", "approved", "paid", "rejected", "all"] as Filter[]).map((f) => (
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

      {loading ? (
        <div className="flex items-center gap-2 text-textFaint text-sm">
          <div className="live-pulse" /> Loading…
        </div>
      ) : error ? (
        <p className="text-accent text-sm font-medium">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-textFaint text-sm">Nothing here.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((row) => (
            <div key={row.id} className="bg-surface border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {row.driver_first_name} {row.driver_last_name}
                    <span className="text-textFaint font-normal"> · @{row.driver_username}</span>
                  </p>
                  <p className="text-textFaint text-xs mt-0.5">
                    Requested {new Date(row.requested_at).toLocaleString("en-ZA", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[row.status]}`}
                >
                  {row.status}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-3">
                <div>
                  <span className="text-textFaint text-[10px] uppercase tracking-wide">Amount</span>
                  <p className="font-mono font-medium text-lg">{formatMoney(row.amount_cents)}</p>
                </div>
                <div>
                  <span className="text-textFaint text-[10px] uppercase tracking-wide">Fee</span>
                  <p className="font-mono text-sm text-textDim">{formatMoney(row.fee_cents)}</p>
                </div>
                <div>
                  <span className="text-textFaint text-[10px] uppercase tracking-wide">Total deducted</span>
                  <p className="font-mono text-sm text-textDim">
                    {formatMoney(row.amount_cents + row.fee_cents)}
                  </p>
                </div>
              </div>

              <div className="bg-surfaceRaised border border-border rounded-xl p-3 mt-3">
                <span className="text-textFaint text-[10px] uppercase tracking-wide">Bank details</span>
                <p className="text-sm mt-1">{row.bank_account_holder} · {row.bank_name}</p>
                <p className="text-textDim text-xs mt-0.5 font-mono">
                  {row.bank_account_number}
                  {row.bank_branch_code ? ` · Branch ${row.bank_branch_code}` : ""}
                </p>
              </div>

              {row.admin_notes && (
                <p className="text-textDim text-xs mt-2">Note: {row.admin_notes}</p>
              )}

              {row.status === "pending" && (
                <div className="mt-3">
                  {rejectingId === row.id ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Reason (internal note)"
                        rows={2}
                        className="bg-surfaceRaised border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitReject(row)}
                          disabled={busyId === row.id}
                          className="bg-accent text-black font-semibold rounded-xl px-3.5 py-1.5 text-xs disabled:opacity-50 hover:brightness-110 transition"
                        >
                          {busyId === row.id ? "Submitting…" : "Confirm Reject"}
                        </button>
                        <button
                          onClick={() => { setRejectingId(null); setNotes(""); }}
                          className="text-textDim text-xs font-semibold px-2"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(row)}
                        disabled={busyId === row.id}
                        className="bg-accent text-black font-semibold rounded-xl px-3.5 py-1.5 text-xs disabled:opacity-50 hover:brightness-110 transition"
                      >
                        {busyId === row.id ? "…" : "Approve"}
                      </button>
                      <button
                        onClick={() => setRejectingId(row.id)}
                        className="border border-border text-textDim font-semibold rounded-xl px-3.5 py-1.5 text-xs hover:text-white transition-colors"
                      >
                        Reject (refund driver)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {row.status === "approved" && (
                <div className="mt-3">
                  <button
                    onClick={() => handleMarkPaid(row)}
                    disabled={busyId === row.id}
                    className="bg-success text-black font-semibold rounded-xl px-3.5 py-1.5 text-xs disabled:opacity-50 hover:brightness-110 transition"
                  >
                    {busyId === row.id ? "…" : "Mark Paid"}
                  </button>
                  <span className="text-textFaint text-xs ml-3">
                    Pay {row.bank_account_holder} manually via EFT, then confirm here.
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
