"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@/lib/auth/session";

interface RoleSwitcherProps {
  roles: UserRole[];
}

export interface PortalView {
  name: string;
  href: string;
  activePrefix: string;
  role: UserRole;
}

/**
 * Filter roles strictly according to portal access rules:
 * - If roles include ADMIN: ADMIN implies builder oversight access.
 *   Tabs: BUILDER PORTAL + ADMIN PORTAL (strictly no CLIENT PORTAL for admin staff accounts).
 * - If roles include BUILDER but not ADMIN: BUILDER PORTAL only.
 *   Hard check on roles.includes('ADMIN'); zero Admin UI/tabs ever.
 * - If roles include only CLIENT: CLIENT PORTAL only (unchanged for client-only users).
 */
export function getPortalViews(roles: UserRole[]): PortalView[] {
  const isAdmin = roles.includes("ADMIN");
  const isBuilder = roles.includes("BUILDER");
  const isClient = roles.includes("CLIENT");

  if (isAdmin) {
    return [
      { name: "Builder Portal", href: "/builder", activePrefix: "/builder", role: "BUILDER" },
      { name: "Admin Portal", href: "/admin", activePrefix: "/admin", role: "ADMIN" },
    ];
  }

  if (isBuilder) {
    return [
      { name: "Builder Portal", href: "/builder", activePrefix: "/builder", role: "BUILDER" },
    ];
  }

  if (isClient) {
    return [
      { name: "Client Portal", href: "/dashboard", activePrefix: "/dashboard", role: "CLIENT" },
    ];
  }

  return [];
}

/**
 * Presentation-only navigation switcher for multi-role users.
 *
 * CRITICAL SECURITY INVARIANT:
 * This component NEVER creates authorization state, sets authority cookies,
 * or determines access privileges. It simply renders navigation links.
 * Every target destination (/dashboard, /builder, /admin) independently enforces
 * strict server-side session authentication and database-backed role authorization.
 */
export function RoleSwitcher({ roles }: RoleSwitcherProps) {
  const pathname = usePathname();

  const views = getPortalViews(roles);

  // Only render switcher if user possesses multiple portal views to switch between
  if (views.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Portal views" className="inline-flex bg-white p-1 border-2 border-black neo-shadow-sm gap-1">
      {views.map((view) => {
        const isActive = pathname.startsWith(view.activePrefix);
        return (
          <Link
            key={view.role}
            href={view.href}
            className={`px-3 py-1 text-xs font-black uppercase tracking-wider border-2 transition ${
              isActive
                ? "bg-[#171e19] text-[#ffe17c] border-black"
                : "bg-white text-[#171e19] border-transparent hover:bg-[#ffe17c] hover:border-black"
            }`}
          >
            {view.name}
          </Link>
        );
      })}
    </nav>
  );
}
