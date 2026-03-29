import {
  emitBrowserCrossTabEvent,
  subscribeBrowserCrossTabEvent,
} from "./browser-cross-tab-events.js";

const PROJECT_MANAGER_ISSUE_DISCUSSION_STATE_EVENT =
  "project-manager-issue-discussion-state";

export interface ProjectManagerIssueDiscussionStateEventDetail {
  issueId: number;
  projectId: number;
}

export function emitProjectManagerIssueDiscussionStateEvent(
  detail: ProjectManagerIssueDiscussionStateEventDetail,
): void {
  emitBrowserCrossTabEvent(PROJECT_MANAGER_ISSUE_DISCUSSION_STATE_EVENT, detail);
}

export function subscribeProjectManagerIssueDiscussionStateEvent(
  handler: (detail: ProjectManagerIssueDiscussionStateEventDetail) => void,
): () => void {
  return subscribeBrowserCrossTabEvent(
    PROJECT_MANAGER_ISSUE_DISCUSSION_STATE_EVENT,
    handler,
  );
}
