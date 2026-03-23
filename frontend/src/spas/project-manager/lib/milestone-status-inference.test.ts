import { describe, expect, it } from "vitest";

import { inferMilestoneStatus } from "./milestone-status-inference.js";

describe("milestone status inference", () => {
  it("returns blocked when any dependency is blocked", () => {
    const tasksById = new Map([
      ["m1", { id: "m1", predecessorIds: ["t1", "t2"], type: "milestone" as const }],
      ["t1", { id: "t1", predecessorIds: [], type: "task" as const }],
      ["t2", { id: "t2", predecessorIds: [], type: "task" as const }],
    ]);

    const status = inferMilestoneStatus("m1", {
      resolveTaskStatus: (taskId) => (taskId === "t1" ? "ISSUE_STATUS_BLOCKED" : "ISSUE_STATUS_CLOSED"),
      tasksById,
    });

    expect(status).toBe("ISSUE_STATUS_BLOCKED");
  });

  it("returns closed when all dependencies are closed", () => {
    const tasksById = new Map([
      ["m1", { id: "m1", predecessorIds: ["t1", "t2"], type: "milestone" as const }],
      ["t1", { id: "t1", predecessorIds: [], type: "task" as const }],
      ["t2", { id: "t2", predecessorIds: [], type: "task" as const }],
    ]);

    const status = inferMilestoneStatus("m1", {
      resolveTaskStatus: () => "ISSUE_STATUS_CLOSED",
      tasksById,
    });

    expect(status).toBe("ISSUE_STATUS_CLOSED");
  });

  it("returns in progress when dependencies exist but are not all closed", () => {
    const tasksById = new Map([
      ["m1", { id: "m1", predecessorIds: ["t1", "t2"], type: "milestone" as const }],
      ["t1", { id: "t1", predecessorIds: [], type: "task" as const }],
      ["t2", { id: "t2", predecessorIds: [], type: "task" as const }],
    ]);

    const status = inferMilestoneStatus("m1", {
      resolveTaskStatus: (taskId) => (taskId === "t1" ? "ISSUE_STATUS_CLOSED" : "ISSUE_STATUS_IN_PROGRESS"),
      tasksById,
    });

    expect(status).toBe("ISSUE_STATUS_IN_PROGRESS");
  });

  it("returns in progress when milestone has no dependencies", () => {
    const tasksById = new Map([
      ["m1", { id: "m1", predecessorIds: [], type: "milestone" as const }],
    ]);

    const status = inferMilestoneStatus("m1", {
      resolveTaskStatus: () => "ISSUE_STATUS_CLOSED",
      tasksById,
    });

    expect(status).toBe("ISSUE_STATUS_IN_PROGRESS");
  });
});
