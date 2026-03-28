import { z } from "zod";

import {
  postMultipartAndParseJson,
  requestJson,
} from "../../../common/api/http-client.js";

interface DiscussionCommentsPathBuilder<SubjectId> {
  commentAttachmentItemPath: (
    projectId: number,
    subjectId: SubjectId,
    commentId: number,
    attachmentId: string,
  ) => string;
  commentAttachmentsPath: (
    projectId: number,
    subjectId: SubjectId,
    commentId: number,
  ) => string;
  commentItemPath: (
    projectId: number,
    subjectId: SubjectId,
    commentId: number,
  ) => string;
  commentsCollectionPath: (projectId: number, subjectId: SubjectId) => string;
}

interface DiscussionAttachmentsPathBuilder<SubjectId> {
  attachmentItemPath: (
    projectId: number,
    subjectId: SubjectId,
    attachmentId: string,
  ) => string;
  attachmentsCollectionPath: (projectId: number, subjectId: SubjectId) => string;
}

interface DiscussionCommentsApiFactoryOptions<
  SubjectId,
  CreateCommentRequest,
  DeleteCommentResponse,
  DeleteAttachmentResponse,
  GetCommentResponse,
  ListCommentsResponse,
  UpdateCommentRequest,
  UploadAttachmentResponse,
> {
  paths: DiscussionCommentsPathBuilder<SubjectId>;
  schemas: {
    createCommentRequest: z.ZodType<CreateCommentRequest>;
    deleteAttachmentResponse: z.ZodType<DeleteAttachmentResponse>;
    deleteCommentResponse: z.ZodType<DeleteCommentResponse>;
    getCommentResponse: z.ZodType<GetCommentResponse>;
    listCommentsResponse: z.ZodType<ListCommentsResponse>;
    updateCommentRequest: z.ZodType<UpdateCommentRequest>;
    uploadAttachmentResponse: z.ZodType<UploadAttachmentResponse>;
  };
}

interface DiscussionAttachmentsApiFactoryOptions<
  SubjectId,
  DeleteAttachmentResponse,
  ListAttachmentsResponse,
  UploadAttachmentResponse,
> {
  paths: DiscussionAttachmentsPathBuilder<SubjectId>;
  schemas: {
    deleteAttachmentResponse: z.ZodType<DeleteAttachmentResponse>;
    listAttachmentsResponse: z.ZodType<ListAttachmentsResponse>;
    uploadAttachmentResponse: z.ZodType<UploadAttachmentResponse>;
  };
}

function createMultipartFormData(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}

export function createDiscussionCommentsApi<
  SubjectId,
  CreateCommentRequest,
  DeleteCommentResponse,
  DeleteAttachmentResponse,
  GetCommentResponse,
  ListCommentsResponse,
  UpdateCommentRequest,
  UploadAttachmentResponse,
>(
  options: DiscussionCommentsApiFactoryOptions<
    SubjectId,
    CreateCommentRequest,
    DeleteCommentResponse,
    DeleteAttachmentResponse,
    GetCommentResponse,
    ListCommentsResponse,
    UpdateCommentRequest,
    UploadAttachmentResponse
  >,
) {
  const { paths, schemas } = options;

  return {
    async createComment(
      token: string,
      projectId: number,
      subjectId: SubjectId,
      payload: CreateCommentRequest,
    ): Promise<GetCommentResponse> {
      return await requestJson({
        body: payload,
        method: "POST",
        path: paths.commentsCollectionPath(projectId, subjectId),
        requestSchema: schemas.createCommentRequest,
        responseSchema: schemas.getCommentResponse,
        token,
      });
    },

    async deleteComment(
      token: string,
      projectId: number,
      subjectId: SubjectId,
      commentId: number,
    ): Promise<DeleteCommentResponse> {
      return await requestJson({
        method: "DELETE",
        path: paths.commentItemPath(projectId, subjectId, commentId),
        responseSchema: schemas.deleteCommentResponse,
        token,
      });
    },

    async getComment(
      token: string,
      projectId: number,
      subjectId: SubjectId,
      commentId: number,
    ): Promise<GetCommentResponse> {
      return await requestJson({
        method: "GET",
        path: paths.commentItemPath(projectId, subjectId, commentId),
        responseSchema: schemas.getCommentResponse,
        token,
      });
    },

    async listComments(
      token: string,
      projectId: number,
      subjectId: SubjectId,
    ): Promise<ListCommentsResponse> {
      return await requestJson({
        method: "GET",
        path: paths.commentsCollectionPath(projectId, subjectId),
        responseSchema: schemas.listCommentsResponse,
        token,
      });
    },

    async updateComment(
      token: string,
      projectId: number,
      subjectId: SubjectId,
      commentId: number,
      payload: UpdateCommentRequest,
    ): Promise<GetCommentResponse> {
      return await requestJson({
        body: payload,
        method: "PATCH",
        path: paths.commentItemPath(projectId, subjectId, commentId),
        requestSchema: schemas.updateCommentRequest,
        responseSchema: schemas.getCommentResponse,
        token,
      });
    },

    async uploadCommentAttachment(
      token: string,
      projectId: number,
      subjectId: SubjectId,
      commentId: number,
      file: File,
    ): Promise<UploadAttachmentResponse> {
      return await postMultipartAndParseJson({
        formData: createMultipartFormData(file),
        path: paths.commentAttachmentsPath(projectId, subjectId, commentId),
        responseSchema: schemas.uploadAttachmentResponse,
        token,
      });
    },

    async deleteCommentAttachment(
      token: string,
      projectId: number,
      subjectId: SubjectId,
      commentId: number,
      attachmentId: string,
    ): Promise<DeleteAttachmentResponse> {
      return await requestJson({
        method: "DELETE",
        path: paths.commentAttachmentItemPath(
          projectId,
          subjectId,
          commentId,
          attachmentId,
        ),
        responseSchema: schemas.deleteAttachmentResponse,
        token,
      });
    },
  };
}

export function createDiscussionAttachmentsApi<
  SubjectId,
  DeleteAttachmentResponse,
  ListAttachmentsResponse,
  UploadAttachmentResponse,
>(
  options: DiscussionAttachmentsApiFactoryOptions<
    SubjectId,
    DeleteAttachmentResponse,
    ListAttachmentsResponse,
    UploadAttachmentResponse
  >,
) {
  const { paths, schemas } = options;

  return {
    async listAttachments(
      token: string,
      projectId: number,
      subjectId: SubjectId,
    ): Promise<ListAttachmentsResponse> {
      return await requestJson({
        method: "GET",
        path: paths.attachmentsCollectionPath(projectId, subjectId),
        responseSchema: schemas.listAttachmentsResponse,
        token,
      });
    },

    async uploadAttachment(
      token: string,
      projectId: number,
      subjectId: SubjectId,
      file: File,
    ): Promise<UploadAttachmentResponse> {
      return await postMultipartAndParseJson({
        formData: createMultipartFormData(file),
        path: paths.attachmentsCollectionPath(projectId, subjectId),
        responseSchema: schemas.uploadAttachmentResponse,
        token,
      });
    },

    async deleteAttachment(
      token: string,
      projectId: number,
      subjectId: SubjectId,
      attachmentId: string,
    ): Promise<DeleteAttachmentResponse> {
      return await requestJson({
        method: "DELETE",
        path: paths.attachmentItemPath(projectId, subjectId, attachmentId),
        responseSchema: schemas.deleteAttachmentResponse,
        token,
      });
    },
  };
}
