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
  discussionPositiveIntegerSchema,
  listDiscussionAttachmentsResponseSchema,
  updateDiscussionCommentRequestSchema,
  uploadDiscussionAttachmentResponseSchema,
} from "../../../common/discussion/discussion.contracts.js";

const issueIdSchema = discussionPositiveIntegerSchema;

export { COMMENT_BODY_MIN_LENGTH };

export const issueCommentsRouteParamsSchema =
  createDiscussionCollectionRouteParamsSchema("issueId", issueIdSchema);

export const issueCommentRouteParamsSchema =
  createDiscussionCommentRouteParamsSchema("issueId", issueIdSchema);

export const attachmentSummarySchema = discussionAttachmentSummarySchema;

export const issueCommentResponseSchema = createDiscussionCommentResponseSchema(
  "issueId",
  issueIdSchema,
);

export const listIssueCommentsResponseSchema =
  createListDiscussionCommentsResponseSchema(issueCommentResponseSchema);

export const getIssueCommentResponseSchema =
  createGetDiscussionCommentResponseSchema(issueCommentResponseSchema);

export const createIssueCommentRequestSchema = createDiscussionCommentRequestSchema;

export const updateIssueCommentRequestSchema = updateDiscussionCommentRequestSchema;

export const deleteIssueCommentResponseSchema = deleteDiscussionCommentResponseSchema;

export const listIssueAttachmentsResponseSchema = listDiscussionAttachmentsResponseSchema;

export const uploadIssueAttachmentResponseSchema = uploadDiscussionAttachmentResponseSchema;

export const issueAttachmentRouteParamsSchema = createDiscussionAttachmentRouteParamsSchema(
  "issueId",
  issueIdSchema,
);

export const issueCommentAttachmentRouteParamsSchema =
  createDiscussionCommentAttachmentRouteParamsSchema("issueId", issueIdSchema);

export const deleteIssueAttachmentResponseSchema = deleteDiscussionAttachmentResponseSchema;

export type IssueCommentResponse = z.infer<typeof issueCommentResponseSchema>;
export type CreateIssueCommentRequest = z.infer<
  typeof createIssueCommentRequestSchema
>;
export type UpdateIssueCommentRequest = z.infer<
  typeof updateIssueCommentRequestSchema
>;
