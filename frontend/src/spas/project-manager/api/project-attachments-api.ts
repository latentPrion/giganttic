import {
  deleteDiscussionAttachmentResponseSchema,
  listDiscussionAttachmentsResponseSchema,
  uploadDiscussionAttachmentResponseSchema,
  type DeleteDiscussionAttachmentResponse,
  type ListDiscussionAttachmentsResponse,
  type UploadDiscussionAttachmentResponse,
} from "../../../../../common/discussion/discussion.contracts.js";
import {
  postMultipartAndParseJson,
  requestJson,
} from "../../../common/api/http-client.js";

function createAttachmentsPath(projectId: number, attachmentId?: string): string {
  return attachmentId === undefined
    ? `/projects/${projectId}/attachments`
    : `/projects/${projectId}/attachments/${encodeURIComponent(attachmentId)}`;
}

function createMultipartFormData(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export const projectAttachmentsApi = {
  async listAttachments(
    token: string,
    projectId: number,
  ): Promise<ListDiscussionAttachmentsResponse> {
    return await requestJson({
      method: "GET",
      path: createAttachmentsPath(projectId),
      responseSchema: listDiscussionAttachmentsResponseSchema,
      token,
    });
  },

  async uploadAttachment(
    token: string,
    projectId: number,
    file: File,
  ): Promise<UploadDiscussionAttachmentResponse> {
    return await postMultipartAndParseJson({
      formData: createMultipartFormData(file),
      path: createAttachmentsPath(projectId),
      responseSchema: uploadDiscussionAttachmentResponseSchema,
      token,
    });
  },

  async deleteAttachment(
    token: string,
    projectId: number,
    attachmentId: string,
  ): Promise<DeleteDiscussionAttachmentResponse> {
    return await requestJson({
      method: "DELETE",
      path: createAttachmentsPath(projectId, attachmentId),
      responseSchema: deleteDiscussionAttachmentResponseSchema,
      token,
    });
  },
};
