import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";

// Mock next/headers for route testing
vi.mock("next/headers", () => {
  const cookieMap = new Map<string, any>();
  return {
    cookies: vi.fn(async () => ({
      get: vi.fn((name: string) => cookieMap.get(name)),
      set: vi.fn((name: string, val: any, opts: any) => cookieMap.set(name, { value: val, ...opts })),
      delete: vi.fn((name: string) => cookieMap.delete(name)),
    })),
    headers: vi.fn(async () => new Headers()),
  };
});

// Mock web-push before importing notify
const mockSendNotification = vi.fn();
const mockSetVapidDetails = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: any[]) => mockSetVapidDetails(...args),
    sendNotification: (...args: any[]) => mockSendNotification(...args),
  },
}));

import { db } from "@/db";
import {
  users,
  userRoles,
  projects,
  quotations,
  notifications,
  pushSubscriptions,
  notificationPrefs,
} from "@/db/schema";
import { eq, inArray, and, isNull } from "drizzle-orm";
import { createSession, testRequestContext } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { notify, sendWebPushForUser, sanitizeNotificationText, sanitizeTitle } from "@/lib/notify";
import { POST as subscribeRoute } from "@/app/api/push/subscribe/route";
import { POST as unsubscribeRoute } from "@/app/api/push/unsubscribe/route";
import { POST as testPushRoute } from "@/app/api/push/test/route";
import { GET as getNotificationsRoute } from "@/app/api/notifications/route";
import { POST as readNotificationRoute } from "@/app/api/notifications/[id]/read/route";
import { POST as readAllRoute } from "@/app/api/notifications/read-all/route";
import { GET as getPrefsRoute, PATCH as patchPrefsRoute } from "@/app/api/notifications/prefs/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { POST as submitQuotationRoute } from "@/app/api/projects/[id]/quotation/route";

describe("Web Push & Notification System (VAPID + Drizzle + Security Invariants)", () => {
  const testRunId = `push_${Date.now()}`;
  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];

  let userA: { id: string; rawToken: string; email: string };
  let userB: { id: string; rawToken: string; email: string };
  let builderUser: { id: string; rawToken: string; email: string };

  beforeAll(async () => {
    // Ensure test environment VAPID keys
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      "BOiti21lZfsj3nWBhCIGF80GTXiNepvRF6BhWgfgRP8JLTqOWBysX8ZKFvJHsvuzSDtSZDl6n7WY4Cpjy4su2Gs";
    process.env.VAPID_PRIVATE_KEY =
      process.env.VAPID_PRIVATE_KEY || "YECKpIhuxn606Tr8fjN1u-thew3TxhPBOJwmmBtDJqQ";
    process.env.VAPID_SUBJECT = "mailto:test@buildmate.internal";

    const passwordHash = await hashPassword("TestPass123!");

    // 1. Create User A (Client)
    const [uA] = await db
      .insert(users)
      .values({
        name: "User A (Client)",
        email: `usera_${testRunId}@test.buildmate`,
        passwordHash,
        emailVerified: true,
      })
      .returning();
    createdUserIds.push(uA.id);
    await db.insert(userRoles).values({ userId: uA.id, role: "CLIENT" });
    const sA = await createSession(uA.id);
    userA = { id: uA.id, rawToken: sA.rawToken, email: uA.email };

    // 2. Create User B (Another Client)
    const [uB] = await db
      .insert(users)
      .values({
        name: "User B (Client)",
        email: `userb_${testRunId}@test.buildmate`,
        passwordHash,
        emailVerified: true,
      })
      .returning();
    createdUserIds.push(uB.id);
    await db.insert(userRoles).values({ userId: uB.id, role: "CLIENT" });
    const sB = await createSession(uB.id);
    userB = { id: uB.id, rawToken: sB.rawToken, email: uB.email };

    // 3. Create Builder User
    const [bU] = await db
      .insert(users)
      .values({
        name: "Builder User",
        email: `builder_${testRunId}@test.buildmate`,
        passwordHash,
        emailVerified: true,
      })
      .returning();
    createdUserIds.push(bU.id);
    await db.insert(userRoles).values({ userId: bU.id, role: "BUILDER" });
    const sBuilder = await createSession(bU.id);
    builderUser = { id: bU.id, rawToken: sBuilder.rawToken, email: bU.email };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendNotification.mockResolvedValue({ statusCode: 201 });
  });

  afterAll(async () => {
    // Cleanup projects, notifications, and users
    if (createdProjectIds.length > 0) {
      await db.delete(projects).where(inArray(projects.id, createdProjectIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  describe("1. Sanitization & Rule Compliance", () => {
    it("never permits the word 'escrow' anywhere in notification text or titles", () => {
      const sanitizedT = sanitizeTitle("Escrow Funds Released");
      expect(sanitizedT.toLowerCase()).not.toContain("escrow");
      expect(sanitizedT).toBe("Platform Funds Released");

      const sanitizedB = sanitizeNotificationText("Your funds are deposited in escrow for safe release.");
      expect(sanitizedB.toLowerCase()).not.toContain("escrow");
      expect(sanitizedB).toContain("secure milestone");
    });

    it("redacts raw URLs from notification body to prevent payload leakage", () => {
      const textWithUrls = "Please inspect https://github.com/secret/repo and https://s3.aws.com/proof.pdf";
      const sanitized = sanitizeNotificationText(textWithUrls);
      expect(sanitized).not.toContain("https://github.com");
      expect(sanitized).not.toContain("https://s3.aws.com");
      expect(sanitized).toContain("[link]");
    });
  });

  describe("2. Unit: notify() & sendWebPushForUser()", () => {
    it("inserts in-app notification row and delivers push notification to active subscription", async () => {
      // Register subscription for User A
      const endpoint = `https://fcm.googleapis.com/fcm/send/test-sub-1-${Date.now()}`;
      await db.insert(pushSubscriptions).values({
        userId: userA.id,
        endpoint,
        p256dh: "mock_p256dh_key",
        auth: "mock_auth_secret",
      });

      const notif = await notify(userA.id, "QUOTATION_RECEIVED", {
        title: "New quotation received",
        body: "A builder submitted a quote for your project.",
        url: "/projects/123/quotation",
      });

      expect(notif.id).toBeDefined();
      expect(notif.userId).toBe(userA.id);
      expect(notif.type).toBe("QUOTATION_RECEIVED");
      expect(notif.read).toBe(false);
      expect(notif.readAt).toBeNull();

      // Flush async dispatch
      await sendWebPushForUser(userA.id, "QUOTATION_RECEIVED", {
        title: notif.title,
        body: notif.body,
        url: notif.url,
      });

      expect(mockSendNotification).toHaveBeenCalled();
      const [targetSub, payloadStr] = mockSendNotification.mock.calls[0];
      expect(targetSub.endpoint).toBe(endpoint);
      const parsedPayload = JSON.parse(payloadStr);
      expect(parsedPayload.title).toBe("New quotation received");
      expect(parsedPayload.data.url).toBe("/projects/123/quotation");
    });

    it("marks subscription revoked on 410 Gone / 404 Not Found web-push response", async () => {
      // Clear any prior subscriptions for userA to isolate this test
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userA.id));

      const staleEndpoint = `https://fcm.googleapis.com/fcm/send/stale-sub-${Date.now()}`;
      const [sub] = await db
        .insert(pushSubscriptions)
        .values({
          userId: userA.id,
          endpoint: staleEndpoint,
          p256dh: "stale_key",
          auth: "stale_auth",
        })
        .returning();

      // Mock 410 Gone
      mockSendNotification.mockRejectedValueOnce({ statusCode: 410, message: "Subscription expired" });

      const res = await sendWebPushForUser(userA.id, "QUOTATION_RECEIVED", {
        title: "Test 410",
        body: "Testing stale subscription revocation",
      });

      expect(res.revoked).toBe(1);

      // Verify row in DB is marked revoked
      const [updatedSub] = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.id, sub.id))
        .limit(1);

      expect(updatedSub.revokedAt).not.toBeNull();
    });

    it("respects preferences: suppresses push when pref is disabled, but still inserts in-app notification", async () => {
      // Disable quotationUpdates for User A
      await db
        .insert(notificationPrefs)
        .values({
          userId: userA.id,
          pushEnabled: true,
          quotationUpdates: false,
          paymentUpdates: true,
        })
        .onConflictDoUpdate({
          target: notificationPrefs.userId,
          set: { quotationUpdates: false },
        });

      mockSendNotification.mockClear();

      const notif = await notify(userA.id, "QUOTATION_RECEIVED", {
        title: "Quotation Notice",
        body: "Quotation received with pref off",
      });

      // Notification row must still exist for in-app bell
      expect(notif.id).toBeDefined();

      const pushResult = await sendWebPushForUser(userA.id, "QUOTATION_RECEIVED", {
        title: notif.title,
        body: notif.body,
      });

      expect(pushResult.sent).toBe(0);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it("mandatory/forced types (payment/security) always dispatch push even if pushEnabled is false", async () => {
      // Ensure User A has an active subscription
      await db.insert(pushSubscriptions).values({
        userId: userA.id,
        endpoint: `https://fcm.googleapis.com/fcm/send/active-user-a-${Date.now()}`,
        p256dh: "key_a",
        auth: "auth_a",
      });

      // Turn off master push for User A
      await db
        .update(notificationPrefs)
        .set({ pushEnabled: false })
        .where(eq(notificationPrefs.userId, userA.id));

      mockSendNotification.mockClear();

      const pushResult = await sendWebPushForUser(userA.id, "PAYMENT_VERIFIED", {
        title: "Payment verified",
        body: "Milestone payment confirmed.",
      });

      expect(pushResult.sent).toBeGreaterThanOrEqual(1);
      expect(mockSendNotification).toHaveBeenCalled();
    });
  });

  describe("3. Security Invariants", () => {
    it("Invariant: User A cannot read User B's notifications", async () => {
      // Insert notification for User B
      const [notifB] = await db
        .insert(notifications)
        .values({
          userId: userB.id,
          title: "User B Secret Alert",
          body: "Only User B should ever see this.",
          message: "User B Secret Alert",
        })
        .returning();

      // Query notifications as User A
      const req = new Request("http://localhost:3000/api/notifications");
      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${userA.rawToken}` },
        () => getNotificationsRoute(req)
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const containsUserBNotif = data.notifications.some((n: any) => n.id === notifB.id);
      expect(containsUserBNotif).toBe(false);
    });

    it("Invariant: User A cannot mark User B's notification as read", async () => {
      const [notifB] = await db
        .insert(notifications)
        .values({
          userId: userB.id,
          title: "User B Unread Alert",
          body: "Pending action for User B.",
          message: "User B Unread Alert",
          read: false,
        })
        .returning();

      // User A attempts to mark User B's notification read
      const req = new Request(`http://localhost:3000/api/notifications/${notifB.id}/read`, {
        method: "POST",
      });
      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${userA.rawToken}` },
        () => readNotificationRoute(req, { params: Promise.resolve({ id: notifB.id }) })
      );

      expect(res.status).toBe(404);

      // Verify notification remains unread in database
      const [check] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, notifB.id))
        .limit(1);

      expect(check.read).toBe(false);
      expect(check.readAt).toBeNull();
    });

    it("Invariant: User A cannot unsubscribe User B's push subscription", async () => {
      const endpointB = `https://fcm.googleapis.com/fcm/send/user-b-sub-${Date.now()}`;
      const [subB] = await db
        .insert(pushSubscriptions)
        .values({
          userId: userB.id,
          endpoint: endpointB,
          p256dh: "keyB",
          auth: "authB",
        })
        .returning();

      // User A attempts to unsubscribe User B's endpoint
      const req = new Request("http://localhost:3000/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: endpointB }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${userA.rawToken}` },
        () => unsubscribeRoute(req)
      );

      expect(res.status).toBe(200);

      // Verify User B's subscription is NOT revoked
      const [checkSub] = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.id, subB.id))
        .limit(1);

      expect(checkSub.revokedAt).toBeNull();
    });

    it("Invariant: Endpoint spoofing (passing foreign userId in subscribe payload is ignored)", async () => {
      const spoofEndpoint = `https://fcm.googleapis.com/fcm/send/spoof-sub-${Date.now()}`;
      const req = new Request("http://localhost:3000/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: spoofEndpoint,
          keys: {
            p256dh: "spoof_key",
            auth: "spoof_auth",
          },
          userId: userB.id, // Attacker passes User B's ID
        }),
      });

      // Executed as User A
      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${userA.rawToken}` },
        () => subscribeRoute(req)
      );

      expect(res.status).toBe(200);

      const [stored] = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, spoofEndpoint))
        .limit(1);

      expect(stored).toBeDefined();
      // Must be bound to authenticated session user (User A), NOT spoofed User B
      expect(stored.userId).toBe(userA.id);
      expect(stored.userId).not.toBe(userB.id);
    });

    it("Invariant: Logout revokes push subscription for the specific device", async () => {
      const deviceEndpoint = `https://fcm.googleapis.com/fcm/send/device-logout-${Date.now()}`;
      const [devSub] = await db
        .insert(pushSubscriptions)
        .values({
          userId: userA.id,
          endpoint: deviceEndpoint,
          p256dh: "dev_key",
          auth: "dev_auth",
        })
        .returning();

      expect(devSub.revokedAt).toBeNull();

      // Logout request carrying endpoint
      const req = new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: deviceEndpoint }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${userA.rawToken}` },
        () => logoutRoute(req)
      );

      expect(res.status).toBe(200);

      const [updatedSub] = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.id, devSub.id))
        .limit(1);

      expect(updatedSub.revokedAt).not.toBeNull();
    });
  });

  describe("4. Integration: Quotation Created -> Notification & Push", () => {
    it("submitting a quotation notifies CLIENT only from DB ownership", async () => {
      // 1. Create a project owned by User A with builderUser assigned
      const [proj] = await db
        .insert(projects)
        .values({
          projectCode: `PRJ-PUSH-${Date.now().toString().slice(-4)}`,
          clientId: userA.id,
          builderId: builderUser.id,
          title: "Push Test Project",
          subject: "Mobile App",
          description: "Testing quotation push dispatch",
          techStack: "Flutter",
          budgetMin: 50000,
          budgetMax: 100000,
          status: "ACCEPTED_PENDING_QUOTE",
        })
        .returning();
      createdProjectIds.push(proj.id);

      mockSendNotification.mockClear();

      // 2. Builder submits quotation
      const quoteReq = new Request(`http://localhost:3000/api/projects/${proj.id}/quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalPrice: 60000,
          estimatedDurationDays: 14,
        }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${builderUser.rawToken}` },
        () => submitQuotationRoute(quoteReq, { params: Promise.resolve({ id: proj.id }) })
      );

      expect(res.status).toBe(200);

      // 3. Verify notification row was created for User A (client)
      const [clientNotif] = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userA.id),
            eq(notifications.projectId, proj.id),
            eq(notifications.type, "QUOTATION_RECEIVED")
          )
        )
        .limit(1);

      expect(clientNotif).toBeDefined();
      expect(clientNotif.title).toBe("New quotation received");
      expect(clientNotif.url).toBe(`/projects/${proj.id}/quotation`);

      // Verify NO quotation received notification was created for the builder
      const [builderNotif] = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, builderUser.id),
            eq(notifications.projectId, proj.id),
            eq(notifications.type, "QUOTATION_RECEIVED")
          )
        )
        .limit(1);

      expect(builderNotif).toBeUndefined();
    });
  });

  describe("5. Pagination & Preference Management", () => {
    it("paginates notifications with cursor and returns unreadCount", async () => {
      // Seed 3 notifications for User B
      for (let i = 1; i <= 3; i++) {
        await db.insert(notifications).values({
          userId: userB.id,
          title: `Paginated Alert ${i}`,
          body: `Notification batch test item ${i}`,
          message: `Paginated Alert ${i}`,
          read: false,
        });
      }

      // Query first page with limit=2
      const req = new Request("http://localhost:3000/api/notifications?limit=2");
      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${userB.rawToken}` },
        () => getNotificationsRoute(req)
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.notifications.length).toBe(2);
      expect(data.hasMore).toBe(true);
      expect(data.nextCursor).toBeDefined();
      expect(data.unreadCount).toBeGreaterThanOrEqual(3);

      // Query next page with cursor
      const nextReq = new Request(`http://localhost:3000/api/notifications?limit=2&cursor=${data.nextCursor}`);
      const nextRes = await testRequestContext.run(
        { cookie: `buildmate_session=${userB.rawToken}` },
        () => getNotificationsRoute(nextReq)
      );

      expect(nextRes.status).toBe(200);
      const nextData = await nextRes.json();
      expect(nextData.notifications.length).toBeGreaterThanOrEqual(1);
    });

    it("snoozes notifications for 7 days via preferences API", async () => {
      const req = new Request("http://localhost:3000/api/notifications/prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snoozeDays: 7 }),
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${userB.rawToken}` },
        () => patchPrefsRoute(req)
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.prefs.snoozedUntil).toBeDefined();

      const snoozedDate = new Date(data.prefs.snoozedUntil);
      const expectedMin = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
      expect(snoozedDate.getTime()).toBeGreaterThan(expectedMin.getTime());
    });

    it("read-all marks all unread notifications read for the session user", async () => {
      const req = new Request("http://localhost:3000/api/notifications/read-all", {
        method: "POST",
      });

      const res = await testRequestContext.run(
        { cookie: `buildmate_session=${userB.rawToken}` },
        () => readAllRoute()
      );

      expect(res.status).toBe(200);

      // Verify unread count is now 0 for User B
      const unread = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userB.id),
            eq(notifications.read, false)
          )
        );

      expect(unread.length).toBe(0);
    });
  });
});
