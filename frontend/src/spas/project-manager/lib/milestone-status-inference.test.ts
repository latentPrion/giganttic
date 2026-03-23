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

  it("returns blocked when a dependency milestone is blocked", () => {
    const tasksById = new Map([
      ["m1", { id: "m1", predecessorIds: ["m2"], type: "milestone" as const }],
      ["m2", { id: "m2", predecessorIds: ["t1", "t2"], type: "milestone" as const }],
      ["t1", { id: "t1", predecessorIds: [], type: "task" as const }],
      ["t2", { id: "t2", predecessorIds: [], type: "task" as const }],
    ]);

    const resolveTaskStatus = (taskId: string) => {
      const taskLike = tasksById.get(taskId);
      if (taskLike?.type === "milestone") {
        return inferMilestoneStatus(taskId, { resolveTaskStatus, tasksById });
      }

      // Only tasks have explicit statuses in this unit test.
      if (taskId === "t1") {
        return "ISSUE_STATUS_BLOCKED";
      }

      return "ISSUE_STATUS_CLOSED";
    };

    const status = inferMilestoneStatus("m1", { resolveTaskStatus, tasksById });
    expect(status).toBe("ISSUE_STATUS_BLOCKED");
  });

  it("returns closed when a dependency milestone is closed", () => {
    const tasksById = new Map([
      ["m1", { id: "m1", predecessorIds: ["m2"], type: "milestone" as const }],
      ["m2", { id: "m2", predecessorIds: ["t1", "t2"], type: "milestone" as const }],
      ["t1", { id: "t1", predecessorIds: [], type: "task" as const }],
      ["t2", { id: "t2", predecessorIds: [], type: "task" as const }],
    ]);

    const resolveTaskStatus = (taskId: string) => {
      const taskLike = tasksById.get(taskId);
      if (taskLike?.type === "milestone") {
        return inferMilestoneStatus(taskId, { resolveTaskStatus, tasksById });
      }

      return "ISSUE_STATUS_CLOSED";
    };

    const status = inferMilestoneStatus("m1", { resolveTaskStatus, tasksById });
    expect(status).toBe("ISSUE_STATUS_CLOSED");
  });

  it("returns in progress when a dependency milestone is in progress", () => {
    const tasksById = new Map([
      ["m1", { id: "m1", predecessorIds: ["m2"], type: "milestone" as const }],
      ["m2", { id: "m2", predecessorIds: ["t1", "t2"], type: "milestone" as const }],
      ["t1", { id: "t1", predecessorIds: [], type: "task" as const }],
      ["t2", { id: "t2", predecessorIds: [], type: "task" as const }],
    ]);

    const resolveTaskStatus = (taskId: string) => {
      const taskLike = tasksById.get(taskId);
      if (taskLike?.type === "milestone") {
        return inferMilestoneStatus(taskId, { resolveTaskStatus, tasksById });
      }

      if (taskId === "t1") {
        return "ISSUE_STATUS_CLOSED";
      }

      return "ISSUE_STATUS_IN_PROGRESS";
    };

    const status = inferMilestoneStatus("m1", { resolveTaskStatus, tasksById });
    expect(status).toBe("ISSUE_STATUS_IN_PROGRESS");
  });

  it("returns blocked when multiple dependency milestones include a blocked one", () => {
    const tasksById = new Map([
      ["m1", { id: "m1", predecessorIds: ["m2", "m3"], type: "milestone" as const }],
      ["m2", { id: "m2", predecessorIds: ["t-closed-1"], type: "milestone" as const }],
      ["m3", { id: "m3", predecessorIds: ["t-blocked"], type: "milestone" as const }],
      ["t-closed-1", { id: "t-closed-1", predecessorIds: [], type: "task" as const }],
      ["t-blocked", { id: "t-blocked", predecessorIds: [], type: "task" as const }],
    ]);

    const resolveTaskStatus = (taskId: string) => {
      const taskLike = tasksById.get(taskId);
      if (taskLike?.type === "milestone") {
        return inferMilestoneStatus(taskId, { resolveTaskStatus, tasksById });
      }

      if (taskId === "t-blocked") {
        return "ISSUE_STATUS_BLOCKED";
      }

      return "ISSUE_STATUS_CLOSED";
    };

    const status = inferMilestoneStatus("m1", { resolveTaskStatus, tasksById });
    expect(status).toBe("ISSUE_STATUS_BLOCKED");
  });

  it("returns closed when multiple dependency milestones are all closed", () => {
    const tasksById = new Map([
      ["m1", { id: "m1", predecessorIds: ["m2", "m3"], type: "milestone" as const }],
      ["m2", { id: "m2", predecessorIds: ["t1"], type: "milestone" as const }],
      ["m3", { id: "m3", predecessorIds: ["t2"], type: "milestone" as const }],
      ["t1", { id: "t1", predecessorIds: [], type: "task" as const }],
      ["t2", { id: "t2", predecessorIds: [], type: "task" as const }],
    ]);

    const resolveTaskStatus = (taskId: string) => {
      const taskLike = tasksById.get(taskId);
      if (taskLike?.type === "milestone") {
        return inferMilestoneStatus(taskId, { resolveTaskStatus, tasksById });
      }

      return "ISSUE_STATUS_CLOSED";
    };

    const status = inferMilestoneStatus("m1", { resolveTaskStatus, tasksById });
    expect(status).toBe("ISSUE_STATUS_CLOSED");
  });

  it("returns in progress when dependency milestones are not all closed and none blocked", () => {
    const tasksById = new Map([
      ["m1", { id: "m1", predecessorIds: ["m2", "m3"], type: "milestone" as const }],
      ["m2", { id: "m2", predecessorIds: ["t-open"], type: "milestone" as const }],
      ["m3", { id: "m3", predecessorIds: ["t-closed"], type: "milestone" as const }],
      ["t-open", { id: "t-open", predecessorIds: [], type: "task" as const }],
      ["t-closed", { id: "t-closed", predecessorIds: [], type: "task" as const }],
    ]);

    const resolveTaskStatus = (taskId: string) => {
      const taskLike = tasksById.get(taskId);
      if (taskLike?.type === "milestone") {
        return inferMilestoneStatus(taskId, { resolveTaskStatus, tasksById });
      }

      if (taskId === "t-open") {
        return "ISSUE_STATUS_OPEN";
      }

      return "ISSUE_STATUS_CLOSED";
    };

    const status = inferMilestoneStatus("m1", { resolveTaskStatus, tasksById });
    expect(status).toBe("ISSUE_STATUS_IN_PROGRESS");
  });
});
