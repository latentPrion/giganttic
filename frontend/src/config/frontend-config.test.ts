import { describe, expect, it } from "vitest";

import {
  normalizeApiBaseUrl,
  normalizeProxyPassMountPath,
  normalizeBooleanFlag,
  normalizeOptionalUrl,
} from "./frontend-config.js";

describe("frontend config normalization", () => {
  it("keeps the default proxy-pass mount path at root", () => {
    expect(normalizeProxyPassMountPath(undefined)).toBe("/");
    expect(normalizeProxyPassMountPath("")).toBe("/");
    expect(normalizeProxyPassMountPath("/")).toBe("/");
  });

  it("normalizes non-root proxy-pass mount paths without trailing slashes", () => {
    expect(normalizeProxyPassMountPath("pm")).toBe("/pm");
    expect(normalizeProxyPassMountPath("/pm")).toBe("/pm");
    expect(normalizeProxyPassMountPath("/pm/")).toBe("/pm");
  });

  it("normalizes api base urls without trailing slashes", () => {
    expect(normalizeApiBaseUrl(undefined)).toBe("");
    expect(normalizeApiBaseUrl("https://example.com/")).toBe("https://example.com");
    expect(normalizeApiBaseUrl("https://example.com/app")).toBe("https://example.com/app");
  });

  it("normalizes boolean flags with sane defaults", () => {
    expect(normalizeBooleanFlag(undefined, false)).toBe(false);
    expect(normalizeBooleanFlag("true", false)).toBe(true);
    expect(normalizeBooleanFlag("false", true)).toBe(false);
  });

  it("normalizes optional urls", () => {
    expect(normalizeOptionalUrl(undefined)).toBeNull();
    expect(normalizeOptionalUrl("")).toBeNull();
    expect(normalizeOptionalUrl("https://debug.example.com/ingest")).toBe(
      "https://debug.example.com/ingest",
    );
  });
});
