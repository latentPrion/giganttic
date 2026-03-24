import { describe, expect, it } from "vitest";

import {
  scopedAccessObjectTypeCodes,
} from "../schema.js";
import {
  scopedAccessObjectTypesInsertSchema,
  scopedAccessTokenCredentialsObjectsInsertSchema,
  usersScopedAccessTokenCredentialsInsertSchema,
} from "../generated-zod/index.js";

describe("scoped access token v4 zod schemas", () => {
  it("accepts scoped access object type inserts", () => {
    const parsed = scopedAccessObjectTypesInsertSchema.parse({
      code: scopedAccessObjectTypeCodes.project,
      displayName: "Project",
    });

    expect(parsed.code).toBe("SCOPED_ACCESS_OBJECT_TYPE_PROJECT");
  });

  it("accepts scoped access token credential inserts", () => {
    const parsed = usersScopedAccessTokenCredentialsInsertSchema.parse({
      ownerUserId: 1,
      tokenHash: "hash",
      userCredentialTypeId: 2,
    });

    expect(parsed.ownerUserId).toBe(1);
    expect(parsed.userCredentialTypeId).toBe(2);
  });

  it("accepts scoped token object joins with renamed FK", () => {
    const parsed = scopedAccessTokenCredentialsObjectsInsertSchema.parse({
      scopedAccessObjectId: 77,
      scopedAccessObjectTypeCode: scopedAccessObjectTypeCodes.project,
      scopedAccessTokenCredentialId: 8,
    });

    expect(parsed.scopedAccessTokenCredentialId).toBe(8);
    expect(parsed.scopedAccessObjectId).toBe(77);
  });
});
