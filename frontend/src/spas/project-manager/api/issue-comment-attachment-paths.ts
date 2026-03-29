export function createIssueCommentAttachmentDownloadPath(
  projectId: number,
  issueId: number,
  commentId: number,
  attachmentId: string,
): string {
  return `/projects/${projectId}/issues/${issueId}/comments/${commentId}/attachments/${attachmentId}/download`;
}
