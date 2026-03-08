import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  projects,
  projectsTeams,
  projectsUsers,
  usersProjectsProjectRoles,
} from "../db/index.js";
import {
  MISSING_ENTITY_ID,
  createCrudTestHarness,
} from "./crud-test-helpers.js";

const harness = createCrudTestHarness("projects-crud.sqlite");

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

  beforeAll(async () => {
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it("allows any authenticated user to create a project and makes the creator a project manager member", async () => {
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
    const roleRow = harness.databaseService.db
      .select()
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.projectId, body.project.id))
      .get();

    expect(membershipRow?.userId).toBe(creator.user.id);
    expect(roleRow?.userId).toBe(creator.user.id);
    expect(roleRow?.roleCode).toBe("GGTC_PROJECTROLE_PROJECT_MANAGER");
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
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(401);
    }
  });

  it("limits project visibility to direct members, team-derived access, and sysadmins", async () => {
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
    const adminGet = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(teamMemberGet.statusCode).toBe(200);
    expect(outsiderGet.statusCode).toBe(403);
    expect(adminGet.statusCode).toBe(200);
  });

  it("requires a project manager or sysadmin to update project membership", async () => {
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
            roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
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

  it("does not let team-derived project access alone update project membership", async () => {
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
            roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
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

  it("allows a sysadmin to update project metadata and membership without being a member", async () => {
    const creator = await harness.registerUser("project-admin-manager");
    const member = await harness.registerUser("project-admin-member");
    const admin = await harness.loginSeededAdmin();
    const createResponse = await createProject(creator.accessToken, {
      name: "Admin Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

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
            roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
            userId: member.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

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
            roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
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
              "GGTC_PROJECTROLE_PROJECT_MANAGER",
              "GGTC_PROJECTROLE_PROJECT_MANAGER",
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
            roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
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

  it("prevents removing the last remaining project manager from a project", async () => {
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
            roleCodes: [],
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
            roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
            userId: creator.user.id,
          },
          {
            roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
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
            roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
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
    expect(roleRows).toHaveLength(1);
    expect(roleRows[0]?.userId).toBe(otherManager.user.id);
  });

  it("allows a project manager or sysadmin to delete a project and bypass the last-manager guard", async () => {
    const creator = await harness.registerUser("project-delete-manager");
    const outsider = await harness.registerUser("project-delete-outsider");
    const createResponse = await createProject(creator.accessToken, {
      name: "Delete Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      createResponse.payload,
    );

    const forbiddenDelete = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(forbiddenDelete.statusCode).toBe(403);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db
        .select()
        .from(projects)
        .where(eq(projects.id, project.id))
        .get(),
    ).toBeUndefined();
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
            roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
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
});
