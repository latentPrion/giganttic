export const PROJECT_VIEW_MODES = [
  "detail",
  "gantt",
] as const;

export type ProjectViewMode = typeof PROJECT_VIEW_MODES[number];
