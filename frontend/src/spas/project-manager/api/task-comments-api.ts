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

interface TaskSubjectId {
  chartId: number;
  taskId: string;
}

function taskCommentsCollectionPath(projectId: number, subject: TaskSubjectId): string {
  return `/projects/${projectId}/charts/${subject.chartId}/tasks/${encodeURIComponent(subject.taskId)}/comments`;
}

function taskCommentItemPath(
  projectId: number,
  subject: TaskSubjectId,
  commentId: number,
): string {
  return `${taskCommentsCollectionPath(projectId, subject)}/${commentId}`;
}

function taskCommentAttachmentsPath(
  projectId: number,
  subject: TaskSubjectId,
  commentId: number,
): string {
  return `${taskCommentItemPath(projectId, subject, commentId)}/attachments`;
}

function taskCommentAttachmentItemPath(
  projectId: number,
  subject: TaskSubjectId,
  commentId: number,
  attachmentId: string,
): string {
  return `${taskCommentAttachmentsPath(projectId, subject, commentId)}/${encodeURIComponent(attachmentId)}`;
}

export const taskCommentsApi = createDiscussionCommentsApi<
  TaskSubjectId,
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
