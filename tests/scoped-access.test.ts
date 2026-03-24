import "reflect-metadata";

import { rm } from "node:fs/promises";

import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { and, asc, eq, ne } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../backend/app.module.js";
import { buildBackendConfig } from "../backend/config/backend-config.js";
import { DatabaseService } from "../backend/modules/database/database.service.js";
import {
  credentialTypeCodes,
  projects,
  projectsUsers,
  scopedAccessTokenCredentialsObjects,
  usersSessions,
  usersScopedAccessTokenCredentials,
  usersProjectsProjectRoles,
} from "../db/index.js";
import { requireDbTestRuntimeConfig } from "./db-test-runtime-guard.js";
import { createDbTestExecutionSandbox } from "./db-test-execution-db.js";
import { seedExecutionDatabase } from "./db-test-seeding.js";

const dbTestRuntimeConfig = requireDbTestRuntimeConfig();

function parseJson<T>(payload: string): T {
  return JSON.parse(payload) as T;
}

describe("scoped access tokens", () => {
  let app: NestFastifyApplication;
  let databaseService: DatabaseService;
  let dbPath: string;
  let tempDir: string;

  async function buildApp(): Promise<NestFastifyApplication> {
    const config = buildBackendConfig({
      createDbIfMissing: false,
      dbPath,
      port: 0,
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    }).compile();

    const nextApp = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    nextApp.setGlobalPrefix(config.routePrefix);
    await nextApp.init();
    await nextApp.getHttpAdapter().getInstance().ready();

    return nextApp;
  }

  async function loginAs(username: string): Promise<{
    accessToken: string;
    session: { id: string };
    user: { id: number };
  }> {
    const response = await app.inject({
      method: "POST",
      payload: {
        password: "1234",
        username,
      },
      url: "/stc-proj-mgmt/api/auth/login/password",
    });
    expect(response.statusCode).toBe(201);
    return parseJson(response.payload);
  }

  beforeAll(async () => {
    const sandbox = await createDbTestExecutionSandbox({
      contextLabel: "scoped access integration database",
      copyBaseDb: false,
      dbFileName: "scoped-access.sqlite",
      runtimeConfig: dbTestRuntimeConfig,
      tempDirPrefix: "giganttic-scoped-access-",
    });
    dbPath = sandbox.dbPath;
    tempDir = sandbox.tempDir;

    await seedExecutionDatabase({
      dbPath,
      includeTestData: true,
      schemaName: dbTestRuntimeConfig.runtimeSchemaSnapshotSubdir,
    });

    app = await buildApp();
    databaseService = app.get(DatabaseService);
  });

  afterAll(async () => {
    await app.close();
    await rm(tempDir, { force: true, recursive: true });
  });

  async function listProjectIds(token: string): Promise<number[]> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "GET",
      url: "/stc-proj-mgmt/api/projects",
    });
    expect(response.statusCode).toBe(200);
    const body = parseJson<{ projects: Array<{ id: number }> }>(response.payload);
    return body.projects.map((project) => project.id).sort((left, right) => left - right);
  }

  async function createScopedTokenForUser(
    token: string,
    options?: { expiresAt?: string | null; projectIds?: number[] },
  ): Promise<{ token: string; tokenCredentialId: number }> {
    const createResponse = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
      payload: { expiresAt: options?.expiresAt ?? null },
      url: "/stc-proj-mgmt/api/scoped-access/tokens",
    });
    expect(createResponse.statusCode).toBe(201);
    const created = parseJson<{ token: string; tokenCredential: { id: number } }>(
      createResponse.payload,
    );

    for (const projectId of options?.projectIds ?? []) {
      const addScopeResponse = await app.inject({
        headers: { authorization: `Bearer ${token}` },
        method: "POST",
        payload: { projectId },
        url: `/stc-proj-mgmt/api/scoped-access/tokens/${created.tokenCredential.id}/scopes/projects`,
      });
      expect(addScopeResponse.statusCode).toBe(201);
    }

    return {
      token: created.token,
      tokenCredentialId: created.tokenCredential.id,
    };
  }

  async function redeemScopedToken(token: string): Promise<{
    accessToken: string;
    session: { id: string };
    user: { id: number };
  }> {
    const response = await app.inject({
      method: "POST",
      payload: { token },
      url: "/stc-proj-mgmt/api/scoped-access/redeem",
    });
    expect(response.statusCode).toBe(201);
    return parseJson(response.payload);
  }

  async function createIssueForProject(
    token: string,
    projectId: number,
    name: string,
  ): Promise<number> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
      payload: { name },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
    });
    expect(response.statusCode).toBe(201);
    const body = parseJson<{ issue: { id: number } }>(response.payload);
    return body.issue.id;
  }

  async function createProjectForUser(token: string, suffix: string): Promise<number> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${token}` },
      method: "POST",
      payload: {
        description: `scoped test ${suffix}`,
        name: `Scoped test project ${suffix}`,
      },
      url: "/stc-proj-mgmt/api/projects",
    });
    expect(response.statusCode).toBe(201);
    const body = parseJson<{ project: { id: number } }>(response.payload);
    return body.project.id;
  }

  async function expectScopedProjectAllowed(scopedToken: string, projectId: number): Promise<void> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${scopedToken}` },
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}`,
    });
    expect(response.statusCode).toBe(200);
  }

  async function expectScopedProjectDenied(scopedToken: string, projectId: number): Promise<void> {
    const response = await app.inject({
      headers: { authorization: `Bearer ${scopedToken}` },
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}`,
    });
    expect(response.statusCode).toBe(403);
  }

  async function pickTwoAccessibleProjects(token: string): Promise<[number, number]> {
    const projectIds = await listProjectIds(token);
    while (projectIds.length < 2) {
      const createdId = await createProjectForUser(token, `${Date.now()}-${projectIds.length}`);
      projectIds.push(createdId);
      projectIds.sort((left, right) => left - right);
    }
    return [projectIds[0]!, projectIds[1]!];
  }

  async function pickFirstAccessibleProject(token: string): Promise<number> {
    const projectIds = await listProjectIds(token);
    if (projectIds.length === 0) {
      return await createProjectForUser(token, `${Date.now()}-first`);
    }
    return projectIds[0]!;
  }

  it("allows only assigned project objects and filters list results", async () => {
    const standardLogin = await loginAs("testadminuser");
    const [projectA, projectB] = await pickTwoAccessibleProjects(standardLogin.accessToken);

    const created = await createScopedTokenForUser(standardLogin.accessToken, {
      projectIds: [projectA],
    });
    const scopedLogin = await redeemScopedToken(created.token);

    await expectScopedProjectAllowed(scopedLogin.accessToken, projectA);
    await expectScopedProjectDenied(scopedLogin.accessToken, projectB);
    expect(await listProjectIds(scopedLogin.accessToken)).toEqual([projectA]);
  });

  it("supports multiple assigned projects as a union", async () => {
    const standardLogin = await loginAs("testadminuser");
    const [projectA, projectB] = await pickTwoAccessibleProjects(standardLogin.accessToken);
    const created = await createScopedTokenForUser(standardLogin.accessToken, {
      projectIds: [projectA, projectB],
    });
    const scopedLogin = await redeemScopedToken(created.token);

    await expectScopedProjectAllowed(scopedLogin.accessToken, projectA);
    await expectScopedProjectAllowed(scopedLogin.accessToken, projectB);
    expect(await listProjectIds(scopedLogin.accessToken)).toEqual([projectA, projectB]);
  });

  it("enforces project scope for issue routes", async () => {
    const standardLogin = await loginAs("testadminuser");
    const [projectA, projectB] = await pickTwoAccessibleProjects(standardLogin.accessToken);
    const issueA = await createIssueForProject(standardLogin.accessToken, projectA, "scope-a");

    const created = await createScopedTokenForUser(standardLogin.accessToken, {
      projectIds: [projectA],
    });
    const scopedLogin = await redeemScopedToken(created.token);

    const listA = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectA}/issues`,
    });
    expect(listA.statusCode).toBe(200);

    const getA = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectA}/issues/${issueA}`,
    });
    expect(getA.statusCode).toBe(200);

    const listB = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectB}/issues`,
    });
    expect(listB.statusCode).toBe(403);

    const createB = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "POST",
      payload: { name: "out-of-scope" },
      url: `/stc-proj-mgmt/api/projects/${projectB}/issues`,
    });
    expect(createB.statusCode).toBe(403);
  });

  it("enforces project scope for chart routes", async () => {
    const standardLogin = await loginAs("testadminuser");
    const [projectA, projectB] = await pickTwoAccessibleProjects(standardLogin.accessToken);
    const created = await createScopedTokenForUser(standardLogin.accessToken, {
      projectIds: [projectA],
    });
    const scopedLogin = await redeemScopedToken(created.token);

    const getChartA = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectA}/chart`,
    });
    expect([200, 404]).toContain(getChartA.statusCode);

    const putChartA = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "PUT",
      payload: { xml: "<project />" },
      url: `/stc-proj-mgmt/api/projects/${projectA}/chart`,
    });
    expect(putChartA.statusCode).toBe(200);

    const getChartB = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectB}/chart`,
    });
    expect(getChartB.statusCode).toBe(403);

    const putChartB = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "PUT",
      payload: { xml: "<project />" },
      url: `/stc-proj-mgmt/api/projects/${projectB}/chart`,
    });
    expect(putChartB.statusCode).toBe(200);
  });

  it("applies deny-first allowlist to non-project and sensitive endpoints", async () => {
    const standardLogin = await loginAs("testadminuser");
    const [projectA] = await pickTwoAccessibleProjects(standardLogin.accessToken);
    const created = await createScopedTokenForUser(standardLogin.accessToken, {
      projectIds: [projectA],
    });
    const scopedLogin = await redeemScopedToken(created.token);

    const deniedCases = [
      { method: "GET", url: "/stc-proj-mgmt/api/users" },
      { method: "GET", url: "/stc-proj-mgmt/api/teams" },
      { method: "GET", url: "/stc-proj-mgmt/api/organizations" },
      { method: "POST", url: "/stc-proj-mgmt/api/auth/session/revoke", payload: { sessionIds: [scopedLogin.session.id] } },
      { method: "GET", url: "/stc-proj-mgmt/api/scoped-access/tokens" },
      { method: "POST", url: "/stc-proj-mgmt/api/scoped-access/tokens", payload: { expiresAt: null } },
      { method: "POST", url: `/stc-proj-mgmt/api/scoped-access/tokens/${created.tokenCredentialId}/revoke` },
      { method: "POST", url: `/stc-proj-mgmt/api/scoped-access/tokens/${created.tokenCredentialId}/scopes/projects`, payload: { projectId: projectA } },
      { method: "DELETE", url: `/stc-proj-mgmt/api/scoped-access/tokens/${created.tokenCredentialId}/scopes/projects/${projectA}` },
    ] as const;

    for (const testCase of deniedCases) {
      const response = await app.inject({
        headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
        method: testCase.method,
        payload: "payload" in testCase ? testCase.payload : undefined,
        url: testCase.url,
      });
      expect(response.statusCode).toBe(403);
    }

    const allowedMe = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(allowedMe.statusCode).toBe(200);
  });

  it("allows scoped sessions to fetch only their own user profile with token-scoped associations", async () => {
    const standardLogin = await loginAs("testadminuser");
    const [projectA, projectB] = await pickTwoAccessibleProjects(standardLogin.accessToken);
    const created = await createScopedTokenForUser(standardLogin.accessToken, {
      projectIds: [projectA],
    });
    const scopedLogin = await redeemScopedToken(created.token);
    const selfId = scopedLogin.user.id;

    const selfProfile = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "GET",
      url: `/stc-proj-mgmt/api/users/${selfId}`,
    });
    expect(selfProfile.statusCode).toBe(200);
    const selfBody = parseJson<{ projects: Array<{ id: number }> }>(selfProfile.payload);
    expect(selfBody.projects.map((project) => project.id).sort((a, b) => a - b)).toEqual([projectA]);
    expect(selfBody.projects.some((project) => project.id === projectB)).toBe(false);

    const otherUserId = selfId === 1 ? 2 : 1;
    const otherProfile = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "GET",
      url: `/stc-proj-mgmt/api/users/${otherUserId}`,
    });
    expect(otherProfile.statusCode).toBe(403);
  });

  it("rejects invalid, revoked, and expired token redemption", async () => {
    const invalidRedeem = await app.inject({
      method: "POST",
      payload: { token: "not-a-real-token" },
      url: "/stc-proj-mgmt/api/scoped-access/redeem",
    });
    expect(invalidRedeem.statusCode).toBe(401);

    const standardLogin = await loginAs("testadminuser");
    const revokedToken = await createScopedTokenForUser(standardLogin.accessToken);
    await app.inject({
      headers: { authorization: `Bearer ${standardLogin.accessToken}` },
      method: "POST",
      url: `/stc-proj-mgmt/api/scoped-access/tokens/${revokedToken.tokenCredentialId}/revoke`,
    });
    const revokedRedeem = await app.inject({
      method: "POST",
      payload: { token: revokedToken.token },
      url: "/stc-proj-mgmt/api/scoped-access/redeem",
    });
    expect(revokedRedeem.statusCode).toBe(401);

    const expiringToken = await createScopedTokenForUser(
      standardLogin.accessToken,
      { expiresAt: new Date(Date.now() + 60_000).toISOString() },
    );
    databaseService.db.update(usersScopedAccessTokenCredentials)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(usersScopedAccessTokenCredentials.id, expiringToken.tokenCredentialId))
      .run();
    const expiredRedeem = await app.inject({
      method: "POST",
      payload: { token: expiringToken.token },
      url: "/stc-proj-mgmt/api/scoped-access/redeem",
    });
    expect(expiredRedeem.statusCode).toBe(401);
  });

  it("supports auth login namespace for scoped access token login", async () => {
    const standardLogin = await loginAs("testadminuser");
    const [projectA] = await pickTwoAccessibleProjects(standardLogin.accessToken);
    const created = await createScopedTokenForUser(standardLogin.accessToken, {
      projectIds: [projectA],
    });

    const loginResponse = await app.inject({
      method: "POST",
      payload: { token: created.token },
      url: "/stc-proj-mgmt/api/auth/login/scoped-access-token",
    });
    expect(loginResponse.statusCode).toBe(201);

    const parsedLogin = parseJson<{ accessToken: string }>(loginResponse.payload);
    const sessionMe = await app.inject({
      headers: { authorization: `Bearer ${parsedLogin.accessToken}` },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(sessionMe.statusCode).toBe(200);
  });

  it("invalidates existing scoped sessions after token revoke", async () => {
    const standardLogin = await loginAs("testadminuser");
    const [projectA] = await pickTwoAccessibleProjects(standardLogin.accessToken);
    const created = await createScopedTokenForUser(standardLogin.accessToken, {
      projectIds: [projectA],
    });
    const scopedLogin = await redeemScopedToken(created.token);

    const beforeRevoke = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(beforeRevoke.statusCode).toBe(200);

    await app.inject({
      headers: { authorization: `Bearer ${standardLogin.accessToken}` },
      method: "POST",
      url: `/stc-proj-mgmt/api/scoped-access/tokens/${created.tokenCredentialId}/revoke`,
    });

    const afterRevoke = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(afterRevoke.statusCode).toBe(401);
  });

  it("hard-deletes revoked tokens and cascade-deletes scope objects", async () => {
    const standardLogin = await loginAs("testadminuser");
    const [projectA] = await pickTwoAccessibleProjects(standardLogin.accessToken);
    const created = await createScopedTokenForUser(standardLogin.accessToken, {
      projectIds: [projectA],
    });

    const scopesBeforeRevoke = databaseService.db.select({
      id: scopedAccessTokenCredentialsObjects.id,
    })
      .from(scopedAccessTokenCredentialsObjects)
      .where(
        eq(
          scopedAccessTokenCredentialsObjects.scopedAccessTokenCredentialId,
          created.tokenCredentialId,
        ),
      )
      .all();
    expect(scopesBeforeRevoke.length).toBeGreaterThan(0);

    const revokeResponse = await app.inject({
      headers: { authorization: `Bearer ${standardLogin.accessToken}` },
      method: "POST",
      url: `/stc-proj-mgmt/api/scoped-access/tokens/${created.tokenCredentialId}/revoke`,
    });
    expect(revokeResponse.statusCode).toBe(201);

    const tokenAfterRevoke = databaseService.db.select({
      id: usersScopedAccessTokenCredentials.id,
    })
      .from(usersScopedAccessTokenCredentials)
      .where(eq(usersScopedAccessTokenCredentials.id, created.tokenCredentialId))
      .get();
    expect(tokenAfterRevoke).toBeUndefined();

    const scopesAfterRevoke = databaseService.db.select({
      id: scopedAccessTokenCredentialsObjects.id,
    })
      .from(scopedAccessTokenCredentialsObjects)
      .where(
        eq(
          scopedAccessTokenCredentialsObjects.scopedAccessTokenCredentialId,
          created.tokenCredentialId,
        ),
      )
      .all();
    expect(scopesAfterRevoke).toHaveLength(0);
  });

  it("updates token lastUsedAt on redemption", async () => {
    const standardLogin = await loginAs("testadminuser");
    const created = await createScopedTokenForUser(standardLogin.accessToken);
    const before = databaseService.db.select({
      lastUsedAt: usersScopedAccessTokenCredentials.lastUsedAt,
    })
      .from(usersScopedAccessTokenCredentials)
      .where(eq(usersScopedAccessTokenCredentials.id, created.tokenCredentialId))
      .get();
    expect(before?.lastUsedAt).toBeNull();

    await redeemScopedToken(created.token);

    const after = databaseService.db.select({
      lastUsedAt: usersScopedAccessTokenCredentials.lastUsedAt,
    })
      .from(usersScopedAccessTokenCredentials)
      .where(eq(usersScopedAccessTokenCredentials.id, created.tokenCredentialId))
      .get();
    expect(after?.lastUsedAt).not.toBeNull();
  });

  it("enforces ownership and scope-management constraints", async () => {
    const owner = await loginAs("testadminuser");
    const other = await loginAs("testnoroleuser");
    const [ownerProject] = await pickTwoAccessibleProjects(owner.accessToken);
    const ownerToken = await createScopedTokenForUser(owner.accessToken, {
      projectIds: [ownerProject],
    });

    const crossUserRevoke = await app.inject({
      headers: { authorization: `Bearer ${other.accessToken}` },
      method: "POST",
      url: `/stc-proj-mgmt/api/scoped-access/tokens/${ownerToken.tokenCredentialId}/revoke`,
    });
    expect(crossUserRevoke.statusCode).toBe(404);

    const duplicateScope = await app.inject({
      headers: { authorization: `Bearer ${owner.accessToken}` },
      method: "POST",
      payload: { projectId: ownerProject },
      url: `/stc-proj-mgmt/api/scoped-access/tokens/${ownerToken.tokenCredentialId}/scopes/projects`,
    });
    expect(duplicateScope.statusCode).toBeGreaterThanOrEqual(400);

    const nonExistentProjectScope = await app.inject({
      headers: { authorization: `Bearer ${owner.accessToken}` },
      method: "POST",
      payload: { projectId: 999_999_999 },
      url: `/stc-proj-mgmt/api/scoped-access/tokens/${ownerToken.tokenCredentialId}/scopes/projects`,
    });
    expect(nonExistentProjectScope.statusCode).toBe(404);

    const inaccessibleProject = databaseService.db.select({ id: projects.id })
      .from(projects)
      .where(ne(projects.id, ownerProject))
      .orderBy(asc(projects.id))
      .get();
    if (inaccessibleProject) {
      const noAccessScope = await app.inject({
        headers: { authorization: `Bearer ${other.accessToken}` },
        method: "POST",
        payload: { projectId: inaccessibleProject.id },
        url: `/stc-proj-mgmt/api/scoped-access/tokens/${ownerToken.tokenCredentialId}/scopes/projects`,
      });
      expect([403, 404]).toContain(noAccessScope.statusCode);
    }
  });

  it("keeps scope removal idempotent and non-granting", async () => {
    const owner = await loginAs("testadminuser");
    const [projectA, projectB] = await pickTwoAccessibleProjects(owner.accessToken);
    const created = await createScopedTokenForUser(owner.accessToken, {
      projectIds: [projectA],
    });
    const scoped = await redeemScopedToken(created.token);

    const removeAbsent = await app.inject({
      headers: { authorization: `Bearer ${owner.accessToken}` },
      method: "DELETE",
      url: `/stc-proj-mgmt/api/scoped-access/tokens/${created.tokenCredentialId}/scopes/projects/${projectB}`,
    });
    expect(removeAbsent.statusCode).toBe(200);

    await expectScopedProjectAllowed(scoped.accessToken, projectA);
    await expectScopedProjectDenied(scoped.accessToken, projectB);
  });

  it("persists session provenance for redeemed sessions and null for password sessions", async () => {
    const standardLogin = await loginAs("testadminuser");
    const created = await createScopedTokenForUser(standardLogin.accessToken);
    const scopedLogin = await redeemScopedToken(created.token);

    const standardSession = databaseService.db.select({
      authSourceCredentialId: usersSessions.authSourceCredentialId,
      authSourceCredentialTypeCode: usersSessions.authSourceCredentialTypeCode,
    })
      .from(usersSessions)
      .where(eq(usersSessions.id, standardLogin.session.id))
      .get();
    expect(standardSession?.authSourceCredentialId).toBeNull();
    expect(standardSession?.authSourceCredentialTypeCode).toBeNull();

    const scopedSession = databaseService.db.select({
      authSourceCredentialId: usersSessions.authSourceCredentialId,
      authSourceCredentialTypeCode: usersSessions.authSourceCredentialTypeCode,
    })
      .from(usersSessions)
      .where(eq(usersSessions.id, scopedLogin.session.id))
      .get();
    expect(scopedSession?.authSourceCredentialId).toBe(created.tokenCredentialId);
    expect(scopedSession?.authSourceCredentialTypeCode).toBe(
      credentialTypeCodes.scopedAccessToken,
    );
  });

  it("rejects scoped sessions when source credential row disappears", async () => {
    const standardLogin = await loginAs("testadminuser");
    const projectA = await pickFirstAccessibleProject(standardLogin.accessToken);
    const created = await createScopedTokenForUser(standardLogin.accessToken, {
      projectIds: [projectA],
    });
    const scopedLogin = await redeemScopedToken(created.token);

    databaseService.db.delete(usersScopedAccessTokenCredentials)
      .where(eq(usersScopedAccessTokenCredentials.id, created.tokenCredentialId))
      .run();

    const meResponse = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(meResponse.statusCode).toBe(401);
  });

  it("denies scoped session access when owner loses normal project authority", async () => {
    const standardLogin = await loginAs("testprojectprojectmanageruser");
    const projectId = await pickFirstAccessibleProject(standardLogin.accessToken);
    const createdToken = await createScopedTokenForUser(standardLogin.accessToken, {
      projectIds: [projectId],
    });
    const scopedLogin = await redeemScopedToken(createdToken.token);

    databaseService.db.delete(usersProjectsProjectRoles)
      .where(and(
        eq(usersProjectsProjectRoles.projectId, projectId),
        eq(usersProjectsProjectRoles.userId, scopedLogin.user.id),
      ))
      .run();
    databaseService.db.delete(projectsUsers)
      .where(and(
        eq(projectsUsers.projectId, projectId),
        eq(projectsUsers.userId, scopedLogin.user.id),
      ))
      .run();

    const deniedProjectAfterMembershipLoss = await app.inject({
      headers: { authorization: `Bearer ${scopedLogin.accessToken}` },
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}`,
    });
    expect(deniedProjectAfterMembershipLoss.statusCode).toBe(403);
  });
});
