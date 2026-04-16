import { describe, expect, it } from "vitest";

import {
  buildAppAbsoluteUrl,
  buildAppRelativeUrl,
  createScopedAccessLoginAbsoluteUrl,
  createScopedAccessLoginRelativeUrl,
} from "./public-app-url.js";
import { SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH } from "../../../../common/routes/app-route-paths.js";

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

  it("creates scoped access login links using the route path directly", () => {
    expect(createScopedAccessLoginRelativeUrl("abc123")).toBe(
      `${SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH}?token=abc123`,
    );
  });

  it("creates absolute scoped access login links", () => {
    expect(
      createScopedAccessLoginAbsoluteUrl("abc123+", "https://workio.ai"),
    ).toBe(
      `https://workio.ai${SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH}?token=abc123%2B`,
    );
  });

  it("returns paths unchanged when they already start with appBasePath (idempotent)", () => {
    expect(buildAppRelativeUrl("/pm/contact", "/pm")).toBe("/pm/contact");
    expect(buildAppRelativeUrl("/pm/pm/project", "/pm")).toBe("/pm/pm/project");
  });
});
