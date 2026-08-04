import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type WalletRow = {
  profile_id: string;
  username: string;
  first_name: string;
  last_name: string;
  role: "rider" | "driver";
  balance_cents: number;
  currency: string;
  updated_at: string | null;
};

type Transaction = {
  id: string;
  amount_cents: number;
  kind: "topup" | "earning" | "ride_charge" | "promo_credit" | "adjustment";
  description: string | null;
  created_at: string;
};

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    (cents ?? 0) / 100
  );
}

export default function Wallets() {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<WalletRow | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"credit" | "debit">("credit");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (searchTerm = "") => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_wallets", {
        search_in: searchTerm || null,
      });
      if (rpcError) throw rpcError;
      setWallets((data ?? []) as WalletRow[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load wallets.");
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

  const openWallet = useCallback(async (w: WalletRow) => {
    setSelected(w);
    setTxLoading(true);
    setAdjustAmount("");
    setAdjustReason("");
    try {
      const { data, error: rpcError } = await supabase.rpc("get_wallet_transactions", {
        profile_id_in: w.profile_id,
      });
      if (rpcError) throw rpcError;
      setTransactions((data ?? []) as Transaction[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load transaction history.");
    } finally {
      setTxLoading(false);
    }
  }, []);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !adjustAmount) return;
    const parsed = Math.round(parseFloat(adjustAmount) * 100);
    if (!parsed || parsed <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    const signedAmount = adjustDirection === "credit" ? parsed : -parsed;

    setSubmitting(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_adjust_wallet", {
        profile_id_in: selected.profile_id,
        amount_cents_in: signedAmount,
        description_in: adjustReason.trim() || null,
      });
      if (rpcError) throw rpcError;

      const newBalance = data as number;
      setWallets((prev) =>
        prev.map((w) => (w.profile_id === selected.profile_id ? { ...w, balance_cents: newBalance } : w))
      );
      setSelected((prev) => (prev ? { ...prev, balance_cents: newBalance } : prev));
      setAdjustAmount("");
      setAdjustReason("");
      openWallet({ ...selected, balance_cents: newBalance });
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to adjust wallet.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 min-w-0 p-8 overflow-y-auto">
        <h1 className="font-display font-semibold text-2xl">Wallets</h1>
        <p className="text-textFaint text-sm mt-1 mb-6">
          {wallets.length} wallet{wallets.length === 1 ? "" : "s"}
        </p>

        <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-md">
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
        ) : wallets.length === 0 ? (
          <p className="text-textFaint text-sm">No wallets found.</p>
        ) : (
          <div className="flex flex-col gap-2 max-w-2xl">
            {wallets.map((w) => (
              <button
                key={w.profile_id}
                onClick={() => openWallet(w)}
                className={`text-left bg-surface border rounded-2xl p-4 flex items-center justify-between transition-colors ${
                  selected?.profile_id === w.profile_id ? "border-accent" : "border-border hover:border-borderStrong"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{w.first_name} {w.last_name}</span>
                    <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border border-border text-textFaint">
                      {w.role}
                    </span>
                  </div>
                  <p className="text-textFaint text-xs mt-1">@{w.username}</p>
                </div>
                <span className="font-mono font-medium text-lg">{formatMoney(w.balance_cents)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      <div className="w-96 shrink-0 border-l border-border p-6 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-textFaint text-sm">
            Select a wallet
          </div>
        ) : (
          <>
            <p className="font-semibold text-sm">{selected.first_name} {selected.last_name}</p>
            <p className="text-textFaint text-xs mb-4">@{selected.username} · {selected.role}</p>
            <div className="bg-surface border border-border rounded-2xl p-4 mb-6">
              <span className="text-textFaint text-xs uppercase tracking-wide font-medium">Balance</span>
              <p className="font-mono font-medium text-2xl mt-1">{formatMoney(selected.balance_cents)}</p>
            </div>

            <form onSubmit={handleAdjust} className="flex flex-col gap-3 mb-6">
              <span className="text-xs font-medium text-textDim uppercase tracking-wide">
                Manual adjustment
              </span>
              <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
                {(["credit", "debit"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAdjustDirection(d)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
                      adjustDirection === d ? "bg-accent text-black" : "text-textDim hover:text-white"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <input
                type="number"
                step="0.01"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="Amount (R)"
                className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
              <input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Reason (internal note)"
                className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
              <button
                type="submit"
                disabled={submitting || !adjustAmount}
                className="bg-accent text-black font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 hover:brightness-110 transition"
              >
                {submitting ? "Submitting…" : `Confirm ${adjustDirection}`}
              </button>
            </form>

            <span className="text-xs font-medium text-textDim uppercase tracking-wide">History</span>
            {txLoading ? (
              <div className="flex items-center gap-2 text-textFaint text-sm mt-3">
                <div className="live-pulse" /> Loading…
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-textFaint text-sm mt-3">No transactions yet.</p>
            ) : (
              <div className="flex flex-col gap-2 mt-3">
                {transactions.map((t) => (
                  <div key={t.id} className="bg-surface border border-border rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-sm font-semibold ${t.amount_cents >= 0 ? "text-success" : "text-accent"}`}>
                        {t.amount_cents >= 0 ? "+" : ""}{formatMoney(t.amount_cents)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-textFaint">{t.kind}</span>
                    </div>
                    {t.description && <p className="text-textDim text-xs mt-1">{t.description}</p>}
                    <p className="text-textFaint text-[11px] mt-1">
                      {new Date(t.created_at).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
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
