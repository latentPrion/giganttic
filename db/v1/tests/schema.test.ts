import { describe, expect, it } from "vitest";

import { credentialTypeCodes } from "../schema.js";
import {
  usersCredentialTypesInsertSchema,
  usersInsertSchema,
  usersPasswordCredentialsInsertSchema,
  usersSessionsInsertSchema,
} from "../generated-zod/index.js";

describe("auth v1 zod schemas", () => {
  it("accepts a minimal user insert payload", () => {
    const parsed = usersInsertSchema.parse({
      username: "pm-admin",
      email: "pm-admin@example.com",
    });

    expect(parsed.username).toBe("pm-admin");
    expect(parsed.email).toBe("pm-admin@example.com");
  });

  it("accepts a password credential instance", () => {
    const parsed = usersCredentialTypesInsertSchema.parse({
      userId: 1,
      credentialTypeCode: credentialTypeCodes.usernamePassword,
    });

    expect(parsed.credentialTypeCode).toBe(
      credentialTypeCodes.usernamePassword,
    );
  });

  it("accepts a linked password credential payload", () => {
    const parsed = usersPasswordCredentialsInsertSchema.parse({
      userCredentialTypeId: 1,
      passwordHash: "argon2id$examplehash",
    });

    expect(parsed.passwordHash).toContain("argon2id");
  });

  it("requires session timestamps and token hash", () => {
    expect(() =>
      usersSessionsInsertSchema.parse({
        id: "session_123",
        ipAddress: "127.0.0.1",
        userId: 1,
        startTimestamp: new Date("2026-03-07T12:00:00.000Z"),
        expirationTimestamp: new Date("2026-03-07T13:00:00.000Z"),
        sessionTokenHash: "hash_123",
      }),
    ).not.toThrow();
  });
});
