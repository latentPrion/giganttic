import { describe, expect, it } from "vitest";

import {
  createMentionContainerKey,
} from "./notification-mention-containers.js";

describe("notification mention containers", () => {
  it("builds a stable key for issue comments", () => {
    expect(createMentionContainerKey({
      commentId: 7,
      issueId: 3,
      mentionContainerType: "MENTION_CONTAINER_ISSUE_COMMENT",
      projectId: 5,
      taskId: null,
    })).toBe("5:3:-:7");
  });

  it("builds a stable key for project journals", () => {
    expect(createMentionContainerKey({
      commentId: null,
      issueId: null,
      mentionContainerType: "MENTION_CONTAINER_PROJECT_JOURNAL",
      projectId: 5,
      taskId: null,
    })).toBe("5:-:-:-");
  });

  it("distinguishes issue and task containers cleanly", () => {
    expect(createMentionContainerKey({
      commentId: null,
      issueId: 9,
      mentionContainerType: "MENTION_CONTAINER_ISSUE_JOURNAL",
      projectId: 5,
      taskId: null,
    })).not.toBe(createMentionContainerKey({
      commentId: null,
      issueId: null,
      mentionContainerType: "MENTION_CONTAINER_TASK_JOURNAL",
      projectId: 5,
      taskId: "task-9",
    }));
  });
});
