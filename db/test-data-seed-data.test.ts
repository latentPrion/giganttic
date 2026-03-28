import { describe, expect, it } from "vitest";

import { getSeededTestData } from "./test-data-seed-data.mjs";

describe("test data seed data", () => {
  it("supports v6 test data seeding", () => {
    const seeded = getSeededTestData("v6");

    expect(Object.keys(seeded.seededTestAccounts).length).toBeGreaterThan(0);
    expect(Object.keys(seeded.seededScopedFixtures).length).toBeGreaterThan(0);
  });

  it("still rejects unsupported schema names", () => {
    expect(() => getSeededTestData("v999")).toThrow(
      /only supported for schema v2\/v3\/v4\/v5\/v6/i,
    );
  });
});
