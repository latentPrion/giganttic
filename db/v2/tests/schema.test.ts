import { describe, expect, it } from "vitest";

import {
  closedReasonCodes,
  credentialTypeCodes,
  issueStatusCodes,
  organizationRoleCodes,
  projectRoleCodes,
  systemRoleCodes,
  teamRoleCodes,
} from "../schema.js";
import {
  closedReasonsInsertSchema,
  organizationsInsertSchema,
  organizationsTeamsInsertSchema,
  issuesInsertSchema,
  issueStatusesInsertSchema,
  projectsOrganizationsInsertSchema,
  projectsInsertSchema,
  projectsTeamsInsertSchema,
  projectsUsersInsertSchema,
  teamsInsertSchema,
  usersOrganizationsInsertSchema,
  usersOrganizationsOrganizationRolesInsertSchema,
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

  it("accepts organization inserts and organization membership mappings", () => {
    const organization = organizationsInsertSchema.parse({
      description: "Umbrella org",
      name: "Umbrella",
    });
    const userMembership = usersOrganizationsInsertSchema.parse({
      organizationId: 2,
      userId: 3,
    });
    const projectAssociation = projectsOrganizationsInsertSchema.parse({
      organizationId: 2,
      projectId: 9,
    });
    const teamAssociation = organizationsTeamsInsertSchema.parse({
      organizationId: 2,
      teamId: 7,
    });

    expect(organization.name).toBe("Umbrella");
    expect(userMembership.organizationId).toBe(2);
    expect(projectAssociation.projectId).toBe(9);
    expect(teamAssociation.teamId).toBe(7);
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

  it("accepts organization role assignments", () => {
    const orgRole = usersOrganizationsOrganizationRolesInsertSchema.parse({
      organizationId: 5,
      roleCode: organizationRoleCodes.organizationManager,
      userId: 1,
    });

    expect(orgRole.roleCode).toBe(
      "GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER",
    );
  });

  it("retains the existing username/password credential code", () => {
    expect(credentialTypeCodes.usernamePassword).toBe(
      "GGTC_CREDTYPE_USERNAME_PASSWORD",
    );
  });

  it("accepts issue status and closed reason inserts", () => {
    const issueStatus = issueStatusesInsertSchema.parse({
      code: issueStatusCodes.open,
      displayName: "Open",
    });
    const closedReason = closedReasonsInsertSchema.parse({
      code: closedReasonCodes.resolved,
      displayName: "Resolved",
    });

    expect(issueStatus.code).toBe(issueStatusCodes.open);
    expect(closedReason.code).toBe(closedReasonCodes.resolved);
  });

  it("accepts an issue insert payload", () => {
    const issue = issuesInsertSchema.parse({
      name: "Broken upload flow",
      priority: 2,
      projectId: 7,
      status: issueStatusCodes.open,
    });

    expect(issue.priority).toBe(2);
    expect(issue.projectId).toBe(7);
    expect(issue.status).toBe(issueStatusCodes.open);
  });
});
