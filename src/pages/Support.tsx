import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type Conversation = {
  user_id: string;
  first_name: string;
  last_name: string;
  username: string;
  role: "rider" | "driver";
  last_message: string;
  last_message_at: string;
  last_sender_role: "user" | "admin";
  awaiting_reply: boolean;
};

type Message = {
  id: string;
  user_id: string;
  sender_id: string;
  sender_role: "user" | "admin";
  body: string;
  created_at: string;
};

export default function Support() {
  const { admin } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_support_conversations");
      if (rpcError) throw rpcError;
      setConversations((data ?? []) as Conversation[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load conversations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 20_000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const openConversation = useCallback(async (c: Conversation) => {
    setSelected(c);
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("user_id", c.user_id)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const channel = supabase
      .channel(`admin-support-${selected.user_id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `user_id=eq.${selected.user_id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !reply.trim() || !admin) return;
    setSending(true);
    try {
      const { error: insertError } = await supabase.from("support_messages").insert({
        user_id: selected.user_id,
        sender_id: admin.id,
        sender_role: "admin",
        body: reply.trim(),
      });
      if (insertError) throw insertError;
      setReply("");
      loadConversations();
    } catch (e: any) {
      setError(e?.message ?? "Failed to send reply.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Conversation list */}
      <div className="w-80 shrink-0 border-r border-border overflow-y-auto">
        <div className="p-5 border-b border-border">
          <h1 className="font-display font-semibold text-xl">Support</h1>
          <p className="text-textFaint text-xs mt-1">
            {conversations.filter((c) => c.awaiting_reply).length} awaiting a reply
          </p>
        </div>

        {loading ? (
          <div className="p-5 flex items-center gap-2 text-textFaint text-sm">
            <div className="live-pulse" /> Loading…
          </div>
        ) : error ? (
          <p className="p-5 text-accent text-sm font-medium">{error}</p>
        ) : conversations.length === 0 ? (
          <p className="p-5 text-textFaint text-sm">No support conversations yet.</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.user_id}
              onClick={() => openConversation(c)}
              className={`w-full text-left px-5 py-3.5 border-b border-border transition-colors ${
                selected?.user_id === c.user_id ? "bg-surfaceRaised" : "hover:bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{c.first_name} {c.last_name}</span>
                {c.awaiting_reply && <div className="w-2 h-2 rounded-full bg-accent shrink-0" />}
              </div>
              <p className="text-textFaint text-xs mt-0.5">@{c.username} · {c.role}</p>
              <p className="text-textDim text-xs mt-1.5 truncate">
                {c.last_sender_role === "admin" ? "You: " : ""}{c.last_message}
              </p>
            </button>
          ))
        )}
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-textFaint text-sm">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="p-5 border-b border-border">
              <p className="font-semibold text-sm">{selected.first_name} {selected.last_name}</p>
              <p className="text-textFaint text-xs">@{selected.username} · {selected.role}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-md rounded-2xl px-4 py-2.5 text-sm ${
                      m.sender_role === "admin"
                        ? "bg-accent text-black rounded-br-md"
                        : "bg-surface border border-border rounded-bl-md"
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 border-t border-border flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a reply…"
                className="flex-1 bg-surfaceRaised border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors"
              />
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="bg-accent text-black font-semibold rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 hover:brightness-110 transition"
              >
                {sending ? "…" : "Send"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
