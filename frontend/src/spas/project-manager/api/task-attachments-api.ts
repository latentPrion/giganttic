import {
  listTaskAttachmentsResponseSchema,
  deleteTaskAttachmentResponseSchema,
  uploadTaskAttachmentResponseSchema,
  type DeleteTaskAttachmentResponse,
  type ListTaskAttachmentsResponse,
} from "../contracts/task-comments.contracts.js";
import { createDiscussionAttachmentsApi } from "./discussion-api-factory.js";
import { createTaskAttachmentDownloadPath } from "./task-attachment-paths.js";

interface TaskSubjectId {
  chartId: number;
  taskId: string;
}

function taskAttachmentsCollectionPath(projectId: number, subject: TaskSubjectId): string {
  return `/projects/${projectId}/charts/${subject.chartId}/tasks/${encodeURIComponent(subject.taskId)}/attachments`;
}

function taskAttachmentItemPath(
  projectId: number,
  subject: TaskSubjectId,
  attachmentId: string,
): string {
  return `${taskAttachmentsCollectionPath(projectId, subject)}/${encodeURIComponent(attachmentId)}`;
}

export const taskAttachmentsApi = createDiscussionAttachmentsApi<
  TaskSubjectId,
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
