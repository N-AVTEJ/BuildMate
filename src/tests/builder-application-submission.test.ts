import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as submitApplicationRoute } from "@/app/api/builder-applications/route";
import { GET as getAdminApplicationsRoute } from "@/app/api/admin/builder-applications/route";
import { GET as getResumeRoute } from "@/app/api/admin/builder-applications/[id]/resume/route";
import { GET as downloadFileRoute } from "@/app/api/files/download/route";
import { db } from "@/db";
import { users, userRoles, builderApplications, notifications, sessions } from "@/db/schema";
import { createSession, testRequestContext } from "@/lib/auth/session";
import { eq, inArray } from "drizzle-orm";

describe("Phase 16 — Builder Application Flow & Admin Verification", () => {
  let adminUserId: string;
  let adminToken: string;
  const createdAppIds: string[] = [];

  beforeAll(async () => {
    // Create an admin user for testing notifications and admin endpoints
    const [adminUser] = await db
      .insert(users)
      .values({
        name: "Test Admin P16",
        email: `admin_p16_${Date.now()}@example.com`,
        passwordHash: "hash",
        emailVerified: true,
      })
      .returning();
    adminUserId = adminUser.id;

    await db.insert(userRoles).values({
      userId: adminUserId,
      role: "ADMIN",
    });

    const session = await createSession(adminUserId);
    adminToken = session.rawToken;
  });

  afterAll(async () => {
    if (createdAppIds.length > 0) {
      await db.delete(builderApplications).where(inArray(builderApplications.id, createdAppIds));
    }
    if (adminUserId) {
      await db.delete(notifications).where(eq(notifications.userId, adminUserId));
      await db.delete(sessions).where(eq(sessions.userId, adminUserId));
      await db.delete(userRoles).where(eq(userRoles.userId, adminUserId));
      await db.delete(users).where(eq(users.id, adminUserId));
    }
  });

  it("1. Applicant can successfully submit application with PDF resume (mimicking user screenshot)", async () => {
    // Construct valid PDF buffer with %PDF- header
    const validPdfBuffer = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.from("1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"),
    ]);

    const formData = new FormData();
    formData.append("name", "Atharva Sanpurkar");
    formData.append("email", `atharva_${Date.now()}@example.com`);
    formData.append("message", "Full-stack engineer with React & Node.js experience.");
    formData.append("githubUrl", "https://github.com/atharva");
    formData.append(
      "resume",
      new Blob([validPdfBuffer], { type: "application/pdf" }),
      "SE LR 2 OG.pdf"
    );

    const req = new Request("http://localhost:3000/api/builder-applications", {
      method: "POST",
      body: formData,
    });

    const res = await submitApplicationRoute(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.id).toBeDefined();
    createdAppIds.push(data.id);

    // Verify record in database
    const [saved] = await db
      .select()
      .from(builderApplications)
      .where(eq(builderApplications.id, data.id));

    expect(saved).toBeDefined();
    expect(saved.name).toBe("Atharva Sanpurkar");
    expect(saved.status).toBe("PENDING");
    expect(saved.resumeUrl).toBeDefined();

    // Verify admin in-app notification was dispatched
    const adminNotifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, adminUserId));

    const relevantNotif = adminNotifs.find((n) => n.message.includes("Atharva Sanpurkar"));
    expect(relevantNotif).toBeDefined();
  });

  it("2. Admin can view applications queue with limit and filter", async () => {
    const req = new Request("http://localhost:3000/api/admin/builder-applications?limit=20&offset=0", {
      method: "GET",
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${adminToken}` },
      () => getAdminApplicationsRoute(req)
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.applications)).toBe(true);
    expect(data.applications.length).toBeGreaterThan(0);

    const found = data.applications.find((a: any) => a.id === createdAppIds[0]);
    expect(found).toBeDefined();
    expect(found.name).toBe("Atharva Sanpurkar");
  });

  it("3. Admin can retrieve and download applicant resume without crashing", async () => {
    const appId = createdAppIds[0];
    const req = new Request(`http://localhost:3000/api/admin/builder-applications/${appId}/resume`, {
      method: "GET",
    });

    const res = await testRequestContext.run(
      { cookie: `buildmate_session=${adminToken}` },
      () => getResumeRoute(req, { params: Promise.resolve({ id: appId }) })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.downloadUrl).toBeDefined();

    // Now test downloading from the local/tmp file handler
    const downloadReq = new Request(`http://localhost:3000${data.downloadUrl}`, {
      method: "GET",
    });

    const downloadRes = await downloadFileRoute(downloadReq);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");
    const downloadedArrayBuffer = await downloadRes.arrayBuffer();
    expect(downloadedArrayBuffer.byteLength).toBeGreaterThan(0);
  });
});
