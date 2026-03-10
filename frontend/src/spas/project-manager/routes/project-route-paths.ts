export const PROJECT_ROUTE_SECTION_VALUES = ["detail", "gantt", "issues"] as const;

export type ProjectRouteSection = typeof PROJECT_ROUTE_SECTION_VALUES[number];

export function createProjectDetailRoute(projectId: number): string {
  return `/pm/project?projectId=${projectId}`;
}

export function createProjectGanttRoute(projectId: number): string {
  return `/pm/project/gantt?projectId=${projectId}`;
}

export function createProjectIssuesRoute(projectId: number): string {
  return `/pm/project/issues?projectId=${projectId}`;
}

export function createProjectIssueRoute(projectId: number, issueId: number): string {
  return `/pm/project/issue?projectId=${projectId}&id=${issueId}`;
}
