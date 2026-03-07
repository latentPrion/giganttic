import { afterEach, describe, expect, it, vi } from "vitest";

import { authApi } from "./auth-api.js";
import { ApiError } from "./api-error.js";

const TEST_TOKEN = "test-token";
const TEST_SESSION_ID = "session-1";

function createJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
    ...init,
  });
}

describe("authApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a valid login response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        accessToken: TEST_TOKEN,
        session: {
          expirationTimestamp: "2026-03-07T00:00:00.000Z",
          id: TEST_SESSION_ID,
          ipAddress: "127.0.0.1",
          location: null,
          revokedAt: null,
          startTimestamp: "2026-03-06T00:00:00.000Z",
          userId: 7,
        },
        tokenType: "Bearer",
        user: {
          email: "user@example.com",
          id: 7,
          roles: ["GGTT_ROLE_ADMIN"],
          username: "user7",
        },
      }),
    );

    const result = await authApi.login({
      password: "secret",
      username: "user7",
    });

    expect(result.user.username).toBe("user7");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("rejects malformed backend payloads with validation errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        accessToken: TEST_TOKEN,
        tokenType: "Bearer",
      }),
    );

    await expect(
      authApi.login({
        password: "secret",
        username: "user7",
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("sends bearer authorization and typed revoke payloads", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        revokedSessionIds: [TEST_SESSION_ID],
      }),
    );

    await authApi.revokeCurrentSession(TEST_TOKEN, TEST_SESSION_ID);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/stc-proj-mgmt/api/auth/session/revoke",
      expect.objectContaining({
        body: JSON.stringify({
          sessionIds: [TEST_SESSION_ID],
        }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${TEST_TOKEN}`,
        }),
        method: "POST",
      }),
    );
  });
});
