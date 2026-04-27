export function createTaskCommentAttachmentDownloadPath(
  projectId: number,
  chartId: number,
  taskId: string,
  commentId: number,
  attachmentId: string,
): string {
  return `/projects/${projectId}/charts/${chartId}/tasks/${encodeURIComponent(taskId)}/comments/${commentId}/attachments/${encodeURIComponent(attachmentId)}/download`;
}
