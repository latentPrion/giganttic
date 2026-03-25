export function createIssueAttachmentDownloadPath(
  projectId: number,
  issueId: number,
  attachmentId: string,
): string {
  return `/projects/${projectId}/issues/${issueId}/attachments/${attachmentId}/download`;
}
