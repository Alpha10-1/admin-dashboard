import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Promotion = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: "percent" | "fixed_cents";
  discount_value: number;
  applies_to_role: "rider" | "driver" | null;
  max_redemptions: number | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
};

function formatDiscount(p: Promotion): string {
  if (p.discount_type === "percent") return `${p.discount_value}% off`;
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    p.discount_value / 100
  );
}

const emptyForm = {
  code: "",
  title: "",
  description: "",
  discountType: "fixed_cents" as "percent" | "fixed_cents",
  discountValue: "",
  appliesTo: "both" as "both" | "rider" | "driver",
  maxRedemptions: "",
  expiresAt: "",
};

export default function Promotions() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_promotions");
      if (rpcError) throw rpcError;
      setPromos((data ?? []) as Promotion[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load promotions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.title.trim() || !form.discountValue) {
      setError("Code, title, and discount value are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const discountValue =
        form.discountType === "percent"
          ? Math.round(parseFloat(form.discountValue))
          : Math.round(parseFloat(form.discountValue) * 100);

      const { error: rpcError } = await supabase.rpc("admin_create_promotion", {
        code_in: form.code,
        title_in: form.title,
        description_in: form.description || null,
        discount_type_in: form.discountType,
        discount_value_in: discountValue,
        applies_to_role_in: form.appliesTo === "both" ? null : form.appliesTo,
        max_redemptions_in: form.maxRedemptions ? parseInt(form.maxRedemptions, 10) : null,
        expires_at_in: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      });
      if (rpcError) throw rpcError;

      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create promotion.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (p: Promotion) => {
    setBusyId(p.id);
    try {
      const { error: rpcError } = await supabase.rpc("admin_set_promotion_active", {
        promotion_id_in: p.id,
        active_in: !p.active,
      });
      if (rpcError) throw rpcError;
      load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to update promotion.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (p: Promotion) => {
    if (!confirm(`Delete promotion "${p.code}"? This can't be undone.`)) return;
    setBusyId(p.id);
    try {
      const { error: rpcError } = await supabase.rpc("admin_delete_promotion", {
        promotion_id_in: p.id,
      });
      if (rpcError) throw rpcError;
      load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete promotion.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-semibold text-2xl">Promotions</h1>
          <p className="text-textFaint text-sm mt-1">Promo codes for riders and drivers.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-accent text-black font-semibold rounded-xl px-4 py-2.5 text-sm hover:brightness-110 transition"
        >
          {showForm ? "Cancel" : "+ New Promotion"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-surface border border-border rounded-2xl p-5 mb-6 flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-textDim uppercase tracking-wide">Code</span>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME50"
                className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-textDim uppercase tracking-wide">Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Welcome Bonus"
                className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-textDim uppercase tracking-wide">Description</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Get R50 credit on your first ride"
              className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-textDim uppercase tracking-wide">Discount Type</span>
              <select
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as any })}
                className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              >
                <option value="fixed_cents">Fixed amount (R)</option>
                <option value="percent">Percentage (%)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-textDim uppercase tracking-wide">
                {form.discountType === "percent" ? "Percent off" : "Amount (R)"}
              </span>
              <input
                type="number"
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                placeholder={form.discountType === "percent" ? "20" : "50"}
                className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-textDim uppercase tracking-wide">Applies To</span>
              <select
                value={form.appliesTo}
                onChange={(e) => setForm({ ...form, appliesTo: e.target.value as any })}
                className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              >
                <option value="both">Both</option>
                <option value="rider">Riders only</option>
                <option value="driver">Drivers only</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-textDim uppercase tracking-wide">Max Redemptions</span>
              <input
                type="number"
                value={form.maxRedemptions}
                onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                placeholder="Unlimited"
                className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-textDim uppercase tracking-wide">Expires</span>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="self-start bg-accent text-black font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 hover:brightness-110 transition"
          >
            {submitting ? "Creating…" : "Create Promotion"}
          </button>
        </form>
      )}

      {error && <p className="text-accent text-sm font-medium mb-4">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-textFaint text-sm">
          <div className="live-pulse" /> Loading…
        </div>
      ) : promos.length === 0 ? (
        <p className="text-textFaint text-sm">No promotions yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {promos.map((p) => (
            <div key={p.id} className="bg-surface border border-border rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-accent">{p.code}</span>
                  <span className="text-sm font-semibold">{p.title}</span>
                  {!p.active && (
                    <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border border-border text-textFaint">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-textDim text-xs mt-1">
                  {formatDiscount(p)} · {p.applies_to_role ? `${p.applies_to_role}s only` : "all users"}
                  {p.max_redemptions ? ` · max ${p.max_redemptions} redemptions` : ""}
                  {p.expires_at ? ` · expires ${new Date(p.expires_at).toLocaleDateString("en-ZA")}` : ""}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleToggleActive(p)}
                  disabled={busyId === p.id}
                  className="border border-border text-textDim font-semibold rounded-xl px-3 py-1.5 text-xs hover:text-white transition-colors disabled:opacity-50"
                >
                  {p.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  disabled={busyId === p.id}
                  className="text-textDim hover:text-accent font-semibold text-xs px-2 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
