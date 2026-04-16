import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCrudTestHarness } from "./crud-test-helpers.js";
import { createMultipartFileBuffer } from "./multipart-form.helpers.js";

const MGR_UPLOADS_BASE = "/stc-proj-mgmt/api/mgr-uploads";
const MULTIPART_BOUNDARY = "----mgrUploadsTestBoundary";
const MINIMAL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const MINIMAL_PNG_BUFFER = Buffer.from(MINIMAL_PNG_BASE64, "base64");
const PROJECT_MANAGER_ROLE = "GGTC_PROJECTROLE_PROJECT_MANAGER";
const PROJECT_OWNER_ROLE = "GGTC_PROJECTROLE_PROJECT_OWNER";

const harness = createCrudTestHarness("mgr-uploads.sqlite");

describe("mgr-uploads api auth matrix", () => {
  beforeAll(async () => {
    await harness.setup();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it("rejects unauthenticated list, upload, and delete", async () => {
    const listResponse = await harness.app.inject({
      method: "GET",
      url: MGR_UPLOADS_BASE,
    });
    expect(listResponse.statusCode).toBe(401);

    const uploadResponse = await harness.app.inject({
      headers: {
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload: createMultipartFileBuffer({
        boundary: MULTIPART_BOUNDARY,
        content: MINIMAL_PNG_BUFFER,
        contentType: "image/png",
        fieldName: "file",
        filename: "x.png",
      }),
      url: MGR_UPLOADS_BASE,
    });
    expect(uploadResponse.statusCode).toBe(401);

    const deleteResponse = await harness.app.inject({
      method: "DELETE",
      url: `${MGR_UPLOADS_BASE}/missing.bin`,
    });
    expect(deleteResponse.statusCode).toBe(401);
  });

  it("forbids a registered user with no manager roles", async () => {
    const user = await harness.registerUser("mgr-uploads-plain");
    const response = await harness.app.inject({
      headers: harness.createAuthHeaders(user.accessToken),
      method: "GET",
      url: MGR_UPLOADS_BASE,
    });
    expect(response.statusCode).toBe(403);
  });

  it("allows a direct project manager", async () => {
    const owner = await harness.registerUser("mgr-uploads-pm-owner");
    const projectResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(owner.accessToken),
      method: "POST",
      payload: { name: "Mgr uploads PM project" },
      url: "/stc-proj-mgmt/api/projects",
    });
    expect(projectResponse.statusCode).toBe(201);
    const projectId = harness.parseJson<{ project: { id: number } }>(
      projectResponse.payload,
    ).project.id;

    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(owner.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
            userId: owner.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const listResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(owner.accessToken),
      method: "GET",
      url: MGR_UPLOADS_BASE,
    });
    expect(listResponse.statusCode).toBe(200);
  });

  it("allows a direct project owner without project-manager role", async () => {
    const ownerOnly = await harness.registerUser("mgr-uploads-owner-only");
    const projectResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(ownerOnly.accessToken),
      method: "POST",
      payload: { name: "Mgr uploads owner-only project" },
      url: "/stc-proj-mgmt/api/projects",
    });
    expect(projectResponse.statusCode).toBe(201);
    const projectId = harness.parseJson<{ project: { id: number } }>(
      projectResponse.payload,
    ).project.id;

    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(ownerOnly.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_OWNER_ROLE],
            userId: ownerOnly.user.id,
          },
        ],
      },
      url: `/stc-proj-mgmt/api/projects/${projectId}/members`,
    });
    expect(membershipResponse.statusCode).toBe(200);

    const listResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(ownerOnly.accessToken),
      method: "GET",
      url: MGR_UPLOADS_BASE,
    });
    expect(listResponse.statusCode).toBe(200);
  });

  it("allows a team manager (team creator)", async () => {
    const teamManager = await harness.registerUser("mgr-uploads-team-mgr");
    const teamResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamManager.accessToken),
      method: "POST",
      payload: { name: "Mgr uploads team" },
      url: "/stc-proj-mgmt/api/teams",
    });
    expect(teamResponse.statusCode).toBe(201);

    const listResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(teamManager.accessToken),
      method: "GET",
      url: MGR_UPLOADS_BASE,
    });
    expect(listResponse.statusCode).toBe(200);
  });

  it("allows an organization manager (organization creator)", async () => {
    const orgManager = await harness.registerUser("mgr-uploads-org-mgr");
    const orgResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(orgManager.accessToken),
      method: "POST",
      payload: { name: "Mgr uploads org" },
      url: "/stc-proj-mgmt/api/organizations",
    });
    expect(orgResponse.statusCode).toBe(201);

    const listResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(orgManager.accessToken),
      method: "GET",
      url: MGR_UPLOADS_BASE,
    });
    expect(listResponse.statusCode).toBe(200);
  });

  it("forbids a non-manager project member", async () => {
    const owner = await harness.registerUser("mgr-uploads-npm-owner");
    const member = await harness.registerUser("mgr-uploads-npm-member");
    const projectResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(owner.accessToken),
      method: "POST",
      payload: { name: "Mgr uploads non-pm project" },
      url: "/stc-proj-mgmt/api/projects",
    });
    const projectId = harness.parseJson<{ project: { id: number } }>(
      projectResponse.payload,
    ).project.id;

    const membershipResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(owner.accessToken),
      method: "PUT",
      payload: {
        members: [
          {
            roleCodes: [PROJECT_MANAGER_ROLE, PROJECT_OWNER_ROLE],
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

    const listResponse = await harness.app.inject({
      headers: harness.createAuthHeaders(member.accessToken),
      method: "GET",
      url: MGR_UPLOADS_BASE,
    });
    expect(listResponse.statusCode).toBe(403);
  });

  it("allows the seeded system administrator", async () => {
    const admin = await harness.loginSeededAdmin();
    const response = await harness.app.inject({
      headers: harness.createAuthHeaders(admin.accessToken),
      method: "GET",
      url: MGR_UPLOADS_BASE,
    });
    expect(response.statusCode).toBe(200);
  });
});

describe("mgr-uploads api behavior", () => {
  const behaviorHarness = createCrudTestHarness("mgr-uploads-behavior.sqlite");

  beforeAll(async () => {
    await behaviorHarness.setup();
  });

  afterAll(async () => {
    await behaviorHarness.cleanup();
  });

  async function uploadAsPng(
    token: string,
    filename: string,
    content: Buffer,
  ) {
    return await behaviorHarness.app.inject({
      headers: {
        ...behaviorHarness.createAuthHeaders(token),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload: createMultipartFileBuffer({
        boundary: MULTIPART_BOUNDARY,
        content,
        contentType: "image/png",
        fieldName: "file",
        filename,
      }),
      url: MGR_UPLOADS_BASE,
    });
  }

  it("accepts arbitrary extensions for uploads", async () => {
    const manager = await behaviorHarness.registerUser("mgr-uploads-ext");
    const teamResponse = await behaviorHarness.app.inject({
      headers: behaviorHarness.createAuthHeaders(manager.accessToken),
      method: "POST",
      payload: { name: "Ext team" },
      url: "/stc-proj-mgmt/api/teams",
    });
    expect(teamResponse.statusCode).toBe(201);

    for (const name of ["a.zip", "b.unknownext", "c.csv"]) {
      const response = await uploadAsPng(
        manager.accessToken,
        name,
        Buffer.from("hello", "utf8"),
      );
      expect(response.statusCode).toBe(201);
    }
  });

  it("lists files in deterministic name order", async () => {
    const manager = await behaviorHarness.registerUser("mgr-uploads-sort");
    await behaviorHarness.app.inject({
      headers: behaviorHarness.createAuthHeaders(manager.accessToken),
      method: "POST",
      payload: { name: "Sort team" },
      url: "/stc-proj-mgmt/api/teams",
    });

    await uploadAsPng(manager.accessToken, "b.bin", Buffer.from("b", "utf8"));
    await uploadAsPng(manager.accessToken, "a.bin", Buffer.from("a", "utf8"));

    const listResponse = await behaviorHarness.app.inject({
      headers: behaviorHarness.createAuthHeaders(manager.accessToken),
      method: "GET",
      url: MGR_UPLOADS_BASE,
    });
    expect(listResponse.statusCode).toBe(200);
    const names = behaviorHarness.parseJson<{ files: Array<{ name: string }> }>(
      listResponse.payload,
    ).files.map((entry) => entry.name);
    const aIndex = names.indexOf("a.bin");
    const bIndex = names.indexOf("b.bin");
    expect(aIndex).toBeGreaterThanOrEqual(0);
    expect(bIndex).toBeGreaterThanOrEqual(0);
    expect(aIndex).toBeLessThan(bIndex);
  });

  it("rejects duplicate uploads with conflict", async () => {
    const manager = await behaviorHarness.registerUser("mgr-uploads-dup");
    await behaviorHarness.app.inject({
      headers: behaviorHarness.createAuthHeaders(manager.accessToken),
      method: "POST",
      payload: { name: "Dup team" },
      url: "/stc-proj-mgmt/api/teams",
    });

    const first = await uploadAsPng(
      manager.accessToken,
      "dup.txt",
      Buffer.from("one", "utf8"),
    );
    expect(first.statusCode).toBe(201);

    const second = await uploadAsPng(
      manager.accessToken,
      "dup.txt",
      Buffer.from("two", "utf8"),
    );
    expect(second.statusCode).toBe(409);
  });

  it("returns 404 when deleting a missing file", async () => {
    const manager = await behaviorHarness.registerUser("mgr-uploads-del404");
    await behaviorHarness.app.inject({
      headers: behaviorHarness.createAuthHeaders(manager.accessToken),
      method: "POST",
      payload: { name: "Del team" },
      url: "/stc-proj-mgmt/api/teams",
    });

    const response = await behaviorHarness.app.inject({
      headers: behaviorHarness.createAuthHeaders(manager.accessToken),
      method: "DELETE",
      url: `${MGR_UPLOADS_BASE}/missing-${Date.now()}.bin`,
    });
    expect(response.statusCode).toBe(404);
  });

  it("rejects traversal-like delete paths", async () => {
    const manager = await behaviorHarness.registerUser("mgr-uploads-trav");
    await behaviorHarness.app.inject({
      headers: behaviorHarness.createAuthHeaders(manager.accessToken),
      method: "POST",
      payload: { name: "Trav team" },
      url: "/stc-proj-mgmt/api/teams",
    });

    const response = await behaviorHarness.app.inject({
      headers: behaviorHarness.createAuthHeaders(manager.accessToken),
      method: "DELETE",
      url: `${MGR_UPLOADS_BASE}/${encodeURIComponent("../evil")}`,
    });
    expect(response.statusCode).toBe(404);
  });

  it("serves public downloads without authentication", async () => {
    const manager = await behaviorHarness.registerUser("mgr-uploads-pub");
    await behaviorHarness.app.inject({
      headers: behaviorHarness.createAuthHeaders(manager.accessToken),
      method: "POST",
      payload: { name: "Pub team" },
      url: "/stc-proj-mgmt/api/teams",
    });

    const uploadResponse = await uploadAsPng(
      manager.accessToken,
      "public-pixel.png",
      MINIMAL_PNG_BUFFER,
    );
    expect(uploadResponse.statusCode).toBe(201);

    const publicResponse = await behaviorHarness.app.inject({
      method: "GET",
      url: `${MGR_UPLOADS_BASE}/public-pixel.png`,
    });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.rawPayload.equals(MINIMAL_PNG_BUFFER)).toBe(true);
  });

  it("allows public downloads even when an invalid bearer token is present", async () => {
    const manager = await behaviorHarness.registerUser("mgr-uploads-bearer");
    await behaviorHarness.app.inject({
      headers: behaviorHarness.createAuthHeaders(manager.accessToken),
      method: "POST",
      payload: { name: "Bearer team" },
      url: "/stc-proj-mgmt/api/teams",
    });

    await uploadAsPng(
      manager.accessToken,
      "bearer-pixel.png",
      MINIMAL_PNG_BUFFER,
    );

    const response = await behaviorHarness.app.inject({
      headers: {
        authorization: "Bearer not-a-real-token",
      },
      method: "GET",
      url: `${MGR_UPLOADS_BASE}/bearer-pixel.png`,
    });
    expect(response.statusCode).toBe(200);
  });

  it("returns 404 for missing public files", async () => {
    const response = await behaviorHarness.app.inject({
      method: "GET",
      url: `${MGR_UPLOADS_BASE}/missing-public-${Date.now()}.png`,
    });
    expect(response.statusCode).toBe(404);
  });

  it("rejects public downloads for traversal-like filenames", async () => {
    const response = await behaviorHarness.app.inject({
      method: "GET",
      url: `${MGR_UPLOADS_BASE}/${encodeURIComponent("../passwd")}`,
    });
    expect(response.statusCode).toBe(404);
  });

  it("rejects empty multipart uploads", async () => {
    const manager = await behaviorHarness.registerUser("mgr-uploads-empty");
    await behaviorHarness.app.inject({
      headers: behaviorHarness.createAuthHeaders(manager.accessToken),
      method: "POST",
      payload: { name: "Empty team" },
      url: "/stc-proj-mgmt/api/teams",
    });

    const response = await behaviorHarness.app.inject({
      headers: {
        ...behaviorHarness.createAuthHeaders(manager.accessToken),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload: Buffer.from(
        `--${MULTIPART_BOUNDARY}\r\n--${MULTIPART_BOUNDARY}--\r\n`,
        "utf8",
      ),
      url: MGR_UPLOADS_BASE,
    });
    expect(response.statusCode).toBe(400);
  });

  it("accepts uploads within the mgr-uploads size limit", async () => {
    const manager = await behaviorHarness.registerUser("mgr-uploads-ok-size");
    await behaviorHarness.app.inject({
      headers: behaviorHarness.createAuthHeaders(manager.accessToken),
      method: "POST",
      payload: { name: "Ok size team" },
      url: "/stc-proj-mgmt/api/teams",
    });

    const payload = Buffer.alloc(512, 7);
    const response = await uploadAsPng(
      manager.accessToken,
      "within-limit.bin",
      payload,
    );
    expect(response.statusCode).toBe(201);
  });
});

describe("mgr-uploads api upload size cap", () => {
  const SIZE_CAP_BYTES = 64;
  const cappedHarness = createCrudTestHarness("mgr-uploads-size-cap.sqlite", {
    mgrUploadsMaxUploadBytes: SIZE_CAP_BYTES,
  });

  beforeAll(async () => {
    await cappedHarness.setup();
  });

  afterAll(async () => {
    await cappedHarness.cleanup();
  });

  async function uploadAsPng(
    token: string,
    filename: string,
    content: Buffer,
  ) {
    return await cappedHarness.app.inject({
      headers: {
        ...cappedHarness.createAuthHeaders(token),
        "content-type": `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`,
      },
      method: "POST",
      payload: createMultipartFileBuffer({
        boundary: MULTIPART_BOUNDARY,
        content,
        contentType: "image/png",
        fieldName: "file",
        filename,
      }),
      url: MGR_UPLOADS_BASE,
    });
  }

  it("rejects uploads larger than the configured mgr-uploads max", async () => {
    const manager = await cappedHarness.registerUser("mgr-uploads-over-cap");
    await cappedHarness.app.inject({
      headers: cappedHarness.createAuthHeaders(manager.accessToken),
      method: "POST",
      payload: { name: "Cap team" },
      url: "/stc-proj-mgmt/api/teams",
    });

    const tooLarge = Buffer.alloc(SIZE_CAP_BYTES + 1, 1);
    const response = await uploadAsPng(
      manager.accessToken,
      "too-large.bin",
      tooLarge,
    );
    expect(response.statusCode).toBe(413);
  });

  it("accepts uploads at or below the configured mgr-uploads max", async () => {
    const manager = await cappedHarness.registerUser("mgr-uploads-at-cap");
    await cappedHarness.app.inject({
      headers: cappedHarness.createAuthHeaders(manager.accessToken),
      method: "POST",
      payload: { name: "At cap team" },
      url: "/stc-proj-mgmt/api/teams",
    });

    const atCap = Buffer.alloc(SIZE_CAP_BYTES, 2);
    const response = await uploadAsPng(manager.accessToken, "at-cap.bin", atCap);
    expect(response.statusCode).toBe(201);
  });
});
