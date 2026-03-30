import { describe, expect, it } from "vitest";

import {
  buildAppAbsoluteUrl,
  buildAppRelativeUrl,
  createScopedAccessLoginAbsoluteUrl,
  createScopedAccessLoginRelativeUrl,
} from "./public-app-url.js";

describe("public app url helpers", () => {
  it("builds root-relative app urls for root deployments", () => {
    expect(buildAppRelativeUrl("/auth/scoped-token-login", "/")).toBe(
      "/auth/scoped-token-login",
    );
  });

  it("prefixes app urls with the configured app base path", () => {
    expect(buildAppRelativeUrl("/auth/scoped-token-login", "/pm")).toBe(
      "/pm/auth/scoped-token-login",
    );
  });

  it("builds absolute urls with the configured app base path", () => {
    expect(
      buildAppAbsoluteUrl("/auth/scoped-token-login", "https://workio.ai", "/pm"),
    ).toBe("https://workio.ai/pm/auth/scoped-token-login");
  });

  it("creates scoped access login links for root deployments", () => {
    expect(createScopedAccessLoginRelativeUrl("abc123", "/")).toBe(
      "/auth/scoped-token-login?token=abc123",
    );
  });

  it("creates scoped access login links for /pm deployments", () => {
    expect(createScopedAccessLoginRelativeUrl("abc123", "/pm")).toBe(
      "/pm/auth/scoped-token-login?token=abc123",
    );
  });

  it("creates absolute scoped access login links for /pm deployments", () => {
    expect(
      createScopedAccessLoginAbsoluteUrl("abc123+", "https://workio.ai", "/pm"),
    ).toBe("https://workio.ai/pm/auth/scoped-token-login?token=abc123%2B");
  });
});
