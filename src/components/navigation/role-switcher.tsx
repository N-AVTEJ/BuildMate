"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@/lib/auth/session";

interface RoleSwitcherProps {
  roles: UserRole[];
}

/**
 * Presentation-only navigation switcher for multi-role users.
 *
 * CRITICAL SECURITY INVARIANT:
 * This component NEVER creates authorization state, sets authority cookies,
 * or determines access privileges. It simply renders navigation links.
 * Every target destination (/projects, /builder, /admin) independently enforces
 * strict server-side session authentication and database-backed role authorization.
 */
export function RoleSwitcher({ roles }: RoleSwitcherProps) {
  const pathname = usePathname();

  const isClient = roles.includes("CLIENT");
  const isBuilder = roles.includes("BUILDER");
  const isAdmin = roles.includes("ADMIN");

  // Only render switcher if user possesses multiple roles
  const activeRolesCount = [isClient, isBuilder, isAdmin].filter(Boolean).length;
  if (activeRolesCount <= 1) {
    return null;
  }

  const views: Array<{ name: string; href: string; activePrefix: string; role: UserRole }> = [];

  if (isClient) {
    views.push({ name: "Client Portal", href: "/projects", activePrefix: "/projects", role: "CLIENT" });
  }
  if (isBuilder) {
    views.push({ name: "Builder Discovery", href: "/builder", activePrefix: "/builder", role: "BUILDER" });
  }
  if (isAdmin) {
    views.push({ name: "Admin Dashboard", href: "/admin", activePrefix: "/admin", role: "ADMIN" });
  }

  return (
    <nav aria-label="Portal views" className="inline-flex rounded-lg bg-gray-100 p-1 border border-gray-200">
      {views.map((view) => {
        const isActive = pathname.startsWith(view.activePrefix);
        return (
          <Link
            key={view.role}
            href={view.href}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              isActive
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            {view.name}
          </Link>
        );
      })}
    </nav>
  );
}
