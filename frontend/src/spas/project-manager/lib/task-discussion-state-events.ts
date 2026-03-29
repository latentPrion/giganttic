import {
  emitBrowserCrossTabEvent,
  subscribeBrowserCrossTabEvent,
} from "./browser-cross-tab-events.js";

const PROJECT_MANAGER_TASK_DISCUSSION_STATE_EVENT =
  "project-manager-task-discussion-state";

export interface ProjectManagerTaskDiscussionStateEventDetail {
  projectId: number;
  taskId: string;
}

export function emitProjectManagerTaskDiscussionStateEvent(
  detail: ProjectManagerTaskDiscussionStateEventDetail,
): void {
  emitBrowserCrossTabEvent(PROJECT_MANAGER_TASK_DISCUSSION_STATE_EVENT, detail);
}

export function subscribeProjectManagerTaskDiscussionStateEvent(
  handler: (detail: ProjectManagerTaskDiscussionStateEventDetail) => void,
): () => void {
  return subscribeBrowserCrossTabEvent(
    PROJECT_MANAGER_TASK_DISCUSSION_STATE_EVENT,
    handler,
  );
}
