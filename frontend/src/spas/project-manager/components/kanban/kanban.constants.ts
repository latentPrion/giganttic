import type { KanbanColumnValue } from "./kanban.types.js";

export const KANBAN_COLUMN_VALUES: KanbanColumnValue[] = [
  "ISSUE_STATUS_OPEN",
  "ISSUE_STATUS_IN_PROGRESS",
  "ISSUE_STATUS_BLOCKED",
  "ISSUE_STATUS_CLOSED",
];

export const KANBAN_COLUMN_LABELS: Record<KanbanColumnValue, string> = {
  ISSUE_STATUS_BLOCKED: "Blocked",
  ISSUE_STATUS_CLOSED: "Closed",
  ISSUE_STATUS_IN_PROGRESS: "In Progress",
  ISSUE_STATUS_OPEN: "Open",
};

export const KANBAN_EMPTY_COLUMN_MESSAGE = "No cards in this column yet.";
