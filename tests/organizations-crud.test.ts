import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  organizations,
  organizationsTeams,
  projects,
  projectsOrganizations,
  projectsTeams,
  teams,
  usersOrganizations,
  usersOrganizationsOrganizationRoles,
} from "../db/index.js";
import {
  MISSING_ENTITY_ID,
  createCrudTestHarness,
} from "./crud-test-helpers.js";

const harness = createCrudTestHarness("organizations-crud.sqlite");

describe("organizations crud api", () => {
  function createOrganization(
    accessToken: string,
    payload: { description?: string | null; name: string },
  ) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "POST",
      payload,
      url: "/stc-proj-mgmt/api/organizations",
    });
  }

  function createProject(
    accessToken: string,
    payload: { description?: string | null; name: string },
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
    payload: { description?: string | null; name: string },
  ) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "POST",
      payload,
      url: "/stc-proj-mgmt/api/teams",
    });
  }

  function getOrganization(accessToken: string, organizationId: number) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/organizations/${organizationId}`,
    });
  }

  function listOrganizations(accessToken: string) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/organizations",
    });
  }

  function grantOrganizationRole(
    accessToken: string,
    organizationId: number,
    payload: { roleCode: string; userId: number },
  ) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "POST",
      payload,
      url: `/stc-proj-mgmt/api/organizations/${organizationId}/roles/grant`,
    });
  }

  function revokeOrganizationRole(
    accessToken: string,
    organizationId: number,
    payload: { roleCode: string; userId: number },
  ) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "POST",
      payload,
      url: `/stc-proj-mgmt/api/organizations/${organizationId}/roles/revoke`,
    });
  }

  beforeAll(async () => {
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it("allows any authenticated user to create an organization and makes the creator an organization manager member", async () => {
    const creator = await harness.registerUser("org-creator");
    const response = await createOrganization(creator.accessToken, {
      description: "Umbrella org",
      name: "Umbrella",
    });
    const body = harness.parseJson<{ organization: { id: number; name: string } }>(
      response.payload,
    );

    expect(response.statusCode).toBe(201);
    expect(body.organization.name).toBe("Umbrella");

    const membershipRow = harness.databaseService.db
      .select()
      .from(usersOrganizations)
      .where(eq(usersOrganizations.organizationId, body.organization.id))
      .get();
    const roleRow = harness.databaseService.db
      .select()
      .from(usersOrganizationsOrganizationRoles)
      .where(eq(usersOrganizationsOrganizationRoles.organizationId, body.organization.id))
      .get();

    expect(membershipRow?.userId).toBe(creator.user.id);
    expect(roleRow?.userId).toBe(creator.user.id);
    expect(roleRow?.roleCode).toBe("GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER");
  });

  it("rejects unauthenticated access to all organization routes", async () => {
    const responses = await Promise.all([
      harness.app.inject({
        method: "POST",
        payload: { name: "Anonymous Org" },
        url: "/stc-proj-mgmt/api/organizations",
      }),
      harness.app.inject({ method: "GET", url: "/stc-proj-mgmt/api/organizations" }),
      harness.app.inject({
        method: "GET",
        url: `/stc-proj-mgmt/api/organizations/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        method: "PATCH",
        payload: { name: "Nope" },
        url: `/stc-proj-mgmt/api/organizations/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        method: "PUT",
        payload: { members: [{ userId: 1 }] },
        url: `/stc-proj-mgmt/api/organizations/${MISSING_ENTITY_ID}/users`,
      }),
      harness.app.inject({
        method: "PUT",
        payload: { projects: [{ projectId: 1 }] },
        url: `/stc-proj-mgmt/api/organizations/${MISSING_ENTITY_ID}/projects`,
      }),
      harness.app.inject({
        method: "POST",
        payload: { teamId: 1 },
        url: `/stc-proj-mgmt/api/organizations/${MISSING_ENTITY_ID}/teams`,
      }),
      harness.app.inject({
        method: "POST",
        payload: {
          roleCode: "GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER",
          userId: 1,
        },
        url: `/stc-proj-mgmt/api/organizations/${MISSING_ENTITY_ID}/roles/grant`,
      }),
      harness.app.inject({
        method: "DELETE",
        url: `/stc-proj-mgmt/api/organizations/${MISSING_ENTITY_ID}`,
      }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(401);
    }
  });

  it("allows organization managers to manage direct users, projects, and teams", async () => {
    const creator = await harness.registerUser("org-manage-creator");
    const userMember = await harness.registerUser("org-manage-user");
    const projectOwner = await harness.registerUser("org-manage-project-owner");
    const teamOwner = await harness.registerUser("org-manage-team-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Manage Org" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Manage Project" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Manage Team" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(
      orgResponse.payload,
    );
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectResponse.payload,
    );
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamResponse.payload,
    );

    const usersUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [{ userId: creator.user.id }, { userId: userMember.user.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    const projectsUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: project.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    const teamAssign = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });

    expect(usersUpdate.statusCode).toBe(200);
    expect(projectsUpdate.statusCode).toBe(200);
    expect(teamAssign.statusCode).toBe(200);
  });

  it("allows sysadmin to self-grant organization manager and then delete an organization", async () => {
    const creator = await harness.registerUser("org-admin-self-creator");
    const admin = await harness.loginSeededAdmin();
    const orgResponse = await createOrganization(creator.accessToken, { name: "Admin Org" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(
      orgResponse.payload,
    );

    const blockedDelete = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
    });
    const selfGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER",
        userId: admin.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/roles/grant`,
    });
    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
    });

    expect(blockedDelete.statusCode).toBe(403);
    expect(selfGrant.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(200);
  });

  it("returns 404 for nonexistent organization routes", async () => {
    const admin = await harness.loginSeededAdmin();
    const responses = await Promise.all([
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "GET",
        url: `/stc-proj-mgmt/api/organizations/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "PATCH",
        payload: { name: "Missing Org" },
        url: `/stc-proj-mgmt/api/organizations/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "POST",
        payload: { teamId: 1 },
        url: `/stc-proj-mgmt/api/organizations/${MISSING_ENTITY_ID}/teams`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(admin.accessToken),
        method: "DELETE",
        url: `/stc-proj-mgmt/api/organizations/${MISSING_ENTITY_ID}`,
      }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(404);
    }
  });

  it("blocks assigning one team to multiple organizations", async () => {
    const firstCreator = await harness.registerUser("org-team-unique-first");
    const secondCreator = await harness.registerUser("org-team-unique-second");
    const teamOwner = await harness.registerUser("org-team-unique-owner");
    const firstOrg = await createOrganization(firstCreator.accessToken, { name: "First Org" });
    const secondOrg = await createOrganization(secondCreator.accessToken, { name: "Second Org" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Unique Team" });
    const { organization: firstOrganization } = harness.parseJson<{ organization: { id: number } }>(
      firstOrg.payload,
    );
    const { organization: secondOrganization } = harness.parseJson<{ organization: { id: number } }>(
      secondOrg.payload,
    );
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamResponse.payload,
    );

    const firstAssign = await harness.app.inject({
      headers: harness.createAuthHeaders(firstCreator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${firstOrganization.id}/teams`,
    });
    const secondAssign = await harness.app.inject({
      headers: harness.createAuthHeaders(secondCreator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${secondOrganization.id}/teams`,
    });

    expect(firstAssign.statusCode).toBe(200);
    expect(secondAssign.statusCode).toBe(409);
  });

  it("allows an organization project manager to manage a directly associated project", async () => {
    const creator = await harness.registerUser("org-project-manager-creator");
    const orgManager = await harness.registerUser("org-project-manager-user");
    const projectOwner = await harness.registerUser("org-project-manager-project-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Project Manager Org" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Org Managed Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(
      orgResponse.payload,
    );
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectResponse.payload,
    );

    const usersUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [{ userId: creator.user.id }, { userId: orgManager.user.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    const projectsUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: project.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
        userId: orgManager.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/roles/grant`,
    });
    const projectUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(orgManager.accessToken),
      method: "PATCH",
      payload: { description: "Updated via org authority" },
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(usersUpdate.statusCode).toBe(200);
    expect(projectsUpdate.statusCode).toBe(200);
    expect(grantResponse.statusCode).toBe(200);
    expect(projectUpdate.statusCode).toBe(200);
  });

  it("allows an organization team manager to manage a team in the organization but not act as an effective project manager by itself", async () => {
    const creator = await harness.registerUser("org-team-manager-creator");
    const teamManager = await harness.registerUser("org-team-manager-user");
    const teamOwner = await harness.registerUser("org-team-manager-team-owner");
    const projectOwner = await harness.registerUser("org-team-manager-project-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Team Manager Org" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Org Team" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Org Team Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(
      orgResponse.payload,
    );
    const { team } = harness.parseJson<{ team: { id: number } }>(
      teamResponse.payload,
    );
    const { project } = harness.parseJson<{ project: { id: number } }>(
      projectResponse.payload,
    );

    const usersUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [{ userId: creator.user.id }, { userId: teamManager.user.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    const teamAssign = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    const roleGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
        userId: teamManager.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/roles/grant`,
    });

    harness.databaseService.db.insert(projectsOrganizations).values({
      organizationId: organization.id,
      projectId: project.id,
    }).run();
    await harness.databaseService.persist();

    const teamUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(teamManager.accessToken),
      method: "PATCH",
      payload: { description: "Updated via org team manager" },
      url: `/stc-proj-mgmt/api/teams/${team.id}`,
    });
    const projectUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(teamManager.accessToken),
      method: "PATCH",
      payload: { description: "Should fail" },
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(usersUpdate.statusCode).toBe(200);
    expect(teamAssign.statusCode).toBe(200);
    expect(roleGrant.statusCode).toBe(200);
    expect(teamUpdate.statusCode).toBe(200);
    expect(projectUpdate.statusCode).toBe(403);
  });

  it("allows deleting an organization when it has a direct project association but no org project manager coverage on that project", async () => {
    const creator = await harness.registerUser("org-delete-direct-project-safe-creator");
    const projectOwner = await harness.registerUser("org-delete-direct-project-safe-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Delete Safe Org" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Delete Safe Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);

    const projectAssociation = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: project.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
    });

    expect(projectAssociation.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db
        .select()
        .from(projects)
        .where(eq(projects.id, project.id))
        .all(),
    ).toHaveLength(1);
  });

  it("allows deleting an organization when its org project manager coverage is not the last effective project manager", async () => {
    const creator = await harness.registerUser("org-delete-fallback-creator");
    const orgProjectManager = await harness.registerUser("org-delete-fallback-org-pm");
    const projectOwner = await harness.registerUser("org-delete-fallback-project-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Delete Fallback Org" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Delete Fallback Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [{ userId: creator.user.id }, { userId: orgProjectManager.user.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: project.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
      userId: orgProjectManager.user.id,
    });

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
    });

    expect(deleteResponse.statusCode).toBe(200);
  });

  it("blocks deleting an organization when its org project manager coverage is the last effective project manager for a directly associated project", async () => {
    const creator = await harness.registerUser("org-delete-last-pm-creator");
    const orgProjectManager = await harness.registerUser("org-delete-last-pm-user");
    const projectOwner = await harness.registerUser("org-delete-last-pm-project-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Delete Last PM Org" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Delete Last PM Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [{ userId: creator.user.id }, { userId: orgProjectManager.user.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: project.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
      userId: orgProjectManager.user.id,
    });
    const membershipReplace = await harness.app.inject({
      headers: harness.createAuthHeaders(projectOwner.accessToken),
      method: "PUT",
      payload: {
        members: [{ roleCodes: [], userId: projectOwner.user.id }],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
    });

    expect(membershipReplace.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(409);
  });

  it("blocks organization deletion atomically when one directly associated project would lose its last effective project manager", async () => {
    const creator = await harness.registerUser("org-delete-multi-project-creator");
    const orgProjectManager = await harness.registerUser("org-delete-multi-project-org-pm");
    const safeProjectOwner = await harness.registerUser("org-delete-multi-project-safe-owner");
    const orphanProjectOwner = await harness.registerUser("org-delete-multi-project-orphan-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Delete Multi Project Org" });
    const safeProjectResponse = await createProject(safeProjectOwner.accessToken, { name: "Delete Multi Project Safe" });
    const orphanProjectResponse = await createProject(orphanProjectOwner.accessToken, { name: "Delete Multi Project Orphan" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { project: safeProject } = harness.parseJson<{ project: { id: number } }>(safeProjectResponse.payload);
    const { project: orphanProject } = harness.parseJson<{ project: { id: number } }>(orphanProjectResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [{ userId: creator.user.id }, { userId: orgProjectManager.user.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        projects: [{ projectId: safeProject.id }, { projectId: orphanProject.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
      userId: orgProjectManager.user.id,
    });
    const orphanMembershipReplace = await harness.app.inject({
      headers: harness.createAuthHeaders(orphanProjectOwner.accessToken),
      method: "PUT",
      payload: {
        members: [{ roleCodes: [], userId: orphanProjectOwner.user.id }],
      },
      url: `/stc-proj-mgmt/api/projects/${orphanProject.id}/members`,
    });

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
    });

    expect(orphanMembershipReplace.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(409);
    expect(
      harness.databaseService.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organization.id))
        .all(),
    ).toHaveLength(1);
    expect(
      harness.databaseService.db
        .select()
        .from(projectsOrganizations)
        .where(eq(projectsOrganizations.organizationId, organization.id))
        .all(),
    ).toHaveLength(2);
    expect(
      harness.databaseService.db
        .select()
        .from(usersOrganizationsOrganizationRoles)
        .where(eq(usersOrganizationsOrganizationRoles.organizationId, organization.id))
        .all(),
    ).toHaveLength(2);
  });

  it("blocks deleting an organization when it still owns any teams even if project coverage would otherwise remain safe", async () => {
    const creator = await harness.registerUser("org-delete-team-owned-creator");
    const projectOwner = await harness.registerUser("org-delete-team-owned-project-owner");
    const teamOwner = await harness.registerUser("org-delete-team-owned-team-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Delete Team Owned Org" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Delete Team Owned Project" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Delete Team Owned Team" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);

    const projectAssociation = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: project.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    const teamAssociation = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
    });

    expect(projectAssociation.statusCode).toBe(200);
    expect(teamAssociation.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(409);
  });

  it("allows org visibility through indirect membership on an org-owned team", async () => {
    const creator = await harness.registerUser("org-indirect-creator");
    const teamOwner = await harness.registerUser("org-indirect-team-owner");
    const indirectMember = await harness.registerUser("org-indirect-member");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Indirect Visibility Org" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Indirect Visibility Team" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);

    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamOwner.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: teamOwner.user.id },
          { roleCodes: [], userId: indirectMember.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    const teamAssign = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    const listResponse = await listOrganizations(indirectMember.accessToken);
    const getResponse = await getOrganization(indirectMember.accessToken, organization.id);
    const listBody = harness.parseJson<{ organizations: Array<{ id: number }> }>(
      listResponse.payload,
    );

    expect(membershipResponse.statusCode).toBe(200);
    expect(teamAssign.statusCode).toBe(200);
    expect(listResponse.statusCode).toBe(200);
    expect(getResponse.statusCode).toBe(200);
    expect(listBody.organizations.some((row) => row.id === organization.id)).toBe(true);
  });

  it("allows targeting org roles at indirect org members on org-owned teams", async () => {
    const creator = await harness.registerUser("org-indirect-role-creator");
    const teamOwner = await harness.registerUser("org-indirect-role-owner");
    const indirectMember = await harness.registerUser("org-indirect-role-member");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Indirect Role Org" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Indirect Role Team" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(teamOwner.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: teamOwner.user.id },
          { roleCodes: [], userId: indirectMember.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });

    const grantResponse = await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
      userId: indirectMember.user.id,
    });

    expect(grantResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db
        .select()
        .from(usersOrganizationsOrganizationRoles)
        .where(eq(usersOrganizationsOrganizationRoles.userId, indirectMember.user.id))
        .all(),
    ).toHaveLength(1);
  });

  it("keeps organization rows unchanged after a blocked delete caused by last project-manager coverage", async () => {
    const creator = await harness.registerUser("org-delete-atomic-creator");
    const orgProjectManager = await harness.registerUser("org-delete-atomic-org-pm");
    const projectOwner = await harness.registerUser("org-delete-atomic-project-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Atomic Org" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Atomic Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [{ userId: creator.user.id }, { userId: orgProjectManager.user.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: project.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
      userId: orgProjectManager.user.id,
    });
    const membershipReplace = await harness.app.inject({
      headers: harness.createAuthHeaders(projectOwner.accessToken),
      method: "PUT",
      payload: {
        members: [{ roleCodes: [], userId: projectOwner.user.id }],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
    });

    expect(membershipReplace.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(409);
    expect(
      harness.databaseService.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organization.id))
        .all(),
    ).toHaveLength(1);
    expect(
      harness.databaseService.db
        .select()
        .from(projectsOrganizations)
        .where(eq(projectsOrganizations.organizationId, organization.id))
        .all(),
    ).toHaveLength(1);
    expect(
      harness.databaseService.db
        .select()
        .from(usersOrganizationsOrganizationRoles)
        .where(eq(usersOrganizationsOrganizationRoles.organizationId, organization.id))
        .all(),
    ).toHaveLength(2);
  });

  it("allows an organization project manager to manage a project through an org-owned linked team", async () => {
    const creator = await harness.registerUser("org-via-team-creator");
    const orgProjectManager = await harness.registerUser("org-via-team-manager");
    const teamOwner = await harness.registerUser("org-via-team-team-owner");
    const projectOwner = await harness.registerUser("org-via-team-project-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Via Team Org" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Via Team Team" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Via Team Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [{ userId: creator.user.id }, { userId: orgProjectManager.user.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
      userId: orgProjectManager.user.id,
    });
    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();

    const projectUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(orgProjectManager.accessToken),
      method: "PATCH",
      payload: { description: "Updated through linked team org coverage" },
      url: `/stc-proj-mgmt/api/projects/${project.id}`,
    });

    expect(projectUpdate.statusCode).toBe(200);
  });

  it("lets an organization team manager grant team project manager only to members of an eligible org-owned linked team", async () => {
    const creator = await harness.registerUser("org-team-pm-grant-creator");
    const orgTeamManager = await harness.registerUser("org-team-pm-grant-manager");
    const teamOwner = await harness.registerUser("org-team-pm-grant-owner");
    const target = await harness.registerUser("org-team-pm-grant-target");
    const outsider = await harness.registerUser("org-team-pm-grant-outsider");
    const projectOwner = await harness.registerUser("org-team-pm-grant-project-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Org Team PM Grant" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Org Team PM Team" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Org Team PM Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [{ userId: creator.user.id }, { userId: orgTeamManager.user.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(teamOwner.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: teamOwner.user.id },
          { roleCodes: [], userId: target.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
      userId: orgTeamManager.user.id,
    });
    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();

    const allowedGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(orgTeamManager.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_PROJECT_MANAGER",
        userId: target.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/grant`,
    });
    const forbiddenGrant = await harness.app.inject({
      headers: harness.createAuthHeaders(orgTeamManager.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_TEAMROLE_PROJECT_MANAGER",
        userId: outsider.user.id,
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/roles/grant`,
    });

    expect(allowedGrant.statusCode).toBe(200);
    expect(forbiddenGrant.statusCode).toBe(409);
  });

  it("lets an organization team manager grant direct project manager on eligible projects to users outside the org", async () => {
    const creator = await harness.registerUser("org-team-grant-project-creator");
    const orgTeamManager = await harness.registerUser("org-team-grant-project-manager");
    const teamOwner = await harness.registerUser("org-team-grant-project-owner");
    const outsider = await harness.registerUser("org-team-grant-project-outsider");
    const projectOwner = await harness.registerUser("org-team-grant-project-project-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Org Team Direct Project Grant" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Org Team Direct Team" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Org Team Direct Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [{ userId: creator.user.id }, { userId: orgTeamManager.user.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
      userId: orgTeamManager.user.id,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(projectOwner.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"], userId: projectOwner.user.id },
          { roleCodes: [], userId: outsider.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/members`,
    });
    harness.databaseService.db.insert(projectsTeams).values({
      projectId: project.id,
      teamId: team.id,
    }).run();
    await harness.databaseService.persist();

    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(orgTeamManager.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_PROJECTROLE_PROJECT_MANAGER",
        userId: outsider.user.id,
      },
      url: `/stc-proj-mgmt/api/projects/${project.id}/roles/grant`,
    });

    expect(grantResponse.statusCode).toBe(200);
  });

  it("lets an organization manager grant org roles only to org members and rejects duplicates and missing revokes", async () => {
    const creator = await harness.registerUser("org-org-manager-creator");
    const member = await harness.registerUser("org-org-manager-member");
    const outsider = await harness.registerUser("org-org-manager-outsider");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Org Manager Grant Org" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [{ userId: creator.user.id }, { userId: member.user.id }],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });

    const memberGrant = await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
      userId: member.user.id,
    });
    const duplicateGrant = await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
      userId: member.user.id,
    });
    const outsiderGrant = await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
      userId: outsider.user.id,
    });
    const missingRevoke = await revokeOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
      userId: member.user.id,
    });

    expect(memberGrant.statusCode).toBe(200);
    expect(duplicateGrant.statusCode).toBe(409);
    expect(outsiderGrant.statusCode).toBe(409);
    expect(missingRevoke.statusCode).toBe(404);
  });

  it("forbids authenticated outsiders from managing organization routes", async () => {
    const creator = await harness.registerUser("org-outsider-creator");
    const outsider = await harness.registerUser("org-outsider-user");
    const member = await harness.registerUser("org-outsider-member");
    const projectOwner = await harness.registerUser("org-outsider-project-owner");
    const teamOwner = await harness.registerUser("org-outsider-team-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Outsider Org" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Outsider Project" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Outsider Team" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);

    const responses = await Promise.all([
      harness.app.inject({
        headers: harness.createAuthHeaders(outsider.accessToken),
        method: "PATCH",
        payload: { name: "Nope" },
        url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(outsider.accessToken),
        method: "PUT",
        payload: { members: [{ userId: member.user.id }] },
        url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(outsider.accessToken),
        method: "PUT",
        payload: { projects: [{ projectId: project.id }] },
        url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(outsider.accessToken),
        method: "POST",
        payload: { teamId: team.id },
        url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
      }),
      grantOrganizationRole(outsider.accessToken, organization.id, {
        roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
        userId: member.user.id,
      }),
      harness.app.inject({
        headers: harness.createAuthHeaders(outsider.accessToken),
        method: "DELETE",
        url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
      }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(403);
    }
  });

  it("returns 404 for unknown user, project, and team ids on org membership endpoints", async () => {
    const creator = await harness.registerUser("org-unknown-ids-creator");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Unknown IDs Org" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);

    const unknownUser = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: MISSING_ENTITY_ID }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    const unknownProject = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: MISSING_ENTITY_ID }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    const unknownTeam = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: MISSING_ENTITY_ID },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });

    expect(unknownUser.statusCode).toBe(404);
    expect(unknownProject.statusCode).toBe(404);
    expect(unknownTeam.statusCode).toBe(404);
  });

  it("rejects duplicate organization members and duplicate associated projects", async () => {
    const creator = await harness.registerUser("org-duplicates-creator");
    const member = await harness.registerUser("org-duplicates-member");
    const projectOwner = await harness.registerUser("org-duplicates-project-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Duplicates Org" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Duplicates Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);

    const duplicateMembers = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: member.user.id }, { userId: member.user.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    const duplicateProjects = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: project.id }, { projectId: project.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });

    expect(duplicateMembers.statusCode).toBe(400);
    expect(duplicateProjects.statusCode).toBe(400);
  });

  it("deleting an organization removes only org-owned association rows and then returns 404 on get", async () => {
    const creator = await harness.registerUser("org-delete-clean-creator");
    const admin = await harness.loginSeededAdmin();
    const projectOwner = await harness.registerUser("org-delete-clean-project-owner");
    const teamOwner = await harness.registerUser("org-delete-clean-team-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Delete Clean Org" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Delete Clean Project" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Delete Clean Team" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);

    await grantOrganizationRole(admin.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER",
      userId: admin.user.id,
    });

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
    });
    const getResponse = await getOrganization(admin.accessToken, organization.id);

    expect(deleteResponse.statusCode).toBe(200);
    expect(getResponse.statusCode).toBe(404);
    expect(
      harness.databaseService.db
        .select()
        .from(projects)
        .where(eq(projects.id, project.id))
        .all(),
    ).toHaveLength(1);
    expect(
      harness.databaseService.db
        .select()
        .from(teams)
        .where(eq(teams.id, team.id))
        .all(),
    ).toHaveLength(1);
  });

  it("keeps org role rows unchanged after a blocked forbidden revoke", async () => {
    const creator = await harness.registerUser("org-revoke-atomic-creator");
    const member = await harness.registerUser("org-revoke-atomic-member");
    const outsider = await harness.registerUser("org-revoke-atomic-outsider");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Revoke Atomic Org" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: creator.user.id }, { userId: member.user.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
      userId: member.user.id,
    });
    const beforeRows = harness.databaseService.db
      .select()
      .from(usersOrganizationsOrganizationRoles)
      .where(eq(usersOrganizationsOrganizationRoles.organizationId, organization.id))
      .all();

    const revokeResponse = await revokeOrganizationRole(outsider.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
      userId: member.user.id,
    });
    const afterRows = harness.databaseService.db
      .select()
      .from(usersOrganizationsOrganizationRoles)
      .where(eq(usersOrganizationsOrganizationRoles.organizationId, organization.id))
      .all();

    expect(revokeResponse.statusCode).toBe(403);
    expect(afterRows).toEqual(beforeRows);
  });

  it("blocks revoking the last organization manager and leaves rows unchanged", async () => {
    const creator = await harness.registerUser("org-last-manager-creator");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Last Manager Org" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const beforeRows = harness.databaseService.db
      .select()
      .from(usersOrganizationsOrganizationRoles)
      .where(eq(usersOrganizationsOrganizationRoles.organizationId, organization.id))
      .all();

    const revokeResponse = await revokeOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER",
      userId: creator.user.id,
    });
    const afterRows = harness.databaseService.db
      .select()
      .from(usersOrganizationsOrganizationRoles)
      .where(eq(usersOrganizationsOrganizationRoles.organizationId, organization.id))
      .all();

    expect(revokeResponse.statusCode).toBe(409);
    expect(afterRows).toEqual(beforeRows);
  });

  it("blocks replacing org users if that would remove the last organization manager", async () => {
    const creator = await harness.registerUser("org-replace-last-manager-creator");
    const member = await harness.registerUser("org-replace-last-manager-member");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Replace Last Manager Org" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);

    const replaceResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: member.user.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });

    expect(replaceResponse.statusCode).toBe(409);
  });

  it("removes stale org role rows for omitted users while preserving retained roles on org user replace", async () => {
    const creator = await harness.registerUser("org-replace-cleanup-creator");
    const retained = await harness.registerUser("org-replace-cleanup-retained");
    const removed = await harness.registerUser("org-replace-cleanup-removed");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Replace Cleanup Org" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { userId: creator.user.id },
          { userId: retained.user.id },
          { userId: removed.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER",
      userId: retained.user.id,
    });
    await grantOrganizationRole(creator.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
      userId: removed.user.id,
    });

    const replaceResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { userId: creator.user.id },
          { userId: retained.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    const roleRows = harness.databaseService.db
      .select()
      .from(usersOrganizationsOrganizationRoles)
      .where(eq(usersOrganizationsOrganizationRoles.organizationId, organization.id))
      .all();

    expect(replaceResponse.statusCode).toBe(200);
    expect(roleRows.some((row) => row.userId === removed.user.id)).toBe(false);
    expect(roleRows.some((row) => row.userId === retained.user.id)).toBe(true);
  });

  it("returns members, projects, and teams from get organization in stable id order", async () => {
    const creator = await harness.registerUser("org-stable-order-creator");
    const memberA = await harness.registerUser("org-stable-order-a");
    const memberB = await harness.registerUser("org-stable-order-b");
    const projectOwner = await harness.registerUser("org-stable-order-project-owner");
    const teamOwner = await harness.registerUser("org-stable-order-team-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Stable Order Org" });
    const projectOne = await createProject(projectOwner.accessToken, { name: "Stable Project One" });
    const projectTwo = await createProject(projectOwner.accessToken, { name: "Stable Project Two" });
    const teamOne = await createTeam(teamOwner.accessToken, { name: "Stable Team One" });
    const teamTwo = await createTeam(teamOwner.accessToken, { name: "Stable Team Two" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { project: firstProject } = harness.parseJson<{ project: { id: number } }>(projectOne.payload);
    const { project: secondProject } = harness.parseJson<{ project: { id: number } }>(projectTwo.payload);
    const { team: firstTeam } = harness.parseJson<{ team: { id: number } }>(teamOne.payload);
    const { team: secondTeam } = harness.parseJson<{ team: { id: number } }>(teamTwo.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { userId: memberB.user.id },
          { userId: creator.user.id },
          { userId: memberA.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        projects: [
          { projectId: secondProject.id },
          { projectId: firstProject.id },
        ],
      },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: secondTeam.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: firstTeam.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });

    const getResponse = await getOrganization(creator.accessToken, organization.id);
    const body = harness.parseJson<{
      members: Array<{ userId: number }>;
      projects: Array<{ projectId: number }>;
      teams: Array<{ teamId: number }>;
    }>(getResponse.payload);

    expect(getResponse.statusCode).toBe(200);
    expect(body.members.map((row) => row.userId)).toEqual(
      [...body.members.map((row) => row.userId)].sort((a, b) => a - b),
    );
    expect(body.projects.map((row) => row.projectId)).toEqual(
      [...body.projects.map((row) => row.projectId)].sort((a, b) => a - b),
    );
    expect(body.teams.map((row) => row.teamId)).toEqual(
      [...body.teams.map((row) => row.teamId)].sort((a, b) => a - b),
    );
  });

  it("keeps the original team ownership row unchanged after a second-org assignment conflict", async () => {
    const firstCreator = await harness.registerUser("org-second-conflict-first");
    const secondCreator = await harness.registerUser("org-second-conflict-second");
    const teamOwner = await harness.registerUser("org-second-conflict-owner");
    const firstOrg = await createOrganization(firstCreator.accessToken, { name: "Conflict First Org" });
    const secondOrg = await createOrganization(secondCreator.accessToken, { name: "Conflict Second Org" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Conflict Team" });
    const { organization: firstOrganization } = harness.parseJson<{ organization: { id: number } }>(firstOrg.payload);
    const { organization: secondOrganization } = harness.parseJson<{ organization: { id: number } }>(secondOrg.payload);
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(firstCreator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${firstOrganization.id}/teams`,
    });
    const secondAssign = await harness.app.inject({
      headers: harness.createAuthHeaders(secondCreator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${secondOrganization.id}/teams`,
    });
    const rows = harness.databaseService.db
      .select()
      .from(organizationsTeams)
      .where(eq(organizationsTeams.teamId, team.id))
      .all();

    expect(secondAssign.statusCode).toBe(409);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.organizationId).toBe(firstOrganization.id);
  });

  it("keeps org-project associations unchanged after blocked project replacement validation", async () => {
    const creator = await harness.registerUser("org-project-atomic-creator");
    const projectOwner = await harness.registerUser("org-project-atomic-owner");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Project Atomic Org" });
    const projectResponse = await createProject(projectOwner.accessToken, { name: "Project Atomic Project" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { project } = harness.parseJson<{ project: { id: number } }>(projectResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: project.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    const beforeRows = harness.databaseService.db
      .select()
      .from(projectsOrganizations)
      .where(eq(projectsOrganizations.organizationId, organization.id))
      .all();

    const replaceResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: MISSING_ENTITY_ID }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/projects`,
    });
    const afterRows = harness.databaseService.db
      .select()
      .from(projectsOrganizations)
      .where(eq(projectsOrganizations.organizationId, organization.id))
      .all();

    expect(replaceResponse.statusCode).toBe(404);
    expect(afterRows).toEqual(beforeRows);
  });

  it("does not let organization project manager authority leak to unrelated projects in other organizations", async () => {
    const creator = await harness.registerUser("org-isolation-project-creator");
    const orgProjectManager = await harness.registerUser("org-isolation-project-manager");
    const firstProjectOwner = await harness.registerUser("org-isolation-project-owner-one");
    const secondProjectOwner = await harness.registerUser("org-isolation-project-owner-two");
    const firstOrg = await createOrganization(creator.accessToken, { name: "Isolation First Org" });
    const secondOrg = await createOrganization(creator.accessToken, { name: "Isolation Second Org" });
    const firstProject = await createProject(firstProjectOwner.accessToken, { name: "Isolation First Project" });
    const secondProject = await createProject(secondProjectOwner.accessToken, { name: "Isolation Second Project" });
    const { organization: firstOrganization } = harness.parseJson<{ organization: { id: number } }>(firstOrg.payload);
    const { organization: secondOrganization } = harness.parseJson<{ organization: { id: number } }>(secondOrg.payload);
    const { project: allowedProject } = harness.parseJson<{ project: { id: number } }>(firstProject.payload);
    const { project: forbiddenProject } = harness.parseJson<{ project: { id: number } }>(secondProject.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: creator.user.id }, { userId: orgProjectManager.user.id }] },
      url: `/stc-proj-mgmt/api/organizations/${firstOrganization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: allowedProject.id }] },
      url: `/stc-proj-mgmt/api/organizations/${firstOrganization.id}/projects`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId: forbiddenProject.id }] },
      url: `/stc-proj-mgmt/api/organizations/${secondOrganization.id}/projects`,
    });
    await grantOrganizationRole(creator.accessToken, firstOrganization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
      userId: orgProjectManager.user.id,
    });

    const allowedUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(orgProjectManager.accessToken),
      method: "PATCH",
      payload: { description: "Allowed" },
      url: `/stc-proj-mgmt/api/projects/${allowedProject.id}`,
    });
    const forbiddenUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(orgProjectManager.accessToken),
      method: "PATCH",
      payload: { description: "Forbidden" },
      url: `/stc-proj-mgmt/api/projects/${forbiddenProject.id}`,
    });

    expect(allowedUpdate.statusCode).toBe(200);
    expect(forbiddenUpdate.statusCode).toBe(403);
  });

  it("does not let organization team manager authority leak to teams in other organizations", async () => {
    const creator = await harness.registerUser("org-isolation-team-creator");
    const orgTeamManager = await harness.registerUser("org-isolation-team-manager");
    const firstTeamOwner = await harness.registerUser("org-isolation-team-owner-one");
    const secondTeamOwner = await harness.registerUser("org-isolation-team-owner-two");
    const firstOrg = await createOrganization(creator.accessToken, { name: "Isolation Team First Org" });
    const secondOrg = await createOrganization(creator.accessToken, { name: "Isolation Team Second Org" });
    const firstTeam = await createTeam(firstTeamOwner.accessToken, { name: "Isolation Team One" });
    const secondTeam = await createTeam(secondTeamOwner.accessToken, { name: "Isolation Team Two" });
    const { organization: firstOrganization } = harness.parseJson<{ organization: { id: number } }>(firstOrg.payload);
    const { organization: secondOrganization } = harness.parseJson<{ organization: { id: number } }>(secondOrg.payload);
    const { team: allowedTeam } = harness.parseJson<{ team: { id: number } }>(firstTeam.payload);
    const { team: forbiddenTeam } = harness.parseJson<{ team: { id: number } }>(secondTeam.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: creator.user.id }, { userId: orgTeamManager.user.id }] },
      url: `/stc-proj-mgmt/api/organizations/${firstOrganization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: allowedTeam.id },
      url: `/stc-proj-mgmt/api/organizations/${firstOrganization.id}/teams`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: forbiddenTeam.id },
      url: `/stc-proj-mgmt/api/organizations/${secondOrganization.id}/teams`,
    });
    await grantOrganizationRole(creator.accessToken, firstOrganization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
      userId: orgTeamManager.user.id,
    });

    const allowedUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(orgTeamManager.accessToken),
      method: "PATCH",
      payload: { description: "Allowed" },
      url: `/stc-proj-mgmt/api/teams/${allowedTeam.id}`,
    });
    const forbiddenUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(orgTeamManager.accessToken),
      method: "PATCH",
      payload: { description: "Forbidden" },
      url: `/stc-proj-mgmt/api/teams/${forbiddenTeam.id}`,
    });

    expect(allowedUpdate.statusCode).toBe(200);
    expect(forbiddenUpdate.statusCode).toBe(403);
  });

  it("removes organization visibility from former indirect members after organization deletion", async () => {
    const creator = await harness.registerUser("org-delete-visibility-creator");
    const admin = await harness.loginSeededAdmin();
    const teamOwner = await harness.registerUser("org-delete-visibility-team-owner");
    const indirectMember = await harness.registerUser("org-delete-visibility-member");
    const orgResponse = await createOrganization(creator.accessToken, { name: "Delete Visibility Org" });
    const teamResponse = await createTeam(teamOwner.accessToken, { name: "Delete Visibility Team" });
    const { organization } = harness.parseJson<{ organization: { id: number } }>(orgResponse.payload);
    const { team } = harness.parseJson<{ team: { id: number } }>(teamResponse.payload);

    await harness.app.inject({
      headers: harness.createAuthHeaders(teamOwner.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: teamOwner.user.id },
          { roleCodes: [], userId: indirectMember.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${team.id}/members`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: creator.user.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/users`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: { teamId: team.id },
      url: `/stc-proj-mgmt/api/organizations/${organization.id}/teams`,
    });
    await grantOrganizationRole(admin.accessToken, organization.id, {
      roleCode: "GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER",
      userId: admin.user.id,
    });

    const beforeDelete = await getOrganization(indirectMember.accessToken, organization.id);
    harness.databaseService.db.delete(organizationsTeams)
      .where(eq(organizationsTeams.organizationId, organization.id))
      .run();
    await harness.databaseService.persist();
    await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/organizations/${organization.id}`,
    });
    const afterDelete = await getOrganization(indirectMember.accessToken, organization.id);
    const listAfterDelete = await listOrganizations(indirectMember.accessToken);
    const listBody = harness.parseJson<{ organizations: Array<{ id: number }> }>(
      listAfterDelete.payload,
    );

    expect(beforeDelete.statusCode).toBe(200);
    expect(afterDelete.statusCode).toBe(404);
    expect(listBody.organizations.some((row) => row.id === organization.id)).toBe(false);
  });
});
