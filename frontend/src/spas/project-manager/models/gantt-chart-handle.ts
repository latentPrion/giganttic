export type GanttTaskId = string | number;

export interface GanttChartHandle {
  addRootTask(): void;
  addChildTask(): void;
  deleteSelectedTask(): void;
  editSelectedTask(): void;
  getSelectedTaskId(): GanttTaskId | null;
  getSerializedXml(): string;
}
