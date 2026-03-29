import {
  ISSUE_ATTACHMENTS_SECTION_ANCHOR,
  ISSUE_JOURNAL_SECTION_ANCHOR,
  PROJECT_ATTACHMENTS_SECTION_ANCHOR,
  PROJECT_JOURNAL_SECTION_ANCHOR,
  TASK_ATTACHMENTS_SECTION_ANCHOR,
  TASK_JOURNAL_SECTION_ANCHOR,
} from "../../../../../common/notifications/notification-targets.js";
import type { IssueDetailTab, TaskDetailTab } from "../contracts/route-query.contracts.js";

export {
  ISSUE_ATTACHMENTS_SECTION_ANCHOR,
  ISSUE_JOURNAL_SECTION_ANCHOR,
  PROJECT_ATTACHMENTS_SECTION_ANCHOR,
  PROJECT_JOURNAL_SECTION_ANCHOR,
  TASK_ATTACHMENTS_SECTION_ANCHOR,
  TASK_JOURNAL_SECTION_ANCHOR,
};

type ProjectDetailTab = "attachments" | "details";

function normalizeAnchor(hash: string | undefined | null): string {
  return (hash ?? "").trim().replace(/^#/, "");
}

export function inferProjectTabFromAnchor(hash: string | undefined | null): ProjectDetailTab | null {
  const normalized = normalizeAnchor(hash);
  if (normalized === PROJECT_JOURNAL_SECTION_ANCHOR) {
    return "details";
  }
  if (normalized === PROJECT_ATTACHMENTS_SECTION_ANCHOR) {
    return "attachments";
  }
  return null;
}

export function inferIssueTabFromAnchor(hash: string | undefined | null): IssueDetailTab | null {
  const normalized = normalizeAnchor(hash);
  if (normalized === ISSUE_JOURNAL_SECTION_ANCHOR) {
    return "details";
  }
  if (normalized === ISSUE_ATTACHMENTS_SECTION_ANCHOR) {
    return "attachments";
  }
  return null;
}

export function inferTaskTabFromAnchor(hash: string | undefined | null): TaskDetailTab | null {
  const normalized = normalizeAnchor(hash);
  if (normalized === TASK_JOURNAL_SECTION_ANCHOR) {
    return "details";
  }
  if (normalized === TASK_ATTACHMENTS_SECTION_ANCHOR) {
    return "attachments";
  }
  return null;
}
