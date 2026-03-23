# Gantt Chart Milestone Inference

This project treats milestone status as an inferred view concern on the Tasks page.

## Scope

- The Tasks page includes milestone nodes.
- Project summary nodes are excluded.
- Future-start tasks are excluded (`start_date > now`).

## Source of Truth

Milestone status is not read from or written to milestone `ggtc_task_status` or `ggtc_task_closed_reason`.
Those fields are ignored for milestone display inference.

## Inference Rules

The milestone effective status is resolved from dependencies with strict precedence:

1. `ISSUE_STATUS_BLOCKED` if any dependency is blocked.
2. `ISSUE_STATUS_CLOSED` if all dependencies are closed.
3. `ISSUE_STATUS_IN_PROGRESS` otherwise.

### Important details

- A milestone with no dependencies is treated as `ISSUE_STATUS_IN_PROGRESS`.
- Closed reason values do not change milestone inference.
  Any closed dependency counts as closed regardless of reason (`NONE`, `WONTFIX`, `CANTFIX`, `RESOLVED`).
- Past-due milestone dates do not force closure.
  A past-due milestone remains `ISSUE_STATUS_IN_PROGRESS` unless all dependencies are closed.

## Implementation Notes

- Milestone logic is implemented in:
  - `frontend/src/spas/project-manager/lib/milestone-status-inference.ts`
- Tasks-page XML parsing and filtering are implemented in:
  - `frontend/src/spas/project-manager/lib/project-tasks-history-parser.ts`
