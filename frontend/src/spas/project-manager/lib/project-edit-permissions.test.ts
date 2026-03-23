import { describe, expect, it } from "vitest";

import { canEditProject } from "./project-edit-permissions.js";

function createProjectResponse() {
  return {
    members: [{
      roleCodes: ["GGTC_PROJECTROLE_PROJECT_OWNER"],
      userId: 42,
      username: "owner-user",
    }],
    organizations: [],
    project: {
      createdAt: "2026-03-01T00:00:00.000Z",
      description: "desc",
      id: 4,
      name: "Project 4",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
    projectManagers: [{
      sourceKinds: ["direct"] as ("direct" | "org" | "team")[],
      userId: 99,
      username: "pm-user",
    }],
    teams: [],
  };
}

describe("project edit permissions", () => {
  it("allows project owners and project managers", () => {
    const response = createProjectResponse();
    expect(canEditProject(42, [], response)).toBe(true);
    expect(canEditProject(99, [], response)).toBe(true);
  });

  it("does not grant chart edit solely from system admin role", () => {
    const response = createProjectResponse();
    expect(canEditProject(7, ["GGTC_SYSTEMROLE_ADMIN"], response)).toBe(false);
  });
});
