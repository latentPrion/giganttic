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
});
