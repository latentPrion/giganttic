import {
  activeSchemaVersion,
  availableSchemaVersions,
  credentialTypeCodes,
  users,
  usersInsertSchema,
  usersSessionsInsertSchema,
} from "db";
import { describe, expect, it } from "vitest";

describe("db module facade", () => {
  it("resolves the configured schema version through the db alias", () => {
    expect(availableSchemaVersions).toContain(activeSchemaVersion);
    expect(users).toBeDefined();
  });

  it("exposes zod schemas through the db alias", () => {
    const parsedUser = usersInsertSchema.parse({
      username: "facade-user",
      email: "facade-user@example.com",
    });
    const parsedSession = usersSessionsInsertSchema.parse({
      id: "facade-session",
      ipAddress: "127.0.0.1",
      userId: 1,
      sessionTokenHash: "facade-hash",
      startTimestamp: new Date("2026-03-07T12:00:00.000Z"),
      expirationTimestamp: new Date("2026-03-07T13:00:00.000Z"),
    });

    expect(parsedUser.username).toBe("facade-user");
    expect(parsedSession.id).toBe("facade-session");
    expect(credentialTypeCodes.usernamePassword).toBe(
      "GGTT_CREDTYPE_USERNAME_PASSWORD",
    );
  });
});
