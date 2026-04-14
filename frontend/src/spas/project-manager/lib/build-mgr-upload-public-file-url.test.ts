import { afterEach, describe, expect, it, vi } from "vitest";

import { frontendConfig } from "../../../config/frontend-config.js";
import { buildMgrUploadPublicFileUrl } from "./build-mgr-upload-public-file-url.js";

describe("buildMgrUploadPublicFileUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds an absolute URL with encoded filename segments", () => {
    vi.stubGlobal("window", {
      location: { origin: "https://example.com" },
    });

    const url = buildMgrUploadPublicFileUrl("my file.bin");
    expect(url).toBe(
      `https://example.com${frontendConfig.routePrefix}/mgr-uploads/my%20file.bin`,
    );
  });
});
