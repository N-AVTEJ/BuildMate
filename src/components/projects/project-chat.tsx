"use client";

import { useState, useEffect, useRef } from "react";

export interface MessageItem {
  id: string;
  projectId: string;
  senderId: string;
  senderName: string;
  senderRole: "CLIENT" | "BUILDER" | "ADMIN";
  body: string;
  createdAt: string | Date;
}

interface ProjectChatProps {
  projectId: string;
  currentUserId: string;
  initialMessages: MessageItem[];
}

export function ProjectChat({
  projectId,
  currentUserId,
  initialMessages,
}: ProjectChatProps) {
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newMessage }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send message.");
      }

      setMessages((prev) => [...prev, data.message]);
      setNewMessage("");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[650px] bg-white rounded-2xl border-2 border-black neo-shadow-lg overflow-hidden font-body text-[#171e19]">
      {/* Chat Messages List */}
      <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#fffdf0] neo-dots">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-black/60">
            <span className="text-4xl mb-3">💬</span>
            <p className="font-heading font-black text-lg text-black">No messages yet</p>
            <p className="text-xs font-semibold text-black/60 mt-1 max-w-sm">
              Start the discussion regarding project scope, updates, or deliverables.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUserId;
            const roleBadgeClass =
              msg.senderRole === "ADMIN"
                ? "bg-[#b7c6c2] text-black border-black"
                : msg.senderRole === "BUILDER"
                ? "bg-[#ffe17c] text-black border-black"
                : "bg-white text-black border-black";

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-2 mb-1 px-1 text-xs text-black/60 font-semibold">
                  <span className="font-heading font-black text-black">
                    {isSelf ? "You" : msg.senderName}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-heading font-black border uppercase tracking-wider ${roleBadgeClass}`}
                  >
                    {msg.senderRole}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Plain text message rendering - zero innerHTML */}
                <div
                  className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words border-2 border-black ${
                    isSelf
                      ? "bg-black text-[#ffe17c] rounded-2xl rounded-tr-none neo-shadow-sm font-medium"
                      : "bg-white text-black rounded-2xl rounded-tl-none neo-shadow-sm font-medium"
                  }`}
                >
                  {msg.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Notice */}
      {error && (
        <div className="px-4 py-2.5 bg-rose-200 border-t-2 border-black text-black text-xs font-bold flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-black hover:opacity-75 font-black ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Chat Input Bar */}
      <form
        onSubmit={handleSend}
        className="p-3.5 bg-white border-t-2 border-black flex items-center gap-3"
      >
        <div className="flex-1 relative">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Type your message... (Shift+Enter for newline)"
            rows={1}
            maxLength={2000}
            className="w-full resize-none px-4 py-2.5 text-sm font-medium border-2 border-black rounded-xl focus:bg-[#ffe17c]/20 focus:outline-none pr-16"
          />
          <span className="absolute right-3 bottom-2 text-[10px] font-bold text-black/40">
            {newMessage.length}/2000
          </span>
        </div>

        <button
          type="submit"
          disabled={loading || !newMessage.trim()}
          className="neo-btn px-6 py-2.5 bg-[#ffe17c] hover:bg-black hover:text-[#ffe17c] text-black text-xs font-heading font-black uppercase tracking-wider rounded-xl border-2 border-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
