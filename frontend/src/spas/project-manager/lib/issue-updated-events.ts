export const PROJECT_MANAGER_ISSUE_UPDATED_EVENT = "project-manager-issue-updated";

export interface ProjectManagerIssueUpdatedEventDetail {
  issueId: number;
  projectId: number;
}

export function emitProjectManagerIssueUpdatedEvent(
  detail: ProjectManagerIssueUpdatedEventDetail,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ProjectManagerIssueUpdatedEventDetail>(PROJECT_MANAGER_ISSUE_UPDATED_EVENT, {
      detail,
    }),
  );
}

export function subscribeProjectManagerIssueUpdatedEvent(
  handler: (detail: ProjectManagerIssueUpdatedEventDetail) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = (event: Event): void => {
    const customEvent = event as CustomEvent<ProjectManagerIssueUpdatedEventDetail>;
    if (!customEvent.detail) {
      return;
    }
    handler(customEvent.detail);
  };

  window.addEventListener(PROJECT_MANAGER_ISSUE_UPDATED_EVENT, listener);
  return () => window.removeEventListener(PROJECT_MANAGER_ISSUE_UPDATED_EVENT, listener);
}

