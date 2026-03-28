import {
  createIssueCommentRequestSchema,
  deleteIssueCommentResponseSchema,
  deleteIssueAttachmentResponseSchema,
  getIssueCommentResponseSchema,
  listIssueCommentsResponseSchema,
  updateIssueCommentRequestSchema,
  uploadIssueAttachmentResponseSchema,
  type CreateIssueCommentRequest,
  type DeleteIssueCommentResponse,
  type DeleteIssueAttachmentResponse,
  type GetIssueCommentResponse,
  type ListIssueCommentsResponse,
  type UpdateIssueCommentRequest,
} from "../contracts/issue-comments.contracts.js";
import { createDiscussionCommentsApi } from "./discussion-api-factory.js";

function issueCommentsCollectionPath(projectId: number, issueId: number): string {
  return `/projects/${projectId}/issues/${issueId}/comments`;
}

function issueCommentItemPath(
  projectId: number,
  issueId: number,
  commentId: number,
): string {
  return `${issueCommentsCollectionPath(projectId, issueId)}/${commentId}`;
}

function issueCommentAttachmentsPath(
  projectId: number,
  issueId: number,
  commentId: number,
): string {
  return `${issueCommentItemPath(projectId, issueId, commentId)}/attachments`;
}

function issueCommentAttachmentItemPath(
  projectId: number,
  issueId: number,
  commentId: number,
  attachmentId: string,
): string {
  return `${issueCommentAttachmentsPath(projectId, issueId, commentId)}/${attachmentId}`;
}

export const issueCommentsApi = createDiscussionCommentsApi<
  number,
  CreateIssueCommentRequest,
  DeleteIssueCommentResponse,
  DeleteIssueAttachmentResponse,
  GetIssueCommentResponse,
  ListIssueCommentsResponse,
  UpdateIssueCommentRequest,
  { attachment: unknown }
>({
  paths: {
    commentAttachmentItemPath: issueCommentAttachmentItemPath,
    commentAttachmentsPath: issueCommentAttachmentsPath,
    commentItemPath: issueCommentItemPath,
    commentsCollectionPath: issueCommentsCollectionPath,
  },
  schemas: {
    createCommentRequest: createIssueCommentRequestSchema,
    deleteAttachmentResponse: deleteIssueAttachmentResponseSchema,
    deleteCommentResponse: deleteIssueCommentResponseSchema,
    getCommentResponse: getIssueCommentResponseSchema,
    listCommentsResponse: listIssueCommentsResponseSchema,
    updateCommentRequest: updateIssueCommentRequestSchema,
    uploadAttachmentResponse: uploadIssueAttachmentResponseSchema,
  },
});
