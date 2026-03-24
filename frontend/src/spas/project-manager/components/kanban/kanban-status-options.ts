import type { IssueStatus } from "../../contracts/issue.contracts.js";

export const KANBAN_STATUS_OPTIONS: readonly IssueStatus[] = [
  "ISSUE_STATUS_OPEN",
  "ISSUE_STATUS_IN_PROGRESS",
  "ISSUE_STATUS_BLOCKED",
  "ISSUE_STATUS_CLOSED",
];

export function formatKanbanStatusLabel(status: IssueStatus): string {
  return status.replace("ISSUE_STATUS_", "").toLowerCase().replace("_", " ");
}

