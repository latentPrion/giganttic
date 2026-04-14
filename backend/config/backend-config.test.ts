import { describe, expect, it } from "vitest";

import { MGR_UPLOADS_MAX_UPLOAD_BYTES } from "../../common/mgr-uploads/mgr-uploads.constants.js";
import { buildBackendConfig, buildBackendConfigFromEnv } from "./backend-config.js";

describe("backend config", () => {
  it("defaults mgrUploadsMaxUploadBytes to 500 MiB", () => {
    expect(buildBackendConfig().mgrUploadsMaxUploadBytes).toBe(
      MGR_UPLOADS_MAX_UPLOAD_BYTES,
    );
  });

  it("overrides mgrUploadsMaxUploadBytes from env", () => {
    expect(
      buildBackendConfigFromEnv({ GGTC_MGR_UPLOADS_MAX_UPLOAD_BYTES: "4096" })
        .mgrUploadsMaxUploadBytes,
    ).toBe(4096);
  });

  it("defaults trustProxy to false", () => {
    expect(buildBackendConfig().trustProxy).toBe(false);
  });

  it("enables trustProxy from env", () => {
    expect(buildBackendConfigFromEnv({ GGTC_TRUST_PROXY: "true" }).trustProxy).toBe(
      true,
    );
  });

  it("keeps trustProxy false when explicitly disabled in env", () => {
    expect(buildBackendConfigFromEnv({ GGTC_TRUST_PROXY: "false" }).trustProxy).toBe(
      false,
    );
  });
});

