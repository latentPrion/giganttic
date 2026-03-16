import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  projectsOrganizations,
  organizationsTeams,
  projects,
  projectsTeams,
  projectsUsers,
  teams,
  teamsUsers,
  users,
  usersCredentialTypes,
  usersOrganizations,
  usersOrganizationsOrganizationRoles,
  usersPasswordCredentials,
  usersProjectsProjectRoles,
  usersSessions,
  usersTeamsTeamRoles,
} from "../db/index.js";
import {
  expectBlockingConflictPayload,
  type BlockingConflictPayload,
} from "./blocking-conflict-helpers.js";
import { createCrudTestHarness } from "./crud-test-helpers.js";

const harness = createCrudTestHarness("users-crud.sqlite");
const PROJECT_MANAGER_ROLE = "GGTC_PROJECTROLE_PROJECT_MANAGER";
const PROJECT_OWNER_ROLE = "GGTC_PROJECTROLE_PROJECT_OWNER";

describe("users delete api", () => {
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

  function createOrganization(
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
      url: "/stc-proj-mgmt/api/organizations",
    });
  }

  beforeAll(async () => {
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it("returns a direct user profile with projects teams and organizations", async () => {
    const creator = await harness.registerUser("users-profile");
    const projectCreateResponse = await createProject(creator.accessToken, {
      name: "Profile Project",
    });
    const teamCreateResponse = await createTeam(creator.accessToken, {
      name: "Profile Team",
    });
    const organizationCreateResponse = await createOrganization(creator.accessToken, {
      name: "Profile Organization",
    });

    expect(projectCreateResponse.statusCode).toBe(201);
    expect(teamCreateResponse.statusCode).toBe(201);
    expect(organizationCreateResponse.statusCode).toBe(201);

    const getUserResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/users/${creator.user.id}`,
    });
    const payload = harness.parseJson<{
      organizations: Array<{ id: number; name: string }>;
      projects: Array<{ id: number; name: string }>;
      teams: Array<{ id: number; name: string }>;
      user: { id: number; isActive: boolean; username: string };
    }>(getUserResponse.payload);

    expect(getUserResponse.statusCode).toBe(200);
    expect(payload.user).toEqual(expect.objectContaining({
      id: creator.user.id,
      isActive: true,
      username: creator.user.username,
    }));
    expect(payload.projects.map((project) => project.name)).toContain("Profile Project");
    expect(payload.teams.map((team) => team.name)).toContain("Profile Team");
    expect(payload.organizations.map((organization) => organization.name))
      .toContain("Profile Organization");
  });

  it("allows deleting a user after project and team management have been transferred", async () => {
    const creator = await harness.registerUser("users-delete-creator");
    const replacement = await harness.registerUser("users-delete-replacement");
    const teamCreateResponse = await createTeam(creator.accessToken, {
      name: "Delete Transfer Team",
    });
    const projectCreateResponse = await createProject(creator.accessToken, {
      name: "Delete Transfer Project",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamCreateResponse.payload,
    );
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectCreateResponse.payload,
    );
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
            roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
            userId: replacement.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const projectMembershipResponse = await harness.app.inject({
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
            userId: replacement.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(teamMembershipResponse.statusCode).toBe(200);
    expect(projectMembershipResponse.statusCode).toBe(200);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${creator.user.id}`,
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, creator.user.id))
        .get(),
    ).toBeUndefined();
  });

  it("blocks self deletion when the caller is the sole remaining effective project manager", async () => {
    const creator = await harness.registerUser("users-delete-last-project-manager");
    const projectCreateResponse = await createProject(creator.accessToken, {
      name: "Blocked Self Delete Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectCreateResponse.payload,
    );

    expect(project.id).toBeGreaterThan(0);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${creator.user.id}`,
    });

    expect(deleteResponse.statusCode).toBe(409);
    expectBlockingConflictPayload(
      harness.parseJson<BlockingConflictPayload>(deleteResponse.payload),
      {
        firstBlockingObject: {
          id: project.id,
          kind: "project",
          reason: "last_owner",
        },
        message: "User delete would remove the last owner",
      },
    );
  });

  it("blocks self deletion when the caller is the sole remaining team manager", async () => {
    const creator = await harness.registerUser("users-delete-last-team-manager");
    const teamCreateResponse = await createTeam(creator.accessToken, {
      name: "Blocked Self Delete Team",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamCreateResponse.payload,
    );

    expect(team.id).toBeGreaterThan(0);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${creator.user.id}`,
    });

    expect(deleteResponse.statusCode).toBe(409);
    expectBlockingConflictPayload(
      harness.parseJson<BlockingConflictPayload>(deleteResponse.payload),
      {
        firstBlockingObject: {
          id: team.id,
          kind: "team",
          reason: "last_effective_team_manager",
        },
        message: "User delete would remove the last effective team manager",
      },
    );
  });

  it("allows an admin to delete another user only after management coverage remains", async () => {
    const admin = await harness.loginSeededAdmin();
    const creator = await harness.registerUser("users-delete-admin-target");
    const replacement = await harness.registerUser("users-delete-admin-replacement");
    const projectCreateResponse = await createProject(creator.accessToken, {
      name: "Admin Delete Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectCreateResponse.payload,
    );
    const blockedDelete = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${creator.user.id}`,
    });
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
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: replacement.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });
    const allowedDelete = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${creator.user.id}`,
    });

    expect(blockedDelete.statusCode).toBe(409);
    expectBlockingConflictPayload(
      harness.parseJson<BlockingConflictPayload>(blockedDelete.payload),
      {
        firstBlockingObject: {
          id: project.id,
          kind: "project",
          reason: "last_owner",
        },
        message: "User delete would remove the last owner",
      },
    );
    expect(membershipResponse.statusCode).toBe(200);
    expect(allowedDelete.statusCode).toBe(200);
  });

  it("reports at least one concrete blocking project when deleting a user who owns multiple projects", async () => {
    const creator = await harness.registerUser("users-delete-multi-owner");
    const replacement = await harness.registerUser("users-delete-multi-owner-replacement");
    const firstProjectResponse = await createProject(creator.accessToken, {
      name: "First Owned Project",
    });
    const secondProjectResponse = await createProject(creator.accessToken, {
      name: "Second Owned Project",
    });
    const firstProject = harness.parseJson<{ project: { id: number } }>(
      firstProjectResponse.payload,
    ).project;
    const secondProject = harness.parseJson<{ project: { id: number } }>(
      secondProjectResponse.payload,
    ).project;

    await harness.app.inject({
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
            userId: replacement.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${secondProject.id}/members`,
    });

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${creator.user.id}`,
    });
    const payload = harness.parseJson<BlockingConflictPayload>(deleteResponse.payload);

    expect(deleteResponse.statusCode).toBe(409);
    expect(payload.message).toBe("User delete would remove the last owner");
    expect(payload.blockingObjects.length).toBeGreaterThan(0);
    expect(payload.blockingObjects[0].kind).toBe("project");
    expect([firstProject.id, secondProject.id]).toContain(payload.blockingObjects[0].id);
    expect(payload.blockingObjects[0].reason).toBe("last_owner");
  });

  it("deleting a user cascades sessions, credential rows, memberships, and role assignments", async () => {
    const creator = await harness.registerUser("users-delete-cascade");
    const teamCreateResponse = await createTeam(creator.accessToken, {
      name: "Cascade Delete Team",
    });
    const projectCreateResponse = await createProject(creator.accessToken, {
      name: "Cascade Delete Project",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamCreateResponse.payload,
    );
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectCreateResponse.payload,
    );
    const replacement = await harness.registerUser("users-delete-cascade-replacement");
    const teamTransferResponse = await harness.app.inject({
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
            userId: replacement.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const projectTransferResponse = await harness.app.inject({
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
            userId: replacement.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(teamTransferResponse.statusCode).toBe(200);
    expect(projectTransferResponse.statusCode).toBe(200);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${creator.user.id}`,
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db
        .select()
        .from(usersSessions)
        .where(eq(usersSessions.userId, creator.user.id))
        .all(),
    ).toHaveLength(0);
    expect(
      harness.databaseService.db
        .select()
        .from(usersProjectsProjectRoles)
        .where(eq(usersProjectsProjectRoles.userId, creator.user.id))
        .all(),
    ).toHaveLength(0);
    expect(
      harness.databaseService.db
        .select()
        .from(usersTeamsTeamRoles)
        .where(eq(usersTeamsTeamRoles.userId, creator.user.id))
        .all(),
    ).toHaveLength(0);
    expect(
      harness.databaseService.db
        .select()
        .from(usersCredentialTypes)
        .where(eq(usersCredentialTypes.userId, creator.user.id))
        .all(),
    ).toHaveLength(0);
    expect(
      harness.databaseService.db
        .select()
        .from(projects)
        .where(eq(projects.id, project.id))
        .get(),
    ).toBeDefined();
    expect(
      harness.databaseService.db
        .select()
        .from(teams)
        .where(eq(teams.id, team.id))
        .get(),
    ).toBeDefined();
  });

  it("checks all affected projects when deleting a user who is an indirect project manager through multiple teams", async () => {
    const manager = await harness.registerUser("users-delete-multi-project-manager");
    const firstTeamCreator = await harness.registerUser("users-delete-multi-project-first-creator");
    const secondTeamCreator = await harness.registerUser("users-delete-multi-project-second-creator");
    const firstProjectOwner = await harness.registerUser("users-delete-multi-project-first-owner");
    const secondProjectOwner = await harness.registerUser("users-delete-multi-project-second-owner");
    const teamOneResponse = await createTeam(firstTeamCreator.accessToken, {
      name: "User Multi Project Team One",
    });
    const teamTwoResponse = await createTeam(secondTeamCreator.accessToken, {
      name: "User Multi Project Team Two",
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
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: manager.user.id },
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
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: manager.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${teamTwo.id}/members`,
    });
    const projectOneResponse = await createProject(firstProjectOwner.accessToken, {
      name: "User Multi Project One",
    });
    const projectTwoResponse = await createProject(secondProjectOwner.accessToken, {
      name: "User Multi Project Two",
    });
    const { project: projectOne } = harness.parseJson<{ project: { id: number } }>(
      projectOneResponse.payload,
    );
    const { project: projectTwo } = harness.parseJson<{ project: { id: number } }>(
      projectTwoResponse.payload,
    );

    expect(teamOneMembership.statusCode).toBe(200);
    expect(teamTwoMembership.statusCode).toBe(200);

    harness.databaseService.db.insert(projectsTeams).values([
      { projectId: projectOne.id, teamId: teamOne.id },
      { projectId: projectTwo.id, teamId: teamTwo.id },
    ]).run();

    const projectOneDemotion = await harness.app.inject({
      headers: harness.createAuthHeaders(firstProjectOwner.accessToken),
      method: "PUT",
      payload: {
        members: [{ roleCodes: [PROJECT_OWNER_ROLE], userId: firstProjectOwner.user.id }],
      },
      url: `/stc-proj-mgmt/api/projects/${projectOne.id}/members`,
    });
    const projectTwoDemotion = await harness.app.inject({
      headers: harness.createAuthHeaders(secondProjectOwner.accessToken),
      method: "PUT",
      payload: {
        members: [{ roleCodes: [PROJECT_OWNER_ROLE], userId: secondProjectOwner.user.id }],
      },
      url: `/stc-proj-mgmt/api/projects/${projectTwo.id}/members`,
    });
    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(manager.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${manager.user.id}`,
    });

    expect(projectOneDemotion.statusCode).toBe(200);
    expect(projectTwoDemotion.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(409);
  });

  it("blocks user deletion atomically when the user is sole team manager on one team and sole effective project manager on another project", async () => {
    const manager = await harness.registerUser("users-delete-atomic-manager");
    const projectOwner = await harness.registerUser("users-delete-atomic-owner");
    const teamResponse = await createTeam(manager.accessToken, {
      name: "User Atomic Team",
    });
    const projectResponse = await createProject(manager.accessToken, {
      name: "User Atomic Project",
    });
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamResponse.payload,
    );
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectResponse.payload,
    );

    expect(team.id).toBeGreaterThan(0);
    expect(project.id).toBeGreaterThan(0);
    expect(projectOwner.user.id).toBeGreaterThan(0);

    const beforeTeamRows = harness.databaseService.db
      .select()
      .from(teamsUsers)
      .where(eq(teamsUsers.userId, manager.user.id))
      .all();
    const beforeProjectRows = harness.databaseService.db
      .select()
      .from(projectsUsers)
      .where(eq(projectsUsers.userId, manager.user.id))
      .all();

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(manager.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${manager.user.id}`,
    });
    const afterTeamRows = harness.databaseService.db
      .select()
      .from(teamsUsers)
      .where(eq(teamsUsers.userId, manager.user.id))
      .all();
    const afterProjectRows = harness.databaseService.db
      .select()
      .from(projectsUsers)
      .where(eq(projectsUsers.userId, manager.user.id))
      .all();

    expect(deleteResponse.statusCode).toBe(409);
    expect(afterTeamRows).toEqual(beforeTeamRows);
    expect(afterProjectRows).toEqual(beforeProjectRows);
  });

  it("removes revoked and active sessions when deleting a user", async () => {
    const creator = await harness.registerUser("users-delete-sessions");
    const replacement = await harness.registerUser("users-delete-sessions-replacement");
    const projectResponse = await createProject(creator.accessToken, {
      name: "User Session Cleanup Project",
    });
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectResponse.payload,
    );
    const secondLoginResponse = await harness.app.inject({
      method: "POST",
      payload: {
        password: "secret123",
        username: creator.user.username,
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });
    const secondLoginBody = harness.parseJson<{
      accessToken: string;
      session: { id: string };
    }>(secondLoginResponse.payload);
    const revokeResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        sessionIds: [secondLoginBody.session.id],
      },
      url: "/stc-proj-mgmt/api/auth/session/revoke",
    });
    const transferResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE], userId: creator.user.id },
          { roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE], userId: replacement.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    expect(secondLoginResponse.statusCode).toBe(201);
    expect(revokeResponse.statusCode).toBe(201);
    expect(transferResponse.statusCode).toBe(200);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${creator.user.id}`,
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db
        .select()
        .from(usersSessions)
        .where(eq(usersSessions.userId, creator.user.id))
        .all(),
    ).toHaveLength(0);
  });

  it("allows deleting a user when organization-derived project and team manager coverage remains", async () => {
    const orgCreator = await harness.registerUser("users-org-coverage-creator");
    const replacement = await harness.registerUser("users-org-coverage-replacement");
    const target = await harness.registerUser("users-org-coverage-target");
    const projectOwner = await harness.registerUser("users-org-coverage-project-owner");
    const teamOwner = await harness.registerUser("users-org-coverage-team-owner");
    const orgResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: { name: "Delete Coverage Org" },
      url: "/stc-proj-mgmt/api/organizations",
    });
    const projectResponse = await createProject(projectOwner.accessToken, {
      name: "Delete Coverage Project",
    });
    const teamResponse = await createTeam(teamOwner.accessToken, {
      name: "Delete Coverage Team",
    });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(
      orgResponse.payload,
    );
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectResponse.payload,
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
          { userId: replacement.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    const projectAssociation = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: project.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    const teamAssociation = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    const orgProjectRoleGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
        userId: replacement.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/roles/grant`,
    });
    const orgTeamRoleGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
        userId: replacement.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/roles/grant`,
    });

    expect(orgUsersUpdate.statusCode).toBe(200);
    expect(projectAssociation.statusCode).toBe(200);
    expect(teamAssociation.statusCode).toBe(200);
    expect(orgProjectRoleGrant.statusCode).toBe(200);
    expect(orgTeamRoleGrant.statusCode).toBe(200);
    expect(organization.id).toBeGreaterThan(0);
    expect(project.id).toBeGreaterThan(0);
    expect(team.id).toBeGreaterThan(0);
    expect(
      harness.databaseService.db
        .select()
        .from(organizationsTeams)
        .where(eq(organizationsTeams.teamId, team.id))
        .all(),
    ).toHaveLength(1);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(target.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${target.user.id}`,
    });

    expect(deleteResponse.statusCode).toBe(200);
  });

  it("blocks user deletion atomically when mixed direct, team-derived, and org-derived project coverage would be orphaned", async () => {
    const manager = await harness.registerUser("users-mixed-project-manager");
    const teamOwner = await harness.registerUser("users-mixed-team-owner");
    const projectTwoOwner = await harness.registerUser("users-mixed-project-two-owner");
    const projectThreeOwner = await harness.registerUser("users-mixed-project-three-owner");
    const orgCreator = await harness.registerUser("users-mixed-org-creator");
    const projectOneResponse = await createProject(manager.accessToken, {
      name: "Mixed Direct Project",
    });
    const teamResponse = await createTeam(teamOwner.accessToken, {
      name: "Mixed Project Team",
    });
    const projectTwoResponse = await createProject(projectTwoOwner.accessToken, {
      name: "Mixed Team Project",
    });
    const projectThreeResponse = await createProject(projectThreeOwner.accessToken, {
      name: "Mixed Org Project",
    });
    const orgResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: { name: "Mixed Source Org" },
      url: "/stc-proj-mgmt/api/organizations",
    });
    const { project: projectOne } = harness.parseJson<{ project: { id: number } }>(
      projectOneResponse.payload,
    );
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);
    const { project: projectTwo } = harness.parseJson<{ project: { id: number } }>(
      projectTwoResponse.payload,
    );
    const { project: projectThree } = harness.parseJson<{ project: { id: number } }>(
      projectThreeResponse.payload,
    );
    const { organization } = harness.parseJson<{ organization: { id: number } }>(
      orgResponse.payload,
    );

    await harness.app.inject({
      headers: harness.createAuthHeaders(teamOwner.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: teamOwner.user.id },
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: manager.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    harness.databaseService.db.insert(projectsTeams).values({
      projectId: projectTwo.id,
      teamId: team.id,
    }).run();
    await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: orgCreator.user.id }, { userId: manager.user.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: projectThree.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
        userId: manager.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/roles/grant`,
    });

    const beforeProjectRoles = harness.databaseService.db
      .select()
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.userId, manager.user.id))
      .all();
    const beforeTeamRoles = harness.databaseService.db
      .select()
      .from(usersTeamsTeamRoles)
      .where(eq(usersTeamsTeamRoles.userId, manager.user.id))
      .all();
    const beforeOrgRoles = harness.databaseService.db
      .select()
      .from(usersOrganizationsOrganizationRoles)
      .where(eq(usersOrganizationsOrganizationRoles.userId, manager.user.id))
      .all();

    expect(projectOne.id).toBeGreaterThan(0);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(manager.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${manager.user.id}`,
    });

    expect(deleteResponse.statusCode).toBe(409);
    expect(
      harness.databaseService.db
        .select()
        .from(usersProjectsProjectRoles)
        .where(eq(usersProjectsProjectRoles.userId, manager.user.id))
        .all(),
    ).toEqual(beforeProjectRoles);
    expect(
      harness.databaseService.db
        .select()
        .from(usersTeamsTeamRoles)
        .where(eq(usersTeamsTeamRoles.userId, manager.user.id))
        .all(),
    ).toEqual(beforeTeamRoles);
    expect(
      harness.databaseService.db
        .select()
        .from(usersOrganizationsOrganizationRoles)
        .where(eq(usersOrganizationsOrganizationRoles.userId, manager.user.id))
        .all(),
    ).toEqual(beforeOrgRoles);
  });

  it("blocks user deletion when direct and org-derived team management would both be orphaned", async () => {
    const manager = await harness.registerUser("users-mixed-team-manager");
    const orgCreator = await harness.registerUser("users-mixed-team-org-creator");
    const otherTeamOwner = await harness.registerUser("users-mixed-team-owner");
    const directTeamResponse = await createTeam(manager.accessToken, {
      name: "Direct Managed Team",
    });
    const orgTeamResponse = await createTeam(otherTeamOwner.accessToken, {
      name: "Org Managed Team",
    });
    const orgResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: { name: "Team Coverage Org" },
      url: "/stc-proj-mgmt/api/organizations",
    });
    const { team: directTeam } = harness.parseJson<{ team: { id: number } }>(
      directTeamResponse.payload,
    );
    const { team: orgTeam } = harness.parseJson<{ team: { id: number } }>(
      orgTeamResponse.payload,
    );
    const { organization } = harness.parseJson<{ organization: { id: number } }>(
      orgResponse.payload,
    );

    await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: orgCreator.user.id }, { userId: manager.user.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(otherTeamOwner.accessToken),
      method: "PUT",
      payload: {
        members: [{ roleCodes: [], userId: otherTeamOwner.user.id }],
      },
      url: `/stc-proj-mgmt/api/teams/${orgTeam.id}/members`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: { teamId: orgTeam.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(orgCreator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
        userId: manager.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/roles/grant`,
    });

    const beforeTeamRows = harness.databaseService.db
      .select()
      .from(teamsUsers)
      .where(eq(teamsUsers.userId, manager.user.id))
      .all();
    const beforeOrgRows = harness.databaseService.db
      .select()
      .from(usersOrganizationsOrganizationRoles)
      .where(eq(usersOrganizationsOrganizationRoles.userId, manager.user.id))
      .all();

    expect(directTeam.id).toBeGreaterThan(0);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(manager.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${manager.user.id}`,
    });

    expect(deleteResponse.statusCode).toBe(409);
    expect(
      harness.databaseService.db
        .select()
        .from(teamsUsers)
        .where(eq(teamsUsers.userId, manager.user.id))
        .all(),
    ).toEqual(beforeTeamRows);
    expect(
      harness.databaseService.db
        .select()
        .from(usersOrganizationsOrganizationRoles)
        .where(eq(usersOrganizationsOrganizationRoles.userId, manager.user.id))
        .all(),
    ).toEqual(beforeOrgRows);
  });

  it("removes org visibility when a user is deleted and the org was only directly visible to that user", async () => {
    const creator = await harness.registerUser("users-delete-org-vis-creator");
    const target = await harness.registerUser("users-delete-org-vis-target");
    const replacement = await harness.registerUser("users-delete-org-vis-replacement");
    const orgResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { name: "Delete User Visibility Org" },
      url: "/stc-proj-mgmt/api/organizations",
    });
    const projectResponse = await createProject(target.accessToken, {
      name: "Delete User Visibility Project",
    });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(
      orgResponse.payload,
    );
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectResponse.payload,
    );

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: creator.user.id }, { userId: target.user.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(target.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE], userId: target.user.id },
          { roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE], userId: replacement.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    const beforeGet = await harness.app.inject({
      headers: harness.createAuthHeaders(target.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
    });
    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(target.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/users/${target.user.id}`,
    });

    expect(beforeGet.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(200);
  });
});
