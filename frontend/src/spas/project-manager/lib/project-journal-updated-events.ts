import {
  emitBrowserCrossTabEvent,
  subscribeBrowserCrossTabEvent,
} from "./browser-cross-tab-events.js";

const PROJECT_MANAGER_PROJECT_JOURNAL_UPDATED_EVENT =
  "project-manager-project-journal-updated";

export interface ProjectManagerProjectJournalUpdatedEventDetail {
  projectId: number;
}

export function emitProjectManagerProjectJournalUpdatedEvent(
  detail: ProjectManagerProjectJournalUpdatedEventDetail,
): void {
  emitBrowserCrossTabEvent(PROJECT_MANAGER_PROJECT_JOURNAL_UPDATED_EVENT, detail);
}

export function subscribeProjectManagerProjectJournalUpdatedEvent(
  handler: (detail: ProjectManagerProjectJournalUpdatedEventDetail) => void,
): () => void {
  return subscribeBrowserCrossTabEvent(
    PROJECT_MANAGER_PROJECT_JOURNAL_UPDATED_EVENT,
    handler,
  );
}
