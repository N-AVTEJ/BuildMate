import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BuilderDashboardView } from "@/components/builder/builder-dashboard-view";

describe("Phase 15 Task 3 — Builder Dashboard Navigation & Responsive Layout Invariants", () => {
  const mockUser = {
    id: "user_test_123",
    email: "builder@buildmate.test",
    name: "Alex Builder",
  };

  it("renders with Back to Portal Switcher for multi-role admin user", () => {
    const html = renderToStaticMarkup(
      React.createElement(BuilderDashboardView, {
        user: mockUser,
        roles: ["BUILDER", "ADMIN"],
        availableProjects: [],
        myProjects: [],
        notifications: [],
      })
    );

    // Must contain Back to Portal Switcher link
    expect(html).toContain("Back to Portal Switcher");
    expect(html).toContain('href="/admin"');
    // Must contain Jump to section select
    expect(html).toContain("Jump to section ▾");
    // Must contain CSS grid repeat(auto-fit, minmax(140px, 1fr))
    expect(html).toContain("grid-template-columns:repeat(auto-fit, minmax(140px, 1fr))");
  });

  it("omits Admin portal link and Back to Portal Switcher for single-role builder", () => {
    const html = renderToStaticMarkup(
      React.createElement(BuilderDashboardView, {
        user: mockUser,
        roles: ["BUILDER"],
        availableProjects: [],
        myProjects: [],
        notifications: [],
      })
    );

    // Single role builder must NEVER see Back to Portal Switcher or Admin portal
    expect(html).not.toContain("Back to Portal Switcher");
    expect(html).not.toContain("⚡ Admin Portal");
    expect(html).not.toContain('href="/admin"');
  });

  it("contains all required navigation sections in layout", () => {
    const html = renderToStaticMarkup(
      React.createElement(BuilderDashboardView, {
        user: mockUser,
        roles: ["BUILDER"],
        availableProjects: [],
        myProjects: [],
        notifications: [],
      })
    );

    const requiredSections = [
      "Overview",
      "Available",
      "My Projects",
      "Quotations",
      "Deadlines",
      "Progress",
      "Deliveries",
      "Payments",
    ];

    for (const section of requiredSections) {
      expect(html).toContain(section);
    }
  });

  it("4. Desktop layout renders single left sidebar and Manage Project button with immediate action classes", () => {
    const mockProject = {
      id: "proj_123",
      projectCode: "PRJ-TEST-001",
      title: "Test Microservice",
      subject: "Backend",
      description: "Test description",
      techStack: "Node.js",
      budgetMin: 500,
      budgetMax: 1000,
      totalPrice: 800,
      advanceAmount: 300,
      remainingAmount: 500,
      status: "IN_PROGRESS",
      requestedCompletionDate: null,
      developmentDeadline: null,
      advancePaymentDeadline: null,
      acceptanceDeadline: null,
      lastProgressUpdateAt: null,
      requirementCount: 1,
      isAssignedToMe: true,
      submittedAt: null,
      createdAt: new Date().toISOString(),
    };

    const html = renderToStaticMarkup(
      React.createElement(BuilderDashboardView, {
        user: mockUser,
        roles: ["BUILDER"],
        availableProjects: [],
        myProjects: [mockProject],
        notifications: [],
        initialTab: "my-projects",
      })
    );

    // Sidebar exists
    expect(html).toContain("Builder Navigation");
    expect(html).toContain("hidden lg:block w-64");
    // Duplicate top tab strip does NOT exist in render tree
    expect(html).not.toContain("hidden lg:flex flex-wrap gap-2 pb-2 border-b-2 border-black");
    // Manage Project action button exists
    expect(html).toContain("Manage Project →");
  });
});
