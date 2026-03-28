import {
  listTaskAttachmentsResponseSchema,
  deleteTaskAttachmentResponseSchema,
  uploadTaskAttachmentResponseSchema,
  type DeleteTaskAttachmentResponse,
  type ListTaskAttachmentsResponse,
} from "../contracts/task-comments.contracts.js";
import { createDiscussionAttachmentsApi } from "./discussion-api-factory.js";
import { createTaskAttachmentDownloadPath } from "./task-attachment-paths.js";

function taskAttachmentsCollectionPath(projectId: number, taskId: string): string {
  return `/projects/${projectId}/tasks/${encodeURIComponent(taskId)}/attachments`;
}

function taskAttachmentItemPath(
  projectId: number,
  taskId: string,
  attachmentId: string,
): string {
  return `${taskAttachmentsCollectionPath(projectId, taskId)}/${encodeURIComponent(attachmentId)}`;
}

export const taskAttachmentsApi = createDiscussionAttachmentsApi<
  string,
  DeleteTaskAttachmentResponse,
  ListTaskAttachmentsResponse,
  { attachment: unknown }
>({
  paths: {
    attachmentItemPath: taskAttachmentItemPath,
    attachmentsCollectionPath: taskAttachmentsCollectionPath,
  },
  schemas: {
    deleteAttachmentResponse: deleteTaskAttachmentResponseSchema,
    listAttachmentsResponse: listTaskAttachmentsResponseSchema,
    uploadAttachmentResponse: uploadTaskAttachmentResponseSchema,
  },
});

export { createTaskAttachmentDownloadPath };
