export type GanttTaskId = string | number;
export type GanttTaskType = "task" | "project" | "milestone";

export interface GanttSelectedTask {
  id: GanttTaskId;
  type: GanttTaskType;
}

export interface GanttChartHandle {
  addRootTask(): void;
  addChildTask(): void;
  addRootMilestone(): void;
  addChildMilestone(): void;
  convertSelectedMilestoneToTask(): void;
  convertSelectedTaskToMilestone(): void;
  deleteSelectedTask(): void;
  editSelectedTask(): void;
  getSelectedTask(): GanttSelectedTask | null;
  getSerializedXml(): string;
}
