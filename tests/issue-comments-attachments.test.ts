import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  IssuePriorityCode,
  projectsTeams,
} from "../db/index.js";
import { createCrudTestHarness } from "./crud-test-helpers.js";
import { createMultipartFileBuffer } from "./multipart-form.helpers.js";

const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const MINIMAL_PNG_BUFFER = Buffer.from(MINIMAL_PNG_BASE64, "base64");
const MULTIPART_BOUNDARY = "----issueAttachmentTestBoundary";

const PROJECT_MANAGER_ROLE = "GGTC_PROJECTROLE_PROJECT_MANAGER";
const PROJECT_OWNER_ROLE = "GGTC_PROJECTROLE_PROJECT_OWNER";

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
    const manager = await harness.registerUser("bad-ext-manager");
    const user = await harness.registerUser("bad-ext");
    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      manager.accessToken,
      "ext-test",
    );
    await replaceProjectMembers(
      harness,
      projectId,
      [
        {
          roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
          userId: manager.user.id,
        },
        {
          roleCodes: [],
          userId: user.user.id,
        },
      ],
      manager.accessToken,
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
    const manager = await harness.registerUser("bad-magic-manager");
    const user = await harness.registerUser("bad-magic");
    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      manager.accessToken,
      "magic-test",
    );
    await replaceProjectMembers(
      harness,
      projectId,
      [
        {
          roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
          userId: manager.user.id,
        },
        {
          roleCodes: [],
          userId: user.user.id,
        },
      ],
      manager.accessToken,
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

  it("accepts otherwise rejected uploads for a direct effective project manager and rejects them for other users", async () => {
    const manager = await harness.registerUser("bypass-direct-manager");
    const member = await harness.registerUser("bypass-direct-member");
    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      manager.accessToken,
      "bypass-direct-project",
    );

    await replaceProjectMembers(
      harness,
      projectId,
      [
        {
          roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
          userId: manager.user.id,
        },
        {
          roleCodes: [],
          userId: member.user.id,
        },
      ],
      manager.accessToken,
    );

    await expectIssueFileTypeBypass(harness, manager.accessToken, projectId, issueId, "direct-manager");
    await expectIssueFileTypeRejection(harness, member.accessToken, projectId, issueId, "direct-member");
  });

  it("accepts otherwise rejected uploads for an effective team manager and rejects them for other users", async () => {
    const projectOwner = await harness.registerUser("bypass-team-owner");
    const teamCreator = await harness.registerUser("bypass-team-creator");
    const teamManager = await harness.registerUser("bypass-team-manager");
    const teamMember = await harness.registerUser("bypass-team-member");
    const teamId = await createTeam(harness, teamCreator.accessToken, "Bypass Team");
    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      projectOwner.accessToken,
      "bypass-team-project",
    );

    await replaceTeamMembers(
      harness,
      teamId,
      [
        {
          roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
          userId: teamManager.user.id,
        },
        {
          roleCodes: ["GGTC_TEAMROLE_TEAM_MANAGER"],
          userId: teamCreator.user.id,
        },
        {
          roleCodes: [],
          userId: teamMember.user.id,
        },
      ],
      teamCreator.accessToken,
    );
    await replaceProjectMembers(
      harness,
      projectId,
      [
        {
          roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
          userId: projectOwner.user.id,
        },
      ],
      projectOwner.accessToken,
    );
    harness.databaseService.db.insert(projectsTeams).values({
      projectId,
      teamId,
    }).run();

    await expectIssueFileTypeBypass(harness, teamManager.accessToken, projectId, issueId, "team-manager");
    await expectIssueFileTypeRejection(harness, teamMember.accessToken, projectId, issueId, "team-member");
  });

  it("accepts otherwise rejected uploads for an effective organization manager and rejects them for other users", async () => {
    const creator = await harness.registerUser("bypass-org-creator");
    const organizationManager = await harness.registerUser("bypass-org-manager");
    const organizationMember = await harness.registerUser("bypass-org-member");
    const projectOwner = await harness.registerUser("bypass-org-owner");
    const organizationId = await createOrganization(
      harness,
      creator.accessToken,
      "Bypass Org",
    );
    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      projectOwner.accessToken,
      "bypass-org-project",
    );

    await replaceProjectMembers(
      harness,
      projectId,
      [
        {
          roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
          userId: projectOwner.user.id,
        },
      ],
      projectOwner.accessToken,
    );
    await addOrganizationUsers(
      harness,
      organizationId,
      [creator.user.id, organizationManager.user.id, organizationMember.user.id],
      creator.accessToken,
    );
    await associateOrganizationProject(
      harness,
      organizationId,
      projectId,
      creator.accessToken,
    );
    await grantOrganizationRole(
      harness,
      organizationId,
      organizationManager.user.id,
      "GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER",
      creator.accessToken,
    );

    await expectIssueFileTypeBypass(
      harness,
      organizationManager.accessToken,
      projectId,
      issueId,
      "org-manager",
    );
    await expectIssueFileTypeRejection(
      harness,
      organizationMember.accessToken,
      projectId,
      issueId,
      "org-member",
    );
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

  it("enforces per-comment attachment count limits", async () => {
    await limitHarness.setup();
    try {
      const user = await limitHarness.registerUser("comment-limit-user");
      const { issueId, projectId } = await createProjectWithIssue(
        limitHarness,
        user.accessToken,
        "comment-limit-proj",
      );
      const commentResponse = await limitHarness.app.inject({
        headers: limitHarness.createAuthHeaders(user.accessToken),
        method: "POST",
        payload: { body: "Comment for attachment limits ok" },
        url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
      });
      expect(commentResponse.statusCode).toBe(201);
      const commentId = limitHarness.parseJson<{ comment: { id: number } }>(
        commentResponse.payload,
      ).comment.id;

      for (let index = 0; index < 2; index += 1) {
        const payload = createMultipartFileBuffer({
          boundary: MULTIPART_BOUNDARY,
          content: MINIMAL_PNG_BUFFER,
          contentType: "image/png",
          fieldName: "file",
          filename: `c${index}.png`,
        });
        const response = await limitHarness.app.inject({
          headers: {
            ...limitHarness.createAuthHeaders(user.accessToken),
            "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
          },
          method: "POST",
          payload,
          url:
            `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${commentId}/attachments`,
        });
        expect(response.statusCode).toBe(201);
      }

      const overflowPayload = createMultipartFileBuffer({
        boundary: MULTIPART_BOUNDARY,
        content: MINIMAL_PNG_BUFFER,
        contentType: "image/png",
        fieldName: "file",
        filename: "comment-overflow.png",
      });
      const overflowResponse = await limitHarness.app.inject({
        headers: {
          ...limitHarness.createAuthHeaders(user.accessToken),
          "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
        },
        method: "POST",
        payload: overflowPayload,
        url:
          `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${commentId}/attachments`,
      });
      expect(overflowResponse.statusCode).toBe(400);
    } finally {
      await limitHarness.cleanup();
    }
  });

  it("downloads issue comment attachments through the comment-scoped route", async () => {
    const user = await harness.registerUser("issue-comment-attachment-download");
    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      user.accessToken,
      "issue-comment-attachment-download-project",
    );

    const commentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: { body: "Comment body for issue attachment download" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(commentResponse.statusCode).toBe(201);
    const commentId = harness.parseJson<{ comment: { id: number } }>(
      commentResponse.payload,
    ).comment.id;

    const uploadResponse = await harness.app.inject({
      headers: {
        ...harness.createAuthHeaders(user.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload: createMultipartFileBuffer({
        boundary: MULTIPART_BOUNDARY,
        content: MINIMAL_PNG_BUFFER,
        contentType: "image/png",
        fieldName: "file",
        filename: "comment-download.png",
      }),
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${commentId}/attachments`,
    });
    expect(uploadResponse.statusCode).toBe(201);
    const uploaded = harness.parseJson<{ attachment: { id: string } }>(
      uploadResponse.payload,
    );

    const unauthDownload = await harness.app.inject({
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${commentId}/attachments/${uploaded.attachment.id}/download`,
    });
    expect(unauthDownload.statusCode).toBe(401);

    const downloadResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${commentId}/attachments/${uploaded.attachment.id}/download`,
    });
    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.rawPayload.equals(MINIMAL_PNG_BUFFER)).toBe(true);
  });

  it("does not download issue comment attachments through a different comment or issue", async () => {
    const user = await harness.registerUser("issue-comment-attachment-download-guard");
    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      user.accessToken,
      "issue-comment-attachment-download-guard-project",
    );
    const otherIssueId = harness.parseJson<{ issue: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(user.accessToken),
          method: "POST",
          payload: {
            name: "Other issue",
            priority: IssuePriorityCode.ISSUE_PRIORITY_LOW,
            progressPercentage: 0,
          },
          url: `/stc-proj-mgmt/api/projects/${projectId}/issues`,
        })
      ).payload,
    ).issue.id;

    const firstCommentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: { body: "First comment body for guarded download" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(firstCommentResponse.statusCode).toBe(201);
    const firstCommentId = harness.parseJson<{ comment: { id: number } }>(
      firstCommentResponse.payload,
    ).comment.id;

    const secondCommentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "POST",
      payload: { body: "Second comment body for guarded download" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(secondCommentResponse.statusCode).toBe(201);
    const secondCommentId = harness.parseJson<{ comment: { id: number } }>(
      secondCommentResponse.payload,
    ).comment.id;

    const uploadResponse = await harness.app.inject({
      headers: {
        ...harness.createAuthHeaders(user.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload: createMultipartFileBuffer({
        boundary: MULTIPART_BOUNDARY,
        content: MINIMAL_PNG_BUFFER,
        contentType: "image/png",
        fieldName: "file",
        filename: "guarded-comment-download.png",
      }),
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${firstCommentId}/attachments`,
    });
    expect(uploadResponse.statusCode).toBe(201);
    const uploaded = harness.parseJson<{ attachment: { id: string } }>(
      uploadResponse.payload,
    );

    const wrongCommentDownload = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${secondCommentId}/attachments/${uploaded.attachment.id}/download`,
    });
    expect(wrongCommentDownload.statusCode).toBe(404);

    const wrongIssueDownload = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${otherIssueId}/comments/${firstCommentId}/attachments/${uploaded.attachment.id}/download`,
    });
    expect(wrongIssueDownload.statusCode).toBe(404);
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

  it("deletes issue attachments for project participants who can modify issues", async () => {
    const pmUser = await harness.registerUser("issue-attachment-delete-pm");
    const viewOnlyUser = await harness.registerUser("issue-attachment-delete-viewer");

    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      pmUser.accessToken,
      "issue-attachment-delete-project",
    );

    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(pmUser.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: pmUser.user.id,
          },
          { roleCodes: [], userId: viewOnlyUser.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const payload = createMultipartFileBuffer({
      boundary: MULTIPART_BOUNDARY,
      content: MINIMAL_PNG_BUFFER,
      contentType: "image/png",
      fieldName: "file",
      filename: "delete-me.png",
    });

    const uploadResponse = await harness.app.inject({
      headers: {
        ...harness.createAuthHeaders(pmUser.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload,
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments`,
    });
    expect(uploadResponse.statusCode).toBe(201);

    const uploaded = harness.parseJson<{
      attachment: { id: string };
    }>(uploadResponse.payload);

    const deleteByParticipant = await harness.app.inject({
      headers: harness.createAuthHeaders(viewOnlyUser.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments/${uploaded.attachment.id}`,
    });
    expect(deleteByParticipant.statusCode).toBe(200);

    const deletedByParticipant = harness.parseJson<{ deletedAttachmentId: string }>(
      deleteByParticipant.payload,
    );
    expect(deletedByParticipant.deletedAttachmentId).toBe(uploaded.attachment.id);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(pmUser.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments/${uploaded.attachment.id}`,
    });
    expect(deleteResponse.statusCode).toBe(404);

    const listResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(pmUser.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments`,
    });
    expect(listResponse.statusCode).toBe(200);
    const listBody = harness.parseJson<{ attachments: Array<{ id: string }> }>(
      listResponse.payload,
    );
    expect(listBody.attachments).toEqual([]);
  });

  it("returns not found when deleting a missing issue attachment", async () => {
    const pmUser = await harness.registerUser("issue-attachment-delete-missing");
    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      pmUser.accessToken,
      "issue-attachment-delete-missing-project",
    );

    const response = await harness.app.inject({
      headers: harness.createAuthHeaders(pmUser.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments/00000000-0000-4000-8000-000000000000`,
    });
    expect(response.statusCode).toBe(404);
  });

  it("deletes comment attachments for comment authors (and forbids non-author non-managers)", async () => {
    const pmUser = await harness.registerUser("comment-attachment-delete-pm");
    const authorUser = await harness.registerUser("comment-attachment-delete-author");
    const nonAuthorUser = await harness.registerUser("comment-attachment-delete-non-author");

    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      pmUser.accessToken,
      "comment-attachment-delete-project",
    );

    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(pmUser.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: pmUser.user.id,
          },
          { roleCodes: [], userId: authorUser.user.id },
          { roleCodes: [], userId: nonAuthorUser.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const commentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(authorUser.accessToken),
      method: "POST",
      payload: { body: "Author comment seventeen" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(commentResponse.statusCode).toBe(201);

    const comment = harness.parseJson<{ comment: { id: number } }>(
      commentResponse.payload,
    ).comment;

    const payload = createMultipartFileBuffer({
      boundary: MULTIPART_BOUNDARY,
      content: MINIMAL_PNG_BUFFER,
      contentType: "image/png",
      fieldName: "file",
      filename: "author-attachment.png",
    });

    const uploadResponse = await harness.app.inject({
      headers: {
        ...harness.createAuthHeaders(authorUser.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload,
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${comment.id}/attachments`,
    });
    expect(uploadResponse.statusCode).toBe(201);

    const uploaded = harness.parseJson<{ attachment: { id: string } }>(
      uploadResponse.payload,
    );

    const deleteForbidden = await harness.app.inject({
      headers: harness.createAuthHeaders(nonAuthorUser.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${comment.id}/attachments/${uploaded.attachment.id}`,
    });
    expect(deleteForbidden.statusCode).toBe(403);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(authorUser.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${comment.id}/attachments/${uploaded.attachment.id}`,
    });
    expect(deleteResponse.statusCode).toBe(200);

    const deleted = harness.parseJson<{ deletedAttachmentId: string }>(
      deleteResponse.payload,
    );
    expect(deleted.deletedAttachmentId).toBe(uploaded.attachment.id);

    const listCommentsResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(pmUser.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(listCommentsResponse.statusCode).toBe(200);
    const listBody = harness.parseJson<{
      comments: Array<{ id: number; attachments: Array<{ id: string }> }>;
    }>(listCommentsResponse.payload);

    const updatedComment = listBody.comments.find((c) => c.id === comment.id);
    expect(updatedComment).toBeDefined();
    expect(updatedComment!.attachments).toEqual([]);
  });

  it("forbids a non-author non-project-manager member from uploading issue comment attachments", async () => {
    const pmUser = await harness.registerUser("comment-attachment-upload-pm");
    const authorUser = await harness.registerUser("comment-attachment-upload-author");
    const nonAuthorUser = await harness.registerUser("comment-attachment-upload-non-author");

    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      pmUser.accessToken,
      "comment-attachment-upload-project",
    );

    await replaceProjectMembers(
      harness,
      projectId,
      [
        {
          roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
          userId: pmUser.user.id,
        },
        { roleCodes: [], userId: authorUser.user.id },
        { roleCodes: [], userId: nonAuthorUser.user.id },
      ],
      pmUser.accessToken,
    );

    const commentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(authorUser.accessToken),
      method: "POST",
      payload: { body: "Issue comment attachment upload control" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(commentResponse.statusCode).toBe(201);
    const commentId = harness.parseJson<{ comment: { id: number } }>(
      commentResponse.payload,
    ).comment.id;

    const uploadResponse = await harness.app.inject({
      headers: buildIssueMultipartHeaders(harness, nonAuthorUser.accessToken),
      method: "POST",
      payload: createPngPayload("non-author-comment-upload.png"),
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${commentId}/attachments`,
    });

    expect(uploadResponse.statusCode).toBe(403);
  });

  it("deletes comment attachments for effective project managers (non-author)", async () => {
    const pmUser = await harness.registerUser("comment-attachment-delete-pm-manager");
    const authorUser = await harness.registerUser("comment-attachment-delete-pm-author");
    const nonAuthorUser = await harness.registerUser("comment-attachment-delete-pm-non-author");

    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      pmUser.accessToken,
      "comment-attachment-delete-pm-project",
    );

    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(pmUser.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: pmUser.user.id,
          },
          { roleCodes: [], userId: authorUser.user.id },
          { roleCodes: [], userId: nonAuthorUser.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const commentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(authorUser.accessToken),
      method: "POST",
      payload: { body: "PM-author comment seventeen" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(commentResponse.statusCode).toBe(201);
    const comment = harness.parseJson<{ comment: { id: number } }>(
      commentResponse.payload,
    ).comment;

    const payload = createMultipartFileBuffer({
      boundary: MULTIPART_BOUNDARY,
      content: MINIMAL_PNG_BUFFER,
      contentType: "image/png",
      fieldName: "file",
      filename: "pm-attachment.png",
    });

    const uploadResponse = await harness.app.inject({
      headers: {
        ...harness.createAuthHeaders(authorUser.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload,
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${comment.id}/attachments`,
    });
    expect(uploadResponse.statusCode).toBe(201);
    const uploaded = harness.parseJson<{ attachment: { id: string } }>(
      uploadResponse.payload,
    );

    const deleteForbidden = await harness.app.inject({
      headers: harness.createAuthHeaders(nonAuthorUser.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${comment.id}/attachments/${uploaded.attachment.id}`,
    });
    expect(deleteForbidden.statusCode).toBe(403);

    const deleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(pmUser.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${comment.id}/attachments/${uploaded.attachment.id}`,
    });
    expect(deleteResponse.statusCode).toBe(200);

    const deleted = harness.parseJson<{ deletedAttachmentId: string }>(
      deleteResponse.payload,
    );
    expect(deleted.deletedAttachmentId).toBe(uploaded.attachment.id);

    const listCommentsResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(pmUser.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(listCommentsResponse.statusCode).toBe(200);
    const listBody = harness.parseJson<{
      comments: Array<{ id: number; attachments: Array<{ id: string }> }>;
    }>(listCommentsResponse.payload);
    const updatedComment = listBody.comments.find((c) => c.id === comment.id);
    expect(updatedComment).toBeDefined();
    expect(updatedComment!.attachments).toEqual([]);
  });

  it("returns not found when deleting a missing comment attachment", async () => {
    const pmUser = await harness.registerUser("comment-attachment-delete-missing");
    const authorUser = await harness.registerUser("comment-attachment-delete-missing-author");

    const { issueId, projectId } = await createProjectWithIssue(
      harness,
      pmUser.accessToken,
      "comment-attachment-delete-missing-project",
    );
    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(pmUser.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: pmUser.user.id,
          },
          { roleCodes: [], userId: authorUser.user.id },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const commentResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(authorUser.accessToken),
      method: "POST",
      payload: { body: "Author comment for missing attachment" },
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments`,
    });
    expect(commentResponse.statusCode).toBe(201);
    const commentId = harness.parseJson<{ comment: { id: number } }>(
      commentResponse.payload,
    ).comment.id;

    const response = await harness.app.inject({
      headers: harness.createAuthHeaders(pmUser.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/comments/${commentId}/attachments/00000000-0000-4000-8000-000000000000`,
    });
    expect(response.statusCode).toBe(404);
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

async function createOrganization(
  h: {
    app: NestFastifyApplication;
    createAuthHeaders: (accessToken: string) => Record<string, string>;
    parseJson: <T>(payload: string) => T;
  },
  accessToken: string,
  name: string,
): Promise<number> {
  const response = await h.app.inject({
    headers: h.createAuthHeaders(accessToken),
    method: "POST",
    payload: { name },
    url: "/stc-proj-mgmt/api/organizations",
  });

  expect(response.statusCode).toBe(201);
  return h.parseJson<{ organization: { id: number } }>(response.payload).organization.id;
}

async function createTeam(
  h: {
    app: NestFastifyApplication;
    createAuthHeaders: (accessToken: string) => Record<string, string>;
    parseJson: <T>(payload: string) => T;
  },
  accessToken: string,
  name: string,
): Promise<number> {
  const response = await h.app.inject({
    headers: h.createAuthHeaders(accessToken),
    method: "POST",
    payload: { name },
    url: "/stc-proj-mgmt/api/teams",
  });

  expect(response.statusCode).toBe(201);
  return h.parseJson<{ team: { id: number } }>(response.payload).team.id;
}

function createDisallowedExtensionPayload(filename: string): Buffer {
  return createMultipartFileBuffer({
    boundary: MULTIPART_BOUNDARY,
    content: Buffer.from("MZ fake exe"),
    contentType: "application/octet-stream",
    fieldName: "file",
    filename,
  });
}

function createMagicMismatchPayload(filename: string): Buffer {
  return createMultipartFileBuffer({
    boundary: MULTIPART_BOUNDARY,
    content: Buffer.from("not a real png"),
    contentType: "image/png",
    fieldName: "file",
    filename,
  });
}

function createPngPayload(filename: string): Buffer {
  return createMultipartFileBuffer({
    boundary: MULTIPART_BOUNDARY,
    content: MINIMAL_PNG_BUFFER,
    contentType: "image/png",
    fieldName: "file",
    filename,
  });
}

function buildIssueMultipartHeaders(
  currentHarness: ReturnType<typeof createCrudTestHarness>,
  accessToken: string,
): Record<string, string> {
  return {
    ...currentHarness.createAuthHeaders(accessToken),
    "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
  };
}

async function expectIssueAttachmentUploadStatus(
  currentHarness: ReturnType<typeof createCrudTestHarness>,
  accessToken: string,
  projectId: number,
  issueId: number,
  payload: Buffer,
  expectedStatusCode: number,
): Promise<void> {
  const response = await currentHarness.app.inject({
    headers: buildIssueMultipartHeaders(currentHarness, accessToken),
    method: "POST",
    payload,
    url: `/stc-proj-mgmt/api/projects/${projectId}/issues/${issueId}/attachments`,
  });

  expect(response.statusCode).toBe(expectedStatusCode);
}

async function expectIssueFileTypeBypass(
  currentHarness: ReturnType<typeof createCrudTestHarness>,
  accessToken: string,
  projectId: number,
  issueId: number,
  fileLabel: string,
): Promise<void> {
  await expectIssueAttachmentUploadStatus(
    currentHarness,
    accessToken,
    projectId,
    issueId,
    createDisallowedExtensionPayload(`${fileLabel}-any.exe`),
    201,
  );
  await expectIssueAttachmentUploadStatus(
    currentHarness,
    accessToken,
    projectId,
    issueId,
    createMagicMismatchPayload(`${fileLabel}-fake.png`),
    201,
  );
}

async function expectIssueFileTypeRejection(
  currentHarness: ReturnType<typeof createCrudTestHarness>,
  accessToken: string,
  projectId: number,
  issueId: number,
  fileLabel: string,
): Promise<void> {
  await expectIssueAttachmentUploadStatus(
    currentHarness,
    accessToken,
    projectId,
    issueId,
    createDisallowedExtensionPayload(`${fileLabel}-any.exe`),
    400,
  );
  await expectIssueAttachmentUploadStatus(
    currentHarness,
    accessToken,
    projectId,
    issueId,
    createMagicMismatchPayload(`${fileLabel}-fake.png`),
    400,
  );
}

async function replaceProjectMembers(
  currentHarness: ReturnType<typeof createCrudTestHarness>,
  projectId: number,
  members: Array<{ roleCodes: string[]; userId: number }>,
  accessToken: string,
): Promise<void> {
  const response = await currentHarness.app.inject({
    headers: currentHarness.createAuthHeaders(accessToken),
    method: "PUT",
    payload: { members },
    url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
  });

  expect(response.statusCode).toBe(200);
}

async function replaceTeamMembers(
  currentHarness: ReturnType<typeof createCrudTestHarness>,
  teamId: number,
  members: Array<{ roleCodes: string[]; userId: number }>,
  accessToken: string,
): Promise<void> {
  const response = await currentHarness.app.inject({
    headers: currentHarness.createAuthHeaders(accessToken),
    method: "PUT",
    payload: { members },
    url: `/stc-proj-mgmt/api/teams/${teamId}/members`,
  });

  expect(response.statusCode).toBe(200);
}

async function addOrganizationUsers(
  currentHarness: ReturnType<typeof createCrudTestHarness>,
  organizationId: number,
  userIds: number[],
  accessToken: string,
): Promise<void> {
  const response = await currentHarness.app.inject({
    headers: currentHarness.createAuthHeaders(accessToken),
    method: "PUT",
    payload: {
      members: userIds.map((userId) => ({ userId })),
    },
    url: `/stc-proj-mgmt/api/organizations/${organizationId}/users`,
  });

  expect(response.statusCode).toBe(200);
}

async function associateOrganizationProject(
  currentHarness: ReturnType<typeof createCrudTestHarness>,
  organizationId: number,
  projectId: number,
  accessToken: string,
): Promise<void> {
  const response = await currentHarness.app.inject({
    headers: currentHarness.createAuthHeaders(accessToken),
    method: "PUT",
    payload: { projects: [{ projectId }] },
    url: `/stc-proj-mgmt/api/organizations/${organizationId}/projects`,
  });

  expect(response.statusCode).toBe(200);
}

async function grantOrganizationRole(
  currentHarness: ReturnType<typeof createCrudTestHarness>,
  organizationId: number,
  userId: number,
  roleCode: string,
  accessToken: string,
): Promise<void> {
  const response = await currentHarness.app.inject({
    headers: currentHarness.createAuthHeaders(accessToken),
    method: "POST",
    payload: { roleCode, userId },
    url: `/stc-proj-mgmt/api/organizations/${organizationId}/roles/grant`,
  });

  expect(response.statusCode).toBe(200);
}
