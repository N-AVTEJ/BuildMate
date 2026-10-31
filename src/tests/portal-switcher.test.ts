import { describe, it, expect } from "vitest";
import { getPortalViews } from "@/components/navigation/role-switcher";
import { formatHeaderRoleBadge } from "@/components/navigation/portal-header";
import { UserRole } from "@/lib/auth/session";

describe("Phase 15 Task 1 — Portal Switcher & Role Badge Invariants", () => {
  describe("getPortalViews", () => {
    it("returns Builder and Admin portals for admin user, strictly excluding Client portal even if CLIENT role exists", () => {
      // Case 1: Owner user with all 3 roles present in DB
      const viewsAll = getPortalViews(["BUILDER", "CLIENT", "ADMIN"]);
      expect(viewsAll).toHaveLength(2);
      expect(viewsAll.map((v) => v.role)).toEqual(["BUILDER", "ADMIN"]);
      expect(viewsAll.map((v) => v.name)).toEqual(["Builder Portal", "Admin Portal"]);
      expect(viewsAll.some((v) => v.role === "CLIENT")).toBe(false);

      // Case 2: User with only ADMIN role
      const viewsAdminOnly = getPortalViews(["ADMIN"]);
      expect(viewsAdminOnly).toHaveLength(2);
      expect(viewsAdminOnly.map((v) => v.role)).toEqual(["BUILDER", "ADMIN"]);
      expect(viewsAdminOnly.some((v) => v.role === "CLIENT")).toBe(false);
    });

    it("returns Builder Portal only for builder without ADMIN, strictly omitting Admin portal", () => {
      // Case 1: Builder only
      const viewsBuilder = getPortalViews(["BUILDER"]);
      expect(viewsBuilder).toHaveLength(1);
      expect(viewsBuilder[0].role).toBe("BUILDER");
      expect(viewsBuilder.some((v) => v.role === "ADMIN")).toBe(false);
      expect(viewsBuilder.some((v) => v.role === "CLIENT")).toBe(false);

      // Case 2: Builder with stale client role but NO admin
      const viewsBuilderWithClient = getPortalViews(["BUILDER", "CLIENT"]);
      expect(viewsBuilderWithClient).toHaveLength(1);
      expect(viewsBuilderWithClient[0].role).toBe("BUILDER");
      expect(viewsBuilderWithClient.some((v) => v.role === "ADMIN")).toBe(false);
      expect(viewsBuilderWithClient.some((v) => v.role === "CLIENT")).toBe(false);
    });

    it("returns Client Portal only for client-only user without ADMIN or BUILDER", () => {
      const viewsClient = getPortalViews(["CLIENT"]);
      expect(viewsClient).toHaveLength(1);
      expect(viewsClient[0].role).toBe("CLIENT");
      expect(viewsClient.some((v) => v.role === "ADMIN")).toBe(false);
      expect(viewsClient.some((v) => v.role === "BUILDER")).toBe(false);
    });

    it("returns empty views when roles array is empty", () => {
      const viewsEmpty = getPortalViews([] as UserRole[]);
      expect(viewsEmpty).toHaveLength(0);
    });
  });

  describe("formatHeaderRoleBadge", () => {
    it("formats header role badge as BUILDER + ADMIN for users with ADMIN role", () => {
      expect(formatHeaderRoleBadge(["BUILDER", "CLIENT", "ADMIN"])).toBe("BUILDER + ADMIN");
      expect(formatHeaderRoleBadge(["ADMIN", "BUILDER"])).toBe("BUILDER + ADMIN");
      expect(formatHeaderRoleBadge(["ADMIN"])).toBe("BUILDER + ADMIN");
    });

    it("formats header role badge as BUILDER for builder users without ADMIN", () => {
      expect(formatHeaderRoleBadge(["BUILDER"])).toBe("BUILDER");
      expect(formatHeaderRoleBadge(["BUILDER", "CLIENT"])).toBe("BUILDER");
    });

    it("formats header role badge as CLIENT for client-only users", () => {
      expect(formatHeaderRoleBadge(["CLIENT"])).toBe("CLIENT");
    });
  });

  describe("Database Audit for Owner Account (madipadiganavtej@gmail.com)", () => {
    it("audits owner user roles in DB and verifies portal switcher & badge resolution", async () => {
      const { db } = await import("@/db");
      const { users, userRoles } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");

      const [ownerUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, "madipadiganavtej@gmail.com"))
        .limit(1);

      console.log("[DB Audit] Owner user found:", ownerUser ? { id: ownerUser.id, email: ownerUser.email, name: ownerUser.name } : "Not found in local test DB");

      if (ownerUser) {
        const roles = await db
          .select()
          .from(userRoles)
          .where(eq(userRoles.userId, ownerUser.id));

        const roleList = roles.map((r) => r.role as UserRole);
        console.log("[DB Audit] Owner roles in DB:", roleList);

        const views = getPortalViews(roleList);
        console.log("[DB Audit] Resulting portal views:", views);
        expect(views.some((v) => v.role === "CLIENT")).toBe(false);

        const badge = formatHeaderRoleBadge(roleList);
        console.log("[DB Audit] Resulting header role badge:", badge);
      }
    });
  });
});

