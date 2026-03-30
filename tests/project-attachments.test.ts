import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCrudTestHarness } from "./crud-test-helpers.js";
import { createMultipartFileBuffer } from "./multipart-form.helpers.js";

const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const MINIMAL_PNG_BUFFER = Buffer.from(MINIMAL_PNG_BASE64, "base64");
const MULTIPART_BOUNDARY = "----projectAttachmentTestBoundary";

const harness = createCrudTestHarness("project-attachments.sqlite");

describe("project attachments api", () => {
  beforeAll(async () => {
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it("uploads, lists, and downloads project attachments with auth", async () => {
    const user = await harness.registerUser("project-attachment-user");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(user.accessToken),
          method: "POST",
          payload: { name: "Project attachments" },
          url: "/stc-proj-mgmt/api/projects",
        })
      ).payload,
    ).project.id;

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
        filename: "project-pixel.png",
      }),
      url: `/stc-proj-mgmt/api/projects/${projectId}/attachments`,
    });
    expect(uploadResponse.statusCode).toBe(201);

    const uploaded = harness.parseJson<{
      attachment: { id: string; originalFilename: string };
    }>(uploadResponse.payload);

    const listResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/attachments`,
    });
    expect(listResponse.statusCode).toBe(200);
    expect(
      harness.parseJson<{ attachments: Array<{ id: string }> }>(listResponse.payload)
        .attachments
        .map((attachment) => attachment.id),
    ).toContain(uploaded.attachment.id);

    const unauthDownload = await harness.app.inject({
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/attachments/${uploaded.attachment.id}/download`,
    });
    expect(unauthDownload.statusCode).toBe(401);

    const downloadResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: `/stc-proj-mgmt/api/projects/${projectId}/attachments/${uploaded.attachment.id}/download`,
    });
    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.rawPayload.equals(MINIMAL_PNG_BUFFER)).toBe(true);
  });

  it("forbids a non-project-manager member from uploading or deleting project attachments", async () => {
    const owner = await harness.registerUser("project-attachment-owner");
    const member = await harness.registerUser("project-attachment-member");
    const projectId = harness.parseJson<{ project: { id: number } }>(
      (
        await harness.app.inject({
          headers: harness.createAuthHeaders(owner.accessToken),
          method: "POST",
          payload: { name: "Project attachment permissions" },
          url: "/stc-proj-mgmt/api/projects",
        })
      ).payload,
    ).project.id;

    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(owner.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [
              "GGTC_PROJECTROLE_PROJECT_MANAGER",
              "GGTC_PROJECTROLE_PROJECT_OWNER",
            ],
            userId: owner.user.id,
          },
          {
            roleCodes: [],
            userId: member.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const ownerUploadResponse = await harness.app.inject({
      headers: {
        ...harness.createAuthHeaders(owner.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload: createMultipartFileBuffer({
        boundary: MULTIPART_BOUNDARY,
        content: MINIMAL_PNG_BUFFER,
        contentType: "image/png",
        fieldName: "file",
        filename: "owner-project-pixel.png",
      }),
      url: `/stc-proj-mgmt/api/projects/${projectId}/attachments`,
    });
    expect(ownerUploadResponse.statusCode).toBe(201);
    const uploaded = harness.parseJson<{ attachment: { id: string } }>(
      ownerUploadResponse.payload,
    );

    const memberUploadResponse = await harness.app.inject({
      headers: {
        ...harness.createAuthHeaders(member.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload: createMultipartFileBuffer({
        boundary: MULTIPART_BOUNDARY,
        content: MINIMAL_PNG_BUFFER,
        contentType: "image/png",
        fieldName: "file",
        filename: "member-project-pixel.png",
      }),
      url: `/stc-proj-mgmt/api/projects/${projectId}/attachments`,
    });
    expect(memberUploadResponse.statusCode).toBe(403);

    const memberDeleteResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(member.accessToken),
      method: "DELETE",
      url: `/stc-proj-mgmt/api/projects/${projectId}/attachments/${uploaded.attachment.id}`,
    });
    expect(memberDeleteResponse.statusCode).toBe(403);
  });
});
