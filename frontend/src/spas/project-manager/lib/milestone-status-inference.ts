import type { IssueStatus } from "../contracts/issue.contracts.js";

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
  const task = context.tasksById.get(taskId);
  if (!task || task.type !== "milestone") {
    return STATUS_IN_PROGRESS;
  }

  const predecessorIds = sanitizePredecessorIds(taskId, task.predecessorIds);

  if (hasBlockedDependency(predecessorIds, context.resolveTaskStatus)) {
    return STATUS_BLOCKED;
  }

  if (areAllDependenciesClosed(predecessorIds, context.resolveTaskStatus)) {
    return STATUS_CLOSED;
  }

  return STATUS_IN_PROGRESS;
}
