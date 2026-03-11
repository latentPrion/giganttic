import {
  availableSchemaVersions,
  configuredRuntimeSchemaSnapshotSubdir,
  credentialTypeCodes,
  projectsInsertSchema,
  runtimeSchemaSnapshotSubdir,
  systemRoleCodes,
  teamsInsertSchema,
  users,
  usersInsertSchema,
  usersSessionsInsertSchema,
} from "db";
import { describe, expect, it } from "vitest";

describe("db module facade", () => {
  it("resolves the configured schema version through the db alias", () => {
    expect(availableSchemaVersions).toContain(
      configuredRuntimeSchemaSnapshotSubdir,
    );
    expect(configuredRuntimeSchemaSnapshotSubdir).toBe("v2");
    expect(runtimeSchemaSnapshotSubdir).toBe("v2");
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
    const parsedProject = projectsInsertSchema.parse({
      description: "Project description",
      name: "Shared Name",
    });
    const parsedTeam = teamsInsertSchema.parse({
      description: null,
      name: "Shared Name",
    });

    expect(parsedUser.username).toBe("facade-user");
    expect(parsedSession.id).toBe("facade-session");
    expect(parsedProject.name).toBe("Shared Name");
    expect(parsedTeam.name).toBe("Shared Name");
    expect(credentialTypeCodes.usernamePassword).toBe(
      "GGTC_CREDTYPE_USERNAME_PASSWORD",
    );
    expect(systemRoleCodes.admin).toBe("GGTC_SYSTEMROLE_ADMIN");
  });
});
