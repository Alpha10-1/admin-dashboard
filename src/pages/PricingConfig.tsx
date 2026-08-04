import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Config = {
  rate_per_km_cents: number;
  rate_per_min_cents: number;
  booking_fee_cents: number;
  minimum_fare_cents: number;
  minimum_cancellation_fee_cents: number;
  multiplier_normal: number;
  multiplier_busy: number;
  multiplier_very_busy: number;
  busy_threshold: number;
  very_busy_threshold: number;
  tier_comfort_multiplier: number;
  tier_xl_multiplier: number;
};

type FormState = Record<keyof Config, string>;

function toForm(c: Config): FormState {
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, String(v)])) as FormState;
}

function Field({
  label,
  value,
  onChange,
  step = "1",
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-textDim uppercase tracking-wide">{label}</span>
      <div className="relative">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
        />
        {suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-textFaint text-xs">{suffix}</span>
        )}
      </div>
    </label>
  );
}

export default function PricingConfig() {
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_pricing_config");
      if (rpcError) throw rpcError;
      setForm(toForm(data as Config));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load pricing config.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: keyof Config) => (v: string) => {
    setSaved(false);
    setForm((prev) => (prev ? { ...prev, [key]: v } : prev));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        rate_per_km_cents_in: Math.round(parseFloat(form.rate_per_km_cents)),
        rate_per_min_cents_in: Math.round(parseFloat(form.rate_per_min_cents)),
        booking_fee_cents_in: Math.round(parseFloat(form.booking_fee_cents)),
        minimum_fare_cents_in: Math.round(parseFloat(form.minimum_fare_cents)),
        minimum_cancellation_fee_cents_in: Math.round(parseFloat(form.minimum_cancellation_fee_cents)),
        multiplier_normal_in: parseFloat(form.multiplier_normal),
        multiplier_busy_in: parseFloat(form.multiplier_busy),
        multiplier_very_busy_in: parseFloat(form.multiplier_very_busy),
        busy_threshold_in: parseInt(form.busy_threshold, 10),
        very_busy_threshold_in: parseInt(form.very_busy_threshold, 10),
        tier_comfort_multiplier_in: parseFloat(form.tier_comfort_multiplier),
        tier_xl_multiplier_in: parseFloat(form.tier_xl_multiplier),
      };
      const { data, error: rpcError } = await supabase.rpc("admin_update_pricing_config", payload);
      if (rpcError) throw rpcError;
      setForm(toForm(data as Config));
      setSaved(true);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save pricing config.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="font-display font-semibold text-2xl">Pricing</h1>
      <p className="text-textFaint text-sm mt-1 mb-6">
        Live fare calculation settings. Changes apply to new fare estimates immediately.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-textFaint text-sm">
          <div className="live-pulse" /> Loading…
        </div>
      ) : !form ? (
        <p className="text-accent text-sm font-medium">{error}</p>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-8">
          {error && <p className="text-accent text-sm font-medium">{error}</p>}
          {saved && <p className="text-success text-sm font-medium">Saved.</p>}

          <section>
            <h2 className="text-textFaint text-xs uppercase tracking-wide font-semibold mb-3">Base rates</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Rate per km" value={form.rate_per_km_cents} onChange={set("rate_per_km_cents")} suffix="cents" />
              <Field label="Rate per minute" value={form.rate_per_min_cents} onChange={set("rate_per_min_cents")} suffix="cents" />
              <Field label="Booking fee" value={form.booking_fee_cents} onChange={set("booking_fee_cents")} suffix="cents" />
              <Field label="Minimum fare" value={form.minimum_fare_cents} onChange={set("minimum_fare_cents")} suffix="cents" />
              <Field label="Minimum cancellation fee" value={form.minimum_cancellation_fee_cents} onChange={set("minimum_cancellation_fee_cents")} suffix="cents" />
            </div>
          </section>

          <section>
            <h2 className="text-textFaint text-xs uppercase tracking-wide font-semibold mb-3">Demand pricing</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Normal multiplier" value={form.multiplier_normal} onChange={set("multiplier_normal")} step="0.01" />
              <Field label="Busy multiplier" value={form.multiplier_busy} onChange={set("multiplier_busy")} step="0.01" />
              <Field label="Very busy multiplier" value={form.multiplier_very_busy} onChange={set("multiplier_very_busy")} step="0.01" />
              <div />
              <Field label="Busy threshold" value={form.busy_threshold} onChange={set("busy_threshold")} suffix="active rides" />
              <Field label="Very busy threshold" value={form.very_busy_threshold} onChange={set("very_busy_threshold")} suffix="active rides" />
            </div>
          </section>

          <section>
            <h2 className="text-textFaint text-xs uppercase tracking-wide font-semibold mb-3">Ride tiers</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Comfort multiplier" value={form.tier_comfort_multiplier} onChange={set("tier_comfort_multiplier")} step="0.01" />
              <Field label="XL multiplier" value={form.tier_xl_multiplier} onChange={set("tier_xl_multiplier")} step="0.01" />
            </div>
          </section>

          <button
            type="submit"
            disabled={submitting}
            className="self-start bg-accent text-black font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 hover:brightness-110 transition"
          >
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </form>
      )}
    </div>
  );
}
