import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  projectsTeams,
  teams,
  teamsUsers,
  usersTeamsTeamRoles,
  users,
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
      harness.app.inject({
        method: "POST",
        payload: {
          roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
          userId: 1,
        },
        url: `/stc-proj-mgmt/api/teams/${MISSING_ENTITY_ID}/roles/grant`,
      }),
      harness.app.inject({
        method: "POST",
        payload: {
          roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
          userId: 1,
        },
        url: `/stc-proj-mgmt/api/teams/${MISSING_ENTITY_ID}/roles/revoke`,
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
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "POST",
        payload: {
          roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
          userId: admin.user.id,
        },
        url: `/stc-proj-mgmt/api/teams/${MISSING_ENTITY_ID}/roles/grant`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "POST",
        payload: {
          roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
          userId: admin.user.id,
        },
        url: `/stc-proj-mgmt/api/teams/${MISSING_ENTITY_ID}/roles/revoke`,
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

  it("requires a sysadmin to self-grant team management before deleting a team", async () => {
    const creator = await harness.registerUser("team-delete-manager");
    const admin = await harness.loginSeededAdmin();
    const createResponse = await createTeam(creator.accessToken, {
      name: "Delete Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );

    const blockedDelete = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });
    const selfGrantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
        userId: admin.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/grant`,
    });
    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });

    expect(blockedDelete.statusCode).toBe(403);
    expect(selfGrantResponse.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db
        .select()
        .from(teams)
        .where(eq(teams.id, team.id))
        .get(),
    ).toBeUndefined();
  });

  it("supports granting and revoking team manager roles", async () => {
    const creator = await harness.registerUser("team-role-grant-creator");
    const target = await harness.registerUser("team-role-grant-target");
    const createResponse = await createTeam(creator.accessToken, {
      name: "Team Role Grant",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
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
            userId: target.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });

    expect(membershipResponse.statusCode).toBe(200);

    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/grant`,
    });
    const revokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/revoke`,
    });

    expect(grantResponse.statusCode).toBe(200);
    expect(revokeResponse.statusCode).toBe(200);
  });

  it("rejects invalid team role payloads and unauthorized grant attempts", async () => {
    const creator = await harness.registerUser("team-role-invalid-creator");
    const outsider = await harness.registerUser("team-role-invalid-outsider");
    const target = await harness.registerUser("team-role-invalid-target");
    const createResponse = await createTeam(creator.accessToken, {
      name: "Team Role Invalid",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );
    const invalidRoleResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_NOT_REAL",
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/grant`,
    });
    const invalidUserIdResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
        userId: 0,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/grant`,
    });
    const unauthorizedResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/grant`,
    });

    expect(invalidRoleResponse.statusCode).toBe(400);
    expect(invalidUserIdResponse.statusCode).toBe(400);
    expect(unauthorizedResponse.statusCode).toBe(403);
  });

  it("allows a team project manager to grant and revoke team project manager on the same team", async () => {
    const creator = await harness.registerUser("team-pm-grant-creator");
    const grantor = await harness.registerUser("team-pm-grant-grantor");
    const target = await harness.registerUser("team-pm-grant-target");
    const createResponse = await createTeam(creator.accessToken, {
      name: "Team PM Grant",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: creator.user.id },
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: grantor.user.id },
          { roleCodes: [], userId: target.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });

    expect(membershipResponse.statusCode).toBe(200);

    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(grantor.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_PROJECT_MANAGER",
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/grant`,
    });
    const revokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(grantor.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_PROJECT_MANAGER",
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/revoke`,
    });

    expect(grantResponse.statusCode).toBe(200);
    expect(revokeResponse.statusCode).toBe(200);
  });

  it("forbids cross-team team-project-manager grants and team-manager-only grants of team PM", async () => {
    const firstCreator = await harness.registerUser("team-cross-grant-first-creator");
    const secondCreator = await harness.registerUser("team-cross-grant-second-creator");
    const grantor = await harness.registerUser("team-cross-grant-grantor");
    const target = await harness.registerUser("team-cross-grant-target");
    const teamOneResponse = await createTeam(firstCreator.accessToken, {
      name: "Cross Grant Team One",
    });
    const teamTwoResponse = await createTeam(secondCreator.accessToken, {
      name: "Cross Grant Team Two",
    });
    const { team: teamOne } = harness.parseJson<{ team: { id: number } }>(
      teamOneResponse.payload,
    );
    const { team: teamTwo } = harness.parseJson<{ team: { id: number } }>(
      teamTwoResponse.payload,
    );
    const teamOneMembership = await harness.app.inject({
      headers: harness.createAuthHeaders(firstCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: firstCreator.user.id },
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: grantor.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${teamOne.id}/members`,
    });
    const teamTwoMembership = await harness.app.inject({
      headers: harness.createAuthHeaders(secondCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: secondCreator.user.id },
          { roleCodes: [], userId: target.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${teamTwo.id}/members`,
    });

    expect(teamOneMembership.statusCode).toBe(200);
    expect(teamTwoMembership.statusCode).toBe(200);

    const crossTeamGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(grantor.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_PROJECT_MANAGER",
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${teamTwo.id}/roles/grant`,
    });
    const teamManagerOnlyGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(secondCreator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_PROJECT_MANAGER",
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${teamTwo.id}/roles/grant`,
    });

    expect(crossTeamGrant.statusCode).toBe(403);
    expect(teamManagerOnlyGrant.statusCode).toBe(403);
  });

  it("blocks revoking a team project manager when linked projects would be orphaned and keeps rows unchanged", async () => {
    const creator = await harness.registerUser("team-revoke-orphan-creator");
    const projectManager = await harness.registerUser("team-revoke-orphan-pm");
    const projectOwner = await harness.registerUser("team-revoke-orphan-owner");
    const createResponse = await createTeam(creator.accessToken, {
      name: "Team Revoke Orphan",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: creator.user.id },
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: projectManager.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const projectOneResponse = await createProject(projectOwner.accessToken, {
      name: "Team Revoke Orphan Project One",
    });
    const projectTwoResponse = await createProject(projectOwner.accessToken, {
      name: "Team Revoke Orphan Project Two",
    });
    const { project: projectOne } = harness.parseJson<{ project: { id: number } }>(
      projectOneResponse.payload,
    );
    const { project: projectTwo } = harness.parseJson<{ project: { id: number } }>(
      projectTwoResponse.payload,
    );

    expect(membershipResponse.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsTeams).values([
      { projectId: projectOne.id, teamId: team.id },
      { projectId: projectTwo.id, teamId: team.id },
    ]).run();
    await harness.databaseService.persist();
    const demoteFirstOwner = await harness.app.inject({
      headers: harness.createAuthHeaders(projectManager.accessToken),
      method: "PUT",
      payload: {
        members: [{ roleCodes: [], userId: projectOwner.user.id }],
      },
      url: `/stc-proj-mgmt/api/projects/${projectOne.id}/members`,
    });
    const demoteSecondOwner = await harness.app.inject({
      headers: harness.createAuthHeaders(projectManager.accessToken),
      method: "PUT",
      payload: {
        members: [{ roleCodes: [], userId: projectOwner.user.id }],
      },
      url: `/stc-proj-mgmt/api/projects/${projectTwo.id}/members`,
    });

    const beforeRows = harness.databaseService.db
      .select()
      .from(usersTeamsTeamRoles)
      .where(eq(usersTeamsTeamRoles.teamId, team.id))
      .all();
    const revokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(projectManager.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_PROJECT_MANAGER",
        userId: projectManager.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/revoke`,
    });
    const afterRows = harness.databaseService.db
      .select()
      .from(usersTeamsTeamRoles)
      .where(eq(usersTeamsTeamRoles.teamId, team.id))
      .all();

    expect(demoteFirstOwner.statusCode).toBe(200);
    expect(demoteSecondOwner.statusCode).toBe(200);
    expect(revokeResponse.statusCode).toBe(409);
    expect(afterRows).toEqual(beforeRows);
  });

  it("allows deleting one of two linked teams when another linked team still preserves project-manager coverage", async () => {
    const projectOwner = await harness.registerUser("team-delete-covered-owner");
    const firstCreator = await harness.registerUser("team-delete-covered-first");
    const firstPm = await harness.registerUser("team-delete-covered-first-pm");
    const secondCreator = await harness.registerUser("team-delete-covered-second");
    const secondPm = await harness.registerUser("team-delete-covered-second-pm");
    const teamOneResponse = await createTeam(firstCreator.accessToken, {
      name: "Delete Covered Team One",
    });
    const teamTwoResponse = await createTeam(secondCreator.accessToken, {
      name: "Delete Covered Team Two",
    });
    const { team: teamOne } = harness.parseJson<{ team: { id: number } }>(
      teamOneResponse.payload,
    );
    const { team: teamTwo } = harness.parseJson<{ team: { id: number } }>(
      teamTwoResponse.payload,
    );
    const teamOneMembership = await harness.app.inject({
      headers: harness.createAuthHeaders(firstCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: firstCreator.user.id },
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: firstPm.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${teamOne.id}/members`,
    });
    const teamTwoMembership = await harness.app.inject({
      headers: harness.createAuthHeaders(secondCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: secondCreator.user.id },
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: secondPm.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${teamTwo.id}/members`,
    });
    const projectResponse = await createProject(projectOwner.accessToken, {
      name: "Delete Covered Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectResponse.payload,
    );

    expect(teamOneMembership.statusCode).toBe(200);
    expect(teamTwoMembership.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsTeams).values([
      { projectId: project.id, teamId: teamOne.id },
      { projectId: project.id, teamId: teamTwo.id },
    ]).run();
    await harness.databaseService.persist();

    const ownerDemotion = await harness.app.inject({
      headers: harness.createAuthHeaders(projectOwner.accessToken),
      method: "PUT",
      payload: {
        members: [{ roleCodes: [], userId: projectOwner.user.id }],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });
    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(firstCreator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/teams/${teamOne.id}`,
    });

    expect(ownerDemotion.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(200);
  });

  it("rejects duplicate admin self-grants and 404s on team reads after deletion", async () => {
    const creator = await harness.registerUser("team-admin-self-dup-creator");
    const admin = await harness.loginSeededAdmin();
    const createResponse = await createTeam(creator.accessToken, {
      name: "Team Admin Self Dup",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );
    const firstGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
        userId: admin.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/grant`,
    });
    const duplicateGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
        userId: admin.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/grant`,
    });
    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });
    const getResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });

    expect(firstGrant.statusCode).toBe(200);
    expect(duplicateGrant.statusCode).toBe(409);
    expect(deleteResponse.statusCode).toBe(200);
    expect(getResponse.statusCode).toBe(404);
  });

  it("removes admin self-granted team membership and roles when deleting a team", async () => {
    const creator = await harness.registerUser("team-admin-cleanup-creator");
    const admin = await harness.loginSeededAdmin();
    const createResponse = await createTeam(creator.accessToken, {
      name: "Team Admin Cleanup",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      createResponse.payload,
    );
    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
        userId: admin.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/grant`,
    });

    expect(grantResponse.statusCode).toBe(200);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });
    const lingeringMembership = harness.databaseService.db
      .select()
      .from(teamsUsers)
      .where(eq(teamsUsers.userId, admin.user.id))
      .all();
    const lingeringRoles = harness.databaseService.db
      .select()
      .from(usersTeamsTeamRoles)
      .where(eq(usersTeamsTeamRoles.userId, admin.user.id))
      .all();

    expect(deleteResponse.statusCode).toBe(200);
    expect(lingeringMembership).toHaveLength(0);
    expect(lingeringRoles).toHaveLength(0);
  });

  it("allows an organization team manager to manage a team and grant team manager within the organization", async () => {
    const orgCreator = await harness.registerUser("team-org-manager-creator");
    const orgTeamManager = await harness.registerUser("team-org-manager-user");
    const teamOwner = await harness.registerUser("team-org-manager-owner");
    const target = await harness.registerUser("team-org-manager-target");
    const orgResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: { name: "Team Manager Authority Org" },
      url: "/stc-proj-mgmt/api/organizations",
    });
    const teamResponse = await createTeam(teamOwner.accessToken, {
      name: "Team Managed By Org",
    });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(
      orgResponse.payload,
    );
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamResponse.payload,
    );

    const orgUsersUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { userId: orgCreator.user.id },
          { userId: orgTeamManager.user.id },
          { userId: target.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    const teamAssign = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    const orgRoleGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
        userId: orgTeamManager.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/roles/grant`,
    });
    const teamGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(orgTeamManager.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_TEAM_MANAGER",
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/grant`,
    });

    expect(orgUsersUpdate.statusCode).toBe(200);
    expect(teamAssign.statusCode).toBe(200);
    expect(orgRoleGrant.statusCode).toBe(200);
    expect(teamGrant.statusCode).toBe(200);
  });

  it("blocks deleting a team when that would remove the final effective project manager from a linked project", async () => {
    const creator = await harness.registerUser("team-delete-block-creator");
    const teamProjectManager = await harness.registerUser("team-delete-block-pm");
    const projectOwner = await harness.registerUser("team-delete-block-project-owner");
    const teamCreateResponse = await createTeam(creator.accessToken, {
      name: "Linked Team",
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
            roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"],
            userId: teamProjectManager.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const projectCreateResponse = await createProject(projectOwner.accessToken, {
      name: "Linked Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectCreateResponse.payload,
    );
    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();

    const projectMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(projectOwner.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [],
            userId: projectOwner.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(membershipResponse.statusCode).toBe(200);
    expect(projectMembershipResponse.statusCode).toBe(200);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });

    expect(deleteResponse.statusCode).toBe(409);
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
