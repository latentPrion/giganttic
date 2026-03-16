export const PROJECT_ROUTE_SECTION_VALUES = ["detail", "gantt", "kanban", "issues"] as const;

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
  return `/pm/user?userId=${userId}`;
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

export function createProjectIssueRoute(projectId: number, issueId: number): string {
  return `/pm/project/issue?projectId=${projectId}&id=${issueId}`;
}
