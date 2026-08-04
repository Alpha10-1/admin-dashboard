import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type DocRow = {
  document_id: string;
  driver_id: string;
  driver_first_name: string;
  driver_last_name: string;
  driver_username: string;
  doc_type: string;
  storage_path: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  uploaded_at: string;
};

const DOC_LABELS: Record<string, string> = {
  drivers_license: "Driver's License",
  id_copy: "ID Copy",
  prdp: "Professional Driving Permit",
  vehicle_license: "Vehicle License / Car Disc",
  vehicle_photo_front: "Vehicle Photo — Front",
  vehicle_photo_back: "Vehicle Photo — Back",
  vehicle_photo_side: "Vehicle Photo — Side",
  vehicle_photo_interior: "Vehicle Photo — Interior",
};

type Filter = "pending" | "approved" | "rejected" | "all";

export default function Documents() {
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_driver_document_queue");
      if (rpcError) throw rpcError;
      setRows((data ?? []) as DocRow[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => filter === "all" || r.status === filter);
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const getPreviewUrl = useCallback(async (row: DocRow) => {
    if (previewUrls[row.document_id]) return;
    const { data } = await supabase.storage
      .from("driver-documents")
      .createSignedUrl(row.storage_path, 60 * 10);
    if (data?.signedUrl) {
      setPreviewUrls((prev) => ({ ...prev, [row.document_id]: data.signedUrl }));
    }
  }, [previewUrls]);

  const handleApprove = async (row: DocRow) => {
    setBusyId(row.document_id);
    try {
      const { error: rpcError } = await supabase.rpc("review_driver_document", {
        document_id_in: row.document_id,
        approve_in: true,
      });
      if (rpcError) throw rpcError;
      load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to approve document.");
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async (row: DocRow) => {
    setBusyId(row.document_id);
    try {
      const { error: rpcError } = await supabase.rpc("review_driver_document", {
        document_id_in: row.document_id,
        approve_in: false,
        rejection_reason_in: rejectReason.trim() || "Document did not meet requirements.",
      });
      if (rpcError) throw rpcError;
      setRejectingId(null);
      setRejectReason("");
      load();
    } catch (e: any) {
      setError(e?.message ?? "Failed to reject document.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display font-semibold text-2xl">Documents</h1>
        <button
          onClick={load}
          className="text-sm font-medium text-textDim hover:text-white border border-border rounded-xl px-3.5 py-2 transition-colors"
        >
          Refresh
        </button>
      </div>
      <p className="text-textFaint text-sm mb-6">
        {pendingCount > 0 ? `${pendingCount} document${pendingCount > 1 ? "s" : ""} awaiting review.` : "All caught up."}
      </p>

      <div className="flex gap-1 mb-6 bg-surface border border-border rounded-xl p-1 w-fit">
        {(["pending", "approved", "rejected", "all"] as Filter[]).map((f) => (
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
            <div key={row.document_id} className="bg-surface border border-border rounded-2xl p-4 flex gap-4">
              <button
                onClick={() => getPreviewUrl(row)}
                className="w-28 h-20 shrink-0 bg-surfaceRaised border border-border rounded-xl overflow-hidden flex items-center justify-center"
              >
                {previewUrls[row.document_id] ? (
                  <img
                    src={previewUrls[row.document_id]}
                    alt={row.doc_type}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-textFaint text-[11px]">View</span>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {row.driver_first_name} {row.driver_last_name}
                    <span className="text-textFaint font-normal"> · @{row.driver_username}</span>
                  </p>
                  <span
                    className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${
                      row.status === "pending"
                        ? "text-warning border-warning/40"
                        : row.status === "approved"
                        ? "text-success border-success/40"
                        : "text-accent border-accent/40"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
                <p className="text-textDim text-sm mt-0.5">{DOC_LABELS[row.doc_type] ?? row.doc_type}</p>
                <p className="text-textFaint text-xs mt-0.5">
                  Uploaded {new Date(row.uploaded_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
                {row.rejection_reason && (
                  <p className="text-accent text-xs mt-1">{row.rejection_reason}</p>
                )}

                {row.status === "pending" && (
                  <div className="mt-3">
                    {rejectingId === row.document_id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason (shown to the driver)"
                          rows={2}
                          className="bg-surfaceRaised border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-accent transition-colors resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => submitReject(row)}
                            disabled={busyId === row.document_id}
                            className="bg-accent text-black font-semibold rounded-xl px-3.5 py-1.5 text-xs disabled:opacity-50 hover:brightness-110 transition"
                          >
                            {busyId === row.document_id ? "Submitting…" : "Confirm Reject"}
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectReason(""); }}
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
                          disabled={busyId === row.document_id}
                          className="bg-accent text-black font-semibold rounded-xl px-3.5 py-1.5 text-xs disabled:opacity-50 hover:brightness-110 transition"
                        >
                          {busyId === row.document_id ? "…" : "Approve"}
                        </button>
                        <button
                          onClick={() => setRejectingId(row.document_id)}
                          className="border border-border text-textDim font-semibold rounded-xl px-3.5 py-1.5 text-xs hover:text-white transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
