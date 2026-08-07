import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Keep in sync with test_mode_capability_keys() in
// 20260804120000_driver_test_mode.sql — the DB validates against that
// list server-side regardless of what this array says, so a mismatch
// here just means a checkbox wouldn't show up, not a security gap.
const CAPABILITIES: { key: string; label: string; hint: string }[] = [
  { key: "go_online", label: "Go online / accept ride requests", hint: "The only capability enforced server-side — every other toggle here is a UI-level restriction on the driver app." },
  { key: "accept_scheduled_rides", label: "Accept scheduled rides", hint: "Pre-booked trips specifically." },
  { key: "view_earnings", label: "View wallet & earnings", hint: "" },
  { key: "download_statements", label: "Download statements", hint: "" },
  { key: "chat_support", label: "Contact support", hint: "" },
  { key: "chat_riders", label: "Chat with riders", hint: "In-trip chat during an active ride." },
  { key: "update_profile", label: "Update profile details/photo", hint: "" },
  { key: "upload_documents", label: "Upload verification documents", hint: "" },
  { key: "manage_subscription", label: "Manage subscription", hint: "" },
  { key: "receive_promotions", label: "View promotions", hint: "" },
];

type Driver = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  cellphone: string;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  is_online: boolean;
  is_suspended: boolean;
  test_mode?: boolean;
  test_mode_permissions?: Record<string, boolean>;
};

type TestDriver = {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  test_mode_permissions: Record<string, boolean>;
};

export default function TestMode() {
  const [testDrivers, setTestDrivers] = useState<TestDriver[]>([]);
  const [loadingTestDrivers, setLoadingTestDrivers] = useState(true);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Driver[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [draftPermissions, setDraftPermissions] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const loadTestDrivers = useCallback(async () => {
    setLoadingTestDrivers(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_test_drivers");
      if (rpcError) throw rpcError;
      setTestDrivers((data ?? []) as TestDriver[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load test-mode drivers.");
    } finally {
      setLoadingTestDrivers(false);
    }
  }, []);

  useEffect(() => {
    loadTestDrivers();
  }, [loadTestDrivers]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("admin_list_drivers", {
        search_in: search || null,
      });
      if (rpcError) throw rpcError;
      setResults((data ?? []) as Driver[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to search drivers.");
    } finally {
      setSearching(false);
    }
  };

  const startEditing = (driverId: string, currentlyEnabled: boolean, currentPermissions: Record<string, boolean> = {}) => {
    setEditingId(driverId);
    setDraftEnabled(currentlyEnabled);
    setDraftPermissions(currentPermissions);
  };

  const toggleCapability = (key: string) => {
    setDraftPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async (driverId: string) => {
    setSaving(true);
    setError(null);
    try {
      const { error: rpcError } = await supabase.rpc("admin_set_driver_test_mode", {
        target_user_id: driverId,
        test_mode_in: draftEnabled,
        permissions_in: draftEnabled ? draftPermissions : {},
      });
      if (rpcError) throw rpcError;
      setEditingId(null);
      await loadTestDrivers();
      if (search) await handleSearch({ preventDefault() {} } as React.FormEvent);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save test mode settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickDisable = async (driverId: string) => {
    setSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc("admin_set_driver_test_mode", {
        target_user_id: driverId,
        test_mode_in: false,
        permissions_in: {},
      });
      if (rpcError) throw rpcError;
      await loadTestDrivers();
    } catch (e: any) {
      setError(e?.message ?? "Failed to disable test mode.");
    } finally {
      setSaving(false);
    }
  };

  const renderPermissionChecklist = (driverId: string) => (
    <div className="mt-3 bg-surfaceRaised border border-border rounded-2xl p-4">
      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={draftEnabled}
          onChange={(e) => setDraftEnabled(e.target.checked)}
          className="w-4 h-4 accent-accent"
        />
        <span className="text-sm font-semibold">Test Mode active</span>
      </label>

      {draftEnabled && (
        <>
          <p className="text-textFaint text-xs mb-3">
            This driver can ONLY do what's checked below — everything else is hidden or blocked in their app.
          </p>
          <div className="flex flex-col gap-2 mb-4">
            {CAPABILITIES.map((cap) => (
              <label key={cap.key} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!draftPermissions[cap.key]}
                  onChange={() => toggleCapability(cap.key)}
                  className="w-4 h-4 mt-0.5 accent-accent"
                />
                <span>
                  <span className="text-sm text-textDim">{cap.label}</span>
                  {cap.hint && <span className="block text-textFaint text-xs">{cap.hint}</span>}
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => handleSave(driverId)}
          disabled={saving}
          className="bg-accent text-black font-semibold rounded-xl px-3.5 py-2 text-xs disabled:opacity-50 hover:brightness-110 transition"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => setEditingId(null)}
          className="border border-border text-textDim font-semibold rounded-xl px-3.5 py-2 text-xs hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display font-semibold text-2xl">Test Mode</h1>
      <p className="text-textFaint text-sm mt-1 mb-6">
        Lock a driver down to only the features you choose — useful for walking a new or
        untrusted driver through the app without letting them accept real trips yet.
      </p>

      {error && <p className="text-accent text-sm font-medium mb-4">{error}</p>}

      {/* Currently in test mode */}
      <div className="mb-8">
        <h2 className="font-display font-semibold text-sm text-textDim mb-3">
          Currently in Test Mode {!loadingTestDrivers && `(${testDrivers.length})`}
        </h2>
        {loadingTestDrivers ? (
          <div className="flex items-center gap-2 text-textFaint text-sm">
            <div className="live-pulse" /> Loading…
          </div>
        ) : testDrivers.length === 0 ? (
          <p className="text-textFaint text-sm">No drivers are currently in test mode.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {testDrivers.map((d) => {
              const enabledCaps = Object.entries(d.test_mode_permissions ?? {}).filter(([, v]) => v);
              return (
                <div key={d.id} className="bg-surface border border-border rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{d.first_name} {d.last_name}</span>
                        <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border border-warning/40 text-warning">
                          Test Mode
                        </span>
                      </div>
                      <p className="text-textFaint text-xs mt-1">@{d.username}</p>
                      <p className="text-textDim text-xs mt-1">
                        {enabledCaps.length > 0
                          ? enabledCaps.map(([k]) => CAPABILITIES.find((c) => c.key === k)?.label ?? k).join(", ")
                          : "No capabilities enabled yet"}
                      </p>
                    </div>
                    <div className="shrink-0 flex gap-3">
                      <button
                        onClick={() => startEditing(d.id, true, d.test_mode_permissions)}
                        className="text-textDim hover:text-white font-semibold text-xs px-2 transition-colors"
                      >
                        Manage
                      </button>
                      <button
                        onClick={() => handleQuickDisable(d.id)}
                        disabled={saving}
                        className="text-textDim hover:text-accent font-semibold text-xs px-2 transition-colors disabled:opacity-50"
                      >
                        Disable
                      </button>
                    </div>
                  </div>
                  {editingId === d.id && renderPermissionChecklist(d.id)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Search to enable test mode for a new driver */}
      <div>
        <h2 className="font-display font-semibold text-sm text-textDim mb-3">Find a Driver</h2>
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or username"
            className="flex-1 bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={searching}
            className="border border-border text-textDim font-semibold rounded-xl px-4 py-2.5 text-sm hover:text-white transition-colors disabled:opacity-50"
          >
            {searching ? "…" : "Search"}
          </button>
        </form>

        <div className="flex flex-col gap-2">
          {results.map((d) => (
            <div key={d.id} className="bg-surface border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{d.first_name} {d.last_name}</span>
                    {d.is_online && <div className="w-2 h-2 rounded-full bg-success" title="Online" />}
                    {d.is_suspended && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border border-accent/40 text-accent">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-textFaint text-xs mt-1">@{d.username} · {d.email}</p>
                </div>
                <div className="shrink-0">
                  <button
                    onClick={() => startEditing(d.id, false, {})}
                    className="border border-border text-textDim font-semibold rounded-xl px-3 py-1.5 text-xs hover:text-white transition-colors"
                  >
                    Enable Test Mode
                  </button>
                </div>
              </div>
              {editingId === d.id && renderPermissionChecklist(d.id)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
