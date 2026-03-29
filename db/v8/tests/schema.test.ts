import { describe, expect, it } from "vitest";

import { scopedAccessObjectTypeCodes } from "../schema.js";
import {
  attachmentsInsertSchema,
  issueCommentsInsertSchema,
  notificationsInsertSchema,
  projectsAttachmentsInsertSchema,
  scopedAccessObjectTypesInsertSchema,
  scopedAccessTokenCredentialsObjectsInsertSchema,
  taskAttachmentsInsertSchema,
  taskCommentsInsertSchema,
  taskCommentsAttachmentsInsertSchema,
  taskMirrorInsertSchema,
  usersNotificationsInsertSchema,
  usersScopedAccessTokenCredentialsInsertSchema,
} from "../generated-zod/index.js";

describe("scoped access token v8 zod schemas", () => {
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

describe("issue comments + attachments v8 zod schemas", () => {
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

  it("accepts project attachment link inserts", () => {
    const parsed = projectsAttachmentsInsertSchema.parse({
      attachmentId: "att-1",
      projectId: 3,
    });

    expect(parsed.projectId).toBe(3);
    expect(parsed.attachmentId).toBe("att-1");
  });
});

describe("task mirror + task comments v8 zod schemas", () => {
  it("accepts task mirror inserts", () => {
    const parsed = taskMirrorInsertSchema.parse({
      projectId: 9,
      taskId: "task-42",
    });

    expect(parsed.projectId).toBe(9);
    expect(parsed.taskId).toBe("task-42");
  });

  it("accepts task comment inserts", () => {
    const parsed = taskCommentsInsertSchema.parse({
      createdByUserId: 1,
      parentCommentId: null,
      projectId: 9,
      taskId: "task-42",
      thumbsDownCount: 0,
      thumbsUpCount: 0,
    });

    expect(parsed.projectId).toBe(9);
    expect(parsed.taskId).toBe("task-42");
  });

  it("accepts task attachment link inserts", () => {
    const parsed = taskAttachmentsInsertSchema.parse({
      attachmentId: "att-1",
      projectId: 9,
      taskId: "task-42",
    });

    expect(parsed.attachmentId).toBe("att-1");
    expect(parsed.taskId).toBe("task-42");
  });

  it("accepts task comment attachment link inserts", () => {
    const parsed = taskCommentsAttachmentsInsertSchema.parse({
      attachmentId: "att-2",
      commentId: 11,
      projectId: 9,
      taskId: "task-42",
    });

    expect(parsed.commentId).toBe(11);
    expect(parsed.attachmentId).toBe("att-2");
  });
});

describe("notifications v8 zod schemas", () => {
  it("accepts notification inserts", () => {
    const parsed = notificationsInsertSchema.parse({
      actorUserId: 1,
      attachmentId: "att-1",
      commentId: 2,
      eventType: "NOTIFICATION_EVENT_ISSUE_COMMENT_CREATED",
      issueId: 3,
      message: "alice commented on Issue \"Ship it\" under Apollo.",
      projectId: 4,
      targetUrl: "/pm/project/issue?projectId=4&id=3&tab=comments&commentId=2",
      taskId: null,
    });

    expect(parsed.projectId).toBe(4);
    expect(parsed.eventType).toBe("NOTIFICATION_EVENT_ISSUE_COMMENT_CREATED");
  });

  it("accepts user notification delivery inserts", () => {
    const parsed = usersNotificationsInsertSchema.parse({
      hasBeenNoticed: false,
      notificationId: 9,
      noticedTimestamp: null,
      userId: 3,
    });

    expect(parsed.userId).toBe(3);
    expect(parsed.notificationId).toBe(9);
  });
});
