import { describe, expect, it } from "vitest";

import {
  parseProjectAttachmentIdFromSearchParameters,
  parseProjectTabFromSearchParameters,
  parseTaskCommentIdFromSearchParameters,
  parseTaskIdFromSearchParameters,
  parseTaskTabFromSearchParameters,
} from "./route-query.contracts.js";

describe("route query contracts", () => {
  it("parses canonical task ids from search parameters", () => {
    const parameters = new URLSearchParams("projectId=7&id=task-42");

    expect(parseTaskIdFromSearchParameters(parameters)).toBe("task-42");
  });

  it("rejects task ids with leading or trailing whitespace", () => {
    const parameters = new URLSearchParams("projectId=7&id=%20task-42%20");

    expect(parseTaskIdFromSearchParameters(parameters)).toBeNull();
  });

  it("defaults the task detail tab to comments when a comment permalink is present", () => {
    const parameters = new URLSearchParams("projectId=7&id=task-42&commentId=91");

    expect(parseTaskCommentIdFromSearchParameters(parameters)).toBe(91);
    expect(parseTaskTabFromSearchParameters(parameters)).toBe("comments");
  });

  it("parses project detail tabs and falls back to details for unknown values", () => {
    expect(parseProjectTabFromSearchParameters(new URLSearchParams("tab=attachments"))).toBe(
      "attachments",
    );
    expect(parseProjectTabFromSearchParameters(new URLSearchParams("tab=unknown"))).toBe(
      "details",
    );
  });

  it("parses project attachment ids only when the value is non-empty and trimmed", () => {
    expect(
      parseProjectAttachmentIdFromSearchParameters(new URLSearchParams("attachmentId=file-1")),
    ).toBe("file-1");
    expect(
      parseProjectAttachmentIdFromSearchParameters(new URLSearchParams("attachmentId=%20file%20")),
    ).toBeNull();
  });
});
