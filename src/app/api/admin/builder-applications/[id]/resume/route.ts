import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { builderApplications } from "@/db/schema";
import { requireRole } from "@/lib/auth/guards";
import { getDownloadUrl } from "@/lib/storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Centralized Authorization: ADMIN only
    await requireRole(["ADMIN"]);

    const { id: applicationId } = await params;
    if (!applicationId) {
      return NextResponse.json({ error: "Application ID is required." }, { status: 400 });
    }

    const [app] = await db
      .select({
        id: builderApplications.id,
        resumeUrl: builderApplications.resumeUrl,
        name: builderApplications.name,
      })
      .from(builderApplications)
      .where(eq(builderApplications.id, applicationId))
      .limit(1);

    if (!app || !app.resumeUrl) {
      return NextResponse.json({ error: "Resume not found for application." }, { status: 404 });
    }

    // 2. Generate signed short-TTL download URL (300 seconds / 5 mins)
    const downloadUrl = await getDownloadUrl(app.resumeUrl, 300);

    const url = new URL(req.url);
    const redirectParam = url.searchParams.get("redirect");

    if (redirectParam === "true") {
      return NextResponse.redirect(downloadUrl);
    }

    return NextResponse.json({
      success: true,
      downloadUrl,
    });
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Admin/BuilderApplications/Resume] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to generate resume download URL." }, { status: 500 });
  }
}
