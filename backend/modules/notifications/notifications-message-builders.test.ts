import { describe, expect, it } from "vitest";

import {
  buildProjectAttachmentCreatedNotification,
  buildProjectJournalUpdatedNotification,
} from "./notifications-message-builders.js";

describe("notifications message builders", () => {
  it("creates project attachment notifications with attachment deep links", () => {
    const snapshot = buildProjectAttachmentCreatedNotification({
      actorUsername: "alice",
      attachmentId: "att-77",
      projectId: 4,
      projectName: "Project 4",
    });

    expect(snapshot.targetUrl).toBe(
      "/project?projectId=4&tab=attachments&attachmentId=att-77",
    );
  });

  it("keeps project journal notifications on the journal anchor target", () => {
    const snapshot = buildProjectJournalUpdatedNotification({
      actorUsername: "alice",
      projectId: 4,
      projectName: "Project 4",
    });

    expect(snapshot.targetUrl).toBe("/project?projectId=4#project-journal");
  });
});
