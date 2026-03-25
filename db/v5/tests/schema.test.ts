import { describe, expect, it } from "vitest";

import { scopedAccessObjectTypeCodes } from "../schema.js";
import {
  attachmentsInsertSchema,
  issueCommentsInsertSchema,
  scopedAccessObjectTypesInsertSchema,
  scopedAccessTokenCredentialsObjectsInsertSchema,
  usersScopedAccessTokenCredentialsInsertSchema,
} from "../generated-zod/index.js";

describe("scoped access token v5 zod schemas", () => {
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

describe("issue comments + attachments v5 zod schemas", () => {
  it("accepts attachment inserts", () => {
    const parsed = attachmentsInsertSchema.parse({
      id: "a-b-c-d-e",
      originalFilename: "notes.txt",
      byteLength: 12,
      contentHash:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      uploadedAt: new Date(0),
      uploadedByUserId: 1,
    });

    expect(parsed.originalFilename).toBe("notes.txt");
  });

  it("accepts issue comment inserts", () => {
    const parsed = issueCommentsInsertSchema.parse({
      issueId: 3,
      createdByUserId: 1,
      parentCommentId: null,
      thumbsUpCount: 0,
      thumbsDownCount: 0,
    });

    expect(parsed.issueId).toBe(3);
  });
});
