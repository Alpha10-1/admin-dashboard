import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: "riders" | "drivers" | "all";
  created_at: string;
  created_by_name: string;
  recipient_count: number;
};

const emptyForm = { title: "", body: "", audience: "all" as "riders" | "drivers" | "all" };

const AUDIENCE_LABEL: Record<string, string> = {
  all: "Everyone",
  riders: "Riders only",
  drivers: "Drivers only",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Announcements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_announcements");
      if (rpcError) throw rpcError;
      setItems((data ?? []) as Announcement[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and body are required.");
      return;
    }
    // A broadcast can't be recalled once it's sent — an explicit second
    // tap here matches the weight of the action, same reasoning as the
    // delete confirm elsewhere in this dashboard.
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("admin_create_announcement", {
        title_in: form.title,
        body_in: form.body,
        audience_in: form.audience,
      });
      if (rpcError) throw rpcError;
      setForm(emptyForm);
      setShowForm(false);
      setConfirming(false);
      load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to send announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-semibold text-2xl">Announcements</h1>
          <p className="text-textFaint text-sm mt-1">Broadcast a push notification to riders, drivers, or everyone.</p>
        </div>
        <button
          onClick={() => {
            setShowForm((v) => !v);
            setConfirming(false);
          }}
          className="bg-accent text-black font-semibold rounded-xl px-4 py-2.5 text-sm hover:brightness-110 transition"
        >
          {showForm ? "Cancel" : "+ New Announcement"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-2xl p-5 mb-6 flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-textDim uppercase tracking-wide">Title</span>
            <input
              value={form.title}
              onChange={(e) => { setForm({ ...form, title: e.target.value }); setConfirming(false); }}
              placeholder="Scheduled maintenance tonight"
              maxLength={80}
              className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-textDim uppercase tracking-wide">Body</span>
            <textarea
              value={form.body}
              onChange={(e) => { setForm({ ...form, body: e.target.value }); setConfirming(false); }}
              placeholder="RIDE will be briefly unavailable between 2–3am for scheduled maintenance."
              rows={3}
              maxLength={300}
              className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors resize-none"
            />
          </label>

          <label className="flex flex-col gap-1.5 max-w-xs">
            <span className="text-xs font-medium text-textDim uppercase tracking-wide">Audience</span>
            <select
              value={form.audience}
              onChange={(e) => { setForm({ ...form, audience: e.target.value as any }); setConfirming(false); }}
              className="bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
            >
              <option value="all">Everyone</option>
              <option value="riders">Riders only</option>
              <option value="drivers">Drivers only</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className={`self-start font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 transition ${
              confirming ? "bg-accent text-black hover:brightness-110" : "border border-border text-textDim hover:text-white"
            }`}
          >
            {submitting
              ? "Sending…"
              : confirming
              ? `Confirm send to ${AUDIENCE_LABEL[form.audience].toLowerCase()}`
              : "Send Announcement"}
          </button>
        </form>
      )}

      {error && <p className="text-accent text-sm font-medium mb-4">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-textFaint text-sm">
          <div className="live-pulse" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-textFaint text-sm">No announcements sent yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((a) => (
            <div key={a.id} className="bg-surface border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{a.title}</span>
                <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border border-border text-textFaint">
                  {AUDIENCE_LABEL[a.audience]}
                </span>
              </div>
              <p className="text-textDim text-sm mt-2">{a.body}</p>
              <p className="text-textFaint text-xs mt-2">
                {formatDate(a.created_at)} · sent by {a.created_by_name} · {a.recipient_count} recipient{a.recipient_count === 1 ? "" : "s"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}