import {
  PROJECT_MANAGER_GANTT_ROUTE_PATH,
  PROJECT_MANAGER_ISSUES_ROUTE_PATH,
  PROJECT_MANAGER_ISSUE_ROUTE_PATH,
  PROJECT_MANAGER_KANBAN_ROUTE_PATH,
  PROJECT_MANAGER_NOTIFICATIONS_ROUTE_PATH,
  PROJECT_MANAGER_ORGANIZATION_ROUTE_PATH,
  PROJECT_MANAGER_ROUTE_PATH,
  PROJECT_MANAGER_TASKS_ROUTE_PATH,
  PROJECT_MANAGER_TASK_ROUTE_PATH,
  PROJECT_MANAGER_TEAM_ROUTE_PATH,
  USER_ROUTE_PATH,
} from "../../../../../common/routes/app-route-paths.js";
import type {
  IssueDetailTab,
  ProjectDetailTab,
  TaskDetailTab,
} from "../contracts/route-query.contracts.js";

export const PROJECT_ROUTE_SECTION_VALUES = [
  "detail",
  "gantt",
  "kanban",
  "issues",
  "tasks",
  "issue-detail",
  "task-detail",
] as const;

export type ProjectRouteSection = typeof PROJECT_ROUTE_SECTION_VALUES[number];

interface CreateProjectDetailRouteOptions {
  attachmentId?: string | null;
  tab?: ProjectDetailTab;
}

function resolveProjectDetailRouteTab(
  options: CreateProjectDetailRouteOptions,
): ProjectDetailTab {
  if (options.attachmentId) {
    return "attachments";
  }

  return options.tab ?? "details";
}

export function createProjectDetailRoute(
  projectId: number,
  options: CreateProjectDetailRouteOptions = {},
): string {
  const parameters = new URLSearchParams();
  parameters.set("projectId", String(projectId));

  const tab = resolveProjectDetailRouteTab(options);
  if (tab !== "details") {
    parameters.set("tab", tab);
  }

  if (options.attachmentId) {
    parameters.set("attachmentId", options.attachmentId);
  }

  return `${PROJECT_MANAGER_ROUTE_PATH}?${parameters.toString()}`;
}

export function createProjectManagerTeamRoute(teamId: number): string {
  return `${PROJECT_MANAGER_TEAM_ROUTE_PATH}?teamId=${teamId}`;
}

export function createProjectManagerOrganizationRoute(organizationId: number): string {
  return `${PROJECT_MANAGER_ORGANIZATION_ROUTE_PATH}?organizationId=${organizationId}`;
}

export function createProjectManagerUserRoute(userId: number): string {
  return `${USER_ROUTE_PATH}?userId=${userId}`;
}

export function createProjectGanttRoute(projectId: number, chartId: number = 0): string {
  return `${PROJECT_MANAGER_GANTT_ROUTE_PATH}?projectId=${projectId}&chartId=${chartId}`;
}

export function createProjectKanbanRoute(projectId: number, chartId: number = 0): string {
  return `${PROJECT_MANAGER_KANBAN_ROUTE_PATH}?projectId=${projectId}&chartId=${chartId}`;
}

export function createProjectIssuesRoute(projectId: number): string {
  return `${PROJECT_MANAGER_ISSUES_ROUTE_PATH}?projectId=${projectId}`;
}

export function createProjectTasksRoute(projectId: number, chartId: number = 0): string {
  return `${PROJECT_MANAGER_TASKS_ROUTE_PATH}?projectId=${projectId}&chartId=${chartId}`;
}

export function createProjectNotificationsRoute(): string {
  return PROJECT_MANAGER_NOTIFICATIONS_ROUTE_PATH;
}

export function createProjectIssueRoute(
  projectId: number,
  issueId: number,
  options: { commentId?: number | null; tab?: IssueDetailTab } = {},
): string {
  const parameters = new URLSearchParams();
  parameters.set("projectId", String(projectId));
  parameters.set("id", String(issueId));

  const tab = options.tab ?? "details";
  if (tab !== "details") {
    parameters.set("tab", tab);
  }

  if (options.commentId != null) {
    parameters.set("commentId", String(options.commentId));
  }

  return `${PROJECT_MANAGER_ISSUE_ROUTE_PATH}?${parameters.toString()}`;
}

export function createProjectTaskRoute(
  projectId: number,
  taskId: string,
  options: { chartId?: number | null; commentId?: number | null; tab?: TaskDetailTab } = {},
): string {
  const parameters = new URLSearchParams();
  parameters.set("projectId", String(projectId));
  parameters.set("id", taskId);
  parameters.set("chartId", String(options.chartId ?? 0));

  const tab = options.tab ?? "details";
  if (tab !== "details") {
    parameters.set("tab", tab);
  }

  if (options.commentId != null) {
    parameters.set("commentId", String(options.commentId));
  }

  return `${PROJECT_MANAGER_TASK_ROUTE_PATH}?${parameters.toString()}`;
}
