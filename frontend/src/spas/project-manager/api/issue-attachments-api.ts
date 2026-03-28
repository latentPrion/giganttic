import {
  listIssueAttachmentsResponseSchema,
  deleteIssueAttachmentResponseSchema,
  uploadIssueAttachmentResponseSchema,
  type ListIssueAttachmentsResponse,
  type DeleteIssueAttachmentResponse,
} from "../contracts/issue-comments.contracts.js";
import { createDiscussionAttachmentsApi } from "./discussion-api-factory.js";
import { createIssueAttachmentDownloadPath } from "./issue-attachment-paths.js";

function issueAttachmentsCollectionPath(projectId: number, issueId: number): string {
  return `/projects/${projectId}/issues/${issueId}/attachments`;
}

function issueAttachmentItemPath(
  projectId: number,
  issueId: number,
  attachmentId: string,
): string {
  return `${issueAttachmentsCollectionPath(projectId, issueId)}/${attachmentId}`;
}

export const issueAttachmentsApi = createDiscussionAttachmentsApi<
  number,
  DeleteIssueAttachmentResponse,
  ListIssueAttachmentsResponse,
  { attachment: unknown }
>({
  paths: {
    attachmentItemPath: issueAttachmentItemPath,
    attachmentsCollectionPath: issueAttachmentsCollectionPath,
  },
  schemas: {
    deleteAttachmentResponse: deleteIssueAttachmentResponseSchema,
    listAttachmentsResponse: listIssueAttachmentsResponseSchema,
    uploadAttachmentResponse: uploadIssueAttachmentResponseSchema,
  },
});

export { createIssueAttachmentDownloadPath };
