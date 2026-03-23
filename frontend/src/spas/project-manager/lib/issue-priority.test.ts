import { describe, expect, it } from "vitest";
import { IssuePriorityCode } from "./issue-priority.js";
import {
  clampIssuePriorityValue,
  getIssuePriorityLabel,
} from "./issue-priority.js";

describe("issue-priority", () => {
  it("clamps out-of-range priorities to the nearest supported code", () => {
    expect(clampIssuePriorityValue(-1)).toBe(IssuePriorityCode.ISSUE_PRIORITY_LOW);
    expect(clampIssuePriorityValue(0)).toBe(IssuePriorityCode.ISSUE_PRIORITY_LOW);
    expect(clampIssuePriorityValue(2)).toBe(IssuePriorityCode.ISSUE_PRIORITY_HIGH);
    expect(clampIssuePriorityValue(3)).toBe(IssuePriorityCode.ISSUE_PRIORITY_URGENT);
    expect(clampIssuePriorityValue(4)).toBe(IssuePriorityCode.ISSUE_PRIORITY_URGENT);
  });

  it("renders labels using clamped priority values", () => {
    expect(getIssuePriorityLabel(-1)).toBe("Low");
    expect(getIssuePriorityLabel(1)).toBe("Medium");
    expect(getIssuePriorityLabel(4)).toBe("Urgent");
  });
});
