import { describe, expect, it } from "vitest";

import {
  intersectProjectIds,
  isRouteAllowedForScopedSession,
  normalizeApiPath,
} from "../backend/modules/scoped-access/scoped-access.policy.js";

describe("scoped access policy helpers", () => {
  it("normalizes api paths using configured prefix", () => {
    expect(normalizeApiPath("/stc-proj-mgmt/api/projects/1", "stc-proj-mgmt/api"))
      .toBe("/projects/1");
    expect(normalizeApiPath("/stc-proj-mgmt/api", "stc-proj-mgmt/api"))
      .toBe("/");
    expect(normalizeApiPath("/projects/1", "stc-proj-mgmt/api"))
      .toBe("/projects/1");
  });

  it("matches route allowlist patterns with params", () => {
    expect(isRouteAllowedForScopedSession(
      "GET",
      "/projects/11/issues/3",
      [{ method: "GET", pattern: "/projects/:projectId/issues/:issueId" }],
    )).toBe(true);
    expect(isRouteAllowedForScopedSession(
      "PATCH",
      "/projects/11/issues/3",
      [{ method: "GET", pattern: "/projects/:projectId/issues/:issueId" }],
    )).toBe(false);
    expect(isRouteAllowedForScopedSession(
      "GET",
      "/projects/11/issues",
      [{ method: "GET", pattern: "/projects/:projectId/issues/:issueId" }],
    )).toBe(false);
    expect(isRouteAllowedForScopedSession(
      "GET",
      "/projects/11/issues/3",
      [{ method: "GET", pattern: "/projects/:projectId/issues" }],
    )).toBe(false);
  });

  it("intersects project id lists", () => {
    expect(intersectProjectIds([1, 2, 3], [2, 4])).toEqual([2]);
    expect(intersectProjectIds([1, 1, 2], [1, 3])).toEqual([1, 1]);
    expect(intersectProjectIds([], [1, 2])).toEqual([]);
  });
});
