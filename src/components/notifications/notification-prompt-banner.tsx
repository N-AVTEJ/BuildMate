"use client";

import { useState, useEffect } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificationPromptBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [isIosHint, setIsIosHint] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check iOS PWA status
    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone =
      "standalone" in window.navigator && Boolean((window.navigator as any).standalone);

    if (isIos && !isStandalone) {
      const dismissedIos = localStorage.getItem("buildmate_ios_install_dismissed");
      if (!dismissedIos) {
        setIsIosHint(true);
      }
      return;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return;
    }

    const permission = Notification.permission;

    if (permission === "granted") {
      // Already granted — silently ensure service worker registration and subscription are in sync
      syncPushSubscription();
      return;
    }

    if (permission === "denied") {
      const dismissedDenied = localStorage.getItem("buildmate_push_denied_dismissed");
      if (!dismissedDenied) {
        setIsDenied(true);
      }
      return;
    }

    // Permission is "default" (unprompted)
    // 1. Fast local check
    const localSnooze = localStorage.getItem("buildmate_push_snooze");
    if (localSnooze && new Date(localSnooze) > new Date()) {
      return;
    }

    // 2. Server-side snooze check
    fetch("/api/notifications/prefs")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.prefs?.snoozedUntil) {
          const snoozedDate = new Date(data.prefs.snoozedUntil);
          if (snoozedDate > new Date()) {
            localStorage.setItem("buildmate_push_snooze", snoozedDate.toISOString());
            return;
          }
        }
        setIsVisible(true);
      })
      .catch(() => {
        setIsVisible(true);
      });
  }, []);

  async function syncPushSubscription() {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) return;

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      // Upsert subscription on backend
      const subJson = subscription.toJSON();
      if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: {
              p256dh: subJson.keys.p256dh,
              auth: subJson.keys.auth,
            },
          }),
        });
      }
    } catch (err) {
      console.warn("[Push] Silently skipped subscription sync:", err);
    }
  }

  async function handleEnable() {
    setIsProcessing(true);
    try {
      // ONLY triggered by explicit user button click
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        await syncPushSubscription();
        setIsVisible(false);
      } else if (permission === "denied") {
        setIsVisible(false);
        setIsDenied(true);
      } else {
        setIsVisible(false);
      }
    } catch (err) {
      console.error("[Push] Error during permission prompt:", err);
      setIsVisible(false);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSnooze() {
    setIsVisible(false);
    const snoozeUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    localStorage.setItem("buildmate_push_snooze", snoozeUntil.toISOString());

    // Server-side 7-day snooze persistence
    try {
      await fetch("/api/notifications/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snoozeDays: 7 }),
      });
    } catch {
      // LocalStorage already protects client
    }
  }

  function handleDismissDenied() {
    setIsDenied(false);
    localStorage.setItem("buildmate_push_denied_dismissed", "true");
  }

  function handleDismissIos() {
    setIsIosHint(false);
    localStorage.setItem("buildmate_ios_install_dismissed", "true");
  }

  // 1. iOS Safari PWA Installation Hint
  if (isIosHint) {
    return (
      <div className="bg-[#ffe17c] border-b-2 border-black px-4 py-3 neo-shadow-sm text-[#171e19]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base font-black">📱</span>
            <span className="font-bold">
              To enable instant push notifications on iOS, install BuildMate to your Home Screen: tap the{" "}
              <strong>Share</strong> icon (square with arrow) and select{" "}
              <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
            </span>
          </div>
          <button
            onClick={handleDismissIos}
            className="neo-btn px-3 py-1 bg-white text-[#171e19] border-2 border-black font-black uppercase text-[10px] neo-shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  // 2. Permission Denied Help Banner (Non-intrusive, explains how to re-enable in settings)
  if (isDenied) {
    return (
      <div className="bg-amber-100 border-b-2 border-black px-4 py-2.5 text-[#171e19]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-black text-amber-800">⚠️</span>
            <span className="font-bold text-gray-800">
              Notifications are blocked in your browser. To receive milestone alerts, click the lock icon in your address bar and allow notifications for BuildMate.
            </span>
          </div>
          <button
            onClick={handleDismissDenied}
            className="text-[10px] font-black uppercase text-gray-700 hover:text-black shrink-0 underline"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // 3. In-App Soft Prompt Banner
  if (!isVisible) {
    return null;
  }

  return (
    <div className="bg-[#ffe17c] border-b-2 border-black px-4 py-3 neo-shadow-sm text-[#171e19] animate-fade-in">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <span className="text-lg">🔔</span>
          <p className="text-xs sm:text-sm font-bold text-[#171e19]">
            Turn on notifications so you never miss a quotation or payment update.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleEnable}
            disabled={isProcessing}
            className="neo-btn px-4 py-1.5 bg-[#171e19] text-[#ffe17c] border-2 border-black text-xs font-black uppercase tracking-wider neo-shadow-sm hover:bg-black transition disabled:opacity-50"
          >
            {isProcessing ? "Enabling..." : "Enable"}
          </button>
          <button
            onClick={handleSnooze}
            disabled={isProcessing}
            className="neo-btn px-3 py-1.5 bg-white text-[#171e19] border-2 border-black text-xs font-black uppercase tracking-wider neo-shadow-sm hover:bg-gray-100 transition disabled:opacity-50"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
