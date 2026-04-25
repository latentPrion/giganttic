import { describe, expect, it } from "vitest";

import { normalizeProxyPassPublicBasePath } from "./vite.config.js";

describe("vite proxy-pass public base path normalization", () => {
  it("keeps the default proxy-pass public base path at root", () => {
    expect(normalizeProxyPassPublicBasePath(undefined)).toBe("/");
    expect(normalizeProxyPassPublicBasePath("")).toBe("/");
    expect(normalizeProxyPassPublicBasePath("/")).toBe("/");
  });

  it("normalizes non-root proxy-pass public base paths with leading and trailing slashes", () => {
    expect(normalizeProxyPassPublicBasePath("pm")).toBe("/pm/");
    expect(normalizeProxyPassPublicBasePath("/pm")).toBe("/pm/");
    expect(normalizeProxyPassPublicBasePath("/pm/")).toBe("/pm/");
  });
});
