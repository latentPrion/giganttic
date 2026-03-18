import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  IssuePriorityCode,
  issues,
  projects,
  projectsTeams,
} from "../db/index.js";
import {
  MISSING_ENTITY_ID,
  createCrudTestHarness,
} from "./crud-test-helpers.js";


const harness = createCrudTestHarness("issues-crud.sqlite");
const ISSUE_STATUS_OPEN = "ISSUE_STATUS_OPEN";
const ISSUE_STATUS_IN_PROGRESS = "ISSUE_STATUS_IN_PROGRESS";
const ISSUE_STATUS_CLOSED = "ISSUE_STATUS_CLOSED";
const ISSUE_STATUS_BLOCKED = "ISSUE_STATUS_BLOCKED";
const ISSUE_CLOSED_REASON_RESOLVED = "ISSUE_CLOSED_REASON_RESOLVED";
const ISSUE_CLOSED_REASON_WONTFIX = "ISSUE_CLOSED_REASON_WONTFIX";
const DEFAULT_ISSUE_PRIORITY = IssuePriorityCode.ISSUE_PRIORITY_LOW;
const PROJECT_OWNER_ROLE = "GGTC_PROJECTROLE_PROJECT_OWNER";

describe("issues crud api", () => {
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

  function createIssue(
    accessToken: string,
    projectId: number,
    payload: Record<string, unknown>,
  ) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "POST",
      payload,
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
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

  function getIssue(accessToken: string, projectId: number, issueId: number) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}`,
    });
  }

  function listIssues(accessToken: string, projectId: number) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
    });
  }

  function updateIssue(
    accessToken: string,
    projectId: number,
    issueId: number,
    payload: Record<string, unknown>,
  ) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "PATCH",
      payload,
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}`,
    });
  }

  function deleteIssue(accessToken: string, projectId: number, issueId: number) {
    return harness.app.inject({
      headers: harness.createAuthHeaders(accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}`,
    });
  }

  beforeAll(async () => {
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it("seeds sample issues with priority for every initially seeded project", () => {
    const seededProjects = harness.databaseService.db.select().from(projects).all();
    const seededIssues = harness.databaseService.db.select().from(issues).all();
    const issueCountByProjectId = new Map<number, number>();

    for (const issue of seededIssues) {
      const currentCount = issueCountByProjectId.get(issue.projectId) ?? 0;
      issueCountByProjectId.set(issue.projectId, currentCount + 1);
    }

    expect(seededProjects.length).toBeGreaterThan(0);
    expect(seededIssues.length).toBeGreaterThan(0);

    for (const project of seededProjects) {
      expect(issueCountByProjectId.get(project.id) ?? 0).toBeGreaterThanOrEqual(3);
    }

    expect(seededIssues.some((issue) => issue.priority > 0)).toBe(true);
    expect(seededIssues.some((issue) => issue.status === ISSUE_STATUS_IN_PROGRESS)).toBe(true);
  });

  it("rejects unauthenticated access to all issue routes", async () => {
    const responses = await Promise.all([
      harness.app.inject({
        method: "POST",
        payload: { name: "Anonymous Issue" },
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}/issues`,
      }),
      harness.app.inject({
        method: "GET",
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}/issues`,
      }),
      harness.app.inject({
        method: "GET",
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}/issues/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        method: "PATCH",
        payload: { name: "Nope" },
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}/issues/${MISSING_ENTITY_ID}`,
      }),
      harness.app.inject({
        method: "DELETE",
        url: `/stc-proj-mgmt/api/projects/${MISSING_ENTITY_ID}/issues/${MISSING_ENTITY_ID}`,
      }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(401);
    }
  });

  it("allows an effective project manager to create and list issues", async () => {
    const creator = await harness.registerUser("issue-creator");
    const projectResponse = await createProject(creator.accessToken, { name: "Apollo" });
    const projectId = harness.parseJson<{ project: { id: number } }>(projectResponse.payload).project.id;

    const createResponse = await createIssue(creator.accessToken, projectId, {
      description: "Fix upload blocking error",
      name: "Upload bug",
      priority: IssuePriorityCode.ISSUE_PRIORITY_URGENT,
      progressPercentage: 10,
    });
    const listResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
    });

    expect(createResponse.statusCode).toBe(201);
    expect(listResponse.statusCode).toBe(200);

    const createBody = harness.parseJson<{ issue: { id: number; priority: number; projectId: number; status: string } }>(createResponse.payload);
    const listBody = harness.parseJson<{ issues: Array<{ id: number }> }>(listResponse.payload);

    expect(createBody.issue.projectId).toBe(projectId);
    expect(createBody.issue.priority).toBe(IssuePriorityCode.ISSUE_PRIORITY_URGENT);
    expect(createBody.issue.status).toBe("ISSUE_STATUS_OPEN");
    expect(listBody.issues.map((issue) => issue.id)).toContain(createBody.issue.id);
  });

  it("allows a direct project member to list and get but not create, update, or delete issues", async () => {
    const creator = await harness.registerUser("issue-member-creator");
    const member = await harness.registerUser("issue-member");
    const projectResponse = await createProject(creator.accessToken, { name: "Mercury" });
    const projectId = harness.parseJson<{ project: { id: number } }>(projectResponse.payload).project.id;
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER", PROJECT_OWNER_ROLE],
            userId: creator.user.id,
          },
          {
            roleCodes: [],
            userId: member.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const createResponse = await createIssue(creator.accessToken, projectId, {
      name: "Member-visible issue",
      progressPercentage: 0,
    });
    const issueId = harness.parseJson<{ issue: { id: number } }>(createResponse.payload).issue.id;

    const listResponse = await listIssues(member.accessToken, projectId);
    const getResponse = await getIssue(member.accessToken, projectId, issueId);
    const forbiddenResponses = await Promise.all([
      createIssue(member.accessToken, projectId, { name: "Nope" }),
      updateIssue(member.accessToken, projectId, issueId, { progressPercentage: 25 }),
      deleteIssue(member.accessToken, projectId, issueId),
    ]);

    expect(listResponse.statusCode).toBe(200);
    expect(getResponse.statusCode).toBe(200);
    for (const response of forbiddenResponses) {
      expect(response.statusCode).toBe(403);
    }
  });

  it("rejects list and get for an authenticated outsider without project access", async () => {
    const creator = await harness.registerUser("issue-outsider-creator");
    const outsider = await harness.registerUser("issue-outsider");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Outsider Project" })).payload,
    ).project.id;
    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Private issue" })).payload,
    ).issue.id;

    const listResponse = await listIssues(outsider.accessToken, projectId);
    const getResponse = await getIssue(outsider.accessToken, projectId, issueId);

    expect(listResponse.statusCode).toBe(403);
    expect(getResponse.statusCode).toBe(403);
  });

  it("allows a team-derived project-access user to list and get issues but not mutate them", async () => {
    const projectOwner = await harness.registerUser("issue-team-access-owner");
    const teamCreator = await harness.registerUser("issue-team-access-creator");
    const teamMember = await harness.registerUser("issue-team-access-member");
    const teamResponse = await createTeam(teamCreator.accessToken, {
      name: "Issue Access Team",
    });
    const teamId = harness.parseJson<{ team: { id: number } }>(teamResponse.payload).team.id;
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: teamCreator.user.id },
          { roleCodes: [], userId: teamMember.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${teamId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(projectOwner.accessToken, { name: "Issue Team Access Project" })).payload,
    ).project.id;
    harness.databaseService.db.insert(projectsTeams).values({
      projectId,
      teamId,
    }).run();

    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(projectOwner.accessToken, projectId, { name: "Team visible issue" })).payload,
    ).issue.id;

    const listResponse = await listIssues(teamMember.accessToken, projectId);
    const getResponse = await getIssue(teamMember.accessToken, projectId, issueId);
    const createResponse = await createIssue(teamMember.accessToken, projectId, {
      name: "Should fail",
    });

    expect(listResponse.statusCode).toBe(200);
    expect(getResponse.statusCode).toBe(200);
    expect(createResponse.statusCode).toBe(403);
  });

  it("allows a team-derived project manager to create update and delete issues", async () => {
    const projectOwner = await harness.registerUser("issue-team-pm-owner");
    const teamCreator = await harness.registerUser("issue-team-pm-creator");
    const teamProjectManager = await harness.registerUser("issue-team-pm-user");
    const teamId = harness.parseJson<{ team: { id: number } }>(
      (await createTeam(teamCreator.accessToken, { name: "Issue PM Team" })).payload,
    ).team.id;
    const teamMembershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamCreator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"], userId: teamCreator.user.id },
          { roleCodes: ["GGTC_TEAMROLE_PROJECT_MANAGER"], userId: teamProjectManager.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/teams/${teamId}/members`,
    });
    expect(teamMembershipResponse.statusCode).toBe(200);

    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(projectOwner.accessToken, { name: "Issue Team PM Project" })).payload,
    ).project.id;
    harness.databaseService.db.insert(projectsTeams).values({
      projectId,
      teamId,
    }).run();

    const createResponse = await createIssue(teamProjectManager.accessToken, projectId, {
      name: "Team managed issue",
    });
    const issueId = harness.parseJson<{ issue: { id: number } }>(createResponse.payload).issue.id;
    const updateResponse = await updateIssue(
      teamProjectManager.accessToken,
      projectId,
      issueId,
      { progressPercentage: 25 },
    );
    const deleteResponse = await deleteIssue(
      teamProjectManager.accessToken,
      projectId,
      issueId,
    );

    expect(createResponse.statusCode).toBe(201);
    expect(updateResponse.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(200);
  });

  it("allows an organization project manager to create update and delete issues on an eligible project", async () => {
    const creator = await harness.registerUser("issue-org-pm-creator");
    const orgProjectManager = await harness.registerUser("issue-org-pm-user");
    const projectOwner = await harness.registerUser("issue-org-pm-owner");
    const organizationId = harness.parseJson<{ organization: { id: number } }>(
      (await createOrganization(creator.accessToken, { name: "Issue Org PM Org" })).payload,
    ).organization.id;
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(projectOwner.accessToken, { name: "Issue Org PM Project" })).payload,
    ).project.id;

    const usersUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { members: [{ userId: creator.user.id }, { userId: orgProjectManager.user.id }] },
      url: `/stc-proj-mgmt/api/organizations/${organizationId}/users`,
    });
    const projectsUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: { projects: [{ projectId }] },
      url: `/stc-proj-mgmt/api/organizations/${organizationId}/projects`,
    });
    const grantResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "POST",
      payload: {
        roleCode: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
        userId: orgProjectManager.user.id,
      },
      url: `/stc-proj-mgmt/api/organizations/${organizationId}/roles/grant`,
    });

    expect(usersUpdate.statusCode).toBe(200);
    expect(projectsUpdate.statusCode).toBe(200);
    expect(grantResponse.statusCode).toBe(200);

    const createResponse = await createIssue(orgProjectManager.accessToken, projectId, {
      name: "Org managed issue",
    });
    const issueId = harness.parseJson<{ issue: { id: number } }>(createResponse.payload).issue.id;
    const updateResponse = await updateIssue(
      orgProjectManager.accessToken,
      projectId,
      issueId,
      { progressPercentage: 80 },
    );
    const deleteResponse = await deleteIssue(
      orgProjectManager.accessToken,
      projectId,
      issueId,
    );

    expect(createResponse.statusCode).toBe(201);
    expect(updateResponse.statusCode).toBe(200);
    expect(deleteResponse.statusCode).toBe(200);
  });

  it("does not let a sysadmin globally list or manage issues without project access or authority", async () => {
    const creator = await harness.registerUser("issue-admin-creator");
    const admin = await harness.loginSeededAdmin();
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Issue Admin Project" })).payload,
    ).project.id;
    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Admin hidden issue" })).payload,
    ).issue.id;

    const responses = await Promise.all([
      listIssues(admin.accessToken, projectId),
      getIssue(admin.accessToken, projectId, issueId),
      createIssue(admin.accessToken, projectId, { name: "No global admin create" }),
      updateIssue(admin.accessToken, projectId, issueId, { progressPercentage: 50 }),
      deleteIssue(admin.accessToken, projectId, issueId),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(403);
    }
  });

  it("returns 404 for nonexistent or mismatched issues", async () => {
    const creator = await harness.registerUser("issue-not-found");
    const projectOneId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "One" })).payload,
    ).project.id;
    const projectTwoId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Two" })).payload,
    ).project.id;
    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectOneId, { name: "Scoped issue" })).payload,
    ).issue.id;

    const missingResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectOneId}/issues/${MISSING_ENTITY_ID}`,
    });
    const mismatchedResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectTwoId}/issues/${issueId}`,
    });
    const mismatchedPatchResponse = await updateIssue(
      creator.accessToken,
      projectTwoId,
      issueId,
      { progressPercentage: 30 },
    );
    const mismatchedDeleteResponse = await deleteIssue(
      creator.accessToken,
      projectTwoId,
      issueId,
    );

    expect(missingResponse.statusCode).toBe(404);
    expect(mismatchedResponse.statusCode).toBe(404);
    expect(mismatchedPatchResponse.statusCode).toBe(404);
    expect(mismatchedDeleteResponse.statusCode).toBe(404);
  });

  it("enforces closed issue status rules on create and update", async () => {
    const creator = await harness.registerUser("issue-status");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Status Project" })).payload,
    ).project.id;

    const invalidCreate = await createIssue(creator.accessToken, projectId, {
      name: "Closed without reason",
      status: "ISSUE_STATUS_CLOSED",
    });
    const openIssueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Open issue" })).payload,
    ).issue.id;
    const invalidUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PATCH",
      payload: { closedReason: "ISSUE_CLOSED_REASON_RESOLVED" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${openIssueId}`,
    });
    const validUpdate = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PATCH",
      payload: {
        closedReason: "ISSUE_CLOSED_REASON_RESOLVED",
        status: "ISSUE_STATUS_CLOSED",
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${openIssueId}`,
    });

    expect(invalidCreate.statusCode).toBe(400);
    expect(invalidUpdate.statusCode).toBe(400);
    expect(validUpdate.statusCode).toBe(200);

    const validBody = harness.parseJson<{ issue: { closedAt: string | null; closedReason: string | null; status: string } }>(validUpdate.payload);
    expect(validBody.issue.closedAt).not.toBeNull();
    expect(validBody.issue.closedReason).toBe("ISSUE_CLOSED_REASON_RESOLVED");
    expect(validBody.issue.status).toBe(ISSUE_STATUS_CLOSED);
  });

  it("allows creating and updating issues with in-progress status", async () => {
    const creator = await harness.registerUser("issue-in-progress");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "In Progress Project" })).payload,
    ).project.id;

    const createResponse = await createIssue(creator.accessToken, projectId, {
      name: "Active issue",
      progressPercentage: 45,
      status: ISSUE_STATUS_IN_PROGRESS,
    });
    const issueId = harness.parseJson<{ issue: { id: number } }>(createResponse.payload).issue.id;
    const updateResponse = await updateIssue(creator.accessToken, projectId, issueId, {
      progressPercentage: 65,
      status: ISSUE_STATUS_IN_PROGRESS,
    });
    const getResponse = await getIssue(creator.accessToken, projectId, issueId);

    expect(createResponse.statusCode).toBe(201);
    expect(updateResponse.statusCode).toBe(200);
    expect(
      harness.parseJson<{ issue: { status: string } }>(updateResponse.payload).issue.status,
    ).toBe(ISSUE_STATUS_IN_PROGRESS);
    expect(
      harness.parseJson<{ issue: { status: string } }>(getResponse.payload).issue.status,
    ).toBe(ISSUE_STATUS_IN_PROGRESS);
  });

  it("allows creating blocked issues without closed-only fields", async () => {
    const creator = await harness.registerUser("issue-blocked");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Blocked Project" })).payload,
    ).project.id;

    const createResponse = await createIssue(creator.accessToken, projectId, {
      name: "Blocked issue",
      progressPercentage: 25,
      status: ISSUE_STATUS_BLOCKED,
    });
    const issueId = harness.parseJson<{ issue: { id: number } }>(createResponse.payload).issue.id;
    const getResponse = await getIssue(creator.accessToken, projectId, issueId);

    expect(createResponse.statusCode).toBe(201);
    expect(getResponse.statusCode).toBe(200);

    const createBody = harness.parseJson<{
      issue: {
        closedAt: string | null;
        closedReason: string | null;
        status: string;
      };
    }>(createResponse.payload);
    const getBody = harness.parseJson<{
      issue: {
        closedAt: string | null;
        closedReason: string | null;
        status: string;
      };
    }>(getResponse.payload);

    expect(createBody.issue.status).toBe(ISSUE_STATUS_BLOCKED);
    expect(createBody.issue.closedAt).toBeNull();
    expect(createBody.issue.closedReason).toBeNull();
    expect(getBody.issue.status).toBe(ISSUE_STATUS_BLOCKED);
  });

  it("allows creating closed issues when closed-only fields are provided", async () => {
    const creator = await harness.registerUser("issue-closed-create");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Closed Create Project" })).payload,
    ).project.id;

    const createResponse = await createIssue(creator.accessToken, projectId, {
      closedAt: "2026-03-08T12:00:00.000Z",
      closedReason: ISSUE_CLOSED_REASON_WONTFIX,
      closedReasonDescription: "Blocked by external vendor dependency",
      name: "Closed issue",
      progressPercentage: 100,
      status: ISSUE_STATUS_CLOSED,
    });

    expect(createResponse.statusCode).toBe(201);

    const createBody = harness.parseJson<{
      issue: {
        closedAt: string | null;
        closedReason: string | null;
        closedReasonDescription: string | null;
        status: string;
      };
    }>(createResponse.payload);

    expect(createBody.issue.status).toBe(ISSUE_STATUS_CLOSED);
    expect(createBody.issue.closedReason).toBe(ISSUE_CLOSED_REASON_WONTFIX);
    expect(createBody.issue.closedReasonDescription).toBe("Blocked by external vendor dependency");
    expect(createBody.issue.closedAt).not.toBeNull();
  });

  it("defaults new issues to open with zero progress priority and null closed fields", async () => {
    const creator = await harness.registerUser("issue-defaults");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Defaults Project" })).payload,
    ).project.id;

    const createResponse = await createIssue(creator.accessToken, projectId, {
      name: "Default issue",
    });

    expect(createResponse.statusCode).toBe(201);
    const body = harness.parseJson<{
      issue: {
        closedAt: string | null;
        closedReason: string | null;
        createdAt: string;
        openedAt: string;
        priority: number;
        progressPercentage: number;
        projectId: number;
        status: string;
        updatedAt: string;
      };
    }>(createResponse.payload);

    expect(body.issue.projectId).toBe(projectId);
    expect(body.issue.status).toBe(ISSUE_STATUS_OPEN);
    expect(body.issue.priority).toBe(DEFAULT_ISSUE_PRIORITY);
    expect(body.issue.progressPercentage).toBe(0);
    expect(body.issue.closedAt).toBeNull();
    expect(body.issue.closedReason).toBeNull();
    expect(Number.isNaN(Date.parse(body.issue.createdAt))).toBe(false);
    expect(Number.isNaN(Date.parse(body.issue.openedAt))).toBe(false);
    expect(Number.isNaN(Date.parse(body.issue.updatedAt))).toBe(false);
  });

  it("persists priority changes through update and subsequent get and list calls", async () => {
    const creator = await harness.registerUser("issue-priority-persist");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Priority Persist Project" })).payload,
    ).project.id;
    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, {
        name: "Priority issue",
        priority: IssuePriorityCode.ISSUE_PRIORITY_MEDIUM,
      })).payload,
    ).issue.id;

    const updateResponse = await updateIssue(creator.accessToken, projectId, issueId, {
      priority: IssuePriorityCode.ISSUE_PRIORITY_URGENT,
      progressPercentage: 55,
    });
    const getResponse = await getIssue(creator.accessToken, projectId, issueId);
    const listResponse = await listIssues(creator.accessToken, projectId);

    expect(updateResponse.statusCode).toBe(200);
    expect(getResponse.statusCode).toBe(200);
    expect(listResponse.statusCode).toBe(200);

    const updateBody = harness.parseJson<{
      issue: { priority: number; progressPercentage: number };
    }>(updateResponse.payload);
    const getBody = harness.parseJson<{
      issue: { priority: number; progressPercentage: number };
    }>(getResponse.payload);
    const listBody = harness.parseJson<{
      issues: Array<{ id: number; priority: number; progressPercentage: number }>;
    }>(listResponse.payload);
    const listedIssue = listBody.issues.find((issue) => issue.id === issueId);

    expect(updateBody.issue.priority).toBe(IssuePriorityCode.ISSUE_PRIORITY_URGENT);
    expect(updateBody.issue.progressPercentage).toBe(55);
    expect(getBody.issue.priority).toBe(IssuePriorityCode.ISSUE_PRIORITY_URGENT);
    expect(getBody.issue.progressPercentage).toBe(55);
    expect(listedIssue?.priority).toBe(IssuePriorityCode.ISSUE_PRIORITY_URGENT);
    expect(listedIssue?.progressPercentage).toBe(55);
  });

  it("clears closed-only fields when updating a closed issue back to open in-progress or blocked", async () => {
    const creator = await harness.registerUser("issue-reopen");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Reopen Project" })).payload,
    ).project.id;
    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, {
        closedReason: ISSUE_CLOSED_REASON_RESOLVED,
        name: "Closable issue",
        status: ISSUE_STATUS_CLOSED,
      })).payload,
    ).issue.id;

    const reopenResponse = await updateIssue(creator.accessToken, projectId, issueId, {
      closedReason: null,
      closedReasonDescription: null,
      status: ISSUE_STATUS_OPEN,
    });
    const blockedResponse = await updateIssue(creator.accessToken, projectId, issueId, {
      status: ISSUE_STATUS_BLOCKED,
    });
    const inProgressResponse = await updateIssue(creator.accessToken, projectId, issueId, {
      status: ISSUE_STATUS_IN_PROGRESS,
    });

    expect(reopenResponse.statusCode).toBe(200);
    expect(blockedResponse.statusCode).toBe(200);
    expect(inProgressResponse.statusCode).toBe(200);

    const blockedBody = harness.parseJson<{
      issue: {
        closedAt: string | null;
        closedReason: string | null;
        closedReasonDescription: string | null;
        status: string;
      };
    }>(blockedResponse.payload);
    const inProgressBody = harness.parseJson<{
      issue: {
        closedAt: string | null;
        closedReason: string | null;
        closedReasonDescription: string | null;
        status: string;
      };
    }>(inProgressResponse.payload);
    expect(blockedBody.issue.status).toBe(ISSUE_STATUS_BLOCKED);
    expect(blockedBody.issue.closedAt).toBeNull();
    expect(blockedBody.issue.closedReason).toBeNull();
    expect(blockedBody.issue.closedReasonDescription).toBeNull();
    expect(inProgressBody.issue.status).toBe(ISSUE_STATUS_IN_PROGRESS);
    expect(inProgressBody.issue.closedAt).toBeNull();
    expect(inProgressBody.issue.closedReason).toBeNull();
    expect(inProgressBody.issue.closedReasonDescription).toBeNull();
  });

  it("enforces progressPercentage bounds", async () => {
    const creator = await harness.registerUser("issue-progress");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Progress Project" })).payload,
    ).project.id;

    const response = await createIssue(creator.accessToken, projectId, {
      name: "Too much progress",
      progressPercentage: 101,
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects invalid name status closed-reason and negative progress payloads", async () => {
    const creator = await harness.registerUser("issue-invalid");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Invalid Project" })).payload,
    ).project.id;
    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Valid issue" })).payload,
    ).issue.id;

    const responses = await Promise.all([
      createIssue(creator.accessToken, projectId, { name: "   " }),
      createIssue(creator.accessToken, projectId, { name: "Bad status", status: "BAD_STATUS" }),
      createIssue(creator.accessToken, projectId, { name: "Bad reason", closedReason: "BAD_REASON" }),
      createIssue(creator.accessToken, projectId, { name: "Bad priority", priority: -1 }),
      createIssue(creator.accessToken, projectId, { name: "Too urgent", priority: 4 }),
      updateIssue(creator.accessToken, projectId, issueId, { progressPercentage: -1 }),
      updateIssue(creator.accessToken, projectId, issueId, { priority: -2 }),
      updateIssue(creator.accessToken, projectId, issueId, { priority: 4 }),
      updateIssue(creator.accessToken, projectId, issueId, { closedReasonDescription: "No closed state" }),
    ]);

    for (const response of responses) {
      expect(response.statusCode).toBe(400);
    }
  });

  it("returns issues in stable ascending id order", async () => {
    const creator = await harness.registerUser("issue-order");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Order Project" })).payload,
    ).project.id;
    const secondIssueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Second" })).payload,
    ).issue.id;
    const firstIssueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Third" })).payload,
    ).issue.id;
    const thirdIssueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Fourth" })).payload,
    ).issue.id;

    const listResponse = await listIssues(creator.accessToken, projectId);

    expect(listResponse.statusCode).toBe(200);
    const body = harness.parseJson<{ issues: Array<{ id: number }> }>(listResponse.payload);
    expect(body.issues.map((issue) => issue.id)).toEqual([secondIssueId, firstIssueId, thirdIssueId]);
  });

  it("keeps the issue row unchanged after blocked validation or unauthorized updates", async () => {
    const creator = await harness.registerUser("issue-atomicity-creator");
    const member = await harness.registerUser("issue-atomicity-member");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Atomicity Project" })).payload,
    ).project.id;
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER", PROJECT_OWNER_ROLE], userId: creator.user.id },
          { roleCodes: [], userId: member.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, {
        description: "Stable description",
        name: "Stable issue",
        progressPercentage: 15,
      })).payload,
    ).issue.id;
    const before = harness.databaseService.db.select().from(issues).where(eq(issues.id, issueId)).get();

    const invalidUpdate = await updateIssue(creator.accessToken, projectId, issueId, {
      closedReasonDescription: "Should fail",
    });
    const unauthorizedUpdate = await updateIssue(member.accessToken, projectId, issueId, {
      progressPercentage: 90,
    });
    const after = harness.databaseService.db.select().from(issues).where(eq(issues.id, issueId)).get();

    expect(invalidUpdate.statusCode).toBe(400);
    expect(unauthorizedUpdate.statusCode).toBe(403);
    expect(after).toEqual(before);
  });

  it("keeps the issue row unchanged after an unauthorized delete", async () => {
    const creator = await harness.registerUser("issue-delete-atomicity-creator");
    const member = await harness.registerUser("issue-delete-atomicity-member");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Delete Atomicity Project" })).payload,
    ).project.id;
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER", PROJECT_OWNER_ROLE], userId: creator.user.id },
          { roleCodes: [], userId: member.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Keep me" })).payload,
    ).issue.id;

    const deleteResponse = await deleteIssue(member.accessToken, projectId, issueId);

    expect(deleteResponse.statusCode).toBe(403);
    expect(
      harness.databaseService.db.select().from(issues).where(eq(issues.id, issueId)).all(),
    ).toHaveLength(1);
  });

  it("deletes an issue row directly", async () => {
    const creator = await harness.registerUser("issue-delete");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Delete Project" })).payload,
    ).project.id;
    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Delete me" })).payload,
    ).issue.id;

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}`,
    });

    expect(deleteResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db.select().from(issues).where(eq(issues.id, issueId)).all(),
    ).toHaveLength(0);
  });

  it("does not affect issues on other projects when deleting one project", async () => {
    const creator = await harness.registerUser("issue-project-isolation");
    const firstProjectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Project A" })).payload,
    ).project.id;
    const secondProjectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Project B" })).payload,
    ).project.id;
    await createIssue(creator.accessToken, firstProjectId, { name: "Issue A" });
    const secondIssueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, secondProjectId, { name: "Issue B" })).payload,
    ).issue.id;

    const deleteProjectResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${firstProjectId}`,
    });

    expect(deleteProjectResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db.select().from(issues).where(eq(issues.id, secondIssueId)).all(),
    ).toHaveLength(1);
  });

  it("retains project issues when project membership is replaced", async () => {
    const creator = await harness.registerUser("issue-membership-replace-creator");
    const member = await harness.registerUser("issue-membership-replace-member");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Membership Replace Project" })).payload,
    ).project.id;
    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Persistent issue" })).payload,
    ).issue.id;

    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "PUT",
      payload: {
        members: [
          { roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER", PROJECT_OWNER_ROLE], userId: creator.user.id },
          { roleCodes: [], userId: member.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });

    expect(membershipResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db.select().from(issues).where(eq(issues.id, issueId)).all(),
    ).toHaveLength(1);
  });

  it("cascades project deletion to its issues", async () => {
    const creator = await harness.registerUser("issue-project-delete");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Cascade Project" })).payload,
    ).project.id;
    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Cascade Issue" })).payload,
    ).issue.id;

    const deleteProjectResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}`,
    });

    expect(deleteProjectResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db.select().from(issues).where(eq(issues.id, issueId)).all(),
    ).toHaveLength(0);
  });

  it("deletes all issues when a project with multiple issues is deleted", async () => {
    const creator = await harness.registerUser("issue-project-multiple-delete");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Multiple Issue Project" })).payload,
    ).project.id;
    const firstIssueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Issue one" })).payload,
    ).issue.id;
    const secondIssueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Issue two" })).payload,
    ).issue.id;

    const deleteProjectResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}`,
    });

    expect(deleteProjectResponse.statusCode).toBe(200);
    expect(
      harness.databaseService.db.select().from(issues).where(eq(issues.id, firstIssueId)).all(),
    ).toHaveLength(0);
    expect(
      harness.databaseService.db.select().from(issues).where(eq(issues.id, secondIssueId)).all(),
    ).toHaveLength(0);
  });

  it("removes all issue rows for a deleted project and returns 404 from the issue routes afterward", async () => {
    const creator = await harness.registerUser("issue-project-route-delete");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (await createProject(creator.accessToken, { name: "Deleted Project Issue Routes" })).payload,
    ).project.id;
    const firstIssueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Deleted issue one" })).payload,
    ).issue.id;
    const secondIssueId = harness.parseJson<{ issue: { id: number } }>(
      (await createIssue(creator.accessToken, projectId, { name: "Deleted issue two" })).payload,
    ).issue.id;

    const deleteProjectResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(creator.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}`,
    });
    const listAfterDeleteResponse = await listIssues(creator.accessToken, projectId);
    const getAfterDeleteResponse = await getIssue(creator.accessToken, projectId, firstIssueId);

    expect(deleteProjectResponse.statusCode).toBe(200);
    expect(listAfterDeleteResponse.statusCode).toBe(404);
    expect(getAfterDeleteResponse.statusCode).toBe(404);
    expect(
      harness.databaseService.db.select().from(issues).where(eq(issues.projectId, projectId)).all(),
    ).toHaveLength(0);
    expect(
      harness.databaseService.db.select().from(issues).where(eq(issues.id, secondIssueId)).all(),
    ).toHaveLength(0);
  });
});
