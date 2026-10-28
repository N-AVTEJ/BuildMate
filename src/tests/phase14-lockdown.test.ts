import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/db";
import { users, userRoles, builderApplications, notifications, sessions } from "@/db/schema";
import { eq, inArray, and, desc, like, not } from "drizzle-orm";
import { POST as builderApplicationsRoute } from "@/app/api/builder-applications/route";
import { GET as adminGetApplicationsRoute } from "@/app/api/admin/builder-applications/route";
import { PATCH as adminPatchApplicationRoute } from "@/app/api/admin/builder-applications/[id]/route";
import { GET as adminGetResumeRoute } from "@/app/api/admin/builder-applications/[id]/resume/route";
import { GET as googleCallbackRoute } from "@/app/api/auth/google/callback/route";
import { createSession, testRequestContext } from "@/lib/auth/session";
import * as googleAuthModule from "@/lib/auth/google";

describe("Phase 14 — Builder/Admin Lockdown & Application Flow Invariant Suite", () => {
  const testRunId = `p14_${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdAppIds: string[] = [];

  let adminUserId: string;
  let adminSessionToken: string;

  let clientUserId: string;
  let clientSessionToken: string;

  beforeAll(async () => {
    // 1. Ensure master admin user exists with ADMIN and BUILDER roles
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "madipadiganavtej@gmail.com"))
      .limit(1);

    if (adminUser) {
      adminUserId = adminUser.id;
    } else {
      const [newAdmin] = await db
        .insert(users)
        .values({
          name: "Navtej Madipadi",
          email: "madipadiganavtej@gmail.com",
          emailVerified: true,
        })
        .returning();
      adminUserId = newAdmin.id;
      createdUserIds.push(newAdmin.id);
    }

    // Ensure ADMIN & BUILDER roles exist for master admin
    for (const role of ["ADMIN", "BUILDER"] as const) {
      const [existing] = await db
        .select()
        .from(userRoles)
        .where(and(eq(userRoles.userId, adminUserId), eq(userRoles.role, role)))
        .limit(1);

      if (!existing) {
        await db.insert(userRoles).values({ userId: adminUserId, role });
      }
    }

    const adminSession = await createSession(adminUserId);
    adminSessionToken = adminSession.rawToken;

    // 2. Create regular CLIENT user for negative authorization checks
    const [clientUser] = await db
      .insert(users)
      .values({
        name: "Standard Client",
        email: `client_${testRunId}@example.com`,
        emailVerified: true,
      })
      .returning();
    clientUserId = clientUser.id;
    createdUserIds.push(clientUserId);

    await db.insert(userRoles).values({ userId: clientUserId, role: "CLIENT" });
    const clientSession = await createSession(clientUserId);
    clientSessionToken = clientSession.rawToken;
  });

  afterAll(async () => {
    if (createdAppIds.length > 0) {
      await db.delete(builderApplications).where(inArray(builderApplications.id, createdAppIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(sessions).where(inArray(sessions.userId, createdUserIds));
      await db.delete(userRoles).where(inArray(userRoles.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("1. Database invariant: madipadiganavtej@gmail.com is provisioned with both ADMIN and BUILDER roles", async () => {
    const adminRoles = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, adminUserId));

    const roleNames = adminRoles.map((r) => r.role);
    expect(roleNames).toContain("ADMIN");
    expect(roleNames).toContain("BUILDER");

    // Any permanent non-ephemeral user possessing ADMIN or BUILDER must be madipadiganavtej@gmail.com
    const permanentPrivileged = await db
      .select({ email: users.email, role: userRoles.role })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          inArray(userRoles.role, ["ADMIN", "BUILDER"]),
          not(like(users.email, "%_179%")),
          not(like(users.email, "%@example.com")),
          not(like(users.email, "%@buildmate.test"))
        )
      );

    for (const row of permanentPrivileged) {
      expect(row.email).toBe("madipadiganavtej@gmail.com");
    }
  });

  it("2. Google OAuth sign-in for new user strictly grants CLIENT only, never BUILDER or ADMIN", async () => {
    const newOAuthEmail = `new_oauth_${testRunId}@example.com`;
    const googleSub = `sub_${testRunId}_new`;
    const state = `state_${testRunId}_new`;

    vi.spyOn(googleAuthModule, "exchangeGoogleCode").mockResolvedValueOnce({
      access_token: "mock_token",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "openid email profile",
    });

    vi.spyOn(googleAuthModule, "getGoogleUserInfo").mockResolvedValueOnce({
      sub: googleSub,
      email: newOAuthEmail,
      name: "New OAuth Applicant",
      picture: undefined,
      email_verified: true,
    });

    const cookieHeader = `google_oauth_state=${JSON.stringify({ state, returnTo: "/dashboard" })}`;
    const req = new Request(
      `http://localhost:3000/api/auth/google/callback?code=mock_code&state=${state}`,
      { headers: { Cookie: cookieHeader } }
    );

    const res = await googleCallbackRoute(req);
    expect(res.status).toBe(307);

    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, newOAuthEmail))
      .limit(1);

    expect(newUser).toBeDefined();
    createdUserIds.push(newUser.id);

    const roles = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, newUser.id));

    expect(roles.length).toBe(1);
    expect(roles[0].role).toBe("CLIENT");
    expect(roles.some((r) => r.role === "BUILDER")).toBe(false);
    expect(roles.some((r) => r.role === "ADMIN")).toBe(false);
  });

  it("3. State-tampering attempt with ?role=BUILDER&role=ADMIN on OAuth callback is completely ignored", async () => {
    const tamperedEmail = `tampered_${testRunId}@example.com`;
    const googleSub = `sub_${testRunId}_tampered`;
    const state = `state_${testRunId}_tampered`;

    vi.spyOn(googleAuthModule, "exchangeGoogleCode").mockResolvedValueOnce({
      access_token: "mock_token",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "openid email profile",
    });

    vi.spyOn(googleAuthModule, "getGoogleUserInfo").mockResolvedValueOnce({
      sub: googleSub,
      email: tamperedEmail,
      name: "Tamper Applicant",
      picture: undefined,
      email_verified: true,
    });

    const cookieHeader = `google_oauth_state=${JSON.stringify({ state, returnTo: "/admin" })}`;
    const req = new Request(
      `http://localhost:3000/api/auth/google/callback?code=mock_code&state=${state}&role=ADMIN&role=BUILDER`,
      { headers: { Cookie: cookieHeader } }
    );

    const res = await googleCallbackRoute(req);
    expect(res.status).toBe(307);

    const [createdUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, tamperedEmail))
      .limit(1);

    expect(createdUser).toBeDefined();
    createdUserIds.push(createdUser.id);

    const roles = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, createdUser.id));

    expect(roles.length).toBe(1);
    expect(roles[0].role).toBe("CLIENT");
  });

  it("4. POST /api/builder-applications creates NO user account and NO role (application record only)", async () => {
    const applicantEmail = `applicant_${testRunId}@example.com`;
    const applicantName = "Alex Builder Applicant";

    // Create a mock valid PDF file buffer (%PDF- header)
    const pdfBuffer = Buffer.from("%PDF-1.4\n%mock valid pdf content for builder application\n%%EOF");
    const formData = new FormData();
    formData.append("name", applicantName);
    formData.append("email", applicantEmail);
    formData.append("githubUrl", "https://github.com/alex-builder");
    formData.append("message", "Full-stack engineer with 5 years experience in Next.js and Postgres.");
    const file = new File([pdfBuffer], "resume.pdf", { type: "application/pdf" });
    formData.append("resume", file);

    const req = new Request("http://localhost:3000/api/builder-applications", {
      method: "POST",
      body: formData,
    });

    const res = await builderApplicationsRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.id).toBeDefined();
    createdAppIds.push(data.id);

    // Verify application stored in builder_applications with status PENDING
    const [app] = await db
      .select()
      .from(builderApplications)
      .where(eq(builderApplications.id, data.id))
      .limit(1);

    expect(app).toBeDefined();
    expect(app.name).toBe(applicantName);
    expect(app.email).toBe(applicantEmail);
    expect(app.status).toBe("PENDING");
    expect(app.resumeUrl).toBeDefined();
    expect(app.githubUrl).toBe("https://github.com/alex-builder");

    // CRITICAL SECURITY INVARIANT: NO user account and NO role were created!
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.email, applicantEmail))
      .limit(1);

    expect(userRecord).toBeUndefined();
  });

  it("5. POST /api/builder-applications rejects unapproved file formats (.txt, .exe, invalid magic bytes)", async () => {
    const invalidBuffer = Buffer.from("Plain text content without PDF or DOCX signature");
    const formData = new FormData();
    formData.append("name", "Malicious Attacker");
    formData.append("email", `attacker_${testRunId}@example.com`);
    const file = new File([invalidBuffer], "malware.exe", { type: "application/x-msdownload" });
    formData.append("resume", file);

    const req = new Request("http://localhost:3000/api/builder-applications", {
      method: "POST",
      body: formData,
    });

    const res = await builderApplicationsRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Only PDF (.pdf) and Word documents (.docx) are permitted");
  });

  it("6. GET /api/admin/builder-applications is strictly forbidden to non-admin users", async () => {
    // Attempt request with CLIENT session
    const req = new Request("http://localhost:3000/api/admin/builder-applications");
    const res = await testRequestContext.run(
      { token: clientSessionToken },
      async () => await adminGetApplicationsRoute(req)
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Forbidden");
  });

  it("7. Admin can view applications and approve an application without auto-provisioning", async () => {
    // 1. Create a test application
    const [newApp] = await db
      .insert(builderApplications)
      .values({
        name: "Pending Candidate",
        email: `candidate_${testRunId}@example.com`,
        resumeUrl: "mock-storage-key.pdf",
        status: "PENDING",
      })
      .returning();
    createdAppIds.push(newApp.id);

    // 2. Admin retrieves list of applications
    const listReq = new Request("http://localhost:3000/api/admin/builder-applications");
    const listRes = await testRequestContext.run(
      { token: adminSessionToken },
      async () => await adminGetApplicationsRoute(listReq)
    );

    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.applications.some((a: any) => a.id === newApp.id)).toBe(true);

    // 3. Admin approves application
    const approveReq = new Request(`http://localhost:3000/api/admin/builder-applications/${newApp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVE" }),
    });

    const approveRes = await testRequestContext.run(
      { token: adminSessionToken },
      async () => await adminPatchApplicationRoute(approveReq, { params: Promise.resolve({ id: newApp.id }) })
    );

    expect(approveRes.status).toBe(200);
    const approveData = await approveRes.json();
    expect(approveData.success).toBe(true);
    expect(approveData.application.status).toBe("APPROVED");

    // Verify DB row status is APPROVED
    const [updatedApp] = await db
      .select()
      .from(builderApplications)
      .where(eq(builderApplications.id, newApp.id))
      .limit(1);
    expect(updatedApp.status).toBe("APPROVED");

    // Invariant: Approve action does NOT create a user or grant a role automatically
    const [userRecord] = await db
      .select()
      .from(users)
      .where(eq(users.email, `candidate_${testRunId}@example.com`))
      .limit(1);
    expect(userRecord).toBeUndefined();

    // Verify notification was sent to admin with manual provisioning instruction
    const [notif] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, adminUserId),
          like(notifications.message, `%${newApp.email}%`)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(1);
    expect(notif).toBeDefined();
    expect(notif.message).toContain("APPROVED");
    expect(notif.message).toContain("scripts/provision-builder.ts");
  });

  it("8. Admin can reject an application", async () => {
    const [newApp] = await db
      .insert(builderApplications)
      .values({
        name: "Reject Candidate",
        email: `reject_${testRunId}@example.com`,
        resumeUrl: "mock-storage-key.pdf",
        status: "PENDING",
      })
      .returning();
    createdAppIds.push(newApp.id);

    const rejectReq = new Request(`http://localhost:3000/api/admin/builder-applications/${newApp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REJECT" }),
    });

    const rejectRes = await testRequestContext.run(
      { token: adminSessionToken },
      async () => await adminPatchApplicationRoute(rejectReq, { params: Promise.resolve({ id: newApp.id }) })
    );

    expect(rejectRes.status).toBe(200);
    const rejectData = await rejectRes.json();
    expect(rejectData.application.status).toBe("REJECTED");

    const [updatedApp] = await db
      .select()
      .from(builderApplications)
      .where(eq(builderApplications.id, newApp.id))
      .limit(1);
    expect(updatedApp.status).toBe("REJECTED");
  });

  it("9. Admin can fetch signed short-TTL download URL for applicant resume", async () => {
    const [appWithResume] = await db
      .insert(builderApplications)
      .values({
        name: "Resume Candidate",
        email: `resume_candidate_${testRunId}@example.com`,
        resumeUrl: "proofs/mock-resume-key.pdf",
        status: "PENDING",
      })
      .returning();
    createdAppIds.push(appWithResume.id);

    const resumeReq = new Request(`http://localhost:3000/api/admin/builder-applications/${appWithResume.id}/resume`);
    const resumeRes = await testRequestContext.run(
      { token: adminSessionToken },
      async () => await adminGetResumeRoute(resumeReq, { params: Promise.resolve({ id: appWithResume.id }) })
    );

    expect(resumeRes.status).toBe(200);
    const data = await resumeRes.json();
    expect(data.success).toBe(true);
    expect(data.downloadUrl).toBeDefined();
    expect(typeof data.downloadUrl).toBe("string");
  });
});
