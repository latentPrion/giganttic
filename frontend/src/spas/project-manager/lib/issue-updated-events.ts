import {
  emitBrowserCrossTabEvent,
  subscribeBrowserCrossTabEvent,
} from "./browser-cross-tab-events.js";

export const PROJECT_MANAGER_ISSUE_UPDATED_EVENT = "project-manager-issue-updated";

export interface ProjectManagerIssueUpdatedEventDetail {
  issueId: number;
  projectId: number;
}

export function emitProjectManagerIssueUpdatedEvent(
  detail: ProjectManagerIssueUpdatedEventDetail,
): void {
  emitBrowserCrossTabEvent(PROJECT_MANAGER_ISSUE_UPDATED_EVENT, detail);
}

export function subscribeProjectManagerIssueUpdatedEvent(
  handler: (detail: ProjectManagerIssueUpdatedEventDetail) => void,
): () => void {
  return subscribeBrowserCrossTabEvent(PROJECT_MANAGER_ISSUE_UPDATED_EVENT, handler);
}
