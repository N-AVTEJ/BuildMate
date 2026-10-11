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
    <header className="bg-[#ffe17c] border-b-2 border-black sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
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

          <div className="hidden md:flex flex-col items-end text-xs bg-white border-2 border-black px-2.5 py-1 neo-shadow-sm">
            <span className="font-black text-[#171e19]">{user.name || user.email}</span>
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
              {roles.join(" • ")}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="neo-btn bg-white hover:bg-rose-500 hover:text-white text-[#171e19] border-2 border-black px-3 py-1.5 text-xs font-black uppercase tracking-wider neo-shadow-sm"
          >
            Log Out
          </button>
        </div>
      </div>
    </header>
  );
}
