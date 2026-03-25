import type { IssueDetailTab } from "../contracts/route-query.contracts.js";

export const PROJECT_ROUTE_SECTION_VALUES = ["detail", "gantt", "kanban", "issues", "tasks"] as const;

export type ProjectRouteSection = typeof PROJECT_ROUTE_SECTION_VALUES[number];

export function createProjectDetailRoute(projectId: number): string {
  return `/pm/project?projectId=${projectId}`;
}

export function createProjectManagerTeamRoute(teamId: number): string {
  return `/pm/team?teamId=${teamId}`;
}

export function createProjectManagerOrganizationRoute(organizationId: number): string {
  return `/pm/organization?organizationId=${organizationId}`;
}

export function createProjectManagerUserRoute(userId: number): string {
  return `/user?userId=${userId}`;
}

export function createProjectGanttRoute(projectId: number): string {
  return `/pm/project/gantt?projectId=${projectId}`;
}

export function createProjectKanbanRoute(projectId: number): string {
  return `/pm/project/kanban?projectId=${projectId}`;
}

export function createProjectIssuesRoute(projectId: number): string {
  return `/pm/project/issues?projectId=${projectId}`;
}

export function createProjectTasksRoute(projectId: number): string {
  return `/pm/project/tasks?projectId=${projectId}`;
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

  return `/pm/project/issue?${parameters.toString()}`;
}
