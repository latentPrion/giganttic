import {
  emitBrowserCrossTabEvent,
  subscribeBrowserCrossTabEvent,
} from "./browser-cross-tab-events.js";

const PROJECT_MANAGER_PROJECT_ATTACHMENT_STATE_EVENT =
  "project-manager-project-attachment-state";

export interface ProjectManagerProjectAttachmentStateEventDetail {
  projectId: number;
}

export function emitProjectManagerProjectAttachmentStateEvent(
  detail: ProjectManagerProjectAttachmentStateEventDetail,
): void {
  emitBrowserCrossTabEvent(PROJECT_MANAGER_PROJECT_ATTACHMENT_STATE_EVENT, detail);
}

export function subscribeProjectManagerProjectAttachmentStateEvent(
  handler: (detail: ProjectManagerProjectAttachmentStateEventDetail) => void,
): () => void {
  return subscribeBrowserCrossTabEvent(
    PROJECT_MANAGER_PROJECT_ATTACHMENT_STATE_EVENT,
    handler,
  );
}
