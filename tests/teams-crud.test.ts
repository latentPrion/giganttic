import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  projectsTeams,
  teams,
  teamsUsers,
  usersTeamsTeamRoles,
} from "../db/index.js";
import {
  MISSING_ENTITY_ID,
  createCrudTestHarness,
} from "./crud-test-helpers.js";

const harness = createCrudTestHarness("teams-crud.sqlite");

describe("teams crud api", () => {
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

  it("allows any authenticated user to create a team and makes the creator a team manager member", async () => {
    const creator = await harness.registerUser("team-creator");
    const response = await createTeam(creator.accessToken, {
      description: "Delivery team",
      name: "Delivery",
    });
    const body = harness.parseJson<{ team: { id: number; name: string } }>(
      response.payload,
    );

    expect(response.statusCode).toBe(201);
    expect(body.team.name).toBe("Delivery");

    const membershipRow = harness.databaseService.db
      .select()
      .from(teamsUsers)
      .where(eq(teamsUsers.teamId, body.team.id))
      .get();
    const roleRow = harness.databaseService.db
      .select()
      .from(usersTeamsTeamRoles)
      .where(eq(usersTeamsTeamRoles.teamId, body.team.id))
      .get();

    expect(membershipRow?.userId).toBe(creator.user.id);
    expect(roleRow?.userId).toBe(creator.user.id);
    expect(roleRow?.roleCode).toBe("GGTC_TEAMROLE_TEAM_MANAGER");
  });

  it("rejects unauthenticated access to all team routes", async () => {
    const responses = await Promise.all([
      harness.app.inject({
        method: "POST",
        payload: { name: "Anonymous Team" },
        url: "/stc-proj-mgmt/api/teams",
      }),
      harness.app.inject({
        method: "GET",
        url: "/stc-proj-mgmt/api/teams",
      }),
      harness.app.inject({
        method: "GET",
        url: `/stc-proj-mgmt/api/teams/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        method: "PATCH",
        payload: { name: "Nope" },
        url: `/stc-proj-mgmt/api/teams/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        method: "PUT",
        payload: {
          members: [
            {
              roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
              userId: 1,
            },
          ],
        },
        url: `/stc-proj-mgmt/api/teams/${MISSING_ENTITY_ID}/members`,
      }),
      harness.app.inject({
        method: "DELETE",
        url: `/stc-proj-mgmt/api/teams/${MISSING_ENTITY_ID}`,
      }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(401);
    }
  });

  it("limits team visibility to members and sysadmins", async () => {
    const creator = await harness.registerUser("team-view-creator");
    const outsider = await harness.registerUser("team-view-outsider");
    const admin = await harness.loginSeededAdmin();
    const createResponse = await createTeam(creator.accessToken, {
      name: "Hidden Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );

    const creatorList = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/teams",
    });
    const outsiderList = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/teams",
    });
    const outsiderGet = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });
    const adminGet = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });

    expect(
      harness.parseJson<{ teams: Array<{ id: number }> }>(creatorList.payload).teams
        .map((entry) => entry.id),
    ).toContain(team.id);
    expect(
      harness.parseJson<{ teams: Array<{ id: number }> }>(outsiderList.payload).teams
        .map((entry) => entry.id),
    ).not.toContain(team.id);
    expect(outsiderGet.statusCode).toBe(403);
    expect(adminGet.statusCode).toBe(200);
  });

  it("requires a team manager or sysadmin to update team membership", async () => {
    const creator = await harness.registerUser("team-membership-manager");
    const outsider = await harness.registerUser("team-membership-outsider");
    const member = await harness.registerUser("team-membership-member");
    const createResponse = await createTeam(creator.accessToken, {
      name: "Membership Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );

    const forbiddenResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: creator.user.id,
          },
          {
            roleCodes: [],
            userId: member.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });

    expect(forbiddenResponse.statusCode).toBe(403);
  });

  it("allows a sysadmin to update team metadata and membership without being a member", async () => {
    const creator = await harness.registerUser("team-admin-manager");
    const member = await harness.registerUser("team-admin-member");
    const admin = await harness.loginSeededAdmin();
    const createResponse = await createTeam(creator.accessToken, {
      name: "Admin Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );

    const metadataResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "PATCH",
      payload: { description: "Updated by admin" },
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: member.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });

    expect(metadataResponse.statusCode).toBe(200);
    expect(membershipResponse.statusCode).toBe(200);
  });

  it("rejects duplicate team members, duplicate team roles, and unknown team users", async () => {
    const creator = await harness.registerUser("team-invalid-membership");
    const member = await harness.registerUser("team-invalid-member");
    const createResponse = await createTeam(creator.accessToken, {
      name: "Invalid Team Membership",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );

    const duplicateMembersResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: creator.user.id,
          },
          {
            roleCodes: [],
            userId: creator.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const duplicateRolesResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [
              "GGTC_TEAMROLE_TEAM_MANAGER",
              "GGTC_TEAMROLE_TEAM_MANAGER",
            ],
            userId: creator.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const missingUserResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: creator.user.id,
          },
          {
            roleCodes: [],
            userId: MISSING_ENTITY_ID,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });

    expect(duplicateMembersResponse.statusCode).toBe(400);
    expect(duplicateRolesResponse.statusCode).toBe(400);
    expect(missingUserResponse.statusCode).toBe(404);
    expect(member.user.id).toBeGreaterThan(0);
  });

  it("returns 404 for nonexistent team routes", async () => {
    const admin = await harness.loginSeededAdmin();
    const responses = await Promise.all([
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "GET",
        url: `/stc-proj-mgmt/api/teams/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "PATCH",
        payload: { name: "Missing Team" },
        url: `/stc-proj-mgmt/api/teams/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "PUT",
        payload: {
          members: [
            {
              roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
              userId: admin.user.id,
            },
          ],
        },
        url: `/stc-proj-mgmt/api/teams/${MISSING_ENTITY_ID}/members`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "DELETE",
        url: `/stc-proj-mgmt/api/teams/${MISSING_ENTITY_ID}`,
      }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(404);
    }
  });

  it("allows a team manager to update team metadata and forbids outsiders", async () => {
    const creator = await harness.registerUser("team-update-manager");
    const outsider = await harness.registerUser("team-update-outsider");
    const createResponse = await createTeam(creator.accessToken, {
      description: "Old description",
      name: "Old Team Name",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );

    const forbiddenResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "PATCH",
      payload: {
        description: "Forbidden update",
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });
    const allowedResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PATCH",
      payload: {
        description: "Updated description",
        name: "Updated Team Name",
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });
    const allowedBody = harness.parseJson<{
      team: { description: string | null; name: string };
    }>(allowedResponse.payload);

    expect(forbiddenResponse.statusCode).toBe(403);
    expect(allowedResponse.statusCode).toBe(200);
    expect(allowedBody.team.name).toBe("Updated Team Name");
    expect(allowedBody.team.description).toBe("Updated description");
  });

  it("prevents removing the last remaining team manager from a team", async () => {
    const creator = await harness.registerUser("team-last-manager");
    const member = await harness.registerUser("team-last-manager-member");
    const createResponse = await createTeam(creator.accessToken, {
      name: "Manager Guard Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
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
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });

    expect(updateResponse.statusCode).toBe(409);
  });

  it("allows transferring team management when another manager remains", async () => {
    const creator = await harness.registerUser("team-transfer-manager");
    const otherManager = await harness.registerUser("team-transfer-other");
    const createResponse = await createTeam(creator.accessToken, {
      name: "Transfer Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );

    const firstUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: creator.user.id,
          },
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: otherManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });

    expect(firstUpdate.statusCode).toBe(200);

    const secondUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: otherManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const roleRows = harness.databaseService.db
      .select()
      .from(usersTeamsTeamRoles)
      .where(eq(usersTeamsTeamRoles.teamId, team.id))
      .all();

    expect(secondUpdate.statusCode).toBe(200);
    expect(roleRows).toHaveLength(1);
    expect(roleRows[0]?.userId).toBe(otherManager.user.id);
  });

  it("allows a team manager or sysadmin to delete a team and bypass the last-manager guard", async () => {
    const creator = await harness.registerUser("team-delete-manager");
    const outsider = await harness.registerUser("team-delete-outsider");
    const admin = await harness.loginSeededAdmin();
    const createResponse = await createTeam(creator.accessToken, {
      name: "Delete Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );

    const forbiddenDelete = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });

    expect(forbiddenDelete.statusCode).toBe(403);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db
        .select()
        .from(teams)
        .where(eq(teams.id, team.id))
        .get(),
    ).toBeUndefined();
  });

  it("deleting a team cascades its memberships, role assignments, and project links", async () => {
    const creator = await harness.registerUser("team-cascade-manager");
    const otherMember = await harness.registerUser("team-cascade-member");
    const projectOwner = await harness.registerUser("team-cascade-project-owner");
    const teamCreateResponse = await createTeam(creator.accessToken, {
      name: "Cascade Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamCreateResponse.payload,
    );
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: creator.user.id,
          },
          {
            roleCodes: [],
            userId: otherMember.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const projectCreateResponse = await createProject(projectOwner.accessToken, {
      name: "Cascade Project Link",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectCreateResponse.payload,
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
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db
        .select()
        .from(teamsUsers)
        .where(eq(teamsUsers.teamId, team.id))
        .all(),
    ).toEqual([]);
    expect(
      harness.databaseService.db
        .select()
        .from(usersTeamsTeamRoles)
        .where(eq(usersTeamsTeamRoles.teamId, team.id))
        .all(),
    ).toEqual([]);
    expect(
      harness.databaseService.db
        .select()
        .from(projectsTeams)
        .where(eq(projectsTeams.teamId, team.id))
        .all(),
    ).toEqual([]);
  });
});
