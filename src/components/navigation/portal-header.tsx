"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/auth/session";
import { RoleSwitcher } from "./role-switcher";

interface PortalHeaderProps {
  user: {
    email: string;
    name?: string | null;
  };
  roles: UserRole[];
  currentPortalTitle: string;
}

export function PortalHeader({ user, roles, currentPortalTitle }: PortalHeaderProps) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-black text-xl tracking-tight text-blue-600">
            Build<span className="text-gray-900">Mate</span>
          </Link>
          <span className="hidden sm:inline-block text-gray-300">|</span>
          <span className="text-sm font-semibold text-gray-700">{currentPortalTitle}</span>
        </div>

        <div className="flex items-center gap-4">
          <RoleSwitcher roles={roles} />

          <div className="hidden md:flex flex-col items-end text-xs">
            <span className="font-semibold text-gray-900">{user.name || user.email}</span>
            <span className="text-gray-500">{roles.join(", ")}</span>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition border border-gray-200"
          >
            Log Out
          </button>
        </div>
      </div>
    </header>
  );
}
