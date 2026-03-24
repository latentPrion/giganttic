import { describe, expect, it } from "vitest";

import { parseScopedAccessTokenInput } from "./scoped-access-token-input.utils.js";

const TEST_BASE = "https://app.example.com";

describe("parseScopedAccessTokenInput", () => {
  it("returns null for empty or whitespace-only input", () => {
    expect(parseScopedAccessTokenInput("", TEST_BASE)).toBeNull();
    expect(parseScopedAccessTokenInput("   ", TEST_BASE)).toBeNull();
  });

  it("parses token from a full HTTPS URL with query", () => {
    const url = "https://login.example.com/auth/scoped-token-login?token=abc123%2B";
    expect(parseScopedAccessTokenInput(url, TEST_BASE)).toBe("abc123+");
  });

  it("parses token from a path-only URL using base URL", () => {
    const input = "/auth/scoped-token-login?token=rel-token";
    expect(parseScopedAccessTokenInput(input, "https://app.example.com")).toBe("rel-token");
  });

  it("parses token from a bare query string", () => {
    expect(parseScopedAccessTokenInput("?token=bare-query", TEST_BASE)).toBe("bare-query");
  });

  it("parses token via regex when URL constructor fails", () => {
    const input = "not-a-url-but?token=still-found";
    expect(parseScopedAccessTokenInput(input, TEST_BASE)).toBe("still-found");
  });

  it("returns trimmed raw string when no token= pattern is present", () => {
    expect(parseScopedAccessTokenInput("  raw-token-value  ", TEST_BASE)).toBe("raw-token-value");
  });

  it("trims the overall input before treating as raw token", () => {
    expect(parseScopedAccessTokenInput("\nplain\n", TEST_BASE)).toBe("plain");
  });
});
