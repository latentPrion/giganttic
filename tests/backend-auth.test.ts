import "reflect-metadata";

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../backend/app.module.js";
import { buildBackendConfig } from "../backend/config/backend-config.js";
import { DatabaseService } from "../backend/modules/database/database.service.js";
import { users, usersSessions } from "../db/index.js";

describe("backend auth api", () => {
  let app: NestFastifyApplication;
  let databaseService: DatabaseService;
  let tempDir: string;

  function parseJson<T>(payload: string): T {
    return JSON.parse(payload) as T;
  }

  async function buildApp(): Promise<NestFastifyApplication> {
    const config = buildBackendConfig({
      dbPath: path.join(tempDir, "auth.sqlite"),
      port: 0,
      seedTestAccounts: true,
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

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "gigantt-auth-"));
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
    expect(meBody.user.roles).toContain("GGTT_ROLE_ADMIN");
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
    await databaseService.persist();

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
    await databaseService.persist();

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
    await databaseService.persist();

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

  it("seeds test accounts idempotently across repeated startup", async () => {
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
