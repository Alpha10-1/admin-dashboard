import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Verification = {
  id: string;
  rider_id: string;
  rider_name: string;
  rider_username: string;
  amount_cents: number;
  status: "pending" | "success" | "failed" | "released" | "refunded";
  paystack_reference: string;
  failure_reason: string | null;
  created_at: string;
  verified_at: string | null;
};

type Reservation = {
  ride_id: string;
  rider_id: string;
  rider_name: string;
  driver_id: string | null;
  driver_name: string | null;
  card_reservation_status: "none" | "pending" | "reserved" | "captured" | "released" | "failed";
  card_reservation_amount_cents: number | null;
  card_reservation_reference: string | null;
  payment_status: string;
  requested_at: string;
};

type BankDetails = {
  rider_name: string;
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;
};

const VERIFICATION_STATUS_STYLE: Record<string, string> = {
  pending: "text-warning border-warning/40",
  success: "text-success border-success/40",
  refunded: "text-success border-success/40",
  released: "text-textFaint border-border",
  failed: "text-accent border-accent/40",
};

const RESERVATION_STATUS_STYLE: Record<string, string> = {
  pending: "text-warning border-warning/40",
  reserved: "text-warning border-warning/40",
  captured: "text-success border-success/40",
  released: "text-textFaint border-border",
  failed: "text-accent border-accent/40",
};

function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Payments() {
  const [tab, setTab] = useState<"verifications" | "reservations">("verifications");

  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationFilter, setReservationFilter] = useState<string>("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bankRiderId, setBankRiderId] = useState<string | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [bankLoading, setBankLoading] = useState(false);

  const loadVerifications = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_card_verifications", {
        status_in: status === "all" ? null : status,
      });
      if (rpcError) throw rpcError;
      setVerifications((data ?? []) as Verification[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load card verifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReservations = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_ride_card_reservations", {
        status_in: status === "all" ? null : status,
      });
      if (rpcError) throw rpcError;
      setReservations((data ?? []) as Reservation[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load ride reservations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "verifications") loadVerifications(verificationFilter);
    else loadReservations(reservationFilter);
    setBankRiderId(null);
    setBankDetails(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleViewBank = async (riderId: string) => {
    if (bankRiderId === riderId) {
      setBankRiderId(null);
      setBankDetails(null);
      return;
    }
    setBankRiderId(riderId);
    setBankLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_get_rider_bank_details", {
        rider_id_in: riderId,
      });
      if (rpcError) throw rpcError;
      setBankDetails((data?.[0] ?? null) as BankDetails | null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load bank details.");
    } finally {
      setBankLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display font-semibold text-2xl">Payments</h1>
      <p className="text-textFaint text-sm mt-1 mb-6">Card verification attempts and ride fund reservations.</p>

      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit mb-6">
        <button
          onClick={() => setTab("verifications")}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
            tab === "verifications" ? "bg-accent text-black" : "text-textDim hover:text-white"
          }`}
        >
          Card Verifications
        </button>
        <button
          onClick={() => setTab("reservations")}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
            tab === "reservations" ? "bg-accent text-black" : "text-textDim hover:text-white"
          }`}
        >
          Ride Reservations
        </button>
      </div>

      {tab === "verifications" ? (
        <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit mb-6">
          {["all", "pending", "success", "refunded", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => { setVerificationFilter(s); loadVerifications(s); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
                verificationFilter === s ? "bg-accentDim text-accent" : "text-textDim hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit mb-6 flex-wrap">
          {["all", "pending", "reserved", "captured", "released", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => { setReservationFilter(s); loadReservations(s); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
                reservationFilter === s ? "bg-accentDim text-accent" : "text-textDim hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-accent text-sm font-medium mb-4">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-textFaint text-sm">
          <div className="live-pulse" /> Loading…
        </div>
      ) : tab === "verifications" ? (
        verifications.length === 0 ? (
          <p className="text-textFaint text-sm">No card verifications found.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {verifications.map((v) => (
              <div key={v.id} className="bg-surface border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{v.rider_name}</span>
                    <span className="text-textFaint text-xs">@{v.rider_username}</span>
                    <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${VERIFICATION_STATUS_STYLE[v.status]}`}>
                      {v.status}
                    </span>
                  </div>
                  <span className="font-mono text-sm">{formatMoney(v.amount_cents)}</span>
                </div>
                <p className="text-textFaint text-xs mt-2">
                  {formatDate(v.created_at)} · ref {v.paystack_reference}
                  {v.verified_at ? ` · verified ${formatDate(v.verified_at)}` : ""}
                </p>
                {v.failure_reason && <p className="text-accent text-xs mt-1">{v.failure_reason}</p>}
                {(v.status === "failed" || v.status === "pending") && (
                  <button
                    onClick={() => handleViewBank(v.rider_id)}
                    className="text-textDim hover:text-white font-semibold text-xs mt-2 transition-colors"
                  >
                    {bankRiderId === v.rider_id ? "Hide bank details" : "View bank details (manual refund)"}
                  </button>
                )}
                {bankRiderId === v.rider_id && (
                  <BankDetailsBlock loading={bankLoading} details={bankDetails} />
                )}
              </div>
            ))}
          </div>
        )
      ) : reservations.length === 0 ? (
        <p className="text-textFaint text-sm">No ride reservations found.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reservations.map((r) => (
            <div key={r.ride_id} className="bg-surface border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{r.rider_name}</span>
                  <span className="text-textFaint text-xs">→ {r.driver_name ?? "unassigned"}</span>
                  <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${RESERVATION_STATUS_STYLE[r.card_reservation_status]}`}>
                    {r.card_reservation_status}
                  </span>
                </div>
                <span className="font-mono text-sm">{formatMoney(r.card_reservation_amount_cents)}</span>
              </div>
              <p className="text-textFaint text-xs mt-2">
                {formatDate(r.requested_at)} · payment {r.payment_status}
                {r.card_reservation_reference ? ` · ref ${r.card_reservation_reference}` : ""}
              </p>
              {r.card_reservation_status === "failed" && (
                <button
                  onClick={() => handleViewBank(r.rider_id)}
                  className="text-textDim hover:text-white font-semibold text-xs mt-2 transition-colors"
                >
                  {bankRiderId === r.rider_id ? "Hide bank details" : "View bank details (manual refund)"}
                </button>
              )}
              {bankRiderId === r.rider_id && (
                <BankDetailsBlock loading={bankLoading} details={bankDetails} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BankDetailsBlock({ loading, details }: { loading: boolean; details: BankDetails | null }) {
  if (loading) {
    return <p className="text-textFaint text-xs mt-2">Loading bank details…</p>;
  }
  if (!details || (!details.bank_name && !details.bank_account_number)) {
    return <p className="text-textFaint text-xs mt-2">No bank details on file for this rider.</p>;
  }
  return (
    <div className="bg-surfaceRaised border border-border rounded-xl p-3 mt-2 text-xs text-textDim flex flex-col gap-0.5">
      <p><span className="text-textFaint">Holder:</span> {details.bank_account_holder ?? "—"}</p>
      <p><span className="text-textFaint">Bank:</span> {details.bank_name ?? "—"}</p>
      <p><span className="text-textFaint">Account:</span> {details.bank_account_number ?? "—"}</p>
      <p><span className="text-textFaint">Branch code:</span> {details.bank_branch_code ?? "—"}</p>
    </div>
  );
}