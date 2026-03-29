import { describe, expect, it } from "vitest";

import { getReferenceSeedData } from "./reference-seed-data.mjs";

describe("reference seed data", () => {
  it("reuses the v4 reference seed set for v6", () => {
    expect(getReferenceSeedData("v6")).toEqual(getReferenceSeedData("v4"));
  });

  it("reuses the v4 reference seed set for v7", () => {
    expect(getReferenceSeedData("v7")).toEqual(getReferenceSeedData("v4"));
  });

  it("still rejects unsupported schema names", () => {
    expect(() => getReferenceSeedData("v999")).toThrow(
      /Unsupported schema for reference data reconciliation: v999/i,
    );
  });
});
