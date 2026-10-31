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
});
