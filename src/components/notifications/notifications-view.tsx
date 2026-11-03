"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NotificationItem } from "./notification-bell";

interface NotificationPrefs {
  pushEnabled: boolean;
  quotationUpdates: boolean;
  paymentUpdates: boolean;
  deliveryUpdates: boolean;
  deadlineAlerts: boolean;
  changeRequestUpdates: boolean;
  disputeUpdates: boolean;
  snoozedUntil?: string | null;
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

export function NotificationsView() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"inbox" | "settings">("inbox");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Settings State
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    pushEnabled: true,
    quotationUpdates: true,
    paymentUpdates: true,
    deliveryUpdates: true,
    deadlineAlerts: true,
    changeRequestUpdates: true,
    disputeUpdates: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [browserPermission, setBrowserPermission] = useState<string>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  async function loadNotifications(reset = false, cursor?: string | null) {
    setLoading(true);
    try {
      const url = new URL("/api/notifications", window.location.origin);
      url.searchParams.set("limit", "15");
      if (unreadOnly) {
        url.searchParams.set("unreadOnly", "true");
      }
      if (!reset && cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const res = await fetch(url.toString());
      if (!res.ok) return;
      const data = await res.json();

      if (data.success && Array.isArray(data.notifications)) {
        if (reset || !cursor) {
          setNotifications(data.notifications);
        } else {
          setNotifications((prev) => [...prev, ...data.notifications]);
        }
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
        setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications(true);
  }, [unreadOnly]);

  async function fetchPrefs() {
    try {
      const res = await fetch("/api/notifications/prefs");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.prefs) {
        setPrefs(data.prefs);
      }
    } catch {
      // Ignore errors
    }
  }

  useEffect(() => {
    fetchPrefs();
  }, []);

  async function handleUpdatePref(key: keyof NotificationPrefs, value: boolean) {
    if (key === "paymentUpdates") return; // Locked on

    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSavingPrefs(true);

    try {
      await fetch("/api/notifications/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      fetchPrefs();
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleSendTest() {
    setTestStatus("Sending test push notification...");
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus("✓ Test notification dispatched! Check your desktop/phone OS alerts.");
        loadNotifications(true);
      } else {
        setTestStatus(`❌ ${data.error || "Failed to dispatch test notification."}`);
      }
    } catch {
      setTestStatus("❌ Network error sending test push notification.");
    }

    setTimeout(() => {
      setTestStatus(null);
    }, 6000);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);

    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      loadNotifications(true);
    }
  }

  async function handleItemClick(item: NotificationItem) {
    if (!item.read && !item.readAt) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      try {
        await fetch(`/api/notifications/${item.id}/read`, { method: "POST" });
      } catch {
        // Fallback
      }
    }

    if (item.url) {
      router.push(item.url);
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* Page Title */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-cabinet font-black uppercase tracking-tight text-[#171e19]">
            Notification Center
          </h1>
          <p className="text-sm font-bold text-gray-700 mt-1">
            Real-time milestone alerts, quotation notices, and system push preferences.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`neo-btn px-4 py-2 text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm transition ${
              activeTab === "inbox"
                ? "bg-[#171e19] text-[#ffe17c]"
                : "bg-white text-[#171e19] hover:bg-gray-100"
            }`}
          >
            Alerts ({unreadCount})
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`neo-btn px-4 py-2 text-xs font-black uppercase tracking-wider border-2 border-black neo-shadow-sm transition ${
              activeTab === "settings"
                ? "bg-[#171e19] text-[#ffe17c]"
                : "bg-white text-[#171e19] hover:bg-gray-100"
            }`}
          >
            Preferences
          </button>
        </div>
      </div>

      {/* Tab 1: INBOX */}
      {activeTab === "inbox" && (
        <div className="bg-white border-2 border-black neo-shadow-lg">
          {/* Controls Bar */}
          <div className="p-4 bg-[#ffe17c] border-b-2 border-black flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-black uppercase cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-2 border-black text-[#171e19] focus:ring-0"
                />
                Unread only
              </label>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="neo-btn bg-white hover:bg-black hover:text-[#ffe17c] text-[#171e19] border-2 border-black px-3 py-1 text-xs font-black uppercase tracking-wider neo-shadow-sm"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="divide-y-2 divide-gray-100">
            {notifications.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-amber-100 border-2 border-black flex items-center justify-center mx-auto mb-3 font-black text-xl">
                  🔔
                </div>
                <h3 className="font-cabinet font-black uppercase text-base text-[#171e19]">
                  {unreadOnly ? "No unread notifications" : "No notifications yet"}
                </h3>
                <p className="text-xs font-bold text-gray-600 mt-1">
                  You are completely caught up on your milestone project updates.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !item.read && !item.readAt;
                const displayTitle = item.title || "Notification";
                const displayBody = item.body || item.message || "";

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-4 transition cursor-pointer flex items-start justify-between gap-4 hover:bg-[#fffdf0] ${
                      isUnread ? "bg-[#fffcee]" : "bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                          isUnread ? "bg-rose-500 ring-4 ring-rose-100" : "bg-gray-300"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-cabinet font-black text-sm text-[#171e19]">
                            {displayTitle}
                          </h4>
                          {item.type && (
                            <span className="text-[10px] bg-gray-100 border border-black px-1.5 py-0.5 font-bold uppercase tracking-wider">
                              {item.type}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-800 leading-relaxed">
                          {displayBody}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0 gap-1 text-[11px] font-bold text-gray-500">
                      <span>{timeAgo(item.createdAt)}</span>
                      {item.url && (
                        <span className="text-xs font-black text-black group-hover:underline">
                          View →
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="p-4 bg-gray-50 border-t-2 border-black text-center">
              <button
                onClick={() => loadNotifications(false, nextCursor)}
                disabled={loading}
                className="neo-btn px-6 py-2 bg-white text-[#171e19] border-2 border-black font-black uppercase text-xs neo-shadow-sm hover:bg-[#ffe17c]"
              >
                {loading ? "Loading..." : "Load More Notifications"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: SETTINGS & PREFERENCES */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          {/* OS Push Status Banner */}
          <div className="bg-white border-2 border-black p-6 neo-shadow-lg">
            <h2 className="text-xl font-cabinet font-black uppercase tracking-tight text-[#171e19] mb-2">
              Browser Push Status
            </h2>
            <p className="text-xs font-bold text-gray-700 mb-4 leading-relaxed">
              Browser push delivers native notifications to your laptop or phone even when BuildMate tabs are closed.
            </p>

            <div className="flex items-center justify-between p-4 bg-[#fffdf0] border-2 border-black neo-shadow-sm mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">
                  {browserPermission === "granted" ? "✅" : browserPermission === "denied" ? "🚫" : "⏳"}
                </span>
                <div>
                  <div className="font-cabinet font-black text-sm uppercase">
                    Status: {browserPermission.toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-600 font-bold">
                    {browserPermission === "granted"
                      ? "Notifications are enabled in this browser."
                      : browserPermission === "denied"
                      ? "Notifications are blocked. Please allow notifications in site settings."
                      : "Permission not yet requested."}
                  </div>
                </div>
              </div>

              <button
                onClick={handleSendTest}
                className="neo-btn px-4 py-2 bg-[#171e19] text-[#ffe17c] border-2 border-black font-black uppercase text-xs neo-shadow-sm hover:bg-black transition"
              >
                Send Test Push
              </button>
            </div>

            {testStatus && (
              <div className="p-3 bg-amber-50 border-2 border-black text-xs font-bold text-[#171e19] neo-shadow-sm">
                {testStatus}
              </div>
            )}
          </div>

          {/* Preferences Form */}
          <div className="bg-white border-2 border-black p-6 neo-shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-cabinet font-black uppercase tracking-tight text-[#171e19]">
                Notification Channels
              </h2>
              {savingPrefs && (
                <span className="text-xs font-black text-emerald-600 uppercase">Saving...</span>
              )}
            </div>

            <div className="space-y-4 divide-y divide-gray-100">
              {/* Master Push Toggle */}
              <div className="pt-2 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-cabinet font-black text-sm uppercase text-[#171e19]">
                    Master Push Notifications
                  </h4>
                  <p className="text-xs font-bold text-gray-600">
                    Receive OS-level popups for important project updates.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.pushEnabled}
                  onChange={(e) => handleUpdatePref("pushEnabled", e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-black text-[#171e19] focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Quotations */}
              <div className="pt-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-cabinet font-black text-sm uppercase text-[#171e19]">
                    Quotation Updates
                  </h4>
                  <p className="text-xs font-bold text-gray-600">
                    Alerts when quotations are created, accepted, or revised.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.quotationUpdates}
                  onChange={(e) => handleUpdatePref("quotationUpdates", e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-black text-[#171e19] focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Payment & Security — FORCED ON */}
              <div className="pt-4 flex items-center justify-between gap-4 bg-amber-50/50 p-2.5 border-2 border-black border-dashed">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-cabinet font-black text-sm uppercase text-[#171e19]">
                      Milestone Payment & Security Updates
                    </h4>
                    <span className="text-[10px] font-black uppercase bg-[#171e19] text-[#ffe17c] px-1.5 py-0.5 border border-black">
                      Mandatory
                    </span>
                  </div>
                  <p className="text-xs font-bold text-gray-600">
                    Crucial payment verifications and security status alerts (cannot be turned off).
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="w-5 h-5 rounded border-2 border-black text-[#171e19] cursor-not-allowed opacity-75"
                />
              </div>

              {/* Code Delivery */}
              <div className="pt-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-cabinet font-black text-sm uppercase text-[#171e19]">
                    Deliverable & Code Releases
                  </h4>
                  <p className="text-xs font-bold text-gray-600">
                    Alerts when code deliverables or artifacts are submitted.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.deliveryUpdates}
                  onChange={(e) => handleUpdatePref("deliveryUpdates", e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-black text-[#171e19] focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Deadlines */}
              <div className="pt-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-cabinet font-black text-sm uppercase text-[#171e19]">
                    Deadline & Abandonment Alerts
                  </h4>
                  <p className="text-xs font-bold text-gray-600">
                    Warnings when milestone deadlines are within 24h or overdue.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.deadlineAlerts}
                  onChange={(e) => handleUpdatePref("deadlineAlerts", e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-black text-[#171e19] focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Change Requests */}
              <div className="pt-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-cabinet font-black text-sm uppercase text-[#171e19]">
                    Change Requests & Scope Modifications
                  </h4>
                  <p className="text-xs font-bold text-gray-600">
                    Notices when scope change requests are proposed or responded to.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.changeRequestUpdates}
                  onChange={(e) => handleUpdatePref("changeRequestUpdates", e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-black text-[#171e19] focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Disputes */}
              <div className="pt-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-cabinet font-black text-sm uppercase text-[#171e19]">
                    Dispute & Mediation Updates
                  </h4>
                  <p className="text-xs font-bold text-gray-600">
                    Notices when a dispute is opened, withdrawn, or resolved.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs.disputeUpdates}
                  onChange={(e) => handleUpdatePref("disputeUpdates", e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-black text-[#171e19] focus:ring-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
