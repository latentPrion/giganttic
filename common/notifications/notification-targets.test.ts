import { describe, expect, it } from "vitest";

import {
  createIssueAttachmentsNotificationTarget,
  createIssueCommentNotificationTarget,
  createProjectAttachmentsNotificationTarget,
  createProjectNotificationTarget,
  createProjectJournalNotificationTarget,
  createTaskAttachmentsNotificationTarget,
  createTaskCommentNotificationTarget,
} from "./notification-targets.js";

describe("notification targets", () => {
  it("creates project attachment targets using query params without hash fragments", () => {
    expect(createProjectAttachmentsNotificationTarget(4)).toBe(
      "/pm/project?projectId=4&tab=attachments",
    );
    expect(
      createProjectAttachmentsNotificationTarget(4, { attachmentId: "att-9" }),
    ).toBe("/pm/project?projectId=4&tab=attachments&attachmentId=att-9");
  });

  it("forces project attachment tab when an attachment id is provided directly", () => {
    expect(
      createProjectNotificationTarget(4, { attachmentId: "att-9" }),
    ).toBe("/pm/project?projectId=4&tab=attachments&attachmentId=att-9");
  });

  it("keeps project journal targets on the existing journal anchor", () => {
    expect(createProjectJournalNotificationTarget(4)).toBe(
      "/pm/project?projectId=4#project-journal",
    );
  });

  it("preserves issue and task attachment routes with section hash + tab context", () => {
    expect(createIssueAttachmentsNotificationTarget(4, 17)).toBe(
      "/pm/project/issue?id=17&projectId=4&tab=attachments#issue-attachments",
    );
    expect(createTaskAttachmentsNotificationTarget(4, 6, "task-1")).toBe(
      "/pm/project/task?chartId=6&id=task-1&projectId=4&tab=attachments#task-attachments",
    );
  });

  it("creates comment notification routes with explicit comments tab", () => {
    expect(createIssueCommentNotificationTarget(4, 17, 99)).toBe(
      "/pm/project/issue?commentId=99&id=17&projectId=4&tab=comments",
    );
    expect(createTaskCommentNotificationTarget(4, 6, "task-1", 99)).toBe(
      "/pm/project/task?commentId=99&chartId=6&id=task-1&projectId=4&tab=comments",
    );
  });
});
