export function createProjectAttachmentDownloadPath(
  projectId: number,
  attachmentId: string,
): string {
  return `/projects/${projectId}/attachments/${encodeURIComponent(attachmentId)}/download`;
}
