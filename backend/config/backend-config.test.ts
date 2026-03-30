import { describe, expect, it } from "vitest";

import { buildBackendConfig, buildBackendConfigFromEnv } from "./backend-config.js";

describe("backend config", () => {
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

