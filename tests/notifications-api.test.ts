import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  notifications,
  projectsUsers,
  usersNotifications,
} from "../db/index.js";
import { createCrudTestHarness } from "./crud-test-helpers.js";
import { createMultipartFileBuffer } from "./multipart-form.helpers.js";

const harness = createCrudTestHarness("notifications-api.sqlite");

const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const MINIMAL_PNG_BUFFER = Buffer.from(MINIMAL_PNG_BASE64, "base64");
const MULTIPART_BOUNDARY = "----notificationBoundary";
const DEFAULT_TASK_ID = "1";
const PROJECT_MANAGER_ROLE = "GGTC_PROJECTROLE_PROJECT_MANAGER";
const PROJECT_OWNER_ROLE = "GGTC_PROJECTROLE_PROJECT_OWNER";
const VALID_OPEN_TASK_CHART_XML = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="1" open="1" parent="0" progress="0" start_date="2026-03-01 09:00" duration="3" ggtc_task_status="ISSUE_STATUS_OPEN"><![CDATA[Edit your new Gantt chart]]></task>
</data>
`;
const VALID_BLOCKED_TASK_CHART_XML = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="1" open="1" parent="0" progress="0" start_date="2026-03-01 09:00" duration="3" ggtc_task_status="ISSUE_STATUS_BLOCKED"><![CDATA[Edit your new Gantt chart]]></task>
</data>
`;

describe("notifications api", () => {
  beforeAll(async () => {
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it("creates comment notifications for all project-access users except the actor", async () => {
    const actor = await harness.registerUser("notif-actor");
    const teammate = await harness.registerUser("notif-teammate");
    const outsider = await harness.registerUser("notif-outsider");

    const projectId = harness.parseJson<{ project: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(actor.accessToken),
          method: "POST",
          payload: { name: "Notifications project" },
          url: "/stc-proj-mgmt/api/projects",
        })
      ).payload,
    ).project.id;

    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: actor.user.id,
          },
          { roleCodes: [], userId: teammate.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(actor.accessToken),
          method: "POST",
          payload: { name: "Issue notifications" },
          url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
        })
      ).payload,
    ).issue.id;

    const createCommentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "POST",
      payload: { body: "This should notify the teammate." },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });

    expect(createCommentResponse.statusCode).toBe(201);
    expect(harness.databaseService.db.select().from(notifications).all()).toHaveLength(1);

    const deliveries = harness.databaseService.db.select().from(usersNotifications).all();
    expect(deliveries.map((row) => row.userId)).toContain(teammate.user.id);
    expect(deliveries.map((row) => row.userId)).not.toContain(actor.user.id);
    expect(deliveries.map((row) => row.userId)).not.toContain(outsider.user.id);
  });

  it("does not create a notification for a no-op issue status patch", async () => {
    const actor = await harness.registerUser("notif-issue-status");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(actor.accessToken),
          method: "POST",
          payload: { name: "Issue status project" },
          url: "/stc-proj-mgmt/api/projects",
        })
      ).payload,
    ).project.id;
    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(actor.accessToken),
          method: "POST",
          payload: { name: "Issue status" },
          url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
        })
      ).payload,
    ).issue.id;

    const beforeCount = harness.databaseService.db.select().from(notifications).all().length;

    const response = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PATCH",
      payload: { status: "ISSUE_STATUS_OPEN" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}`,
    });

    expect(response.statusCode).toBe(200);
    const afterCount = harness.databaseService.db.select().from(notifications).all().length;
    expect(afterCount).toBe(beforeCount);
  });

  it("creates a notification for a top-level project attachment but not a comment attachment", async () => {
    const actor = await harness.registerUser("notif-attachment-actor");
    const teammate = await harness.registerUser("notif-attachment-teammate");

    const projectId = harness.parseJson<{ project: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(actor.accessToken),
          method: "POST",
          payload: { name: "Attachment project" },
          url: "/stc-proj-mgmt/api/projects",
        })
      ).payload,
    ).project.id;

    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: actor.user.id,
          },
          { roleCodes: [], userId: teammate.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const projectAttachmentResponse = await harness.app.inject({
      headers: {
        ...harness.createAuthHeaders(actor.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload: createMultipartFileBuffer({
        boundary: MULTIPART_BOUNDARY,
        content: MINIMAL_PNG_BUFFER,
        contentType: "image/png",
        fieldName: "file",
        filename: "project-upload.png",
      }),
      url: `/stc-proj-mgmt/api/projects/${projectId}/attachments`,
    });

    expect(projectAttachmentResponse.statusCode).toBe(201);
    const afterProjectAttachmentCount = harness.databaseService.db
      .select()
      .from(notifications)
      .all()
      .length;
    expect(afterProjectAttachmentCount).toBeGreaterThan(0);

    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(actor.accessToken),
          method: "POST",
          payload: { name: "Issue with comment attachment" },
          url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
        })
      ).payload,
    ).issue.id;
    const createCommentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "POST",
      payload: { body: "Parent comment body." },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(createCommentResponse.statusCode).toBe(201);
    const commentId = harness.parseJson<{ comment: { id: number } }>(
      createCommentResponse.payload,
    ).comment.id;

    const beforeCommentAttachmentCount = harness.databaseService.db
      .select()
      .from(notifications)
      .all()
      .length;

    const commentAttachmentResponse = await harness.app.inject({
      headers: {
        ...harness.createAuthHeaders(actor.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload: createMultipartFileBuffer({
        boundary: MULTIPART_BOUNDARY,
        content: MINIMAL_PNG_BUFFER,
        contentType: "image/png",
        fieldName: "file",
        filename: "comment-upload.png",
      }),
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${commentId}/attachments`,
    });

    expect(commentAttachmentResponse.statusCode).toBe(201);
    const afterCommentAttachmentCount = harness.databaseService.db
      .select()
      .from(notifications)
      .all()
      .length;
    expect(afterCommentAttachmentCount).toBe(beforeCommentAttachmentCount);
  });

  it("creates task status notifications only when a chart save changes a task status", async () => {
    const actor = await harness.registerUser("notif-task-status");
    const teammate = await harness.registerUser("notif-task-status-teammate");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(actor.accessToken),
          method: "POST",
          payload: { name: "Task status project" },
          url: "/stc-proj-mgmt/api/projects",
        })
      ).payload,
    ).project.id;

    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: actor.user.id,
          },
          { roleCodes: [], userId: teammate.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const unchangedSave = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PUT",
      payload: {
        xml: VALID_OPEN_TASK_CHART_XML,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/chart`,
    });
    expect(unchangedSave.statusCode).toBe(200);

    const beforeChangedSave = harness.databaseService.db.select().from(notifications).all().length;

    const changedSave = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PUT",
      payload: {
        xml: VALID_BLOCKED_TASK_CHART_XML,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/chart`,
    });
    expect(changedSave.statusCode).toBe(200);

    const afterChangedSave = harness.databaseService.db.select().from(notifications).all().length;
    expect(afterChangedSave).toBe(beforeChangedSave + 1);
  });

  it("lists unnoticed notifications, reports the summary count, and toggles noticed state", async () => {
    const actor = await harness.registerUser("notif-list-actor");
    const recipient = await harness.registerUser("notif-list-recipient");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(actor.accessToken),
          method: "POST",
          payload: { name: "Notifications list project" },
          url: "/stc-proj-mgmt/api/projects",
        })
      ).payload,
    ).project.id;

    await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: actor.user.id,
          },
          { roleCodes: [], userId: recipient.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });

    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(actor.accessToken),
          method: "POST",
          payload: { name: "Notifications list issue" },
          url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
        })
      ).payload,
    ).issue.id;

    const firstCommentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "POST",
      payload: { body: "Comment one body." },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    const secondCommentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "POST",
      payload: { body: "Comment two body." },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(firstCommentResponse.statusCode).toBe(201);
    expect(secondCommentResponse.statusCode).toBe(201);

    const summaryResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/notifications/summary",
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(
      harness.parseJson<{ unnoticedCount: number }>(summaryResponse.payload).unnoticedCount,
    ).toBe(2);

    const unnoticedResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/notifications/unnoticed?limit=20",
    });
    expect(unnoticedResponse.statusCode).toBe(200);
    const unnoticedBody = harness.parseJson<{
      notifications: Array<{ hasBeenNoticed: boolean; id: number }>;
    }>(unnoticedResponse.payload);
    expect(unnoticedBody.notifications).toHaveLength(2);
    expect(unnoticedBody.notifications.every((row) => row.hasBeenNoticed === false)).toBe(true);

    const toggleResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "POST",
      url: `/stc-proj-mgmt/api/notifications/${unnoticedBody.notifications[0]!.id}/toggle-noticed`,
    });
    expect(toggleResponse.statusCode).toBe(200);
    expect(
      harness.parseJson<{ hasBeenNoticed: boolean }>(toggleResponse.payload).hasBeenNoticed,
    ).toBe(true);

    const fullListResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/notifications?limit=20&offset=0&includeNoticed=false&sort=desc",
    });
    expect(fullListResponse.statusCode).toBe(200);
    expect(
      harness.parseJson<{ notifications: Array<{ hasBeenNoticed: boolean }> }>(
        fullListResponse.payload,
      ).notifications,
    ).toHaveLength(1);
  });

  it("filters notifications by category in the paginated list", async () => {
    const actor = await harness.registerUser("notif-filter-actor");
    const recipient = await harness.registerUser("notif-filter-recipient");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(actor.accessToken),
          method: "POST",
          payload: { name: "Notification filter project" },
          url: "/stc-proj-mgmt/api/projects",
        })
      ).payload,
    ).project.id;

    await harness.databaseService.db.insert(projectsUsers).values({
      projectId,
      userId: recipient.user.id,
    }).run();

    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(actor.accessToken),
          method: "POST",
          payload: { name: "Filtered issue" },
          url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
        })
      ).payload,
    ).issue.id;

    await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "POST",
      payload: { body: "Comment filter seed" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PATCH",
      payload: { status: "ISSUE_STATUS_IN_PROGRESS" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}`,
    });

    const commentsOnlyResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/notifications?limit=20&offset=0&includeNoticed=true&sort=desc&eventTypes=comments",
    });
    expect(commentsOnlyResponse.statusCode).toBe(200);
    const commentsOnly = harness.parseJson<{ notifications: Array<{ eventCategory: string }> }>(
      commentsOnlyResponse.payload,
    );
    expect(commentsOnly.notifications).toHaveLength(1);
    expect(commentsOnly.notifications[0]!.eventCategory).toBe("comments");
  });
});
