import { describe, expect, it } from "vitest";

import {
  credentialTypeCodes,
  projectRoleCodes,
  systemRoleCodes,
  teamRoleCodes,
} from "../schema.js";
import {
  projectsInsertSchema,
  projectsTeamsInsertSchema,
  projectsUsersInsertSchema,
  teamsInsertSchema,
  usersProjectsProjectRolesInsertSchema,
  usersSystemRolesInsertSchema,
  usersTeamsTeamRolesInsertSchema,
} from "../generated-zod/index.js";

describe("auth and access v2 zod schemas", () => {
  it("accepts a project insert payload with a non-unique name", () => {
    const parsed = projectsInsertSchema.parse({
      description: "Reusable name",
      name: "Release Train",
    });

    expect(parsed.name).toBe("Release Train");
  });

  it("accepts a team insert payload with a nullable description", () => {
    const parsed = teamsInsertSchema.parse({
      description: null,
      name: "Platform Team",
    });

    expect(parsed.description).toBeNull();
  });

  it("accepts direct access and team role mappings", () => {
    const projectUser = projectsUsersInsertSchema.parse({
      projectId: 10,
      userId: 3,
    });
    const projectTeam = projectsTeamsInsertSchema.parse({
      projectId: 10,
      teamId: 7,
    });
    const teamRole = usersTeamsTeamRolesInsertSchema.parse({
      roleCode: teamRoleCodes.projectManager,
      teamId: 7,
      userId: 3,
    });

    expect(projectUser.projectId).toBe(10);
    expect(projectTeam.teamId).toBe(7);
    expect(teamRole.roleCode).toBe(teamRoleCodes.projectManager);
  });

  it("accepts split role assignments", () => {
    const systemRole = usersSystemRolesInsertSchema.parse({
      roleCode: systemRoleCodes.admin,
      userId: 1,
    });
    const projectRole = usersProjectsProjectRolesInsertSchema.parse({
      projectId: 11,
      roleCode: projectRoleCodes.projectManager,
      userId: 1,
    });

    expect(systemRole.roleCode).toBe("GGTC_SYSTEMROLE_ADMIN");
    expect(projectRole.roleCode).toBe("GGTC_PROJECTROLE_PROJECT_MANAGER");
  });

  it("retains the existing username/password credential code", () => {
    expect(credentialTypeCodes.usernamePassword).toBe(
      "GGTC_CREDTYPE_USERNAME_PASSWORD",
    );
  });
});
