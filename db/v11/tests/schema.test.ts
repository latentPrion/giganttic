import { describe, expect, it } from "vitest";

import { mentionContainerTypeCodes } from "../schema.js";
import {
  mentionsInsertSchema,
  notificationsInsertSchema,
  usersNotificationsInsertSchema,
} from "../generated-zod/index.js";

describe("mentions v10 zod schemas", () => {
  it("accepts mention inserts for comment containers", () => {
    const parsed = mentionsInsertSchema.parse({
      commentId: 7,
      containerKey: "5:3:-:7",
      issueId: 3,
      mentionContainerType: mentionContainerTypeCodes.issueComment,
      mentionedUserId: 11,
      projectId: 5,
      speakerUserId: 2,
      taskId: null,
    });

    expect(parsed.mentionContainerType).toBe(
      "MENTION_CONTAINER_ISSUE_COMMENT",
    );
    expect(parsed.containerKey).toBe("5:3:-:7");
    expect(parsed.mentionedUserId).toBe(11);
  });

  it("accepts mention inserts for journal containers", () => {
    const parsed = mentionsInsertSchema.parse({
      commentId: null,
      containerKey: "5:-:-:-",
      issueId: null,
      mentionContainerType: mentionContainerTypeCodes.projectJournal,
      mentionedUserId: 17,
      projectId: 5,
      speakerUserId: 2,
      taskId: null,
    });

    expect(parsed.mentionContainerType).toBe(
      "MENTION_CONTAINER_PROJECT_JOURNAL",
    );
    expect(parsed.commentId).toBeNull();
  });
});

describe("notifications v10 zod schemas", () => {
  it("accepts issue creation notification inserts", () => {
    const parsed = notificationsInsertSchema.parse({
      actorUserId: 1,
      attachmentId: null,
      commentId: null,
      eventType: "NOTIFICATION_EVENT_ISSUE_CREATED",
      issueId: 3,
      mentionedUserId: null,
      message: "alice created Issue \"Ship it\" under Apollo.",
      projectId: 4,
      targetUrl: "/pm/pm/project/issue?projectId=4&id=3&tab=details",
      taskId: null,
    });

    expect(parsed.eventType).toBe("NOTIFICATION_EVENT_ISSUE_CREATED");
    expect(parsed.projectId).toBe(4);
  });

  it("accepts mention notification inserts", () => {
    const parsed = notificationsInsertSchema.parse({
      actorUserId: 1,
      attachmentId: null,
      commentId: 12,
      eventType: "NOTIFICATION_EVENT_TASK_COMMENT_MENTIONED",
      issueId: null,
      mentionedUserId: 7,
      message: "alice mentioned you in a comment on Task \"Build API\" under Apollo.",
      projectId: 4,
      targetUrl: "/pm/pm/project/task?projectId=4&id=task-1&tab=comments&commentId=12",
      taskId: "task-1",
    });

    expect(parsed.mentionedUserId).toBe(7);
    expect(parsed.eventType).toBe("NOTIFICATION_EVENT_TASK_COMMENT_MENTIONED");
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
