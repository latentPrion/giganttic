import type { IssueStatus } from "../contracts/issue.contracts.js";

const STATUS_BLOCKED: IssueStatus = "ISSUE_STATUS_BLOCKED";
const STATUS_CLOSED: IssueStatus = "ISSUE_STATUS_CLOSED";
const STATUS_IN_PROGRESS: IssueStatus = "ISSUE_STATUS_IN_PROGRESS";
const DEBUG_INGEST_ENDPOINT = "http://127.0.0.1:7725/ingest/79f6b8a3-16b6-41b4-b9c7-8a49362b3407";
const DEBUG_SESSION_ID = "117825";

export interface MilestoneInferenceTaskLike {
  id: string;
  predecessorIds: readonly string[];
  type: "milestone" | "task";
}

export type ResolveTaskStatus = (taskId: string) => IssueStatus;

export interface MilestoneStatusInferenceContext {
  resolveTaskStatus: ResolveTaskStatus;
  tasksById: ReadonlyMap<string, MilestoneInferenceTaskLike>;
}

function emitDebugLog(
  location: string,
  message: string,
  hypothesisId: string,
  runId: string,
  data: Record<string, unknown>,
): void {
  // #region agent log
  fetch(DEBUG_INGEST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": DEBUG_SESSION_ID,
    },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      location,
      message,
      data,
      timestamp: Date.now(),
      runId,
      hypothesisId,
    }),
  }).catch(() => {});
  // #endregion
}

function hasBlockedDependency(
  predecessorIds: readonly string[],
  resolveTaskStatus: ResolveTaskStatus,
): boolean {
  return predecessorIds.some((predecessorId) => resolveTaskStatus(predecessorId) === STATUS_BLOCKED);
}

function areAllDependenciesClosed(
  predecessorIds: readonly string[],
  resolveTaskStatus: ResolveTaskStatus,
): boolean {
  if (predecessorIds.length === 0) {
    return false;
  }

  return predecessorIds.every((predecessorId) => resolveTaskStatus(predecessorId) === STATUS_CLOSED);
}

function hasSelfDependency(taskId: string, predecessorIds: readonly string[]): boolean {
  return predecessorIds.some((predecessorId) => predecessorId === taskId);
}

function removeSelfDependency(taskId: string, predecessorIds: readonly string[]): string[] {
  return predecessorIds.filter((predecessorId) => predecessorId !== taskId);
}

function sanitizePredecessorIds(taskId: string, predecessorIds: readonly string[]): string[] {
  if (!hasSelfDependency(taskId, predecessorIds)) {
    return [...predecessorIds];
  }

  return removeSelfDependency(taskId, predecessorIds);
}

export function inferMilestoneStatus(
  taskId: string,
  context: MilestoneStatusInferenceContext,
): IssueStatus {
  const runId = `milestone-infer-${Date.now()}`;
  const task = context.tasksById.get(taskId);
  if (!task || task.type !== "milestone") {
    return STATUS_IN_PROGRESS;
  }

  const predecessorIds = sanitizePredecessorIds(taskId, task.predecessorIds);
  const predecessorStatuses = predecessorIds.map((predecessorId) => ({
    predecessorId,
    status: context.resolveTaskStatus(predecessorId),
  }));

  if (hasBlockedDependency(predecessorIds, context.resolveTaskStatus)) {
    emitDebugLog(
      "milestone-status-inference.ts:inferMilestoneStatus",
      "Milestone inferred as blocked",
      "H2",
      runId,
      {
        predecessorStatuses,
        taskId,
      },
    );
    return STATUS_BLOCKED;
  }

  if (areAllDependenciesClosed(predecessorIds, context.resolveTaskStatus)) {
    emitDebugLog(
      "milestone-status-inference.ts:inferMilestoneStatus",
      "Milestone inferred as closed",
      "H2",
      runId,
      {
        predecessorStatuses,
        taskId,
      },
    );
    return STATUS_CLOSED;
  }

  emitDebugLog(
    "milestone-status-inference.ts:inferMilestoneStatus",
    "Milestone inferred as in-progress",
    "H2",
    runId,
    {
      predecessorStatuses,
      taskId,
    },
  );
  return STATUS_IN_PROGRESS;
}
