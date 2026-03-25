import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { IssuePriorityCode } from "../db/index.js";
import { createCrudTestHarness } from "./crud-test-helpers.js";
import { createMultipartFileBuffer } from "./multipart-form.helpers.js";

const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const MINIMAL_PNG_BUFFER = Buffer.from(MINIMAL_PNG_BASE64, "base64");
const MULTIPART_BOUNDARY = "----issueAttachmentTestBoundary";

const harness = createCrudTestHarness("issue-comments-attachments.sqlite");
const limitHarness = createCrudTestHarness("issue-attachment-limit.sqlite", {
  maxAttachmentsPerIssueOrComment: 2,
});

describe("issue comments and attachments api", () => {
  beforeAll(async () => {
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it("rejects comments shorter than 16 characters", async () => {
    const user = await harness.registerUser("short-comment");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(user.accessToken),
          method: "POST",
          payload: { name: "Comment board" },
          url: "/stc-proj-mgmt/api/projects",
        })
      ).payload,
    ).project.id;

    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(user.accessToken),
          method: "POST",
          payload: {
            name: "Discuss",
            priority: IssuePriorityCode.ISSUE_PRIORITY_LOW,
            progressPercentage: 0,
          },
          url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
        })
      ).payload,
    ).issue.id;

    const response = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: { body: "too short" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });

    expect(response.statusCode).toBe(400);
  });

  it("creates, lists, and retrieves comments with bodies", async () => {
    const user = await harness.registerUser("comment-flow");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(user.accessToken),
          method: "POST",
          payload: { name: "Threaded project" },
          url: "/stc-proj-mgmt/api/projects",
        })
      ).payload,
    ).project.id;

    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(user.accessToken),
          method: "POST",
          payload: {
            name: "Main issue",
            priority: IssuePriorityCode.ISSUE_PRIORITY_LOW,
            progressPercentage: 0,
          },
          url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
        })
      ).payload,
    ).issue.id;

    const bodyText = "This is seventeen chars";
    const createResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: { body: bodyText },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(createResponse.statusCode).toBe(201);
    const created = harness.parseJson<{ comment: { id: number; body: string } }>(
      createResponse.payload,
    );
    expect(created.comment.body).toBe(bodyText);

    const listResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(listResponse.statusCode).toBe(200);
    const listBody = harness.parseJson<{
      comments: Array<{ id: number; body: string }>;
    }>(listResponse.payload);
    expect(listBody.comments.map((c) => c.id)).toContain(created.comment.id);

    const getResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${created.comment.id}`,
    });
    expect(getResponse.statusCode).toBe(200);
  });

  it("rejects parent comments from another issue", async () => {
    const user = await harness.registerUser("reply-guard");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(user.accessToken),
          method: "POST",
          payload: { name: "Dual issue project" },
          url: "/stc-proj-mgmt/api/projects",
        })
      ).payload,
    ).project.id;

    const issueOne = harness.parseJson<{ issue: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(user.accessToken),
          method: "POST",
          payload: {
            name: "First",
            priority: IssuePriorityCode.ISSUE_PRIORITY_LOW,
            progressPercentage: 0,
          },
          url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
        })
      ).payload,
    ).issue.id;

    const issueTwo = harness.parseJson<{ issue: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(user.accessToken),
          method: "POST",
          payload: {
            name: "Second",
            priority: IssuePriorityCode.ISSUE_PRIORITY_LOW,
            progressPercentage: 0,
          },
          url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
        })
      ).payload,
    ).issue.id;

    const parentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: { body: "Parent comment text ok" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueOne}/comments`,
    });
    expect(parentResponse.statusCode).toBe(201);
    const parentId = harness.parseJson<{ comment: { id: number } }>(
      parentResponse.payload,
    ).comment.id;

    const badReply = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: {
        body: "Reply referencing wrong parent",
        parentCommentId: parentId,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueTwo}/comments`,
    });

    expect(badReply.statusCode).toBe(400);
  });

  it("rejects disallowed extensions for uploads", async () => {
    const user = await harness.registerUser("bad-ext");
    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      user.accessToken,
      "ext-test",
    );

    const payload = createMultipartFileBuffer({
      boundary: MULTIPART_BOUNDARY,
      content: Buffer.from("MZ fake exe"),
      contentType: "application/octet-stream",
      fieldName: "file",
      filename: "virus.exe",
    });

    const response = await harness.app.inject({
      headers: {
        ...harness.createAuthHeaders(user.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload,
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments`,
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects content that does not match extension magic bytes", async () => {
    const user = await harness.registerUser("bad-magic");
    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      user.accessToken,
      "magic-test",
    );

    const payload = createMultipartFileBuffer({
      boundary: MULTIPART_BOUNDARY,
      content: Buffer.from("not a real png"),
      contentType: "image/png",
      fieldName: "file",
      filename: "fake.png",
    });

    const response = await harness.app.inject({
      headers: {
        ...harness.createAuthHeaders(user.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload,
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments`,
    });

    expect(response.statusCode).toBe(400);
  });

  it("uploads issue attachment, lists, and downloads with auth", async () => {
    const user = await harness.registerUser("attach-user");
    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      user.accessToken,
      "attach-proj",
    );

    const payload = createMultipartFileBuffer({
      boundary: MULTIPART_BOUNDARY,
      content: MINIMAL_PNG_BUFFER,
      contentType: "image/png",
      fieldName: "file",
      filename: "pixel.png",
    });

    const uploadResponse = await harness.app.inject({
      headers: {
        ...harness.createAuthHeaders(user.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload,
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments`,
    });
    expect(uploadResponse.statusCode).toBe(201);
    const uploaded = harness.parseJson<{
      attachment: { id: string; originalFilename: string };
    }>(uploadResponse.payload);

    const listResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments`,
    });
    expect(listResponse.statusCode).toBe(200);
    const listed = harness.parseJson<{ attachments: Array<{ id: string }> }>(
      listResponse.payload,
    );
    expect(listed.attachments.map((a) => a.id)).toContain(uploaded.attachment.id);

    const unauthDownload = await harness.app.inject({
      method: "GET",
      url:
        `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments/${uploaded.attachment.id}/download`,
    });
    expect(unauthDownload.statusCode).toBe(401);

    const downloadResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url:
        `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments/${uploaded.attachment.id}/download`,
    });
    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.rawPayload.equals(MINIMAL_PNG_BUFFER)).toBe(true);
  });

  it("enforces per-issue attachment count limits", async () => {
    await limitHarness.setup();
    try {
      const user = await limitHarness.registerUser("limit-user");
      const { issueId, projectId } = await createProjectWithIssue(
        limitHarness,
        user.accessToken,
        "limit-proj",
      );

      for (let index = 0; index < 2; index += 1) {
        const payload = createMultipartFileBuffer({
          boundary: MULTIPART_BOUNDARY,
          content: MINIMAL_PNG_BUFFER,
          contentType: "image/png",
          fieldName: "file",
          filename: `p${index}.png`,
        });
        const res = await limitHarness.app.inject({
          headers: {
            ...limitHarness.createAuthHeaders(user.accessToken),
            "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
          },
          method: "POST",
          payload,
          url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments`,
        });
        expect(res.statusCode).toBe(201);
      }

      const overflowPayload = createMultipartFileBuffer({
        boundary: MULTIPART_BOUNDARY,
        content: MINIMAL_PNG_BUFFER,
        contentType: "image/png",
        fieldName: "file",
        filename: "overflow.png",
      });
      const overflowResponse = await limitHarness.app.inject({
        headers: {
          ...limitHarness.createAuthHeaders(user.accessToken),
          "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
        },
        method: "POST",
        payload: overflowPayload,
        url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments`,
      });
      expect(overflowResponse.statusCode).toBe(400);
    } finally {
      await limitHarness.cleanup();
    }
  });

  it("blocks deleting comments that already have replies", async () => {
    const user = await harness.registerUser("reply-delete");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(user.accessToken),
          method: "POST",
          payload: { name: "Delete thread project" },
          url: "/stc-proj-mgmt/api/projects",
        })
      ).payload,
    ).project.id;

    const issueId = harness.parseJson<{ issue: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(user.accessToken),
          method: "POST",
          payload: {
            name: "Thread root",
            priority: IssuePriorityCode.ISSUE_PRIORITY_LOW,
            progressPercentage: 0,
          },
          url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
        })
      ).payload,
    ).issue.id;

    const parentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: { body: "Root comment seventeen" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    const parentId = harness.parseJson<{ comment: { id: number } }>(
      parentResponse.payload,
    ).comment.id;

    const childResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: {
        body: "Child comment seventeen",
        parentCommentId: parentId,
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(childResponse.statusCode).toBe(201);

    const deleteParent = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "DELETE",
      url:
        `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${parentId}`,
    });
    expect(deleteParent.statusCode).toBe(400);
  });
});

async function createProjectWithIssue(
  h: {
    app: NestFastifyApplication;
    createAuthHeaders: (accessToken: string) => Record<string, string>;
    parseJson: <T>(payload: string) => T;
  },
  accessToken: string,
  projectName: string,
): Promise<{ issueId: number; projectId: number }> {
  const projectId = h.parseJson<{ project: { id: number } }>(
    (
      await h.app.inject({
        headers: h.createAuthHeaders(accessToken),
        method: "POST",
        payload: { name: projectName },
        url: "/stc-proj-mgmt/api/projects",
      })
    ).payload,
  ).project.id;

  const issueId = h.parseJson<{ issue: { id: number } }>(
    (
      await h.app.inject({
        headers: h.createAuthHeaders(accessToken),
        method: "POST",
        payload: {
          name: `${projectName} issue`,
          priority: IssuePriorityCode.ISSUE_PRIORITY_LOW,
          progressPercentage: 0,
        },
        url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
      })
    ).payload,
  ).issue.id;

  return { issueId, projectId };
}
