import { redirect } from "next/navigation";
import { getOptionalAuth } from "@/lib/auth/guards";

export default async function PortalSelectPage() {
  const auth = await getOptionalAuth();

  if (!auth) {
    redirect("/login");
  }

  const { roles } = auth;

  // Immediately redirect to authorized destination portal
  if (roles.includes("ADMIN")) {
    redirect("/admin");
  } else if (roles.includes("BUILDER")) {
    redirect("/builder");
  } else {
    redirect("/projects");
  }
}
