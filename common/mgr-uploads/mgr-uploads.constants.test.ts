import { describe, expect, it } from "vitest";

import { MGR_UPLOADS_MAX_UPLOAD_BYTES, MGR_UPLOADS_MAX_UPLOAD_MIB } from "./mgr-uploads.constants.js";

describe("mgr-uploads.constants", () => {
  it("defines a 500 MiB default cap in bytes", () => {
    expect(MGR_UPLOADS_MAX_UPLOAD_MIB).toBe(500);
    expect(MGR_UPLOADS_MAX_UPLOAD_BYTES).toBe(500 * 1024 * 1024);
  });
});
