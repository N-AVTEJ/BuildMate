"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/auth/session";
import { RoleSwitcher } from "./role-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { NotificationPromptBanner } from "@/components/notifications/notification-prompt-banner";

interface PortalHeaderProps {
  user: {
    email: string;
    name?: string | null;
  };
  roles: UserRole[];
  currentPortalTitle: string;
}

export function formatHeaderRoleBadge(roles: UserRole[]): string {
  if (roles.includes("ADMIN")) {
    return "BUILDER + ADMIN";
  }
  if (roles.includes("BUILDER")) {
    return "BUILDER";
  }
  if (roles.includes("CLIENT")) {
    return "CLIENT";
  }
  return roles.join(" + ");
}

export function PortalHeader({ user, roles, currentPortalTitle }: PortalHeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      let endpoint: string | undefined;

      // Fast, non-blocking push subscription retrieval with bounded 200ms timeout fallback
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          const timeoutFallback = new Promise<undefined>((resolve) =>
            setTimeout(() => resolve(undefined), 200)
          );
          const reg = await Promise.race([
            navigator.serviceWorker.getRegistration(),
            timeoutFallback,
          ]);

          if (reg?.pushManager) {
            const sub = await Promise.race([
              reg.pushManager.getSubscription(),
              timeoutFallback,
            ]);
            if (sub) {
              endpoint = sub.endpoint;
              // Non-blocking push revocation: fire-and-forget
              sub.unsubscribe().catch(() => {});
            }
          }
        } catch {
          // Proceed immediately with logout if service worker retrieval fails
        }
      }

      // Send POST to /api/auth/logout with AbortSignal timeout (2000ms)
      const controller = new AbortController();
      const abortTimer = setTimeout(() => controller.abort(), 2000);

      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
          signal: controller.signal,
        });
      } catch {
        // Proceed even if logout fetch timed out or encountered network error
      } finally {
        clearTimeout(abortTimer);
      }

      // Direct users to portal-appropriate login route
      const isBuilderPortal =
        currentPortalTitle?.toLowerCase().includes("builder") ||
        (roles.includes("BUILDER") && !roles.includes("CLIENT"));
      const redirectUrl = isBuilderPortal ? "/builder/login" : "/login";

      // Hard redirect replaces history entry and flushes RSC router cache and bfcache
      window.location.replace(redirectUrl);
    } catch {
      const isBuilderPortal =
        currentPortalTitle?.toLowerCase().includes("builder") ||
        (roles.includes("BUILDER") && !roles.includes("CLIENT"));
      window.location.replace(isBuilderPortal ? "/builder/login" : "/login");
    }
  }

  const roleBadgeText = formatHeaderRoleBadge(roles);

  return (
    <>
      <header className="bg-[#ffe17c] border-b-2 border-black sticky top-0 z-50 w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-[#171e19] text-[#ffe17c] border-2 border-black flex items-center justify-center font-black text-base neo-shadow-sm group-hover:bg-[#ffe17c] group-hover:text-[#171e19] transition">
                ⚡
              </div>
              <span className="font-cabinet font-black text-xl tracking-tight text-[#171e19]">
                Build<span className="underline decoration-2">Mate</span>
              </span>
            </Link>
            <span className="hidden sm:inline-block font-black text-black">/</span>
            <span className="hidden sm:inline-block bg-[#171e19] text-[#ffe17c] border-2 border-black px-2.5 py-0.5 text-xs font-black uppercase tracking-wider neo-shadow-sm">
              {currentPortalTitle}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <RoleSwitcher roles={roles} />

            {/* Notification Bell Dropdown */}
            <NotificationBell />

            <div
              className="hidden md:flex flex-col items-end text-xs bg-white border-2 border-black px-2.5 py-1 neo-shadow-sm"
              aria-label={`${user.name || user.email} · ${roleBadgeText}`}
            >
              <span className="font-black text-[#171e19]">{user.name || user.email}</span>
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                {roleBadgeText}
              </span>
            </div>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`neo-btn text-[#171e19] border-2 border-black px-3 py-1.5 text-xs font-black uppercase tracking-wider neo-shadow-sm transition ${
                isLoggingOut
                  ? "bg-gray-200 cursor-not-allowed opacity-80"
                  : "bg-white hover:bg-rose-500 hover:text-white"
              }`}
              aria-busy={isLoggingOut}
            >
              {isLoggingOut ? "Logging out..." : "Log Out"}
            </button>
          </div>
        </div>
      </header>

      {/* In-app soft push permission banner & iOS PWA guidance */}
      <NotificationPromptBanner />
    </>
  );
}
