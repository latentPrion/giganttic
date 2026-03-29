import {
  emitBrowserCrossTabEvent,
  subscribeBrowserCrossTabEvent,
} from "./browser-cross-tab-events.js";

const PROJECT_MANAGER_ISSUE_JOURNAL_UPDATED_EVENT =
  "project-manager-issue-journal-updated";

export interface ProjectManagerIssueJournalUpdatedEventDetail {
  issueId: number;
  projectId: number;
}

export function emitProjectManagerIssueJournalUpdatedEvent(
  detail: ProjectManagerIssueJournalUpdatedEventDetail,
): void {
  emitBrowserCrossTabEvent(PROJECT_MANAGER_ISSUE_JOURNAL_UPDATED_EVENT, detail);
}

export function subscribeProjectManagerIssueJournalUpdatedEvent(
  handler: (detail: ProjectManagerIssueJournalUpdatedEventDetail) => void,
): () => void {
  return subscribeBrowserCrossTabEvent(
    PROJECT_MANAGER_ISSUE_JOURNAL_UPDATED_EVENT,
    handler,
  );
}
