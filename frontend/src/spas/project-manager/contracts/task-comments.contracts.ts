import { z } from "zod";

import {
  createDiscussionCommentRequestSchema,
  createDiscussionCommentResponseSchema,
  createGetDiscussionCommentResponseSchema,
  createListDiscussionCommentsResponseSchema,
  deleteDiscussionAttachmentResponseSchema,
  deleteDiscussionCommentResponseSchema,
  discussionAttachmentSummarySchema,
  listDiscussionAttachmentsResponseSchema,
  updateDiscussionCommentRequestSchema,
  uploadDiscussionAttachmentResponseSchema,
} from "../../../../../common/discussion/discussion.contracts.js";

const taskIdSchema = z.string().min(1);

export const taskCommentSchema = createDiscussionCommentResponseSchema(
  "taskId",
  taskIdSchema,
);

export const listTaskCommentsResponseSchema =
  createListDiscussionCommentsResponseSchema(taskCommentSchema);

export const getTaskCommentResponseSchema =
  createGetDiscussionCommentResponseSchema(taskCommentSchema);

export const createTaskCommentRequestSchema = createDiscussionCommentRequestSchema;

export const updateTaskCommentRequestSchema = updateDiscussionCommentRequestSchema;

export const deleteTaskCommentResponseSchema = deleteDiscussionCommentResponseSchema;

export const listTaskAttachmentsResponseSchema = listDiscussionAttachmentsResponseSchema;

export const uploadTaskAttachmentResponseSchema = uploadDiscussionAttachmentResponseSchema;

export const deleteTaskAttachmentResponseSchema = deleteDiscussionAttachmentResponseSchema;

export type TaskComment = z.infer<typeof taskCommentSchema>;
export type TaskAttachmentSummary = z.infer<typeof discussionAttachmentSummarySchema>;
export type ListTaskCommentsResponse = z.infer<typeof listTaskCommentsResponseSchema>;
export type GetTaskCommentResponse = z.infer<typeof getTaskCommentResponseSchema>;
export type CreateTaskCommentRequest = z.infer<typeof createTaskCommentRequestSchema>;
export type UpdateTaskCommentRequest = z.infer<typeof updateTaskCommentRequestSchema>;
export type DeleteTaskCommentResponse = z.infer<typeof deleteTaskCommentResponseSchema>;
export type ListTaskAttachmentsResponse = z.infer<typeof listTaskAttachmentsResponseSchema>;
export type DeleteTaskAttachmentResponse = z.infer<typeof deleteTaskAttachmentResponseSchema>;
