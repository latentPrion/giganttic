import { z } from "zod";

import {
  COMMENT_BODY_MIN_LENGTH,
  createDiscussionAttachmentRouteParamsSchema,
  createDiscussionCollectionRouteParamsSchema,
  createDiscussionCommentAttachmentRouteParamsSchema,
  createDiscussionCommentRequestSchema,
  createDiscussionCommentResponseSchema,
  createDiscussionCommentRouteParamsSchema,
  createGetDiscussionCommentResponseSchema,
  createListDiscussionCommentsResponseSchema,
  deleteDiscussionAttachmentResponseSchema,
  deleteDiscussionCommentResponseSchema,
  discussionAttachmentSummarySchema,
  listDiscussionAttachmentsResponseSchema,
  updateDiscussionCommentRequestSchema,
  uploadDiscussionAttachmentResponseSchema,
} from "../../../common/discussion/discussion.contracts.js";

const taskIdSchema = z.string().min(1);
const chartIdSchema = z.coerce.number().int().nonnegative();

export { COMMENT_BODY_MIN_LENGTH };

export const taskCommentsRouteParamsSchema =
  createDiscussionCollectionRouteParamsSchema("taskId", taskIdSchema).extend({
    chartId: chartIdSchema,
  });

export const taskCommentRouteParamsSchema =
  createDiscussionCommentRouteParamsSchema("taskId", taskIdSchema).extend({
    chartId: chartIdSchema,
  });

export const attachmentSummarySchema = discussionAttachmentSummarySchema;

export const taskCommentResponseSchema = createDiscussionCommentResponseSchema(
  "taskId",
  taskIdSchema,
);

export const listTaskCommentsResponseSchema =
  createListDiscussionCommentsResponseSchema(taskCommentResponseSchema);

export const getTaskCommentResponseSchema =
  createGetDiscussionCommentResponseSchema(taskCommentResponseSchema);

export const createTaskCommentRequestSchema = createDiscussionCommentRequestSchema;

export const updateTaskCommentRequestSchema = updateDiscussionCommentRequestSchema;

export const deleteTaskCommentResponseSchema = deleteDiscussionCommentResponseSchema;

export const listTaskAttachmentsResponseSchema = listDiscussionAttachmentsResponseSchema;

export const uploadTaskAttachmentResponseSchema = uploadDiscussionAttachmentResponseSchema;

export const taskAttachmentRouteParamsSchema = createDiscussionAttachmentRouteParamsSchema(
  "taskId",
  taskIdSchema,
).extend({
  chartId: chartIdSchema,
});

export const taskCommentAttachmentRouteParamsSchema =
  createDiscussionCommentAttachmentRouteParamsSchema("taskId", taskIdSchema).extend({
    chartId: chartIdSchema,
  });

export const deleteTaskAttachmentResponseSchema = deleteDiscussionAttachmentResponseSchema;

export type TaskCommentResponse = z.infer<typeof taskCommentResponseSchema>;
export type CreateTaskCommentRequest = z.infer<
  typeof createTaskCommentRequestSchema
>;
export type UpdateTaskCommentRequest = z.infer<
  typeof updateTaskCommentRequestSchema
>;
