export function createTaskAttachmentDownloadPath(
  projectId: number,
  chartId: number,
  taskId: string,
  attachmentId: string,
): string {
  return `/projects/${projectId}/charts/${chartId}/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}/download`;
}
