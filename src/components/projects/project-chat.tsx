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
    <div className="flex flex-col h-[650px] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Chat Messages List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500">
            <span className="text-3xl mb-2">💬</span>
            <p className="font-semibold text-gray-700">No messages yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Start the discussion regarding project scope, updates, or deliverables.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUserId;
            const roleBadgeColor =
              msg.senderRole === "ADMIN"
                ? "bg-purple-100 text-purple-700 border-purple-200"
                : msg.senderRole === "BUILDER"
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-blue-100 text-blue-700 border-blue-200";

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-2 mb-1 px-1 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">
                    {isSelf ? "You" : msg.senderName}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${roleBadgeColor}`}
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
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                    isSelf
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-xs"
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
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-xs flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Chat Input Bar */}
      <form
        onSubmit={handleSend}
        className="p-3 bg-white border-t border-gray-200 flex items-center gap-2"
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
            className="w-full resize-none px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none pr-16"
          />
          <span className="absolute right-3 bottom-2 text-[10px] text-gray-400">
            {newMessage.length}/2000
          </span>
        </div>

        <button
          type="submit"
          disabled={loading || !newMessage.trim()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
