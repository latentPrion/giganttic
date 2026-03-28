import {
  createTaskCommentRequestSchema,
  deleteTaskAttachmentResponseSchema,
  deleteTaskCommentResponseSchema,
  getTaskCommentResponseSchema,
  listTaskCommentsResponseSchema,
  updateTaskCommentRequestSchema,
  uploadTaskAttachmentResponseSchema,
  type CreateTaskCommentRequest,
  type DeleteTaskAttachmentResponse,
  type DeleteTaskCommentResponse,
  type GetTaskCommentResponse,
  type ListTaskCommentsResponse,
  type UpdateTaskCommentRequest,
} from "../contracts/task-comments.contracts.js";
import { createDiscussionCommentsApi } from "./discussion-api-factory.js";

function taskCommentsCollectionPath(projectId: number, taskId: string): string {
  return `/projects/${projectId}/tasks/${encodeURIComponent(taskId)}/comments`;
}

function taskCommentItemPath(
  projectId: number,
  taskId: string,
  commentId: number,
): string {
  return `${taskCommentsCollectionPath(projectId, taskId)}/${commentId}`;
}

function taskCommentAttachmentsPath(
  projectId: number,
  taskId: string,
  commentId: number,
): string {
  return `${taskCommentItemPath(projectId, taskId, commentId)}/attachments`;
}

function taskCommentAttachmentItemPath(
  projectId: number,
  taskId: string,
  commentId: number,
  attachmentId: string,
): string {
  return `${taskCommentAttachmentsPath(projectId, taskId, commentId)}/${encodeURIComponent(attachmentId)}`;
}

export const taskCommentsApi = createDiscussionCommentsApi<
  string,
  CreateTaskCommentRequest,
  DeleteTaskCommentResponse,
  DeleteTaskAttachmentResponse,
  GetTaskCommentResponse,
  ListTaskCommentsResponse,
  UpdateTaskCommentRequest,
  { attachment: unknown }
>({
  paths: {
    commentAttachmentItemPath: taskCommentAttachmentItemPath,
    commentAttachmentsPath: taskCommentAttachmentsPath,
    commentItemPath: taskCommentItemPath,
    commentsCollectionPath: taskCommentsCollectionPath,
  },
  schemas: {
    createCommentRequest: createTaskCommentRequestSchema,
    deleteAttachmentResponse: deleteTaskAttachmentResponseSchema,
    deleteCommentResponse: deleteTaskCommentResponseSchema,
    getCommentResponse: getTaskCommentResponseSchema,
    listCommentsResponse: listTaskCommentsResponseSchema,
    updateCommentRequest: updateTaskCommentRequestSchema,
    uploadAttachmentResponse: uploadTaskAttachmentResponseSchema,
  },
});
