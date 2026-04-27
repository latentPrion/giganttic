export interface MentionContainerDescriptor {
  chartId: number | null;
  commentId: number | null;
  issueId: number | null;
  mentionContainerType: string;
  projectId: number;
  taskId: string | null;
}

const NULL_CONTAINER_SEGMENT = "-";

function normalizeContainerSegment(value: number | string | null): string {
  return value === null ? NULL_CONTAINER_SEGMENT : String(value);
}

export function createMentionContainerKey(
  container: MentionContainerDescriptor,
): string {
  return [
    String(container.projectId),
    normalizeContainerSegment(container.chartId),
    normalizeContainerSegment(container.issueId),
    normalizeContainerSegment(container.taskId),
    normalizeContainerSegment(container.commentId),
  ].join(":");
}
