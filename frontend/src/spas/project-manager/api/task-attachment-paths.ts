export function createTaskAttachmentDownloadPath(
  projectId: number,
  taskId: string,
  attachmentId: string,
): string {
  return `/projects/${projectId}/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}/download`;
}
