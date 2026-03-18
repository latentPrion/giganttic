import "reflect-metadata";

import { rm } from "node:fs/promises";

import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../backend/app.module.js";
import { buildBackendConfig } from "../backend/config/backend-config.js";
import { DatabaseService } from "../backend/modules/database/database.service.js";
import {
  issues,
  managedTestDataRecords,
  organizations,
  organizationsTeams,
  projects,
  projectsOrganizations,
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
  usersSystemRoles,
  usersTeamsTeamRoles,
} from "../db/index.js";
import {
  requireDbTestRuntimeConfig,
} from "./db-test-runtime-guard.js";
import { createDbTestExecutionSandbox } from "./db-test-execution-db.js";
import { seedExecutionDatabase } from "./db-test-seeding.js";

const dbTestRuntimeConfig = requireDbTestRuntimeConfig();

describe("backend auth api", () => {
  let app: NestFastifyApplication;
  let databaseService: DatabaseService;
  let dbPath: string;
  let tempDir: string;

  function parseJson<T>(payload: string): T {
    return JSON.parse(payload) as T;
  }

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

  async function loginAs(
    username: string,
    options?: {
      headers?: Record<string, string>;
      password?: string;
    },
  ): Promise<{
    accessToken: string;
    session: { id: string; ipAddress: string; location: string | null };
    tokenType: string;
    user: { id: number; roles: string[]; username: string };
  }> {
    const response = await app.inject({
      headers: options?.headers,
      method: "POST",
      payload: {
        password: options?.password ?? "1234",
        username,
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });

    expect(response.statusCode).toBe(201);
    return parseJson(response.payload);
  }

  async function registerUser(seed: {
    email: string;
    password: string;
    username: string;
  }): Promise<{ user: { id: number; username: string } }> {
    const response = await app.inject({
      method: "POST",
      payload: seed,
      url: "/stc-proj-mgmt/api/auth/register",
    });

    expect(response.statusCode).toBe(201);
    return parseJson(response.payload);
  }

  async function changePassword(
    accessToken: string,
    userId: number,
    payload: {
      currentPassword?: string;
      newPassword: string;
      revokeSessions: boolean;
    },
  ): Promise<{
    revokedSessionIds: string[];
    updatedUserId: number;
  }> {
    const response = await app.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: "POST",
      payload,
      url: `/stc-proj-mgmt/api/users/${userId}/password`,
    });

    expect(response.statusCode).toBe(200);
    return parseJson(response.payload);
  }

  beforeAll(async () => {
    const sandbox = await createDbTestExecutionSandbox({
      contextLabel: "backend auth integration database",
      copyBaseDb: false,
      dbFileName: "auth.sqlite",
      runtimeConfig: dbTestRuntimeConfig,
      tempDirPrefix: "giganttic-auth-",
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

  it("registers a new user and rejects duplicate username/email", async () => {
    const firstResponse = await app.inject({
      method: "POST",
      payload: {
        email: "registered@example.com",
        password: "secret123",
        username: "registereduser",
      },
      url: "/stc-proj-mgmt/api/auth/register",
    });
    const firstBody = parseJson<{ user: { username: string } }>(
      firstResponse.payload,
    );

    expect(firstResponse.statusCode).toBe(201);
    expect(firstBody.user.username).toBe("registereduser");

    const duplicateUsername = await app.inject({
      method: "POST",
      payload: {
        email: "other@example.com",
        password: "secret123",
        username: "registereduser",
      },
      url: "/stc-proj-mgmt/api/auth/register",
    });
    expect(duplicateUsername.statusCode).toBe(409);

    const duplicateEmail = await app.inject({
      method: "POST",
      payload: {
        email: "registered@example.com",
        password: "secret123",
        username: "otheruser",
      },
      url: "/stc-proj-mgmt/api/auth/register",
    });
    expect(duplicateEmail.statusCode).toBe(409);
  });

  it("logs in seeded users, normalizes ip, stores location, and returns current session", async () => {
    const loginBody = await loginAs("testadminuser", {
      headers: {
        "x-client-location": "Port of Spain",
        "x-forwarded-for": "::ffff:203.0.113.9",
      },
    });

    expect(loginBody.tokenType).toBe("Bearer");
    expect(loginBody.session.ipAddress).toBe("203.0.113.9");
    expect(loginBody.session.location).toBe("Port of Spain");

    const meResponse = await app.inject({
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`,
      },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    const meBody = parseJson<{ user: { roles: string[]; username: string } }>(
      meResponse.payload,
    );

    expect(meResponse.statusCode).toBe(200);
    expect(meBody.user.username).toBe("testadminuser");
    expect(meBody.user.roles).toContain("GGTC_SYSTEMROLE_ADMIN");
  });

  it("stores plain IPv6 unchanged and uses the first forwarded IP when proxies are present", async () => {
    const ipv6Login = await loginAs("testnoroleuser", {
      headers: {
        "x-forwarded-for": "2001:db8::1",
      },
    });
    expect(ipv6Login.session.ipAddress).toBe("2001:db8::1");

    const proxiedLogin = await loginAs("testnoroleuser", {
      headers: {
        "x-forwarded-for": "198.51.100.10, 10.0.0.1, 10.0.0.2",
      },
    });
    expect(proxiedLogin.session.ipAddress).toBe("198.51.100.10");
  });

  it("seeds scoped-role fixture users together with usable organizations, teams, and projects", async () => {
    const seededLogins = await Promise.all([
      loginAs("testorgorgmanageruser"),
      loginAs("testorgteammanageruser"),
      loginAs("testorgprojectmanageruser"),
      loginAs("testteamteammanageruser"),
      loginAs("testteamprojectmanageruser"),
      loginAs("testprojectprojectmanageruser"),
    ]);

    expect(seededLogins.map((login) => login.user.username)).toEqual([
      "testorgorgmanageruser",
      "testorgteammanageruser",
      "testorgprojectmanageruser",
      "testteamteammanageruser",
      "testteamprojectmanageruser",
      "testprojectprojectmanageruser",
    ]);

    const orgOrganizationManagerUserId = databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "testorgorgmanageruser"))
      .get()!.id;
    const orgProjectManagerUserId = databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "testorgprojectmanageruser"))
      .get()!.id;
    const orgTeamManagerUserId = databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "testorgteammanageruser"))
      .get()!.id;
    const projectProjectManagerUserId = databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "testprojectprojectmanageruser"))
      .get()!.id;
    const teamProjectManagerUserId = databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "testteamprojectmanageruser"))
      .get()!.id;
    const teamTeamManagerUserId = databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "testteamteammanageruser"))
      .get()!.id;

    const organizationProjectManagerProject = databaseService.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.name, "Seed Fixture Organization Project Managed Project"))
      .get();
    const organizationTeamManagerTeam = databaseService.db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.name, "Seed Fixture Organization Team Managed Team"))
      .get();
    const teamProjectManagerProject = databaseService.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.name, "Seed Fixture Team Project Managed Project"))
      .get();
    const directProjectManagerProject = databaseService.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.name, "Seed Fixture Direct Project Managed Project"))
      .get();

    expect(
      databaseService.db
        .select()
        .from(usersOrganizations)
        .where(eq(usersOrganizations.userId, orgOrganizationManagerUserId))
        .all(),
    ).toHaveLength(1);
    expect(
      databaseService.db
        .select()
        .from(usersOrganizationsOrganizationRoles)
        .where(eq(usersOrganizationsOrganizationRoles.userId, orgOrganizationManagerUserId))
        .all(),
    ).toHaveLength(1);
    expect(
      databaseService.db
        .select()
        .from(usersOrganizationsOrganizationRoles)
        .where(eq(usersOrganizationsOrganizationRoles.userId, orgProjectManagerUserId))
        .all(),
    ).toHaveLength(1);
    expect(
      databaseService.db
        .select()
        .from(usersOrganizationsOrganizationRoles)
        .where(eq(usersOrganizationsOrganizationRoles.userId, orgTeamManagerUserId))
        .all(),
    ).toHaveLength(1);
    expect(
      databaseService.db
        .select()
        .from(usersProjectsProjectRoles)
        .where(eq(usersProjectsProjectRoles.userId, projectProjectManagerUserId))
        .all(),
    ).toHaveLength(1);
    expect(
      databaseService.db
        .select()
        .from(usersTeamsTeamRoles)
        .where(eq(usersTeamsTeamRoles.userId, teamProjectManagerUserId))
        .all(),
    ).toHaveLength(1);
    expect(
      databaseService.db
        .select()
        .from(usersTeamsTeamRoles)
        .where(eq(usersTeamsTeamRoles.userId, teamTeamManagerUserId))
        .all(),
    ).toHaveLength(1);
    expect(
      databaseService.db
        .select()
        .from(projectsOrganizations)
        .where(eq(projectsOrganizations.projectId, organizationProjectManagerProject!.id))
        .all(),
    ).toHaveLength(1);
    expect(
      databaseService.db
        .select()
        .from(projectsUsers)
        .where(eq(projectsUsers.userId, orgProjectManagerUserId))
        .all(),
    ).toHaveLength(1);
    expect(
      databaseService.db
        .select()
        .from(organizationsTeams)
        .where(eq(organizationsTeams.teamId, organizationTeamManagerTeam!.id))
        .all(),
    ).toHaveLength(1);
    expect(
      databaseService.db
        .select()
        .from(teamsUsers)
        .where(eq(teamsUsers.userId, orgTeamManagerUserId))
        .all(),
    ).toHaveLength(1);
    expect(
      databaseService.db
        .select()
        .from(projectsTeams)
        .where(eq(projectsTeams.projectId, teamProjectManagerProject!.id))
        .all(),
    ).toHaveLength(1);
    expect(
      databaseService.db
        .select()
        .from(issues)
        .where(eq(issues.projectId, organizationProjectManagerProject!.id))
        .all(),
    ).toHaveLength(4);
    expect(
      databaseService.db
        .select()
        .from(issues)
        .where(eq(issues.projectId, directProjectManagerProject!.id))
        .all(),
    ).toHaveLength(4);
    expect(
      databaseService.db
        .select()
        .from(issues)
        .where(eq(issues.projectId, teamProjectManagerProject!.id))
        .all(),
    ).toHaveLength(4);
    expect(
      databaseService.db
        .select()
        .from(organizations)
        .where(eq(organizations.name, "Seed Fixture Organization Manager Org"))
        .all(),
    ).toHaveLength(1);
  });

  it("stores only a session token hash in the database", async () => {
    const loginBody = await loginAs("testadminuser");

    const sessionRow = databaseService.db
      .select({
        id: usersSessions.id,
        sessionTokenHash: usersSessions.sessionTokenHash,
      })
      .from(usersSessions)
      .where(eq(usersSessions.id, loginBody.session.id))
      .get();

    expect(sessionRow).toBeDefined();
    expect(sessionRow?.sessionTokenHash).toBeTruthy();
    expect(sessionRow?.sessionTokenHash).not.toBe(loginBody.accessToken);
    expect(sessionRow?.sessionTokenHash).not.toContain(loginBody.accessToken);
  });

  it("rejects unknown users and invalid passwords", async () => {
    const unknownUserResponse = await app.inject({
      method: "POST",
      payload: {
        password: "1234",
        username: "doesnotexist",
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });
    expect(unknownUserResponse.statusCode).toBe(401);

    const invalidPasswordResponse = await app.inject({
      method: "POST",
      payload: {
        password: "wrong-password",
        username: "testadminuser",
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });
    expect(invalidPasswordResponse.statusCode).toBe(401);
  });

  it("rejects bad request payloads for auth and session routes", async () => {
    const badRegister = await app.inject({
      method: "POST",
      payload: {
        email: "not-an-email",
        password: "",
        username: "",
      },
      url: "/stc-proj-mgmt/api/auth/register",
    });
    expect(badRegister.statusCode).toBe(400);

    const badLogin = await app.inject({
      method: "POST",
      payload: {
        password: "",
        username: "",
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });
    expect(badLogin.statusCode).toBe(400);

    const loginBody = await loginAs("testadminuser");

    const badSessionQuery = await app.inject({
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`,
      },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session?userId=0",
    });
    expect(badSessionQuery.statusCode).toBe(400);

    const badRevokePayload = await app.inject({
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`,
      },
      method: "POST",
      payload: {
        sessionIds: [],
      },
      url: "/stc-proj-mgmt/api/auth/session/revoke",
    });
    expect(badRevokePayload.statusCode).toBe(400);

    const badPasswordChangePayload = await app.inject({
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`,
      },
      method: "POST",
      payload: {
        currentPassword: "",
        newPassword: "",
      },
      url: `/stc-proj-mgmt/api/users/${loginBody.user.id}/password`,
    });
    expect(badPasswordChangePayload.statusCode).toBe(400);
  });

  it("lets a user change their own password and keep all sessions when revokeSessions is false", async () => {
    await registerUser({
      email: "self-change@example.com",
      password: "secret123",
      username: "selfchangeuser",
    });
    const firstLogin = await loginAs("selfchangeuser", { password: "secret123" });
    const secondLogin = await loginAs("selfchangeuser", { password: "secret123" });

    const changeBody = await changePassword(secondLogin.accessToken, secondLogin.user.id, {
      currentPassword: "secret123",
      newPassword: "newsecret456",
      revokeSessions: false,
    });

    expect(changeBody.updatedUserId).toBe(secondLogin.user.id);
    expect(changeBody.revokedSessionIds).toEqual([]);

    const firstSessionStillWorks = await app.inject({
      headers: { authorization: `Bearer ${firstLogin.accessToken}` },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    const secondSessionStillWorks = await app.inject({
      headers: { authorization: `Bearer ${secondLogin.accessToken}` },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });

    expect(firstSessionStillWorks.statusCode).toBe(200);
    expect(secondSessionStillWorks.statusCode).toBe(200);

    const oldPasswordLogin = await app.inject({
      method: "POST",
      payload: {
        password: "secret123",
        username: "selfchangeuser",
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });
    expect(oldPasswordLogin.statusCode).toBe(401);

    const newPasswordLogin = await app.inject({
      method: "POST",
      payload: {
        password: "newsecret456",
        username: "selfchangeuser",
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });
    expect(newPasswordLogin.statusCode).toBe(201);
  });

  it("revokes all sessions when a user changes their own password with revokeSessions enabled", async () => {
    await registerUser({
      email: "self-revoke@example.com",
      password: "secret123",
      username: "selfrevokeuser",
    });
    const firstLogin = await loginAs("selfrevokeuser", { password: "secret123" });
    const secondLogin = await loginAs("selfrevokeuser", { password: "secret123" });

    const changeBody = await changePassword(secondLogin.accessToken, secondLogin.user.id, {
      currentPassword: "secret123",
      newPassword: "newsecret456",
      revokeSessions: true,
    });

    expect(changeBody.revokedSessionIds).toEqual(
      expect.arrayContaining([firstLogin.session.id, secondLogin.session.id]),
    );

    const firstSessionResponse = await app.inject({
      headers: { authorization: `Bearer ${firstLogin.accessToken}` },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    const secondSessionResponse = await app.inject({
      headers: { authorization: `Bearer ${secondLogin.accessToken}` },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });

    expect(firstSessionResponse.statusCode).toBe(401);
    expect(secondSessionResponse.statusCode).toBe(401);
  });

  it("requires the current password for self-service changes and rejects wrong values", async () => {
    await registerUser({
      email: "self-verify@example.com",
      password: "secret123",
      username: "selfverifyuser",
    });
    const login = await loginAs("selfverifyuser", { password: "secret123" });

    const missingCurrentPassword = await app.inject({
      headers: { authorization: `Bearer ${login.accessToken}` },
      method: "POST",
      payload: {
        newPassword: "newsecret456",
        revokeSessions: false,
      },
      url: `/stc-proj-mgmt/api/users/${login.user.id}/password`,
    });
    expect(missingCurrentPassword.statusCode).toBe(401);

    const wrongCurrentPassword = await app.inject({
      headers: { authorization: `Bearer ${login.accessToken}` },
      method: "POST",
      payload: {
        currentPassword: "wrong-password",
        newPassword: "newsecret456",
        revokeSessions: false,
      },
      url: `/stc-proj-mgmt/api/users/${login.user.id}/password`,
    });
    expect(wrongCurrentPassword.statusCode).toBe(401);
  });

  it("lets an admin change another user's password and optionally revoke all target sessions", async () => {
    await registerUser({
      email: "admin-target@example.com",
      password: "secret123",
      username: "admintargetuser",
    });
    const adminLogin = await loginAs("testadminuser");
    const targetFirstLogin = await loginAs("admintargetuser", { password: "secret123" });
    const targetSecondLogin = await loginAs("admintargetuser", { password: "secret123" });

    const keepSessionsBody = await changePassword(adminLogin.accessToken, targetFirstLogin.user.id, {
      newPassword: "newsecret456",
      revokeSessions: false,
    });
    expect(keepSessionsBody.revokedSessionIds).toEqual([]);

    const targetSessionStillWorks = await app.inject({
      headers: { authorization: `Bearer ${targetFirstLogin.accessToken}` },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(targetSessionStillWorks.statusCode).toBe(200);

    const revokeSessionsBody = await changePassword(adminLogin.accessToken, targetFirstLogin.user.id, {
      newPassword: "adminfinalsecret",
      revokeSessions: true,
    });
    expect(revokeSessionsBody.revokedSessionIds).toEqual(
      expect.arrayContaining([targetFirstLogin.session.id, targetSecondLogin.session.id]),
    );

    const revokedTargetSession = await app.inject({
      headers: { authorization: `Bearer ${targetFirstLogin.accessToken}` },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(revokedTargetSession.statusCode).toBe(401);

    const newPasswordLogin = await app.inject({
      method: "POST",
      payload: {
        password: "adminfinalsecret",
        username: "admintargetuser",
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });
    expect(newPasswordLogin.statusCode).toBe(201);
  });

  it("forbids non-admin users from changing another user's password", async () => {
    await registerUser({
      email: "password-actor@example.com",
      password: "secret123",
      username: "passwordactoruser",
    });
    await registerUser({
      email: "password-target@example.com",
      password: "secret123",
      username: "passwordtargetuser",
    });
    const actorLogin = await loginAs("passwordactoruser", { password: "secret123" });
    const targetLogin = await loginAs("passwordtargetuser", { password: "secret123" });

    const response = await app.inject({
      headers: { authorization: `Bearer ${actorLogin.accessToken}` },
      method: "POST",
      payload: {
        newPassword: "newsecret456",
        revokeSessions: false,
      },
      url: `/stc-proj-mgmt/api/users/${targetLogin.user.id}/password`,
    });

    expect(response.statusCode).toBe(403);
  });

  it("returns not found when changing the password of a nonexistent user", async () => {
    const adminLogin = await loginAs("testadminuser");

    const response = await app.inject({
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
      method: "POST",
      payload: {
        newPassword: "newsecret456",
        revokeSessions: false,
      },
      url: "/stc-proj-mgmt/api/users/999999/password",
    });

    expect(response.statusCode).toBe(404);
  });

  it("fails clearly when the target user has no active password credential", async () => {
    const adminLogin = await loginAs("testadminuser");
    const registration = await registerUser({
      email: "nopasswordcredential@example.com",
      password: "secret123",
      username: "nopasswordcredentialuser",
    });
    const passwordCredentialTypeRows = databaseService.db
      .select({ id: usersCredentialTypes.id })
      .from(usersCredentialTypes)
      .where(eq(usersCredentialTypes.userId, registration.user.id))
      .all();

    databaseService.db.delete(usersPasswordCredentials)
      .where(inArray(
        usersPasswordCredentials.userCredentialTypeId,
        passwordCredentialTypeRows.map((row) => row.id),
      ))
      .run();

    const response = await app.inject({
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
      method: "POST",
      payload: {
        newPassword: "newsecret456",
        revokeSessions: false,
      },
      url: `/stc-proj-mgmt/api/users/${registration.user.id}/password`,
    });

    expect(response.statusCode).toBe(409);
    expect(parseJson<{ message: string }>(response.payload).message).toBe(
      "User does not have an active password credential",
    );
  });

  it("rejects missing and malformed bearer auth headers", async () => {
    const missingHeaderResponse = await app.inject({
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(missingHeaderResponse.statusCode).toBe(401);

    const malformedHeaderResponse = await app.inject({
      headers: {
        authorization: "Token abc123",
      },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(malformedHeaderResponse.statusCode).toBe(401);

    const emptyBearerResponse = await app.inject({
      headers: {
        authorization: "Bearer ",
      },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(emptyBearerResponse.statusCode).toBe(401);
  });

  it("enforces session read permissions for admin and non-admin users", async () => {
    const adminLogin = await loginAs("testadminuser");
    const noRoleLogin = await loginAs("testnoroleuser");

    const adminMe = parseJson<{ user: { id: number } }>(
      (
        await app.inject({
          headers: {
            authorization: `Bearer ${adminLogin.accessToken}`,
          },
          method: "GET",
          url: "/stc-proj-mgmt/api/auth/session/me",
        })
      ).payload,
    );
    const noRoleMe = parseJson<{ user: { id: number } }>(
      (
        await app.inject({
          headers: {
            authorization: `Bearer ${noRoleLogin.accessToken}`,
          },
          method: "GET",
          url: "/stc-proj-mgmt/api/auth/session/me",
        })
      ).payload,
    );

    const forbiddenList = await app.inject({
      headers: {
        authorization: `Bearer ${noRoleLogin.accessToken}`,
      },
      method: "GET",
      url: `/stc-proj-mgmt/api/auth/session?userId=${adminMe.user.id}`,
    });
    expect(forbiddenList.statusCode).toBe(403);

    const allowedList = await app.inject({
      headers: {
        authorization: `Bearer ${adminLogin.accessToken}`,
      },
      method: "GET",
      url: `/stc-proj-mgmt/api/auth/session?userId=${noRoleMe.user.id}`,
    });
    const allowedListBody = parseJson<{ sessions: unknown[] }>(
      allowedList.payload,
    );

    expect(allowedList.statusCode).toBe(200);
    expect(Array.isArray(allowedListBody.sessions)).toBe(true);
    expect(allowedListBody.sessions.length).toBeGreaterThan(0);

    const selfList = await app.inject({
      headers: {
        authorization: `Bearer ${noRoleLogin.accessToken}`,
      },
      method: "GET",
      url: `/stc-proj-mgmt/api/auth/session?userId=${noRoleMe.user.id}`,
    });
    const selfListBody = parseJson<{ sessions: Array<{ userId: number }> }>(
      selfList.payload,
    );

    expect(selfList.statusCode).toBe(200);
    expect(
      selfListBody.sessions.every((session) => session.userId === noRoleMe.user.id),
    ).toBe(true);
  });

  it("lists sessions newest-first for a user", async () => {
    const firstLogin = await loginAs("testnoroleuser");
    const secondLogin = await loginAs("testnoroleuser");

    const sessionsResponse = await app.inject({
      headers: {
        authorization: `Bearer ${secondLogin.accessToken}`,
      },
      method: "GET",
      url: `/stc-proj-mgmt/api/auth/session?userId=${secondLogin.user.id}`,
    });
    const sessionsBody = parseJson<{
      sessions: Array<{ id: string; startTimestamp: string }>;
    }>(sessionsResponse.payload);

    expect(sessionsResponse.statusCode).toBe(200);
    expect(sessionsBody.sessions[0]?.id).toBe(secondLogin.session.id);
    expect(sessionsBody.sessions.findIndex((session) => session.id === secondLogin.session.id))
      .toBeLessThan(
        sessionsBody.sessions.findIndex((session) => session.id === firstLogin.session.id),
      );
  });

  it("revokes the current session and prevents further use", async () => {
    const loginBody = await loginAs("testnoroleuser");

    const revokeResponse = await app.inject({
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`,
      },
      method: "POST",
      payload: {
        sessionIds: [loginBody.session.id],
      },
      url: "/stc-proj-mgmt/api/auth/session/revoke",
    });
    const revokeBody = parseJson<{ revokedSessionIds: string[] }>(
      revokeResponse.payload,
    );

    expect(revokeResponse.statusCode).toBe(201);
    expect(revokeBody.revokedSessionIds).toContain(loginBody.session.id);

    const meAfterRevoke = await app.inject({
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`,
      },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });

    expect(meAfterRevoke.statusCode).toBe(401);
  });

  it("prevents non-admin cross-user revocation and allows admin revocation", async () => {
    const adminLogin = await loginAs("testadminuser");
    const noRoleLogin = await loginAs("testnoroleuser");

    const forbiddenRevoke = await app.inject({
      headers: {
        authorization: `Bearer ${noRoleLogin.accessToken}`,
      },
      method: "POST",
      payload: {
        sessionIds: [adminLogin.session.id],
      },
      url: "/stc-proj-mgmt/api/auth/session/revoke",
    });
    expect(forbiddenRevoke.statusCode).toBe(403);

    const adminRevoke = await app.inject({
      headers: {
        authorization: `Bearer ${adminLogin.accessToken}`,
      },
      method: "POST",
      payload: {
        sessionIds: [noRoleLogin.session.id],
      },
      url: "/stc-proj-mgmt/api/auth/session/revoke",
    });
    const adminRevokeBody = parseJson<{ revokedSessionIds: string[] }>(
      adminRevoke.payload,
    );

    expect(adminRevoke.statusCode).toBe(201);
    expect(adminRevokeBody.revokedSessionIds).toContain(noRoleLogin.session.id);
  });

  it("revokes only the targeted session when a user has multiple active sessions", async () => {
    const firstSession = await loginAs("testnoroleuser");
    const secondSession = await loginAs("testnoroleuser");

    const revokeResponse = await app.inject({
      headers: {
        authorization: `Bearer ${secondSession.accessToken}`,
      },
      method: "POST",
      payload: {
        sessionIds: [firstSession.session.id],
      },
      url: "/stc-proj-mgmt/api/auth/session/revoke",
    });

    expect(revokeResponse.statusCode).toBe(201);

    const revokedMe = await app.inject({
      headers: {
        authorization: `Bearer ${firstSession.accessToken}`,
      },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(revokedMe.statusCode).toBe(401);

    const activeMe = await app.inject({
      headers: {
        authorization: `Bearer ${secondSession.accessToken}`,
      },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(activeMe.statusCode).toBe(200);
  });

  it("allows an admin to revoke the current session and treats it like logout", async () => {
    const adminLogin = await loginAs("testadminuser");

    const revokeResponse = await app.inject({
      headers: {
        authorization: `Bearer ${adminLogin.accessToken}`,
      },
      method: "POST",
      payload: {
        sessionIds: [adminLogin.session.id],
      },
      url: "/stc-proj-mgmt/api/auth/session/revoke",
    });

    expect(revokeResponse.statusCode).toBe(201);

    const meResponse = await app.inject({
      headers: {
        authorization: `Bearer ${adminLogin.accessToken}`,
      },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(meResponse.statusCode).toBe(401);
  });

  it("rejects mixed owned and unowned revocations for non-admin users", async () => {
    const adminLogin = await loginAs("testadminuser");
    const noRoleLogin = await loginAs("testnoroleuser");

    const mixedRevoke = await app.inject({
      headers: {
        authorization: `Bearer ${noRoleLogin.accessToken}`,
      },
      method: "POST",
      payload: {
        sessionIds: [noRoleLogin.session.id, adminLogin.session.id],
      },
      url: "/stc-proj-mgmt/api/auth/session/revoke",
    });

    expect(mixedRevoke.statusCode).toBe(403);

    const ownSessionStillWorks = await app.inject({
      headers: {
        authorization: `Bearer ${noRoleLogin.accessToken}`,
      },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(ownSessionStillWorks.statusCode).toBe(200);
  });

  it("returns an empty revoke result for nonexistent session ids", async () => {
    const adminLogin = await loginAs("testadminuser");

    const revokeResponse = await app.inject({
      headers: {
        authorization: `Bearer ${adminLogin.accessToken}`,
      },
      method: "POST",
      payload: {
        sessionIds: ["missing-session-id"],
      },
      url: "/stc-proj-mgmt/api/auth/session/revoke",
    });
    const revokeBody = parseJson<{ revokedSessionIds: string[] }>(
      revokeResponse.payload,
    );

    expect(revokeResponse.statusCode).toBe(201);
    expect(revokeBody.revokedSessionIds).toEqual([]);
  });

  it("handles duplicate and mixed revoke ids without affecting unrelated active sessions", async () => {
    const loginBody = await loginAs("testnoroleuser");
    const otherSession = await loginAs("testnoroleuser");

    const revokeResponse = await app.inject({
      headers: {
        authorization: `Bearer ${otherSession.accessToken}`,
      },
      method: "POST",
      payload: {
        sessionIds: [
          loginBody.session.id,
          loginBody.session.id,
          "missing-session-id",
        ],
      },
      url: "/stc-proj-mgmt/api/auth/session/revoke",
    });
    const revokeBody = parseJson<{ revokedSessionIds: string[] }>(
      revokeResponse.payload,
    );

    expect(revokeResponse.statusCode).toBe(201);
    expect(revokeBody.revokedSessionIds).toEqual([loginBody.session.id]);

    const revokedMe = await app.inject({
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`,
      },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(revokedMe.statusCode).toBe(401);

    const stillActiveMe = await app.inject({
      headers: {
        authorization: `Bearer ${otherSession.accessToken}`,
      },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });
    expect(stillActiveMe.statusCode).toBe(200);
  });

  it("excludes expired sessions from the active session list", async () => {
    const activeSession = await loginAs("testnoroleuser");
    const expiringSession = await loginAs("testnoroleuser");
    const expiredStart = new Date(Date.now() - 120_000);
    const expiredEnd = new Date(Date.now() - 60_000);

    databaseService.db
      .update(usersSessions)
      .set({
        expirationTimestamp: expiredEnd,
        startTimestamp: expiredStart,
        updatedAt: new Date(),
      })
      .where(eq(usersSessions.id, expiringSession.session.id))
      .run();

    const ownSessionsResponse = await app.inject({
      headers: {
        authorization: `Bearer ${activeSession.accessToken}`,
      },
      method: "GET",
      url: `/stc-proj-mgmt/api/auth/session?userId=${activeSession.user.id}`,
    });
    const ownSessionsBody = parseJson<{ sessions: Array<{ id: string }> }>(
      ownSessionsResponse.payload,
    );

    expect(ownSessionsResponse.statusCode).toBe(200);
    expect(
      ownSessionsBody.sessions.some(
        (session) => session.id === expiringSession.session.id,
      ),
    ).toBe(false);
    expect(
      ownSessionsBody.sessions.some(
        (session) => session.id === activeSession.session.id,
      ),
    ).toBe(true);
  });

  it("rejects expired sessions for authenticated routes", async () => {
    const loginBody = await loginAs("testadminuser");
    const expiredStart = new Date(Date.now() - 120_000);
    const expiredEnd = new Date(Date.now() - 60_000);

    databaseService.db
      .update(usersSessions)
      .set({
        expirationTimestamp: expiredEnd,
        startTimestamp: expiredStart,
        updatedAt: new Date(),
      })
      .where(eq(usersSessions.id, loginBody.session.id))
      .run();

    const meResponse = await app.inject({
      headers: {
        authorization: `Bearer ${loginBody.accessToken}`,
      },
      method: "GET",
      url: "/stc-proj-mgmt/api/auth/session/me",
    });

    expect(meResponse.statusCode).toBe(401);
  });

  it("rejects login for deactivated users", async () => {
    const registered = parseJson<{ user: { id: number } }>(
      (
        await app.inject({
          method: "POST",
          payload: {
            email: "deactivated@example.com",
            password: "secret123",
            username: "deactivateduser",
          },
          url: "/stc-proj-mgmt/api/auth/register",
        })
      ).payload,
    );

    databaseService.db
      .update(users)
      .set({
        deactivatedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, registered.user.id))
      .run();

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        password: "secret123",
        username: "deactivateduser",
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });

    expect(loginResponse.statusCode).toBe(401);
  });

  it("keeps explicitly seeded test accounts stable across repeated startup", async () => {
    await app.close();

    app = await buildApp();
    databaseService = app.get(DatabaseService);

    const adminRows = databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "testadminuser"))
      .all();
    const noRoleRows = databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "testnoroleuser"))
      .all();

    expect(adminRows).toHaveLength(1);
    expect(noRoleRows).toHaveLength(1);

    const adminRoles = databaseService.db
      .select({ roleCode: usersSystemRoles.roleCode })
      .from(usersSystemRoles)
      .where(eq(usersSystemRoles.userId, adminRows[0]!.id))
      .all();
    const noRoleUserRoles = databaseService.db
      .select({ roleCode: usersSystemRoles.roleCode })
      .from(usersSystemRoles)
      .where(eq(usersSystemRoles.userId, noRoleRows[0]!.id))
      .all();

    expect(adminRoles.map((row) => row.roleCode)).toEqual([
      "GGTC_SYSTEMROLE_ADMIN",
    ]);
    expect(noRoleUserRoles).toEqual([]);
    expect(
      databaseService.db
        .select({ id: managedTestDataRecords.id })
        .from(managedTestDataRecords)
        .all()
        .length,
    ).toBeGreaterThan(0);

    const loginResponse = await app.inject({
      method: "POST",
      payload: {
        password: "1234",
        username: "testadminuser",
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });
    expect(loginResponse.statusCode).toBe(201);
  });
});
