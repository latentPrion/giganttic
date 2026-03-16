import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  organizationsTeams,
  projects,
  projectsOrganizations,
  projectsTeams,
  projectsUsers,
  usersOrganizations,
  usersOrganizationsOrganizationRoles,
  usersProjectsProjectRoles,
  usersSessions,
} from "../db/index.js";
import {
  MISSING_ENTITY_ID,
  createCrudTestHarness,
} from "./crud-test-helpers.js";
import {
  expectBlockingConflictPayload,
  type BlockingConflictPayload,
} from "./blocking-conflict-helpers.js";

const harness = createCrudTestHarness("projects-crud.sqlite");
const PROJECT_MANAGER_ROLE = "GGTC_PROJECTROLE_PROJECT_MANAGER";
const PROJECT_OWNER_ROLE = "GGTC_PROJECTROLE_PROJECT_OWNER";

function sortRoleCodes(roleCodes: ReadonlyArray<string>) {
  return [...roleCodes].sort();
}

describe("projects crud api", () => {
  function createTeam(
    accessToken: string,
    payload: {
      description?: string | null;
      name: string;
    },
  ) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "POST",
      payload,
      url: "/stc-proj-mgmt/api/teams",
    });
  }

  function createProject(
    accessToken: string,
    payload: {
      description?: string | null;
      journal?: string | null;
      name: string;
    },
  ) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "POST",
      payload,
      url: "/stc-proj-mgmt/api/projects",
    });
  }

  function getProject(accessToken: string, projectId: number) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}`,
    });
  }

  beforeAll(async () => {
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it("allows any authenticated user to create a project and makes the creator a project owner manager member", async () => {
    const creator = await harness.registerUser("project-creator");
    const response = await createProject(creator.accessToken, {
      description: "Delivery project",
      name: "Apollo",
    });
    const body = harness.parseJson<{ project: { id: number; name: string } }>(
      response.payload,
    );

    expect(response.statusCode).toBe(201);
    expect(body.project.name).toBe("Apollo");

    const membershipRow = harness.databaseService.db
      .select()
      .from(projectsUsers)
      .where(eq(projectsUsers.projectId, body.project.id))
      .get();
    const roleRows = harness.databaseService.db
      .select()
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.projectId, body.project.id))
      .all();

    expect(membershipRow?.userId).toBe(creator.user.id);
    expect(roleRows.map((row) => row.userId)).toEqual([
      creator.user.id,
      creator.user.id,
    ]);
    expect(sortRoleCodes(roleRows.map((row) => row.roleCode))).toEqual([
      PROJECT_MANAGER_ROLE,
      PROJECT_OWNER_ROLE,
    ]);
  });

  it("assigns ownership independently per project when different users create separate projects", async () => {
    const firstCreator = await harness.registerUser("project-owner-scope-first");
    const secondCreator = await harness.registerUser("project-owner-scope-second");
    const firstResponse = await createProject(firstCreator.accessToken, {
      name: "Scoped Ownership One",
    });
    const secondResponse = await createProject(secondCreator.accessToken, {
      name: "Scoped Ownership Two",
    });
    const firstProject = harness.parseJson<{ project: { id: number } }>(
      firstResponse.payload,
    ).project;
    const secondProject = harness.parseJson<{ project: { id: number } }>(
      secondResponse.payload,
    ).project;

    const firstProjectRoles = harness.databaseService.db
      .select()
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.projectId, firstProject.id))
      .all();
    const secondProjectRoles = harness.databaseService.db
      .select()
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.projectId, secondProject.id))
      .all();

    expect(sortRoleCodes(firstProjectRoles.map((row) => row.roleCode))).toEqual([
      PROJECT_MANAGER_ROLE,
      PROJECT_OWNER_ROLE,
    ]);
    expect(sortRoleCodes(secondProjectRoles.map((row) => row.roleCode))).toEqual([
      PROJECT_MANAGER_ROLE,
      PROJECT_OWNER_ROLE,
    ]);
    expect(new Set(firstProjectRoles.map((row) => row.userId))).toEqual(
      new Set([firstCreator.user.id]),
    );
    expect(new Set(secondProjectRoles.map((row) => row.userId))).toEqual(
      new Set([secondCreator.user.id]),
    );
  });

  it("persists project journal through create, get, and update", async () => {
    const creator = await harness.registerUser("project-journal");
    const createResponse = await createProject(creator.accessToken, {
      description: "Delivery project",
      journal: "Initial planning journal",
      name: "Journal Project",
    });
    const { project } = harness.parseJson<{
      project: {
        id: number;
        journal: string | null;
      };
    }>(createResponse.payload);

    const getResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const updateResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PATCH",
      payload: {
        journal: "Updated execution journal",
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(createResponse.statusCode).toBe(201);
    expect(project.journal).toBe("Initial planning journal");
    expect(getResponse.statusCode).toBe(200);
    expect(
      harness.parseJson<{ project: { journal: string | null } }>(getResponse.payload).project.journal,
    ).toBe("Initial planning journal");
    expect(updateResponse.statusCode).toBe(200);
    expect(
      harness.parseJson<{ project: { journal: string | null } }>(updateResponse.payload).project.journal,
    ).toBe("Updated execution journal");
  });

  it("rejects unauthenticated access to all project routes", async () => {
    const responses = await Promise.all([
      harness.app.inject({
        method: "POST",
        payload: { name: "Anonymous Project" },
        url: "/stc-proj-mgmt/api/projects",
      }),
      harness.app.inject({
        method: "GET",
        url: "/stc-proj-mgmt/api/projects",
      }),
      harness.app.inject({
        method: "GET",
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        method: "PATCH",
        payload: { name: "Nope" },
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        method: "PUT",
        payload: {
          members: [
            {
              roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
              userId: 1,
            },
          ],
        },
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}/members`,
      }),
      harness.app.inject({
        method: "DELETE",
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        method: "POST",
        payload: {
          roleCode: "GGTC_PROJECTROLE_PROJECT_MANAGER",
          userId: 1,
        },
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}/roles/grant`,
      }),
      harness.app.inject({
        method: "POST",
        payload: {
          roleCode: "GGTC_PROJECTROLE_PROJECT_MANAGER",
          userId: 1,
        },
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}/roles/revoke`,
      }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(401);
    }
  });

  it("limits project lobby visibility to direct members and team-derived access even for sysadmins", async () => {
    const creator = await harness.registerUser("project-view-creator");
    const teamCreator = await harness.registerUser("project-view-team-creator");
    const teamMember = await harness.registerUser("project-view-team-member");
    const outsider = await harness.registerUser("project-view-outsider");
    const admin = await harness.loginSeededAdmin();

    const teamCreateResponse = await createTeam(teamCreator.accessToken, {
      name: "Bridge Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamCreateResponse.payload,
    );
    const membershipUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(teamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: teamCreator.user.id,
          },
          {
            roleCodes: [],
            userId: teamMember.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });

    expect(membershipUpdate.statusCode).toBe(200);

    const projectCreateResponse = await createProject(creator.accessToken, {
      name: "Shared Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectCreateResponse.payload,
    );

    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();

    const teamMemberGet = await harness.app.inject({
      headers: harness.createAuthHeaders(teamMember.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const outsiderGet = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const creatorList = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/projects",
    });
    const teamMemberList = await harness.app.inject({
      headers: harness.createAuthHeaders(teamMember.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/projects",
    });
    const outsiderList = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/projects",
    });
    const adminList = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/projects",
    });
    const adminGet = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(
      harness.parseJson<{ projects: Array<{ id: number }> }>(creatorList.payload).projects
        .map((entry) => entry.id),
    ).toContain(project.id);
    expect(
      harness.parseJson<{ projects: Array<{ id: number }> }>(teamMemberList.payload).projects
        .map((entry) => entry.id),
    ).toContain(project.id);
    expect(
      harness.parseJson<{ projects: Array<{ id: number }> }>(outsiderList.payload).projects
        .map((entry) => entry.id),
    ).not.toContain(project.id);
    expect(
      harness.parseJson<{ projects: Array<{ id: number }> }>(adminList.payload).projects
        .map((entry) => entry.id),
    ).not.toContain(project.id);
    expect(teamMemberGet.statusCode).toBe(200);
    expect(outsiderGet.statusCode).toBe(403);
    expect(adminGet.statusCode).toBe(200);
  });

  it("returns effective project managers plus linked teams and direct or indirect organizations", async () => {
    const creator = await harness.registerUser("project-detail-creator");
    const teamManager = await harness.registerUser("project-detail-team-manager");
    const organizationManager = await harness.registerUser("project-detail-org-manager");

    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Project Detail Payload" })).payload,
    ).project.id;
    const teamId = harness.parseJson<{ team: { id: number } }>(
      (await createTeam(creator.accessToken, { name: "Project Detail Team" })).payload,
    ).team.id;

    const directOrganizationId = harness.parseJson<{ organization: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(creator.accessToken),
          method: "POST",
          payload: { name: "Project Detail Direct Org" },
          url: "/stc-proj-mgmt/api/organizations",
        })
      ).payload,
    ).organization.id;
    const indirectOrganizationId = harness.parseJson<{ organization: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(creator.accessToken),
          method: "POST",
          payload: { name: "Project Detail Indirect Org" },
          url: "/stc-proj-mgmt/api/organizations",
        })
      ).payload,
    ).organization.id;

    const teamMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: creator.user.id,
          },
          {
            roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"],
            userId: teamManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${teamId}/members`,
    });

    expect(teamMembershipResponse.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsTeams).values({
      projectId,
      teamId,
    }).run();
    harness.databaseService.db.insert(projectsOrganizations).values({
      organizationId: directOrganizationId,
      projectId,
    }).run();
    harness.databaseService.db.insert(organizationsTeams).values({
      organizationId: indirectOrganizationId,
      teamId,
    }).run();
    harness.databaseService.db.insert(usersOrganizations).values({
      organizationId: directOrganizationId,
      userId: organizationManager.user.id,
    }).run();
    harness.databaseService.db.insert(usersOrganizationsOrganizationRoles).values({
      organizationId: directOrganizationId,
      roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
      userId: organizationManager.user.id,
    }).run();
    await harness.databaseService.persist();

    const response = await getProject(creator.accessToken, projectId);
    const body = harness.parseJson<{
      organizations: Array<{ id: number }>;
      projectManagers: Array<{ sourceKinds: string[]; userId: number; username: string }>;
      teams: Array<{ id: number }>;
    }>(response.payload);

    expect(response.statusCode).toBe(200);
    expect(body.projectManagers).toEqual([
      {
        sourceKinds: ["direct"],
        userId: creator.user.id,
        username: creator.user.username,
      },
      {
        sourceKinds: ["team"],
        userId: teamManager.user.id,
        username: teamManager.user.username,
      },
      {
        sourceKinds: ["org"],
        userId: organizationManager.user.id,
        username: organizationManager.user.username,
      },
    ]);
    expect(body.teams.map((team) => team.id)).toEqual([teamId]);
    expect(body.organizations.map((organization) => organization.id)).toEqual([
      directOrganizationId,
      indirectOrganizationId,
    ]);
  });

  it("deduplicates project managers and organizations while combining mixed source kinds in stable order", async () => {
    const creator = await harness.registerUser("project-mixed-source-creator");
    const createResponse = await createProject(creator.accessToken, {
      name: "Mixed Source Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );
    const sharedManager = await harness.registerUser("project-mixed-source-shared-manager");
    const secondManager = await harness.registerUser("project-mixed-source-second-manager");

    const lowIdTeamResponse = await createTeam(creator.accessToken, {
      name: "A Team",
    });
    const highIdTeamResponse = await createTeam(creator.accessToken, {
      name: "B Team",
    });
    const lowIdTeam = harness.parseJson<{ team: { id: number } }>(lowIdTeamResponse.payload).team;
    const highIdTeam = harness.parseJson<{ team: { id: number } }>(highIdTeamResponse.payload).team;

    const directOrgResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { name: "Direct Org" },
      url: "/stc-proj-mgmt/api/organizations",
    });
    const indirectOrgResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { name: "Indirect Org" },
      url: "/stc-proj-mgmt/api/organizations",
    });
    const directOrganizationId = harness.parseJson<{ organization: { id: number } }>(
      directOrgResponse.payload,
    ).organization.id;
    const indirectOrganizationId = harness.parseJson<{ organization: { id: number } }>(
      indirectOrgResponse.payload,
    ).organization.id;

    const lowTeamMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: creator.user.id,
          },
          {
            roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"],
            userId: sharedManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${lowIdTeam.id}/members`,
    });
    const highTeamMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: creator.user.id,
          },
          {
            roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"],
            userId: secondManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${highIdTeam.id}/members`,
    });

    expect(lowTeamMembershipResponse.statusCode).toBe(200);
    expect(highTeamMembershipResponse.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsUsers).values({
      projectId: project.id,
      userId: sharedManager.user.id,
    }).run();
    harness.databaseService.db.insert(usersProjectsProjectRoles).values({
      projectId: project.id,
      roleCode: "GGTC_PROJECTROLE_PROJECT_MANAGER",
      userId: sharedManager.user.id,
    }).run();
    harness.databaseService.db.insert(projectsTeams).values([
      {
        projectId: project.id,
        teamId: highIdTeam.id,
      },
      {
        projectId: project.id,
        teamId: lowIdTeam.id,
      },
    ]).run();
    harness.databaseService.db.insert(projectsOrganizations).values({
      organizationId: directOrganizationId,
      projectId: project.id,
    }).run();
    harness.databaseService.db.insert(organizationsTeams).values([
      {
        organizationId: directOrganizationId,
        teamId: lowIdTeam.id,
      },
      {
        organizationId: indirectOrganizationId,
        teamId: highIdTeam.id,
      },
    ]).run();
    harness.databaseService.db.insert(usersOrganizations).values({
      organizationId: directOrganizationId,
      userId: sharedManager.user.id,
    }).run();
    harness.databaseService.db.insert(usersOrganizationsOrganizationRoles).values({
      organizationId: directOrganizationId,
      roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
      userId: sharedManager.user.id,
    }).run();
    await harness.databaseService.persist();

    const response = await getProject(creator.accessToken, project.id);
    const body = harness.parseJson<{
      organizations: Array<{ id: number }>;
      projectManagers: Array<{
        sourceKinds: Array<"direct" | "org" | "team">;
        userId: number;
        username: string;
      }>;
      teams: Array<{ id: number }>;
    }>(response.payload);

    expect(response.statusCode).toBe(200);
    expect(body.projectManagers).toEqual([
      {
        sourceKinds: ["direct"],
        userId: creator.user.id,
        username: creator.user.username,
      },
      {
        sourceKinds: ["direct", "team", "org"],
        userId: sharedManager.user.id,
        username: sharedManager.user.username,
      },
      {
        sourceKinds: ["team"],
        userId: secondManager.user.id,
        username: secondManager.user.username,
      },
    ]);
    expect(body.teams.map((team) => team.id)).toEqual([lowIdTeam.id, highIdTeam.id]);
    expect(body.organizations.map((organization) => organization.id)).toEqual([
      directOrganizationId,
      indirectOrganizationId,
    ]);
  });

  it("requires a project owner or self-granted sysadmin owner to update project membership", async () => {
    const creator = await harness.registerUser("project-membership-manager");
    const outsider = await harness.registerUser("project-membership-outsider");
    const member = await harness.registerUser("project-membership-member");
    const createResponse = await createProject(creator.accessToken, {
      name: "Project Membership",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const forbiddenResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: creator.user.id,
          },
          {
            roleCodes: [],
            userId: member.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(forbiddenResponse.statusCode).toBe(403);
  });

  it("forbids team-derived project managers from updating project membership", async () => {
    const projectOwner = await harness.registerUser("project-team-access-owner");
    const teamCreator = await harness.registerUser("project-team-access-team-manager");
    const teamMember = await harness.registerUser("project-team-access-member");
    const candidate = await harness.registerUser("project-team-access-candidate");
    const teamCreateResponse = await createTeam(teamCreator.accessToken, {
      name: "Project Access Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamCreateResponse.payload,
    );
    const teamMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: teamCreator.user.id,
          },
          {
            roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"],
            userId: teamMember.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const projectCreateResponse = await createProject(projectOwner.accessToken, {
      name: "Access Only Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectCreateResponse.payload,
    );

    expect(teamMembershipResponse.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();

    const forbiddenResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamMember.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: projectOwner.user.id,
          },
          {
            roleCodes: [],
            userId: candidate.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(forbiddenResponse.statusCode).toBe(403);
  });

  it("requires a sysadmin to self-grant owner before updating project metadata and membership", async () => {
    const creator = await harness.registerUser("project-admin-manager");
    const member = await harness.registerUser("project-admin-member");
    const admin = await harness.loginSeededAdmin();
    const createResponse = await createProject(creator.accessToken, {
      name: "Admin Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const blockedMetadataResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "PATCH",
      payload: { description: "Updated by admin" },
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const selfGrantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: admin.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const metadataResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "PATCH",
      payload: { description: "Updated by admin" },
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_OWNER_ROLE],
            userId: admin.user.id,
          },
          {
            roleCodes: [PROJECT_MANAGER_ROLE],
            userId: member.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(blockedMetadataResponse.statusCode).toBe(403);
    expect(selfGrantResponse.statusCode).toBe(200);
    expect(metadataResponse.statusCode).toBe(200);
    expect(membershipResponse.statusCode).toBe(200);
  });

  it("rejects duplicate project members, duplicate project roles, and unknown project users", async () => {
    const creator = await harness.registerUser("project-invalid-membership");
    const createResponse = await createProject(creator.accessToken, {
      name: "Invalid Project Membership",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const duplicateMembersResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: creator.user.id,
          },
          {
            roleCodes: [],
            userId: creator.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });
    const duplicateRolesResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [
              PROJECT_MANAGER_ROLE,
              PROJECT_MANAGER_ROLE,
            ],
            userId: creator.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });
    const missingUserResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: creator.user.id,
          },
          {
            roleCodes: [],
            userId: MISSING_ENTITY_ID,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(duplicateMembersResponse.statusCode).toBe(400);
    expect(duplicateRolesResponse.statusCode).toBe(400);
    expect(missingUserResponse.statusCode).toBe(404);
  });

  it("returns 404 for nonexistent project routes", async () => {
    const admin = await harness.loginSeededAdmin();
    const responses = await Promise.all([
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "GET",
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "PATCH",
        payload: { name: "Missing Project" },
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "PUT",
        payload: {
          members: [
            {
              roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
              userId: admin.user.id,
            },
          ],
        },
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}/members`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "DELETE",
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "POST",
        payload: {
          roleCode: "GGTC_PROJECTROLE_PROJECT_MANAGER",
          userId: admin.user.id,
        },
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}/roles/grant`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "POST",
        payload: {
          roleCode: "GGTC_PROJECTROLE_PROJECT_MANAGER",
          userId: admin.user.id,
        },
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}/roles/revoke`,
      }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(404);
    }
  });

  it("allows a project manager to update project metadata and forbids outsiders", async () => {
    const creator = await harness.registerUser("project-update-manager");
    const outsider = await harness.registerUser("project-update-outsider");
    const createResponse = await createProject(creator.accessToken, {
      description: "Old project description",
      name: "Old Project Name",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const forbiddenResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "PATCH",
      payload: {
        description: "Forbidden project update",
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const allowedResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PATCH",
      payload: {
        description: "Updated project description",
        name: "Updated Project Name",
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const allowedBody = harness.parseJson<{
      project: { description: string | null; name: string };
    }>(allowedResponse.payload);

    expect(forbiddenResponse.statusCode).toBe(403);
    expect(allowedResponse.statusCode).toBe(200);
    expect(allowedBody.project.name).toBe("Updated Project Name");
    expect(allowedBody.project.description).toBe("Updated project description");
  });

  it("prevents removing the last remaining effective project manager from a project", async () => {
    const creator = await harness.registerUser("project-last-manager");
    const member = await harness.registerUser("project-last-manager-member");
    const createResponse = await createProject(creator.accessToken, {
      name: "Project Manager Guard",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const updateResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_OWNER_ROLE],
            userId: creator.user.id,
          },
          {
            roleCodes: [],
            userId: member.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(updateResponse.statusCode).toBe(409);
    expectBlockingConflictPayload(
      harness.parseJson<BlockingConflictPayload>(updateResponse.payload),
      {
        firstBlockingObject: {
          id: project.id,
          kind: "project",
          reason: "last_effective_project_manager",
        },
        message: "Project membership update would remove the last effective project manager",
      },
    );
  });

  it("allows removing the last direct project manager when a linked team project manager remains", async () => {
    const creator = await harness.registerUser("project-indirect-manager");
    const teamCreator = await harness.registerUser("project-indirect-team-creator");
    const teamProjectManager = await harness.registerUser("project-indirect-team-pm");
    const member = await harness.registerUser("project-indirect-member");
    const teamCreateResponse = await createTeam(teamCreator.accessToken, {
      name: "Indirect Manager Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamCreateResponse.payload,
    );
    const teamMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: teamCreator.user.id,
          },
          {
            roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"],
            userId: teamProjectManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const createResponse = await createProject(creator.accessToken, {
      name: "Indirect Cover Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    expect(teamMembershipResponse.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();

    const updateResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_OWNER_ROLE],
            userId: creator.user.id,
          },
          {
            roleCodes: [],
            userId: member.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(updateResponse.statusCode).toBe(200);
  });

  it("allows transferring project management when another manager remains", async () => {
    const creator = await harness.registerUser("project-transfer-manager");
    const otherManager = await harness.registerUser("project-transfer-other");
    const createResponse = await createProject(creator.accessToken, {
      name: "Project Transfer",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const firstUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: creator.user.id,
          },
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: otherManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(firstUpdate.statusCode).toBe(200);

    const secondUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: otherManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });
    const roleRows = harness.databaseService.db
      .select()
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.projectId, project.id))
      .all();

    expect(secondUpdate.statusCode).toBe(200);
    expect(roleRows).toHaveLength(2);
    expect(new Set(roleRows.map((row) => row.userId))).toEqual(
      new Set([otherManager.user.id]),
    );
  });

  it("requires a sysadmin to self-grant direct project ownership before deleting a project", async () => {
    const creator = await harness.registerUser("project-delete-manager");
    const admin = await harness.loginSeededAdmin();
    const createResponse = await createProject(creator.accessToken, {
      name: "Delete Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const blockedDelete = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const selfGrantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_PROJECTROLE_PROJECT_MANAGER",
        userId: admin.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const deleteStillBlocked = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const selfGrantOwnerResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: admin.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(blockedDelete.statusCode).toBe(403);
    expect(selfGrantResponse.statusCode).toBe(200);
    expect(deleteStillBlocked.statusCode).toBe(403);
    expect(selfGrantOwnerResponse.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db
        .select()
        .from(projects)
        .where(eq(projects.id, project.id))
        .get(),
    ).toBeUndefined();
  });

  it("allows an effective project manager on a linked team to update project metadata", async () => {
    const creator = await harness.registerUser("project-indirect-update-creator");
    const teamCreator = await harness.registerUser("project-indirect-update-team-creator");
    const teamProjectManager = await harness.registerUser("project-indirect-update-team-pm");
    const teamCreateResponse = await createTeam(teamCreator.accessToken, {
      name: "Indirect Update Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamCreateResponse.payload,
    );
    const teamMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: teamCreator.user.id,
          },
          {
            roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"],
            userId: teamProjectManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const createResponse = await createProject(creator.accessToken, {
      name: "Indirect Update Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    expect(teamMembershipResponse.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();

    const response = await harness.app.inject({
      headers: harness.createAuthHeaders(teamProjectManager.accessToken),
      method: "PATCH",
      payload: { description: "Updated by indirect manager" },
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(response.statusCode).toBe(200);
  });

  it("lets a project owner grant and revoke direct project manager and owner roles", async () => {
    const creator = await harness.registerUser("project-role-grant-creator");
    const target = await harness.registerUser("project-role-grant-target");
    const createResponse = await createProject(creator.accessToken, {
      name: "Project Role Grant",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: creator.user.id,
          },
          {
            roleCodes: [],
            userId: target.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(membershipResponse.statusCode).toBe(200);

    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
        method: "POST",
      payload: {
        roleCode: PROJECT_MANAGER_ROLE,
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const ownerGrantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const revokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(target.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_MANAGER_ROLE,
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/revoke`,
    });
    const ownerRevokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/revoke`,
    });

    expect(grantResponse.statusCode).toBe(200);
    expect(ownerGrantResponse.statusCode).toBe(200);
    expect(revokeResponse.statusCode).toBe(200);
    expect(ownerRevokeResponse.statusCode).toBe(200);
  });

  it("auto-creates direct membership when an owner grants manager or owner to non-members", async () => {
    const creator = await harness.registerUser("project-role-autojoin-creator");
    const managerTarget = await harness.registerUser("project-role-autojoin-manager");
    const ownerTarget = await harness.registerUser("project-role-autojoin-owner");
    const createResponse = await createProject(creator.accessToken, {
      name: "Auto Join Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const grantManagerResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_MANAGER_ROLE,
        userId: managerTarget.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const grantOwnerResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: ownerTarget.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const membershipRows = harness.databaseService.db
      .select()
      .from(projectsUsers)
      .where(eq(projectsUsers.projectId, project.id))
      .all();
    const roleRows = harness.databaseService.db
      .select()
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.projectId, project.id))
      .all();

    expect(grantManagerResponse.statusCode).toBe(200);
    expect(grantOwnerResponse.statusCode).toBe(200);
    expect(new Set(membershipRows.map((row) => row.userId))).toEqual(
      new Set([creator.user.id, managerTarget.user.id, ownerTarget.user.id]),
    );
    expect(
      roleRows.some(
        (row) =>
          row.userId === managerTarget.user.id && row.roleCode === PROJECT_MANAGER_ROLE,
      ),
    ).toBe(true);
    expect(
      roleRows.some(
        (row) =>
          row.userId === ownerTarget.user.id && row.roleCode === PROJECT_OWNER_ROLE,
      ),
    ).toBe(true);
  });

  it("rejects invalid project role payloads and unauthorized grant attempts", async () => {
    const creator = await harness.registerUser("project-role-invalid-creator");
    const outsider = await harness.registerUser("project-role-invalid-outsider");
    const target = await harness.registerUser("project-role-invalid-target");
    const createResponse = await createProject(creator.accessToken, {
      name: "Project Role Invalid",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );
    const invalidRoleResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
        method: "POST",
      payload: {
        roleCode: "GGTC_PROJECTROLE_NOT_REAL",
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const invalidUserIdResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
        method: "POST",
      payload: {
        roleCode: PROJECT_MANAGER_ROLE,
        userId: 0,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const unauthorizedResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
        method: "POST",
      payload: {
        roleCode: PROJECT_MANAGER_ROLE,
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });

    expect(invalidRoleResponse.statusCode).toBe(400);
    expect(invalidUserIdResponse.statusCode).toBe(400);
    expect(unauthorizedResponse.statusCode).toBe(403);
  });

  it("forbids a direct project manager who is not an owner from granting owner", async () => {
    const creator = await harness.registerUser("project-direct-pm-no-owner-creator");
    const manager = await harness.registerUser("project-direct-pm-no-owner-manager");
    const target = await harness.registerUser("project-direct-pm-no-owner-target");
    const createResponse = await createProject(creator.accessToken, {
      name: "PM Cannot Grant Owner",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: creator.user.id,
          },
          {
            roleCodes: [PROJECT_MANAGER_ROLE],
            userId: manager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(membershipResponse.statusCode).toBe(200);

    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(manager.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });

    expect(grantResponse.statusCode).toBe(403);
  });

  it("forbids a team project manager from granting direct project manager", async () => {
    const projectOwner = await harness.registerUser("project-role-teampm-owner");
    const teamCreator = await harness.registerUser("project-role-teampm-creator");
    const teamProjectManager = await harness.registerUser("project-role-teampm-pm");
    const directProjectMember = await harness.registerUser("project-role-teampm-target");
    const teamCreateResponse = await createTeam(teamCreator.accessToken, {
      name: "Team PM Grant Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamCreateResponse.payload,
    );
    const teamMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: teamCreator.user.id,
          },
          {
            roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"],
            userId: teamProjectManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const projectCreateResponse = await createProject(projectOwner.accessToken, {
      name: "Team PM Grant Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectCreateResponse.payload,
    );
    const projectMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(projectOwner.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: projectOwner.user.id,
          },
          {
            roleCodes: [],
            userId: directProjectMember.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(teamMembershipResponse.statusCode).toBe(200);
    expect(projectMembershipResponse.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();

    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamProjectManager.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_MANAGER_ROLE,
        userId: directProjectMember.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });

    expect(grantResponse.statusCode).toBe(403);
  });

  it("forbids a team project manager from granting direct project manager to a non-member", async () => {
    const projectOwner = await harness.registerUser("project-role-nonmember-owner");
    const teamCreator = await harness.registerUser("project-role-nonmember-creator");
    const teamProjectManager = await harness.registerUser("project-role-nonmember-pm");
    const outsider = await harness.registerUser("project-role-nonmember-outsider");
    const teamCreateResponse = await createTeam(teamCreator.accessToken, {
      name: "Team PM Nonmember Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamCreateResponse.payload,
    );
    const teamMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: teamCreator.user.id,
          },
          {
            roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"],
            userId: teamProjectManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const projectCreateResponse = await createProject(projectOwner.accessToken, {
      name: "Team PM Nonmember Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectCreateResponse.payload,
    );

    expect(teamMembershipResponse.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();

    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamProjectManager.accessToken),
        method: "POST",
      payload: {
        roleCode: PROJECT_MANAGER_ROLE,
        userId: outsider.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });

    expect(grantResponse.statusCode).toBe(403);
  });

  it("allows revoking the only direct project manager role when the same user remains an indirect manager", async () => {
    const projectOwner = await harness.registerUser("project-revoke-same-user-owner");
    const teamCreator = await harness.registerUser("project-revoke-same-user-creator");
    const teamCreateResponse = await createTeam(teamCreator.accessToken, {
      name: "Same User PM Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamCreateResponse.payload,
    );
    const teamMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: teamCreator.user.id,
          },
          {
            roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"],
            userId: projectOwner.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const createResponse = await createProject(projectOwner.accessToken, {
      name: "Same User PM Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    expect(teamMembershipResponse.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();

    const revokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(projectOwner.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_PROJECTROLE_PROJECT_MANAGER",
        userId: projectOwner.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/revoke`,
    });

    expect(revokeResponse.statusCode).toBe(200);
  });

  it("blocks revoking the last project owner and reports the blocking project", async () => {
    const creator = await harness.registerUser("project-last-owner-creator");
    const createResponse = await createProject(creator.accessToken, {
      name: "Last Owner Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const revokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: creator.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/revoke`,
    });

    expect(revokeResponse.statusCode).toBe(409);
    expectBlockingConflictPayload(
      harness.parseJson<BlockingConflictPayload>(revokeResponse.payload),
      {
        firstBlockingObject: {
          id: project.id,
          kind: "project",
          reason: "last_owner",
        },
        message: "Project role revoke would remove the last owner",
      },
    );
  });

  it("allows an owner to revoke another owner and remain the sole owner", async () => {
    const creator = await harness.registerUser("project-owner-revoke-other-creator");
    const secondOwner = await harness.registerUser("project-owner-revoke-other-target");
    const createResponse = await createProject(creator.accessToken, {
      name: "Owner Revoke Other Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: secondOwner.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const revokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: secondOwner.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/revoke`,
    });
    const ownerRows = harness.databaseService.db
      .select()
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.projectId, project.id))
      .all()
      .filter((row) => row.roleCode === PROJECT_OWNER_ROLE);

    expect(grantResponse.statusCode).toBe(200);
    expect(revokeResponse.statusCode).toBe(200);
    expect(ownerRows).toHaveLength(1);
    expect(ownerRows[0].userId).toBe(creator.user.id);
  });

  it("allows self-revoking owner when another owner remains", async () => {
    const creator = await harness.registerUser("project-owner-self-revoke-creator");
    const secondOwner = await harness.registerUser("project-owner-self-revoke-second");
    const createResponse = await createProject(creator.accessToken, {
      name: "Owner Self Revoke Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: secondOwner.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const selfRevokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: creator.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/revoke`,
    });
    const ownerRows = harness.databaseService.db
      .select()
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.projectId, project.id))
      .all()
      .filter((row) => row.roleCode === PROJECT_OWNER_ROLE);

    expect(grantResponse.statusCode).toBe(200);
    expect(selfRevokeResponse.statusCode).toBe(200);
    expect(ownerRows).toHaveLength(1);
    expect(ownerRows[0].userId).toBe(secondOwner.user.id);
  });

  it("lets an owner without project-manager keep metadata edit powers while owner-only actions still enforce manager-preservation", async () => {
    const creator = await harness.registerUser("project-owner-only-creator");
    const fallbackManager = await harness.registerUser("project-owner-only-fallback");
    const createResponse = await createProject(creator.accessToken, {
      name: "Owner Only Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );
    const membershipSeedResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: creator.user.id,
          },
          {
            roleCodes: [PROJECT_MANAGER_ROLE],
            userId: fallbackManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });
    const demoteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_MANAGER_ROLE,
        userId: creator.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/revoke`,
    });
    const metadataResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PATCH",
      payload: { description: "Owner only metadata" },
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const member = await harness.registerUser("project-owner-only-member");
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: [PROJECT_OWNER_ROLE], userId: creator.user.id },
          { roleCodes: [], userId: member.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(membershipSeedResponse.statusCode).toBe(200);
    expect(demoteResponse.statusCode).toBe(200);
    expect(metadataResponse.statusCode).toBe(200);
    expect(membershipResponse.statusCode).toBe(409);
    expectBlockingConflictPayload(
      harness.parseJson<BlockingConflictPayload>(membershipResponse.payload),
      {
        firstBlockingObject: {
          id: project.id,
          kind: "project",
          reason: "last_effective_project_manager",
        },
        message: "Project membership update would remove the last effective project manager",
      },
    );
  });

  it("downgrades a former owner to metadata-only manager behavior after owner revoke", async () => {
    const creator = await harness.registerUser("project-manager-after-owner-creator");
    const secondOwner = await harness.registerUser("project-manager-after-owner-second");
    const newMember = await harness.registerUser("project-manager-after-owner-member");
    const createResponse = await createProject(creator.accessToken, {
      name: "Manager After Owner Revoke",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: secondOwner.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const revokeOwnerResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(secondOwner.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: creator.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/revoke`,
    });
    const metadataResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PATCH",
      payload: { description: "Still a manager" },
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: [PROJECT_OWNER_ROLE], userId: secondOwner.user.id },
          { roleCodes: [], userId: newMember.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(revokeOwnerResponse.statusCode).toBe(200);
    expect(metadataResponse.statusCode).toBe(200);
    expect(membershipResponse.statusCode).toBe(403);
  });

  it("keeps project rows unchanged after a blocked revoke of the final effective project manager", async () => {
    const creator = await harness.registerUser("project-atomic-revoke-creator");
    const createResponse = await createProject(creator.accessToken, {
      name: "Atomic Revoke Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );
    const beforeRows = harness.databaseService.db
      .select()
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.projectId, project.id))
      .all();

    const revokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_MANAGER_ROLE,
        userId: creator.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/revoke`,
    });
    const afterRows = harness.databaseService.db
      .select()
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.projectId, project.id))
      .all();

    expect(revokeResponse.statusCode).toBe(409);
    expectBlockingConflictPayload(
      harness.parseJson<BlockingConflictPayload>(revokeResponse.payload),
      {
        firstBlockingObject: {
          id: project.id,
          kind: "project",
          reason: "last_effective_project_manager",
        },
        message: "Project role revoke would remove the last effective project manager",
      },
    );
    expect(afterRows).toEqual(beforeRows);
  });

  it("keeps project memberships unchanged after a blocked membership replacement", async () => {
    const creator = await harness.registerUser("project-atomic-membership-creator");
    const member = await harness.registerUser("project-atomic-membership-member");
    const createResponse = await createProject(creator.accessToken, {
      name: "Atomic Membership Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );
    const beforeMembers = harness.databaseService.db
      .select()
      .from(projectsUsers)
      .where(eq(projectsUsers.projectId, project.id))
      .all();

    const response = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: [PROJECT_OWNER_ROLE], userId: creator.user.id },
          { roleCodes: [], userId: member.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });
    const afterMembers = harness.databaseService.db
      .select()
      .from(projectsUsers)
      .where(eq(projectsUsers.projectId, project.id))
      .all();

    expect(response.statusCode).toBe(409);
    expectBlockingConflictPayload(
      harness.parseJson<BlockingConflictPayload>(response.payload),
      {
        firstBlockingObject: {
          id: project.id,
          kind: "project",
          reason: "last_effective_project_manager",
        },
        message: "Project membership update would remove the last effective project manager",
      },
    );
    expect(afterMembers).toEqual(beforeMembers);
  });

  it("rejects duplicate admin self-grants and 404s on reads after deletion", async () => {
    const creator = await harness.registerUser("project-admin-self-dup-creator");
    const admin = await harness.loginSeededAdmin();
    const createResponse = await createProject(creator.accessToken, {
      name: "Admin Self Dup Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );
    const firstGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: admin.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const duplicateGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: admin.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });
    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const getResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(firstGrant.statusCode).toBe(200);
    expect(duplicateGrant.statusCode).toBe(409);
    expect(deleteResponse.statusCode).toBe(200);
    expect(getResponse.statusCode).toBe(404);
  });

  it("lets a linked team continue covering a project after another linked team is deleted", async () => {
    const projectOwner = await harness.registerUser("project-two-teams-owner");
    const firstTeamCreator = await harness.registerUser("project-two-teams-first-creator");
    const firstTeamPm = await harness.registerUser("project-two-teams-first-pm");
    const secondTeamCreator = await harness.registerUser("project-two-teams-second-creator");
    const secondTeamPm = await harness.registerUser("project-two-teams-second-pm");
    const teamOneResponse = await createTeam(firstTeamCreator.accessToken, {
      name: "Linked Team One",
    });
    const teamTwoResponse = await createTeam(secondTeamCreator.accessToken, {
      name: "Linked Team Two",
    });
    const { team: teamOne } = harness.parseJson<{ team: { id: number } }>(
      teamOneResponse.payload,
    );
    const { team: teamTwo } = harness.parseJson<{ team: { id: number } }>(
      teamTwoResponse.payload,
    );
    const teamOneMembership = await harness.app.inject({
      headers: harness.createAuthHeaders(firstTeamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: firstTeamCreator.user.id },
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: firstTeamPm.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${teamOne.id}/members`,
    });
    const teamTwoMembership = await harness.app.inject({
      headers: harness.createAuthHeaders(secondTeamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: secondTeamCreator.user.id },
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: secondTeamPm.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${teamTwo.id}/members`,
    });
    const projectCreateResponse = await createProject(projectOwner.accessToken, {
      name: "Two Linked Teams Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectCreateResponse.payload,
    );
    const ownerDemotionResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(projectOwner.accessToken),
      method: "PUT",
      payload: {
        members: [{ roleCodes: [PROJECT_OWNER_ROLE], userId: projectOwner.user.id }],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(teamOneMembership.statusCode).toBe(200);
    expect(teamTwoMembership.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsTeams).values([
      { projectId: project.id, teamId: teamOne.id },
      { projectId: project.id, teamId: teamTwo.id },
    ]).run();
    await harness.databaseService.persist();

    const indirectMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(projectOwner.accessToken),
      method: "PUT",
      payload: {
        members: [{ roleCodes: [PROJECT_OWNER_ROLE], userId: projectOwner.user.id }],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });
    const deleteTeamOneResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(firstTeamCreator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/teams/${teamOne.id}`,
    });
    const metadataUpdateBySecondPm = await harness.app.inject({
      headers: harness.createAuthHeaders(secondTeamPm.accessToken),
      method: "PATCH",
      payload: { description: "Still covered" },
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(ownerDemotionResponse.statusCode).toBe(409);
    expect(indirectMembershipResponse.statusCode).toBe(200);
    expect(deleteTeamOneResponse.statusCode).toBe(200);
    expect(metadataUpdateBySecondPm.statusCode).toBe(200);
  });

  it("removes admin self-granted direct membership and roles when deleting a project", async () => {
    const creator = await harness.registerUser("project-admin-cleanup-creator");
    const admin = await harness.loginSeededAdmin();
    const createResponse = await createProject(creator.accessToken, {
      name: "Admin Cleanup Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );
    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_OWNER_ROLE,
        userId: admin.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });

    expect(grantResponse.statusCode).toBe(200);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });
    const lingeringMembership = harness.databaseService.db
      .select()
      .from(projectsUsers)
      .where(eq(projectsUsers.projectId, project.id))
      .all();
    const lingeringRoles = harness.databaseService.db
      .select()
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.projectId, project.id))
      .all();

    expect(deleteResponse.statusCode).toBe(200);
    expect(lingeringMembership).toHaveLength(0);
    expect(lingeringRoles).toHaveLength(0);
  });

  it("forbids an organization project manager from granting direct project manager on an organization-associated project", async () => {
    const orgCreator = await harness.registerUser("project-org-grant-creator");
    const orgProjectManager = await harness.registerUser("project-org-grant-manager");
    const target = await harness.registerUser("project-org-grant-target");
    const projectOwner = await harness.registerUser("project-org-grant-owner");
    const orgResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: { name: "Project Grant Org" },
      url: "/stc-proj-mgmt/api/organizations",
    });
    const createResponse = await createProject(projectOwner.accessToken, {
      name: "Project Grant Via Org",
    });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(
      orgResponse.payload,
    );
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const orgUsersUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "PUT",
      payload: {
        members: [{ userId: orgCreator.user.id }, { userId: orgProjectManager.user.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    const projectMembership = await harness.app.inject({
      headers: harness.createAuthHeaders(projectOwner.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE], userId: projectOwner.user.id },
          { roleCodes: [], userId: target.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });
    const orgProjectAssociation = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: project.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    const orgRoleGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
        userId: orgProjectManager.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/roles/grant`,
    });
    const projectRoleGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(orgProjectManager.accessToken),
      method: "POST",
      payload: {
        roleCode: PROJECT_MANAGER_ROLE,
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });

    expect(orgUsersUpdate.statusCode).toBe(200);
    expect(projectMembership.statusCode).toBe(200);
    expect(orgProjectAssociation.statusCode).toBe(200);
    expect(orgRoleGrant.statusCode).toBe(200);
    expect(projectRoleGrant.statusCode).toBe(403);
    expect(
      harness.databaseService.db
        .select()
        .from(projectsOrganizations)
        .where(eq(projectsOrganizations.projectId, project.id))
        .all(),
    ).toHaveLength(1);
  });

  it("returns 404 for unimplemented project-team mutation routes", async () => {
    const creator = await harness.registerUser("project-no-team-links");
    const createResponse = await createProject(creator.accessToken, {
      name: "No Team Links Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );
    const response = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: 1 },
      url: `/stc-proj-mgmt/api/projects/${project.id}/teams`,
    });

    expect(response.statusCode).toBe(404);
  });

  it("deleting a project cascades its memberships, role assignments, and team links", async () => {
    const creator = await harness.registerUser("project-cascade-manager");
    const otherMember = await harness.registerUser("project-cascade-member");
    const teamCreator = await harness.registerUser("project-cascade-team-manager");
    const projectCreateResponse = await createProject(creator.accessToken, {
      name: "Cascade Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectCreateResponse.payload,
    );
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: creator.user.id,
          },
          {
            roleCodes: [],
            userId: otherMember.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });
    const teamCreateResponse = await createTeam(teamCreator.accessToken, {
      name: "Cascade Project Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamCreateResponse.payload,
    );

    expect(membershipResponse.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db
        .select()
        .from(projectsUsers)
        .where(eq(projectsUsers.projectId, project.id))
        .all(),
    ).toEqual([]);
    expect(
      harness.databaseService.db
        .select()
        .from(usersProjectsProjectRoles)
        .where(eq(usersProjectsProjectRoles.projectId, project.id))
        .all(),
    ).toEqual([]);
    expect(
      harness.databaseService.db
        .select()
        .from(projectsTeams)
        .where(eq(projectsTeams.projectId, project.id))
        .all(),
    ).toEqual([]);
  });

  it("allows revoking the last linked-team project manager when organization project manager fallback remains", async () => {
    const orgCreator = await harness.registerUser("project-revoke-team-pm-org-creator");
    const orgProjectManager = await harness.registerUser("project-revoke-team-pm-org-pm");
    const teamCreator = await harness.registerUser("project-revoke-team-pm-team-creator");
    const teamProjectManager = await harness.registerUser("project-revoke-team-pm-member");
    const projectOwner = await harness.registerUser("project-revoke-team-pm-owner");
    const orgResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: { name: "Revoke Team PM Fallback Org" },
      url: "/stc-proj-mgmt/api/organizations",
    });
    const teamResponse = await createTeam(teamCreator.accessToken, { name: "Revoke Team PM Team" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Revoke Team PM Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(teamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: teamCreator.user.id },
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: teamProjectManager.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: orgCreator.user.id }, { userId: orgProjectManager.user.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
        userId: orgProjectManager.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/roles/grant`,
    });
    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();
    await harness.app.inject({
      headers: harness.createAuthHeaders(projectOwner.accessToken),
      method: "PUT",
      payload: { members: [{ roleCodes: [PROJECT_OWNER_ROLE], userId: projectOwner.user.id }] },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    const revokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamCreator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_PROJECT_MANAGER",
        userId: teamProjectManager.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/revoke`,
    });

    expect(revokeResponse.statusCode).toBe(200);
  });

  it("allows revoking organization project manager when linked-team project manager fallback remains", async () => {
    const orgCreator = await harness.registerUser("project-revoke-org-pm-creator");
    const orgProjectManager = await harness.registerUser("project-revoke-org-pm-manager");
    const teamCreator = await harness.registerUser("project-revoke-org-pm-team-creator");
    const teamProjectManager = await harness.registerUser("project-revoke-org-pm-team-pm");
    const projectOwner = await harness.registerUser("project-revoke-org-pm-owner");
    const orgResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: { name: "Revoke Org PM Fallback Org" },
      url: "/stc-proj-mgmt/api/organizations",
    });
    const teamResponse = await createTeam(teamCreator.accessToken, { name: "Revoke Org PM Team" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Revoke Org PM Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(teamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: teamCreator.user.id },
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: teamProjectManager.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: orgCreator.user.id }, { userId: orgProjectManager.user.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
        userId: orgProjectManager.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/roles/grant`,
    });
    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();
    await harness.app.inject({
      headers: harness.createAuthHeaders(projectOwner.accessToken),
      method: "PUT",
      payload: { members: [{ roleCodes: [PROJECT_OWNER_ROLE], userId: projectOwner.user.id }] },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    const revokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
        userId: orgProjectManager.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/roles/revoke`,
    });

    expect(revokeResponse.statusCode).toBe(200);
  });
});
