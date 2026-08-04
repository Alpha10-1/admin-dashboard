import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type ContentRow = {
  key: string;
  title: string;
  body: string;
  updated_at: string;
};

export default function Content() {
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { title: string; body: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("app_content")
        .select("*")
        .order("key", { ascending: true });
      if (fetchError) throw fetchError;
      setRows((data ?? []) as ContentRow[]);
      setEditing(
        Object.fromEntries((data ?? []).map((r: ContentRow) => [r.key, { title: r.title, body: r.body }]))
      );
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load content.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (key: string) => {
    const draft = editing[key];
    if (!draft) return;
    setSavingKey(key);
    setSavedKey(null);
    try {
      const { error: rpcError } = await supabase.rpc("admin_upsert_app_content", {
        key_in: key,
        title_in: draft.title,
        body_in: draft.body,
      });
      if (rpcError) throw rpcError;
      setSavedKey(key);
      load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="font-display font-semibold text-2xl">Content</h1>
      <p className="text-textFaint text-sm mt-1 mb-6">
        Terms & Conditions, Privacy Policy, and other in-app copy — edits go live immediately, no app update needed.
      </p>

      {error && <p className="text-accent text-sm font-medium mb-4">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-textFaint text-sm">
          <div className="live-pulse" /> Loading…
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {rows.map((row) => {
            const draft = editing[row.key] ?? { title: row.title, body: row.body };
            const dirty = draft.title !== row.title || draft.body !== row.body;
            return (
              <div key={row.key} className="bg-surface border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-textFaint">
                    {row.key}
                  </span>
                  <span className="text-textFaint text-xs">
                    Updated {new Date(row.updated_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>

                <input
                  value={draft.title}
                  onChange={(e) => setEditing({ ...editing, [row.key]: { ...draft, title: e.target.value } })}
                  className="w-full bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-accent transition-colors mb-2"
                />
                <textarea
                  value={draft.body}
                  onChange={(e) => setEditing({ ...editing, [row.key]: { ...draft, body: e.target.value } })}
                  rows={10}
                  className="w-full bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors font-mono leading-relaxed resize-y"
                />

                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => handleSave(row.key)}
                    disabled={!dirty || savingKey === row.key}
                    className="bg-accent text-black font-semibold rounded-xl px-4 py-2 text-sm disabled:opacity-40 hover:brightness-110 transition"
                  >
                    {savingKey === row.key ? "Saving…" : "Save"}
                  </button>
                  {savedKey === row.key && !dirty && (
                    <span className="text-success text-xs font-semibold">Saved</span>
                  )}
                  {dirty && <span className="text-warning text-xs font-semibold">Unsaved changes</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
