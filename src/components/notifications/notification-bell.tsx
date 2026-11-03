"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface NotificationItem {
  id: string;
  type?: string;
  title?: string;
  body?: string;
  message?: string;
  url?: string | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      }
    } catch {
      // Ignore network errors during polling
    }
  }

  // Periodic polling every 60s and on window focus
  useEffect(() => {
    fetchNotifications();

    const handleFocus = () => {
      fetchNotifications();
    };

    window.addEventListener("focus", handleFocus);
    const interval = setInterval(fetchNotifications, 60000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  async function markAsRead(item: NotificationItem) {
    if (!item.read && !item.readAt) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      try {
        await fetch(`/api/notifications/${item.id}/read`, { method: "POST" });
      } catch {
        // Fallback to fetch on next poll
      }
    }

    setIsOpen(false);
    if (item.url) {
      router.push(item.url);
    }
  }

  async function markAllAsRead() {
    setLoading(true);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);

    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      fetchNotifications();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            fetchNotifications();
          }
        }}
        className="neo-btn relative w-9 h-9 bg-white text-[#171e19] border-2 border-black flex items-center justify-center neo-shadow-sm hover:bg-[#ffe17c] transition"
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] leading-tight px-1.5 py-0.5 rounded-full border border-black shadow-sm animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border-2 border-black neo-shadow-lg z-50 overflow-hidden text-[#171e19]">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#ffe17c] border-b-2 border-black">
            <div className="flex items-center gap-2">
              <span className="font-cabinet font-black text-xs uppercase tracking-wider text-[#171e19]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="bg-[#171e19] text-[#ffe17c] text-[10px] font-black px-1.5 py-0.5 border border-black">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={loading}
                className="text-[10px] font-black uppercase text-[#171e19] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y-2 divide-gray-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs font-bold text-gray-500">
                No notifications right now.
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !item.read && !item.readAt;
                const displayTitle = item.title || "Update";
                const displayBody = item.body || item.message || "";

                return (
                  <button
                    key={item.id}
                    onClick={() => markAsRead(item)}
                    className={`w-full text-left p-3 hover:bg-[#fffdf0] transition flex items-start gap-2.5 ${
                      isUnread ? "bg-[#fffcee]" : "bg-white"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        isUnread ? "bg-rose-500 ring-2 ring-rose-200" : "bg-transparent"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-black text-xs truncate text-[#171e19]">
                          {displayTitle}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500 shrink-0">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">
                        {displayBody}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 bg-gray-50 border-t-2 border-black flex items-center justify-between text-xs font-black">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-[#171e19] hover:underline uppercase text-[11px] tracking-wide"
            >
              View all & settings →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
