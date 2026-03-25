import {
  postMultipartAndParseJson,
  requestJson,
} from "../../../common/api/http-client.js";
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

export const issueCommentsApi = {
  async createComment(
    token: string,
    projectId: number,
    issueId: number,
    payload: CreateIssueCommentRequest,
  ): Promise<GetIssueCommentResponse> {
    return await requestJson({
      body: payload,
      method: "POST",
      path: issueCommentsCollectionPath(projectId, issueId),
      requestSchema: createIssueCommentRequestSchema,
      responseSchema: getIssueCommentResponseSchema,
      token,
    });
  },

  async deleteComment(
    token: string,
    projectId: number,
    issueId: number,
    commentId: number,
  ): Promise<DeleteIssueCommentResponse> {
    return await requestJson({
      method: "DELETE",
      path: issueCommentItemPath(projectId, issueId, commentId),
      responseSchema: deleteIssueCommentResponseSchema,
      token,
    });
  },

  async getComment(
    token: string,
    projectId: number,
    issueId: number,
    commentId: number,
  ): Promise<GetIssueCommentResponse> {
    return await requestJson({
      method: "GET",
      path: issueCommentItemPath(projectId, issueId, commentId),
      responseSchema: getIssueCommentResponseSchema,
      token,
    });
  },

  async listComments(
    token: string,
    projectId: number,
    issueId: number,
  ): Promise<ListIssueCommentsResponse> {
    return await requestJson({
      method: "GET",
      path: issueCommentsCollectionPath(projectId, issueId),
      responseSchema: listIssueCommentsResponseSchema,
      token,
    });
  },

  async updateComment(
    token: string,
    projectId: number,
    issueId: number,
    commentId: number,
    payload: UpdateIssueCommentRequest,
  ): Promise<GetIssueCommentResponse> {
    return await requestJson({
      body: payload,
      method: "PATCH",
      path: issueCommentItemPath(projectId, issueId, commentId),
      requestSchema: updateIssueCommentRequestSchema,
      responseSchema: getIssueCommentResponseSchema,
      token,
    });
  },

  async uploadCommentAttachment(
    token: string,
    projectId: number,
    issueId: number,
    commentId: number,
    file: File,
  ) {
    const formData = new FormData();
    formData.append("file", file);
    return await postMultipartAndParseJson({
      formData,
      path: issueCommentAttachmentsPath(projectId, issueId, commentId),
      responseSchema: uploadIssueAttachmentResponseSchema,
      token,
    });
  },

  async deleteCommentAttachment(
    token: string,
    projectId: number,
    issueId: number,
    commentId: number,
    attachmentId: string,
  ): Promise<DeleteIssueAttachmentResponse> {
    return await requestJson({
      method: "DELETE",
      path: issueCommentAttachmentItemPath(projectId, issueId, commentId, attachmentId),
      responseSchema: deleteIssueAttachmentResponseSchema,
      token,
    });
  },
};
