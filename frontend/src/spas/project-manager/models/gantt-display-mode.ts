export const GANTT_DISPLAY_MODES = [
  "both",
  "grid",
  "chart",
] as const;

export type GanttDisplayMode = typeof GANTT_DISPLAY_MODES[number];
