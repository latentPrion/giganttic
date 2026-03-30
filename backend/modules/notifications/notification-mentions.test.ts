import { describe, expect, it } from "vitest";

import { extractMentionUsernames } from "./notification-mentions.js";

describe("notification mention parsing", () => {
  it("parses @token mentions", () => {
    expect(
      extractMentionUsernames("Please sync with @alice and @bob_smith today."),
    ).toEqual(["alice", "bob_smith"]);
  });

  it("parses bracketed mentions with spaces and punctuation", () => {
    expect(
      extractMentionUsernames("Review this with @[Alice Smith] and @[bob.smith]."),
    ).toEqual(["Alice Smith", "bob.smith"]);
  });

  it("supports both mention syntaxes in one body", () => {
    expect(
      extractMentionUsernames("Ping @alice and @[Bob Smith] before close."),
    ).toEqual(["alice", "Bob Smith"]);
  });

  it("dedupes repeated mentions while preserving first appearance order", () => {
    expect(
      extractMentionUsernames("Check with @alice and again with @alice and @[Alice Smith]."),
    ).toEqual(["alice", "Alice Smith"]);
  });

  it("ignores malformed and incomplete bracket syntax", () => {
    expect(
      extractMentionUsernames("Broken @[] @[  ] and @[alice plus raw @@bad syntax"),
    ).toEqual([]);
  });
});
