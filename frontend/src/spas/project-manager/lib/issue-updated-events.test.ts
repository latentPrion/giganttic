import { describe, expect, it, vi } from "vitest";

import {
  emitProjectManagerIssueUpdatedEvent,
  subscribeProjectManagerIssueUpdatedEvent,
} from "./issue-updated-events.js";

describe("issue-updated-events", () => {
  it("emits and receives issue update payload", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeProjectManagerIssueUpdatedEvent(handler);

    emitProjectManagerIssueUpdatedEvent({
      issueId: 9,
      projectId: 42,
    });

    expect(handler).toHaveBeenCalledWith({
      issueId: 9,
      projectId: 42,
    });

    unsubscribe();
  });
});

