import type { IssueStatus } from "../contracts/issue.contracts.js";
import { emitFrontendDebugLog } from "../../../common/debug/frontend-debug-ingest.js";

const STATUS_BLOCKED: IssueStatus = "ISSUE_STATUS_BLOCKED";
const STATUS_CLOSED: IssueStatus = "ISSUE_STATUS_CLOSED";
const STATUS_IN_PROGRESS: IssueStatus = "ISSUE_STATUS_IN_PROGRESS";

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
  emitFrontendDebugLog({
    data,
    hypothesisId,
    location,
    message,
    runId,
  });
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

function collectTransitivePredecessorIds(
  taskId: string,
  directPredecessorIds: readonly string[],
  tasksById: ReadonlyMap<string, MilestoneInferenceTaskLike>,
): string[] {
  const visited = new Set<string>();
  const result = new Set<string>();

  // Stack-based traversal so we don't depend on recursion depth.
  const stack: string[] = [...directPredecessorIds];
  visited.add(taskId);

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    if (current === taskId) {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    result.add(current);

    const node = tasksById.get(current);
    if (!node) {
      continue;
    }

    for (const predecessorId of node.predecessorIds) {
      if (predecessorId === taskId) {
        continue;
      }
      stack.push(predecessorId);
    }
  }

  return Array.from(result);
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

  const directPredecessorIds = sanitizePredecessorIds(taskId, task.predecessorIds);
  const predecessorIds = collectTransitivePredecessorIds(taskId, directPredecessorIds, context.tasksById);

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
