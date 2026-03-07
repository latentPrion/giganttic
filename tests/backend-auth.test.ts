import "reflect-metadata";

import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AppModule } from "../backend/app.module.js";
import { buildBackendConfig } from "../backend/config/backend-config.js";

describe("backend auth api", () => {
  let app: NestFastifyApplication;
  let tempDir: string;

  function parseJson<T>(payload: string): T {
    return JSON.parse(payload) as T;
  }

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "gigantt-auth-"));
    const config = buildBackendConfig({
      dbPath: path.join(tempDir, "auth.sqlite"),
      port: 0,
      seedTestAccounts: true,
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix(config.routePrefix);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
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

  it("logs in seeded users, records ip, and returns current session", async () => {
    const loginResponse = await app.inject({
      headers: {
        "x-forwarded-for": "203.0.113.9",
      },
      method: "POST",
      payload: {
        password: "1234",
        username: "testadminuser",
      },
      url: "/stc-proj-mgmt/api/auth/login",
    });
    const loginBody = parseJson<{
      accessToken: string;
      session: { id: string; ipAddress: string };
      tokenType: string;
      user: { roles: string[]; username: string };
    }>(loginResponse.payload);

    expect(loginResponse.statusCode).toBe(201);
    expect(loginBody.tokenType).toBe("Bearer");
    expect(loginBody.session.ipAddress).toBe("203.0.113.9");

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

  it("enforces session read permissions for admin and non-admin users", async () => {
    const adminLogin = parseJson<{ accessToken: string }>(
      (
        await app.inject({
          method: "POST",
          payload: {
            password: "1234",
            username: "testadminuser",
          },
          url: "/stc-proj-mgmt/api/auth/login",
        })
      ).payload,
    );
    const noRoleLogin = parseJson<{ accessToken: string }>(
      (
        await app.inject({
          method: "POST",
          payload: {
            password: "1234",
            username: "testnoroleuser",
          },
          url: "/stc-proj-mgmt/api/auth/login",
        })
      ).payload,
    );

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
  });

  it("revokes the current session and prevents further use", async () => {
    const loginBody = parseJson<{
      accessToken: string;
      session: { id: string };
    }>(
      (
        await app.inject({
          method: "POST",
          payload: {
            password: "1234",
            username: "testnoroleuser",
          },
          url: "/stc-proj-mgmt/api/auth/login",
        })
      ).payload,
    );

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
    const adminLogin = parseJson<{
      accessToken: string;
      session: { id: string };
    }>(
      (
        await app.inject({
          method: "POST",
          payload: {
            password: "1234",
            username: "testadminuser",
          },
          url: "/stc-proj-mgmt/api/auth/login",
        })
      ).payload,
    );
    const noRoleLogin = parseJson<{
      accessToken: string;
      session: { id: string };
    }>(
      (
        await app.inject({
          method: "POST",
          payload: {
            password: "1234",
            username: "testnoroleuser",
          },
          url: "/stc-proj-mgmt/api/auth/login",
        })
      ).payload,
    );

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
});
