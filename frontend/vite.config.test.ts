import { describe, expect, it } from "vitest";

import { normalizePublicBasePath } from "./vite.config.js";

describe("vite public base path normalization", () => {
  it("keeps the default public base path at root", () => {
    expect(normalizePublicBasePath(undefined)).toBe("/");
    expect(normalizePublicBasePath("")).toBe("/");
    expect(normalizePublicBasePath("/")).toBe("/");
  });

  it("normalizes non-root public base paths with leading and trailing slashes", () => {
    expect(normalizePublicBasePath("pm")).toBe("/pm/");
    expect(normalizePublicBasePath("/pm")).toBe("/pm/");
    expect(normalizePublicBasePath("/pm/")).toBe("/pm/");
  });
});
