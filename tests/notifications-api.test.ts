import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { eq } from "drizzle-orm";

import {
  mentions,
  notifications,
  organizations,
  projectsOrganizations,
  projectsUsers,
  projectsTeams,
  teams,
  teamsUsers,
  usersOrganizations,
  usersNotifications,
} from "../db/index.js";
import { createIssueDetailsNotificationTarget } from "../common/notifications/notification-targets.js";
import {
  createCrudTestHarness,
  type AuthSession,
} from "./crud-test-helpers.js";
import { createMultipartFileBuffer } from "./multipart-form.helpers.js";

const harness = createCrudTestHarness("notifications-api.sqlite");

const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const MINIMAL_PNG_BUFFER = Buffer.from(MINIMAL_PNG_BASE64, "base64");
const MULTIPART_BOUNDARY = "----notificationBoundary";
const DEFAULT_TASK_ID = "1";
const DEFAULT_CHART_ID = 0;
const PROJECT_MANAGER_ROLE = "GGTC_PROJECTROLE_PROJECT_MANAGER";
const PROJECT_OWNER_ROLE = "GGTC_PROJECTROLE_PROJECT_OWNER";
const ISSUE_UPDATES_CATEGORY = "issue-updates";
const MENTIONS_CATEGORY = "mentions";
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

async function createProject(accessToken: string, name: string): Promise<number> {
  const response = await harness.app.inject({
    headers: harness.createAuthHeaders(accessToken),
    method: "POST",
    payload: { name },
    url: "/stc-proj-mgmt/api/projects",
  });

  expect(response.statusCode).toBe(201);
  return harness.parseJson<{ project: { id: number } }>(response.payload).project.id;
}

async function createIssue(
  accessToken: string,
  projectId: number,
  name: string,
): Promise<number> {
  const response = await harness.app.inject({
    headers: harness.createAuthHeaders(accessToken),
    method: "POST",
    payload: { name },
    url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
  });

  expect(response.statusCode).toBe(201);
  return harness.parseJson<{ issue: { id: number } }>(response.payload).issue.id;
}

async function replaceProjectMembers(
  accessToken: string,
  projectId: number,
  members: Array<{ roleCodes: string[]; userId: number }>,
): Promise<void> {
  const response = await harness.app.inject({
    headers: harness.createAuthHeaders(accessToken),
    method: "PUT",
    payload: { members },
    url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
  });

  expect(response.statusCode).toBe(200);
}

async function createScopedSession(accessToken: string): Promise<AuthSession> {
  const createTokenResponse = await harness.app.inject({
    headers: harness.createAuthHeaders(accessToken),
    method: "POST",
    payload: {},
    url: "/stc-proj-mgmt/api/scoped-access/tokens",
  });
  expect(createTokenResponse.statusCode).toBe(201);
  const token = harness.parseJson<{
    token: string;
    tokenCredential: { id: number };
  }>(createTokenResponse.payload).token;

  const redeemResponse = await harness.app.inject({
    method: "POST",
    payload: { token },
    url: "/stc-proj-mgmt/api/scoped-access/redeem",
  });
  expect(redeemResponse.statusCode).toBe(201);

  return harness.parseJson<AuthSession>(redeemResponse.payload);
}

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
    const createdCommentNotifications = harness.databaseService.db.select()
      .from(notifications)
      .all()
      .filter((row) => row.eventType === "NOTIFICATION_EVENT_ISSUE_COMMENT_CREATED");
    expect(createdCommentNotifications).toHaveLength(1);

    const deliveries = harness.databaseService.db.select().from(usersNotifications).all();
    expect(deliveries.map((row) => row.userId)).toContain(teammate.user.id);
    expect(deliveries.map((row) => row.userId)).not.toContain(actor.user.id);
    expect(deliveries.map((row) => row.userId)).not.toContain(outsider.user.id);
  });

  it("creates an issue creation notification in the issue-updates category", async () => {
    const actor = await harness.registerUser("notif-issue-create-actor");
    const recipient = await harness.registerUser("notif-issue-create-recipient");
    const projectId = await createProject(actor.accessToken, "Issue creation project");

    await replaceProjectMembers(actor.accessToken, projectId, [
      {
        roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
        userId: actor.user.id,
      },
      { roleCodes: [], userId: recipient.user.id },
    ]);

    const issueId = await createIssue(
      actor.accessToken,
      projectId,
      "Created issue notification",
    );

    const createdNotification = harness.databaseService.db.select()
      .from(notifications)
      .where(eq(notifications.issueId, issueId))
      .all()
      .find((row) => row.eventType === "NOTIFICATION_EVENT_ISSUE_CREATED");
    const expectedIssueDetailsTarget = createIssueDetailsNotificationTarget(
      projectId,
      issueId,
    );

    expect(createdNotification).toBeDefined();
    expect(createdNotification?.targetUrl).toBe(expectedIssueDetailsTarget);

    const recipientListResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/notifications?limit=20&offset=0&includeNoticed=true&sort=desc&eventTypes=${ISSUE_UPDATES_CATEGORY}`,
    });
    expect(recipientListResponse.statusCode).toBe(200);

    const body = harness.parseJson<{
      notifications: Array<{ eventCategory: string; eventType: string; targetUrl: string }>;
    }>(recipientListResponse.payload);
    expect(body.notifications.some((row) =>
      row.eventType === "NOTIFICATION_EVENT_ISSUE_CREATED"
      && row.eventCategory === ISSUE_UPDATES_CATEGORY
      && row.targetUrl === expectedIssueDetailsTarget
    )).toBe(true);
  });

  it("normalizes legacy /pm/pm notification targets into /pm app routes", async () => {
    const actor = await harness.registerUser("notif-legacy-target-actor");
    const recipient = await harness.registerUser("notif-legacy-target-recipient");
    const projectId = await createProject(actor.accessToken, "Legacy target project");

    const [createdLegacyNotification] = harness.databaseService.db.insert(notifications)
      .values({
        actorUserId: actor.user.id,
        attachmentId: null,
        commentId: null,
        eventType: "NOTIFICATION_EVENT_ISSUE_CREATED",
        issueId: null,
        mentionedUserId: null,
        message: "Legacy double-pm target",
        projectId,
        targetUrl: `/pm/pm/project?projectId=${projectId}`,
        taskId: null,
      })
      .returning({ id: notifications.id })
      .all();

    expect(createdLegacyNotification).toBeDefined();

    harness.databaseService.db.insert(usersNotifications)
      .values({
        notificationId: createdLegacyNotification.id,
        userId: recipient.user.id,
      })
      .run();

    const listResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/notifications?limit=20&offset=0&includeNoticed=true&sort=desc&eventTypes=${ISSUE_UPDATES_CATEGORY}`,
    });
    expect(listResponse.statusCode).toBe(200);

    const body = harness.parseJson<{
      notifications: Array<{ id: number; targetUrl: string }>;
    }>(listResponse.payload);
    expect(
      body.notifications.some((row) =>
        row.id === createdLegacyNotification.id
        && row.targetUrl === `/pm/project?projectId=${projectId}`
      ),
    ).toBe(true);

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
      url: `/stc-proj-mgmt/api/projects/${projectId}/charts/${DEFAULT_CHART_ID}`,
    });
    expect(unchangedSave.statusCode).toBe(200);

    const beforeChangedSave = harness.databaseService.db.select().from(notifications).all().length;

    const changedSave = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PUT",
      payload: {
        xml: VALID_BLOCKED_TASK_CHART_XML,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/charts/${DEFAULT_CHART_ID}`,
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
    ).toBe(3);

    const unnoticedResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/notifications/unnoticed?limit=20",
    });
    expect(unnoticedResponse.statusCode).toBe(200);
    const unnoticedBody = harness.parseJson<{
      notifications: Array<{ hasBeenNoticed: boolean; id: number }>;
    }>(unnoticedResponse.payload);
    expect(unnoticedBody.notifications).toHaveLength(3);
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
    ).toHaveLength(2);
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

  it("creates issue comment mention notifications only for first-time mentions", async () => {
    const actor = await harness.registerUser("notif-issue-mention-actor");
    const recipient = await harness.registerUser("notif-issue-mention-recipient");
    const outsider = await harness.registerUser("notif-issue-mention-outsider");
    const projectId = await createProject(actor.accessToken, "Issue mention project");

    await replaceProjectMembers(actor.accessToken, projectId, [
      {
        roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
        userId: actor.user.id,
      },
      { roleCodes: [], userId: recipient.user.id },
    ]);

    const issueId = await createIssue(actor.accessToken, projectId, "Issue mention target");
    const createCommentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "POST",
      payload: {
        body:
          `Please review this update with @${recipient.user.username} and `
          + `@[${outsider.user.username}] before tomorrow.`,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(createCommentResponse.statusCode).toBe(201);
    const commentId = harness.parseJson<{ comment: { id: number } }>(
      createCommentResponse.payload,
    ).comment.id;

    const mentionRowsAfterCreate = harness.databaseService.db.select()
      .from(mentions)
      .where(eq(mentions.commentId, commentId))
      .all();
    expect(mentionRowsAfterCreate).toHaveLength(1);
    expect(mentionRowsAfterCreate[0]?.mentionedUserId).toBe(recipient.user.id);

    const firstMentionNotifications = harness.databaseService.db.select()
      .from(notifications)
      .where(eq(notifications.commentId, commentId))
      .all()
      .filter((row) => row.eventType === "NOTIFICATION_EVENT_ISSUE_COMMENT_MENTIONED");
    expect(firstMentionNotifications).toHaveLength(1);

    const editResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PATCH",
      payload: {
        body:
          `Still looping in @${recipient.user.username}, and adding `
          + `@[${actor.user.username}] here too.`,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${commentId}`,
    });
    expect(editResponse.statusCode).toBe(200);

    const mentionRowsAfterEdit = harness.databaseService.db.select()
      .from(mentions)
      .where(eq(mentions.commentId, commentId))
      .all();
    expect(mentionRowsAfterEdit).toHaveLength(1);

    const mentionNotificationsAfterEdit = harness.databaseService.db.select()
      .from(notifications)
      .where(eq(notifications.commentId, commentId))
      .all()
      .filter((row) => row.eventType === "NOTIFICATION_EVENT_ISSUE_COMMENT_MENTIONED");
    expect(mentionNotificationsAfterEdit).toHaveLength(1);

    const recipientMentionsResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/notifications?limit=20&offset=0&includeNoticed=true&sort=desc&eventTypes=${MENTIONS_CATEGORY}`,
    });
    expect(recipientMentionsResponse.statusCode).toBe(200);
    const recipientMentions = harness.parseJson<{
      notifications: Array<{ eventCategory: string; eventType: string }>;
    }>(recipientMentionsResponse.payload);
    expect(recipientMentions.notifications.some((row) =>
      row.eventCategory === MENTIONS_CATEGORY
      && row.eventType === "NOTIFICATION_EVENT_ISSUE_COMMENT_MENTIONED"
    )).toBe(true);

    const outsiderSummaryResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/notifications/summary",
    });
    expect(outsiderSummaryResponse.statusCode).toBe(200);
    expect(
      harness.parseJson<{ unnoticedCount: number }>(outsiderSummaryResponse.payload).unnoticedCount,
    ).toBe(0);
  });

  it("creates task comment mention notifications only for first-time mentions", async () => {
    const actor = await harness.registerUser("notif-task-mention-actor");
    const recipient = await harness.registerUser("notif-task-mention-recipient");
    const projectId = await createProject(actor.accessToken, "Task mention project");

    await replaceProjectMembers(actor.accessToken, projectId, [
      {
        roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
        userId: actor.user.id,
      },
      { roleCodes: [], userId: recipient.user.id },
    ]);

    const createCommentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "POST",
      payload: {
        body: `Please review this task with @${recipient.user.username} today.`,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/charts/${DEFAULT_CHART_ID}/tasks/${DEFAULT_TASK_ID}/comments`,
    });
    expect(createCommentResponse.statusCode).toBe(201);
    const commentId = harness.parseJson<{ comment: { id: number } }>(
      createCommentResponse.payload,
    ).comment.id;

    const firstMentions = harness.databaseService.db.select()
      .from(mentions)
      .where(eq(mentions.commentId, commentId))
      .all();
    expect(firstMentions).toHaveLength(1);

    const editResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PATCH",
      payload: {
        body: `Still need @${recipient.user.username} on this task update today.`,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/charts/${DEFAULT_CHART_ID}/tasks/${DEFAULT_TASK_ID}/comments/${commentId}`,
    });
    expect(editResponse.statusCode).toBe(200);

    const secondMentionNotifications = harness.databaseService.db.select()
      .from(notifications)
      .where(eq(notifications.commentId, commentId))
      .all()
      .filter((row) => row.eventType === "NOTIFICATION_EVENT_TASK_COMMENT_MENTIONED");
    expect(secondMentionNotifications).toHaveLength(1);
  });

  it("creates journal mention notifications only for newly added users across project, issue, and task journals", async () => {
    const actor = await harness.registerUser("notif-journal-mention-actor");
    const directUser = await harness.registerUser("notif-journal-direct");
    const teamUser = await harness.registerUser("notif-journal-team");
    const organizationUser = await harness.registerUser("notif-journal-org");
    const outsider = await harness.registerUser("notif-journal-outsider");

    const projectId = await createProject(actor.accessToken, "Journal mention project");
    await replaceProjectMembers(actor.accessToken, projectId, [
      {
        roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
        userId: actor.user.id,
      },
      { roleCodes: [], userId: directUser.user.id },
    ]);

    harness.databaseService.db.insert(teams).values({ name: "Mention Team" }).run();
    const teamId = harness.databaseService.db.select({ id: teams.id })
      .from(teams)
      .orderBy(teams.id)
      .all()
      .at(-1)?.id;
    expect(teamId).toBeDefined();
    harness.databaseService.db.insert(teamsUsers).values({
      teamId: teamId!,
      userId: teamUser.user.id,
    }).run();
    harness.databaseService.db.insert(projectsTeams).values({
      projectId,
      teamId: teamId!,
    }).run();

    harness.databaseService.db.insert(organizations).values({ name: "Mention Org" }).run();
    const organizationId = harness.databaseService.db.select({ id: organizations.id })
      .from(organizations)
      .orderBy(organizations.id)
      .all()
      .at(-1)?.id;
    expect(organizationId).toBeDefined();
    harness.databaseService.db.insert(usersOrganizations).values({
      organizationId: organizationId!,
      userId: organizationUser.user.id,
    }).run();
    harness.databaseService.db.insert(projectsOrganizations).values({
      organizationId: organizationId!,
      projectId,
    }).run();

    const issueId = await createIssue(actor.accessToken, projectId, "Journal issue");

    const projectJournalResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PUT",
      payload: {
        markdown:
          `Project journal mentions @${directUser.user.username}, `
          + `@[${teamUser.user.username}], and @${organizationUser.user.username}.`,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/journal`,
    });
    expect(projectJournalResponse.statusCode).toBe(200);

    const issueJournalResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PUT",
      payload: {
        markdown:
          `Issue journal mentions @${directUser.user.username} for context and `
          + `@${outsider.user.username} should be ignored.`,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/journal`,
    });
    expect(issueJournalResponse.statusCode).toBe(200);

    const taskJournalResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PUT",
      payload: {
        markdown: `Task journal mentions @${teamUser.user.username} for follow-up work.`,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/charts/${DEFAULT_CHART_ID}/tasks/${DEFAULT_TASK_ID}/journal`,
    });
    expect(taskJournalResponse.statusCode).toBe(200);

    const mentionRows = harness.databaseService.db.select().from(mentions).all();
    expect(mentionRows.length).toBeGreaterThanOrEqual(4);

    const mentionNotifications = harness.databaseService.db.select().from(notifications).all()
      .filter((row) =>
        row.eventType === "NOTIFICATION_EVENT_PROJECT_JOURNAL_MENTIONED"
        || row.eventType === "NOTIFICATION_EVENT_ISSUE_JOURNAL_MENTIONED"
        || row.eventType === "NOTIFICATION_EVENT_TASK_JOURNAL_MENTIONED"
      );
    expect(mentionNotifications.length).toBeGreaterThanOrEqual(4);

    const outsiderMentionsResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(outsider.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/notifications/summary",
    });
    expect(outsiderMentionsResponse.statusCode).toBe(200);
    expect(
      harness.parseJson<{ unnoticedCount: number }>(outsiderMentionsResponse.payload).unnoticedCount,
    ).toBe(0);

    const directMentionsResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(directUser.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/notifications?limit=20&offset=0&includeNoticed=true&sort=desc&eventTypes=${MENTIONS_CATEGORY}`,
    });
    expect(directMentionsResponse.statusCode).toBe(200);
    const directMentions = harness.parseJson<{
      notifications: Array<{ eventCategory: string; message: string }>;
    }>(directMentionsResponse.payload);
    expect(directMentions.notifications.every((row) => row.eventCategory === MENTIONS_CATEGORY)).toBe(true);

    const repeatedProjectJournalResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "PUT",
      payload: {
        markdown:
          `Project journal still mentions @${directUser.user.username}, `
          + `@[${teamUser.user.username}], and @${organizationUser.user.username}.`,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/journal`,
    });
    expect(repeatedProjectJournalResponse.statusCode).toBe(200);

    const repeatedMentionRows = harness.databaseService.db.select().from(mentions).all();
    expect(repeatedMentionRows).toHaveLength(mentionRows.length);
  });

  it("shares notification state between standard and scoped sessions for the same user", async () => {
    const actor = await harness.registerUser("notif-scoped-actor");
    const recipient = await harness.registerUser("notif-scoped-recipient");
    const projectId = await createProject(actor.accessToken, "Scoped notification project");

    await replaceProjectMembers(actor.accessToken, projectId, [
      {
        roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
        userId: actor.user.id,
      },
      { roleCodes: [], userId: recipient.user.id },
    ]);

    const issueId = await createIssue(actor.accessToken, projectId, "Scoped issue");
    const commentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(actor.accessToken),
      method: "POST",
      payload: { body: "Scoped state should be shared." },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(commentResponse.statusCode).toBe(201);

    const scopedSession = await createScopedSession(recipient.accessToken);

    const standardSummary = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/notifications/summary",
    });
    const scopedSummary = await harness.app.inject({
      headers: harness.createAuthHeaders(scopedSession.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/notifications/summary",
    });
    expect(standardSummary.statusCode).toBe(200);
    expect(scopedSummary.statusCode).toBe(200);
    expect(standardSummary.payload).toBe(scopedSummary.payload);

    const standardList = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/notifications/unnoticed?limit=20",
    });
    expect(standardList.statusCode).toBe(200);
    const notificationId = harness.parseJson<{
      notifications: Array<{ id: number }>;
    }>(standardList.payload).notifications[0]?.id;
    expect(notificationId).toBeDefined();

    const scopedToggle = await harness.app.inject({
      headers: harness.createAuthHeaders(scopedSession.accessToken),
      method: "POST",
      url: `/stc-proj-mgmt/api/notifications/${notificationId}/toggle-noticed`,
    });
    expect(scopedToggle.statusCode).toBe(200);

    const standardAfterToggle = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/notifications/summary",
    });
    expect(
      harness.parseJson<{ unnoticedCount: number }>(standardAfterToggle.payload).unnoticedCount,
    ).toBe(1);

    const standardToggleBack = await harness.app.inject({
      headers: harness.createAuthHeaders(recipient.accessToken),
      method: "POST",
      url: `/stc-proj-mgmt/api/notifications/${notificationId}/toggle-noticed`,
    });
    expect(standardToggleBack.statusCode).toBe(200);

    const scopedAfterToggleBack = await harness.app.inject({
      headers: harness.createAuthHeaders(scopedSession.accessToken),
      method: "GET",
      url: "/stc-proj-mgmt/api/notifications/summary",
    });
    expect(
      harness.parseJson<{ unnoticedCount: number }>(scopedAfterToggleBack.payload).unnoticedCount,
    ).toBe(2);
  });
});
