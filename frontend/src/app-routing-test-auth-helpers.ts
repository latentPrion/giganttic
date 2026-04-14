export function createAuthenticatedResponse() {
  return {
    session: {
      expirationTimestamp: "2026-03-08T00:00:00.000Z",
      id: "session-1",
      ipAddress: "127.0.0.1",
      isScopedAccessSession: false,
      location: null,
      revokedAt: null,
      startTimestamp: "2026-03-07T00:00:00.000Z",
      userId: 101,
    },
    user: {
      email: "demo@example.com",
      id: 101,
      roles: ["GGTC_SYSTEMROLE_ADMIN"],
      username: "demo-user",
    },
  };
}

export function createLoginResponse() {
  return {
    accessToken: "scoped-login-token",
    ...createAuthenticatedResponse(),
    tokenType: "Bearer" as const,
  };
}
