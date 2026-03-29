import { describe, expect, it } from "vitest";

import {
  ISSUE_ATTACHMENTS_SECTION_ANCHOR,
  ISSUE_JOURNAL_SECTION_ANCHOR,
  PROJECT_ATTACHMENTS_SECTION_ANCHOR,
  PROJECT_JOURNAL_SECTION_ANCHOR,
  TASK_ATTACHMENTS_SECTION_ANCHOR,
  TASK_JOURNAL_SECTION_ANCHOR,
  inferIssueTabFromAnchor,
  inferProjectTabFromAnchor,
  inferTaskTabFromAnchor,
} from "./detail-section-anchor-routing.js";

describe("detail section anchor routing", () => {
  it("maps project anchors to project tabs", () => {
    expect(inferProjectTabFromAnchor(`#${PROJECT_JOURNAL_SECTION_ANCHOR}`)).toBe("details");
    expect(inferProjectTabFromAnchor(`#${PROJECT_ATTACHMENTS_SECTION_ANCHOR}`)).toBe(
      "attachments",
    );
  });

  it("maps issue anchors to issue tabs", () => {
    expect(inferIssueTabFromAnchor(`#${ISSUE_JOURNAL_SECTION_ANCHOR}`)).toBe("details");
    expect(inferIssueTabFromAnchor(`#${ISSUE_ATTACHMENTS_SECTION_ANCHOR}`)).toBe("attachments");
  });

  it("maps task anchors to task tabs", () => {
    expect(inferTaskTabFromAnchor(`#${TASK_JOURNAL_SECTION_ANCHOR}`)).toBe("details");
    expect(inferTaskTabFromAnchor(`#${TASK_ATTACHMENTS_SECTION_ANCHOR}`)).toBe("attachments");
  });

  it("returns null for unknown anchors", () => {
    expect(inferProjectTabFromAnchor("#unknown")).toBeNull();
    expect(inferIssueTabFromAnchor("#unknown")).toBeNull();
    expect(inferTaskTabFromAnchor("#unknown")).toBeNull();
  });
});
