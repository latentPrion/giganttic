import { describe, expect, it } from "vitest";

import { extractAuthRequestMetadata } from "./auth-request-metadata.js";

describe("extractAuthRequestMetadata", () => {
  it("uses the direct request ip when proxy trust is disabled", () => {
    expect(
      extractAuthRequestMetadata({
        headers: {
          "x-client-location": "Trinidad",
          "x-forwarded-for": "203.0.113.10",
        },
        ip: "::ffff:127.0.0.1",
        trustProxy: false,
      }),
    ).toEqual({
      ipAddress: "127.0.0.1",
      location: "Trinidad",
    });
  });

  it("uses the forwarded ip when proxy trust is enabled", () => {
    expect(
      extractAuthRequestMetadata({
        headers: {
          "x-forwarded-for": "203.0.113.10, 127.0.0.1",
        },
        ip: "127.0.0.1",
        trustProxy: true,
      }),
    ).toEqual({
      ipAddress: "203.0.113.10",
      location: null,
    });
  });

  it("falls back to socket remote address when no ip is present", () => {
    expect(
      extractAuthRequestMetadata({
        headers: {},
        socket: { remoteAddress: "::ffff:10.0.0.4" },
        trustProxy: false,
      }),
    ).toEqual({
      ipAddress: "10.0.0.4",
      location: null,
    });
  });
});

