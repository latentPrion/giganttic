import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { taskMirror } from "../db/index.js";
import { createCrudTestHarness } from "./crud-test-helpers.js";
import { createMultipartFileBuffer } from "./multipart-form.helpers.js";

const DEFAULT_TASK_ID = "1";
const MISSING_TASK_ID = "missing-task";
const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const MINIMAL_PNG_BUFFER = Buffer.from(MINIMAL_PNG_BASE64, "base64");
const MULTIPART_BOUNDARY = "----taskAttachmentTestBoundary";
const VALID_COMMENT_BODY = "This task comment is valid.";

const harness = createCrudTestHarness("task-comments-attachments.sqlite");

describe("task comments and attachments api", () => {
  beforeAll(async () => {
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it("creates the task mirror on the first task comment only", async () => {
    const user = await harness.registerUser("task-first-comment");
    const { projectId } = await createProjectWithDefaultTask(user.accessToken, "Task comments");

    expect(selectTaskMirrorRows(projectId, DEFAULT_TASK_ID)).toEqual([]);

    const createResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: { body: VALID_COMMENT_BODY },
      url: buildTaskCommentsPath(projectId, DEFAULT_TASK_ID),
    });

    expect(createResponse.statusCode).toBe(201);
    expect(selectTaskMirrorRows(projectId, DEFAULT_TASK_ID)).toHaveLength(1);
  });

  it("returns 404 for a missing task comment target and leaves task mirror absent", async () => {
    const user = await harness.registerUser("task-missing-comment");
    const { projectId } = await createProjectWithDefaultTask(user.accessToken, "Task missing");

    const createResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: { body: VALID_COMMENT_BODY },
      url: buildTaskCommentsPath(projectId, MISSING_TASK_ID),
    });

    expect(createResponse.statusCode).toBe(404);
    expect(selectTaskMirrorRows(projectId, MISSING_TASK_ID)).toEqual([]);
  });

  it("lists task comments without creating a task mirror row", async () => {
    const user = await harness.registerUser("task-list-comments");
    const { projectId } = await createProjectWithDefaultTask(user.accessToken, "Task list comments");

    const response = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: buildTaskCommentsPath(projectId, DEFAULT_TASK_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(harness.parseJson<{ comments: unknown[] }>(response.payload)).toEqual({
      comments: [],
    });
    expect(selectTaskMirrorRows(projectId, DEFAULT_TASK_ID)).toEqual([]);
  });

  it("creates the task mirror on the first task-level attachment only", async () => {
    const user = await harness.registerUser("task-first-attachment");
    const { projectId } = await createProjectWithDefaultTask(user.accessToken, "Task attachments");

    expect(selectTaskMirrorRows(projectId, DEFAULT_TASK_ID)).toEqual([]);

    const uploadResponse = await harness.app.inject({
      headers: buildMultipartHeaders(user.accessToken),
      method: "POST",
      payload: createPngUploadPayload("first-task.png"),
      url: buildTaskAttachmentsPath(projectId, DEFAULT_TASK_ID),
    });

    expect(uploadResponse.statusCode).toBe(201);
    expect(selectTaskMirrorRows(projectId, DEFAULT_TASK_ID)).toHaveLength(1);
  });

  it("returns 404 for a missing task attachment target and leaves task mirror absent", async () => {
    const user = await harness.registerUser("task-missing-attachment");
    const { projectId } = await createProjectWithDefaultTask(user.accessToken, "Task missing attachments");

    const uploadResponse = await harness.app.inject({
      headers: buildMultipartHeaders(user.accessToken),
      method: "POST",
      payload: createPngUploadPayload("missing-task.png"),
      url: buildTaskAttachmentsPath(projectId, MISSING_TASK_ID),
    });

    expect(uploadResponse.statusCode).toBe(404);
    expect(selectTaskMirrorRows(projectId, MISSING_TASK_ID)).toEqual([]);
  });

  it("lists task attachments without creating a task mirror row", async () => {
    const user = await harness.registerUser("task-list-attachments");
    const { projectId } = await createProjectWithDefaultTask(user.accessToken, "Task list attachments");

    const response = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: buildTaskAttachmentsPath(projectId, DEFAULT_TASK_ID),
    });

    expect(response.statusCode).toBe(200);
    expect(harness.parseJson<{ attachments: unknown[] }>(response.payload)).toEqual({
      attachments: [],
    });
    expect(selectTaskMirrorRows(projectId, DEFAULT_TASK_ID)).toEqual([]);
  });

  it("does not create a task mirror when task comment attachment upload targets a missing comment", async () => {
    const user = await harness.registerUser("task-comment-attachment-missing");
    const { projectId } = await createProjectWithDefaultTask(
      user.accessToken,
      "Task comment attachment missing",
    );

    const uploadResponse = await harness.app.inject({
      headers: buildMultipartHeaders(user.accessToken),
      method: "POST",
      payload: createPngUploadPayload("missing-comment.png"),
      url: `${buildTaskCommentsPath(projectId, DEFAULT_TASK_ID)}/999/attachments`,
    });

    expect(uploadResponse.statusCode).toBe(404);
    expect(selectTaskMirrorRows(projectId, DEFAULT_TASK_ID)).toEqual([]);
  });

  it("downloads task comment attachments through the comment-scoped route", async () => {
    const user = await harness.registerUser("task-comment-attachment-download");
    const { projectId } = await createProjectWithDefaultTask(
      user.accessToken,
      "Task comment attachment download",
    );

    const commentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: { body: VALID_COMMENT_BODY },
      url: buildTaskCommentsPath(projectId, DEFAULT_TASK_ID),
    });
    expect(commentResponse.statusCode).toBe(201);
    const commentId = harness.parseJson<{ comment: { id: number } }>(
      commentResponse.payload,
    ).comment.id;

    const uploadResponse = await harness.app.inject({
      headers: buildMultipartHeaders(user.accessToken),
      method: "POST",
      payload: createPngUploadPayload("task-comment-download.png"),
      url: `${buildTaskCommentsPath(projectId, DEFAULT_TASK_ID)}/${commentId}/attachments`,
    });
    expect(uploadResponse.statusCode).toBe(201);
    const uploaded = harness.parseJson<{ attachment: { id: string } }>(
      uploadResponse.payload,
    );

    const unauthDownload = await harness.app.inject({
      method: "GET",
      url: `${buildTaskCommentsPath(projectId, DEFAULT_TASK_ID)}/${commentId}/attachments/${uploaded.attachment.id}/download`,
    });
    expect(unauthDownload.statusCode).toBe(401);

    const downloadResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: `${buildTaskCommentsPath(projectId, DEFAULT_TASK_ID)}/${commentId}/attachments/${uploaded.attachment.id}/download`,
    });
    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.rawPayload.equals(MINIMAL_PNG_BUFFER)).toBe(true);
  });

  it("does not download task comment attachments through a different comment or task", async () => {
    const user = await harness.registerUser("task-comment-attachment-download-guard");
    const { projectId } = await createProjectWithDefaultTask(
      user.accessToken,
      "Task comment attachment download guard",
    );
    const otherTaskId = "2";
    await putProjectChartWithTaskIds(user.accessToken, projectId, [
      DEFAULT_TASK_ID,
      otherTaskId,
    ]);

    const firstCommentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: { body: VALID_COMMENT_BODY },
      url: buildTaskCommentsPath(projectId, DEFAULT_TASK_ID),
    });
    expect(firstCommentResponse.statusCode).toBe(201);
    const firstCommentId = harness.parseJson<{ comment: { id: number } }>(
      firstCommentResponse.payload,
    ).comment.id;

    const secondCommentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: { body: `${VALID_COMMENT_BODY} second` },
      url: buildTaskCommentsPath(projectId, DEFAULT_TASK_ID),
    });
    expect(secondCommentResponse.statusCode).toBe(201);
    const secondCommentId = harness.parseJson<{ comment: { id: number } }>(
      secondCommentResponse.payload,
    ).comment.id;

    const uploadResponse = await harness.app.inject({
      headers: buildMultipartHeaders(user.accessToken),
      method: "POST",
      payload: createPngUploadPayload("task-comment-guard.png"),
      url: `${buildTaskCommentsPath(projectId, DEFAULT_TASK_ID)}/${firstCommentId}/attachments`,
    });
    expect(uploadResponse.statusCode).toBe(201);
    const uploaded = harness.parseJson<{ attachment: { id: string } }>(
      uploadResponse.payload,
    );

    const wrongCommentDownload = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: `${buildTaskCommentsPath(projectId, DEFAULT_TASK_ID)}/${secondCommentId}/attachments/${uploaded.attachment.id}/download`,
    });
    expect(wrongCommentDownload.statusCode).toBe(404);

    const wrongTaskDownload = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: `${buildTaskCommentsPath(projectId, otherTaskId)}/${firstCommentId}/attachments/${uploaded.attachment.id}/download`,
    });
    expect(wrongTaskDownload.statusCode).toBe(404);
  });

  it("forbids a non-project-manager member from uploading task-level attachments", async () => {
    const owner = await harness.registerUser("task-attachment-owner");
    const member = await harness.registerUser("task-attachment-member");
    const { projectId } = await createProjectWithDefaultTask(owner.accessToken, "Task attachment perms");
    await replaceProjectMembers(projectId, owner.user.id, member.user.id, owner.accessToken);

    const uploadResponse = await harness.app.inject({
      headers: buildMultipartHeaders(member.accessToken),
      method: "POST",
      payload: createPngUploadPayload("member-task-upload.png"),
      url: buildTaskAttachmentsPath(projectId, DEFAULT_TASK_ID),
    });

    expect(uploadResponse.statusCode).toBe(403);
    expect(selectTaskMirrorRows(projectId, DEFAULT_TASK_ID)).toEqual([]);
  });

  it("forbids a non-author non-project-manager member from uploading or deleting task comment attachments", async () => {
    const owner = await harness.registerUser("task-comment-attachment-owner");
    const member = await harness.registerUser("task-comment-attachment-member");
    const { projectId } = await createProjectWithDefaultTask(
      owner.accessToken,
      "Task comment attachment perms",
    );
    await replaceProjectMembers(projectId, owner.user.id, member.user.id, owner.accessToken);

    const commentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(owner.accessToken),
      method: "POST",
      payload: { body: VALID_COMMENT_BODY },
      url: buildTaskCommentsPath(projectId, DEFAULT_TASK_ID),
    });
    expect(commentResponse.statusCode).toBe(201);
    const commentId = harness.parseJson<{ comment: { id: number } }>(
      commentResponse.payload,
    ).comment.id;

    const ownerUploadResponse = await harness.app.inject({
      headers: buildMultipartHeaders(owner.accessToken),
      method: "POST",
      payload: createPngUploadPayload("owner-comment-attachment.png"),
      url: `${buildTaskCommentsPath(projectId, DEFAULT_TASK_ID)}/${commentId}/attachments`,
    });
    expect(ownerUploadResponse.statusCode).toBe(201);
    const uploaded = harness.parseJson<{ attachment: { id: string } }>(
      ownerUploadResponse.payload,
    );

    const memberUploadResponse = await harness.app.inject({
      headers: buildMultipartHeaders(member.accessToken),
      method: "POST",
      payload: createPngUploadPayload("member-comment-attachment.png"),
      url: `${buildTaskCommentsPath(projectId, DEFAULT_TASK_ID)}/${commentId}/attachments`,
    });
    expect(memberUploadResponse.statusCode).toBe(403);

    const memberDeleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(member.accessToken),
      method: "DELETE",
      url: `${buildTaskCommentsPath(projectId, DEFAULT_TASK_ID)}/${commentId}/attachments/${uploaded.attachment.id}`,
    });
    expect(memberDeleteResponse.statusCode).toBe(403);
  });

  it("accepts otherwise rejected task attachment uploads for an effective project manager and rejects them for other users", async () => {
    const owner = await harness.registerUser("task-attachment-bypass-owner");
    const member = await harness.registerUser("task-attachment-bypass-member");
    const { projectId } = await createProjectWithDefaultTask(
      owner.accessToken,
      "Task attachment bypass",
    );
    await replaceProjectMembers(projectId, owner.user.id, member.user.id, owner.accessToken);

    const ownerBadExtension = await harness.app.inject({
      headers: buildMultipartHeaders(owner.accessToken),
      method: "POST",
      payload: createUploadPayload("task-any.exe", Buffer.from("MZ fake exe"), "application/octet-stream"),
      url: buildTaskAttachmentsPath(projectId, DEFAULT_TASK_ID),
    });
    const ownerBadMagic = await harness.app.inject({
      headers: buildMultipartHeaders(owner.accessToken),
      method: "POST",
      payload: createUploadPayload("task-fake.png", Buffer.from("not a real png"), "image/png"),
      url: buildTaskAttachmentsPath(projectId, DEFAULT_TASK_ID),
    });
    const memberBadExtension = await harness.app.inject({
      headers: buildMultipartHeaders(member.accessToken),
      method: "POST",
      payload: createUploadPayload("task-member-any.exe", Buffer.from("MZ fake exe"), "application/octet-stream"),
      url: buildTaskAttachmentsPath(projectId, DEFAULT_TASK_ID),
    });
    const memberBadMagic = await harness.app.inject({
      headers: buildMultipartHeaders(member.accessToken),
      method: "POST",
      payload: createUploadPayload("task-member-fake.png", Buffer.from("not a real png"), "image/png"),
      url: buildTaskAttachmentsPath(projectId, DEFAULT_TASK_ID),
    });

    expect(ownerBadExtension.statusCode).toBe(201);
    expect(ownerBadMagic.statusCode).toBe(201);
    expect(memberBadExtension.statusCode).toBe(403);
    expect(memberBadMagic.statusCode).toBe(403);
  });
});

async function createProjectWithDefaultTask(accessToken: string, name: string) {
  const createResponse = await harness.app.inject({
    headers: harness.createAuthHeaders(accessToken),
    method: "POST",
    payload: { name },
    url: "/stc-proj-mgmt/api/projects",
  });

  expect(createResponse.statusCode).toBe(201);
  const project = harness.parseJson<{ project: { id: number } }>(
    createResponse.payload,
  ).project;

  return {
    projectId: project.id,
    taskId: DEFAULT_TASK_ID,
  };
}

async function putProjectChartWithTaskIds(
  accessToken: string,
  projectId: number,
  taskIds: string[],
): Promise<void> {
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<data>\n${taskIds
    .map(
      (taskId, index) =>
        `  <task id="${taskId}" type="task" start_date="2026-03-0${index + 1} 09:00"><![CDATA[Task ${taskId}]]></task>`,
    )
    .join("\n")}\n</data>`;

  const response = await harness.app.inject({
    headers: harness.createAuthHeaders(accessToken),
    method: "PUT",
    payload: { xml: content },
    url: `/stc-proj-mgmt/api/projects/${projectId}/chart`,
  });

  expect(response.statusCode).toBe(200);
}

function buildTaskCommentsPath(projectId: number, taskId: string): string {
  return `/stc-proj-mgmt/api/projects/${projectId}/tasks/${taskId}/comments`;
}

function buildTaskAttachmentsPath(projectId: number, taskId: string): string {
  return `/stc-proj-mgmt/api/projects/${projectId}/tasks/${taskId}/attachments`;
}

function buildMultipartHeaders(accessToken: string): Record<string, string> {
  return {
    ...harness.createAuthHeaders(accessToken),
    "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
  };
}

function createPngUploadPayload(filename: string): Buffer {
  return createUploadPayload(filename, MINIMAL_PNG_BUFFER, "image/png");
}

function createUploadPayload(
  filename: string,
  content: Buffer,
  contentType: string,
): Buffer {
  return createMultipartFileBuffer({
    boundary: MULTIPART_BOUNDARY,
    content,
    contentType,
    fieldName: "file",
    filename,
  });
}

function selectTaskMirrorRows(projectId: number, taskId: string) {
  return harness.databaseService.db
    .select()
    .from(taskMirror)
    .where(
      and(
        eq(taskMirror.projectId, projectId),
        eq(taskMirror.taskId, taskId),
      ),
    )
    .all();
}

async function replaceProjectMembers(
  projectId: number,
  ownerUserId: number,
  memberUserId: number,
  ownerAccessToken: string,
): Promise<void> {
  const response = await harness.app.inject({
    headers: harness.createAuthHeaders(ownerAccessToken),
    method: "PUT",
    payload: {
      members: [
        {
          roleCodes: [
            "GGTC_PROJECTROLE_PROJECT_MANAGER",
            "GGTC_PROJECTROLE_PROJECT_OWNER",
          ],
          userId: ownerUserId,
        },
        {
          roleCodes: [],
          userId: memberUserId,
        },
      ],
    },
    url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
  });

  expect(response.statusCode).toBe(200);
}
