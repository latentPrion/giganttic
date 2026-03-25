import {
  postMultipartAndParseJson,
  requestJson,
} from "../../../common/api/http-client.js";
import {
  listIssueAttachmentsResponseSchema,
  uploadIssueAttachmentResponseSchema,
  type ListIssueAttachmentsResponse,
} from "../contracts/issue-comments.contracts.js";
import { createIssueAttachmentDownloadPath } from "./issue-attachment-paths.js";

function issueAttachmentsCollectionPath(projectId: number, issueId: number): string {
  return `/projects/${projectId}/issues/${issueId}/attachments`;
}

export const issueAttachmentsApi = {
  async listAttachments(
    token: string,
    projectId: number,
    issueId: number,
  ): Promise<ListIssueAttachmentsResponse> {
    return await requestJson({
      method: "GET",
      path: issueAttachmentsCollectionPath(projectId, issueId),
      responseSchema: listIssueAttachmentsResponseSchema,
      token,
    });
  },

  async uploadAttachment(
    token: string,
    projectId: number,
    issueId: number,
    file: File,
  ) {
    const formData = new FormData();
    formData.append("file", file);
    return await postMultipartAndParseJson({
      formData,
      path: issueAttachmentsCollectionPath(projectId, issueId),
      responseSchema: uploadIssueAttachmentResponseSchema,
      token,
    });
  },
};

export { createIssueAttachmentDownloadPath };
