export function createTaskCommentAttachmentDownloadPath(
  projectId: number,
  taskId: string,
  commentId: number,
  attachmentId: string,
): string {
  return `/projects/${projectId}/tasks/${encodeURIComponent(taskId)}/comments/${commentId}/attachments/${encodeURIComponent(attachmentId)}/download`;
}
