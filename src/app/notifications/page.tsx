import { redirect } from "next/navigation";
import { getOptionalAuth } from "@/lib/auth/guards";
import { PortalHeader } from "@/components/navigation/portal-header";
import { NotificationsView } from "@/components/notifications/notifications-view";

export default async function NotificationsPage() {
  const auth = await getOptionalAuth();
  if (!auth) {
    redirect("/login");
  }

  const portalTitle = auth.roles.includes("BUILDER")
    ? "Builder Portal"
    : auth.roles.includes("ADMIN")
    ? "Admin Portal"
    : "Client Portal";

  return (
    <div className="min-h-screen bg-[#fffdf0] neo-dots">
      <PortalHeader
        user={auth.user}
        roles={auth.roles}
        currentPortalTitle={portalTitle}
      />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <NotificationsView />
      </main>
    </div>
  );
}
