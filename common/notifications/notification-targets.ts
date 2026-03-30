const PROJECT_ROUTE_PREFIX = "/pm/project";
const ISSUE_ROUTE_PREFIX = "/pm/project/issue";
const TASK_ROUTE_PREFIX = "/pm/project/task";
const NOTIFICATIONS_ROUTE_PREFIX = "/pm/notifications";

export const PROJECT_JOURNAL_SECTION_ANCHOR = "project-journal";
export const PROJECT_ATTACHMENTS_SECTION_ANCHOR = "project-attachments";
export const ISSUE_JOURNAL_SECTION_ANCHOR = "issue-journal";
export const ISSUE_ATTACHMENTS_SECTION_ANCHOR = "issue-attachments";
export const TASK_JOURNAL_SECTION_ANCHOR = "task-journal";
export const TASK_ATTACHMENTS_SECTION_ANCHOR = "task-attachments";

function createQueryString(
  values: Record<string, number | string | null | undefined>,
): string {
  const parameters = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) {
      continue;
    }
    parameters.set(key, String(value));
  }

  return parameters.toString();
}

function appendHash(path: string, hash: string | null): string {
  return hash ? `${path}#${hash}` : path;
}

export function createNotificationsRoute(): string {
  return NOTIFICATIONS_ROUTE_PREFIX;
}

export function createProjectNotificationTarget(
  projectId: number,
  options: { hash?: string | null } = {},
): string {
  const query = createQueryString({ projectId });
  return appendHash(`${PROJECT_ROUTE_PREFIX}?${query}`, options.hash ?? null);
}

export function createProjectJournalNotificationTarget(projectId: number): string {
  return createProjectNotificationTarget(projectId, {
    hash: PROJECT_JOURNAL_SECTION_ANCHOR,
  });
}

export function createProjectAttachmentsNotificationTarget(projectId: number): string {
  return createProjectNotificationTarget(projectId, {
    hash: PROJECT_ATTACHMENTS_SECTION_ANCHOR,
  });
}

export function createIssueNotificationTarget(
  projectId: number,
  issueId: number,
  options: {
    commentId?: number | null;
    hash?: string | null;
    tab?: "attachments" | "comments" | "details";
  } = {},
): string {
  const query = createQueryString({
    commentId: options.commentId ?? null,
    id: issueId,
    projectId,
    tab: options.tab ?? null,
  });
  return appendHash(`${ISSUE_ROUTE_PREFIX}?${query}`, options.hash ?? null);
}

export function createIssueDetailsNotificationTarget(
  projectId: number,
  issueId: number,
): string {
  return createIssueNotificationTarget(projectId, issueId, {
    tab: "details",
  });
}

export function createIssueCommentNotificationTarget(
  projectId: number,
  issueId: number,
  commentId: number,
): string {
  return createIssueNotificationTarget(projectId, issueId, {
    commentId,
    tab: "comments",
  });
}

export function createIssueJournalNotificationTarget(
  projectId: number,
  issueId: number,
): string {
  return createIssueNotificationTarget(projectId, issueId, {
    hash: ISSUE_JOURNAL_SECTION_ANCHOR,
  });
}

export function createIssueAttachmentsNotificationTarget(
  projectId: number,
  issueId: number,
): string {
  return createIssueNotificationTarget(projectId, issueId, {
    hash: ISSUE_ATTACHMENTS_SECTION_ANCHOR,
    tab: "attachments",
  });
}

export function createTaskNotificationTarget(
  projectId: number,
  taskId: string,
  options: {
    commentId?: number | null;
    hash?: string | null;
    tab?: "attachments" | "comments" | "details";
  } = {},
): string {
  const query = createQueryString({
    commentId: options.commentId ?? null,
    id: taskId,
    projectId,
    tab: options.tab ?? null,
  });
  return appendHash(`${TASK_ROUTE_PREFIX}?${query}`, options.hash ?? null);
}

export function createTaskDetailsNotificationTarget(
  projectId: number,
  taskId: string,
): string {
  return createTaskNotificationTarget(projectId, taskId, {
    tab: "details",
  });
}

export function createTaskCommentNotificationTarget(
  projectId: number,
  taskId: string,
  commentId: number,
): string {
  return createTaskNotificationTarget(projectId, taskId, {
    commentId,
    tab: "comments",
  });
}

export function createTaskJournalNotificationTarget(
  projectId: number,
  taskId: string,
): string {
  return createTaskNotificationTarget(projectId, taskId, {
    hash: TASK_JOURNAL_SECTION_ANCHOR,
  });
}

export function createTaskAttachmentsNotificationTarget(
  projectId: number,
  taskId: string,
): string {
  return createTaskNotificationTarget(projectId, taskId, {
    hash: TASK_ATTACHMENTS_SECTION_ANCHOR,
    tab: "attachments",
  });
}
