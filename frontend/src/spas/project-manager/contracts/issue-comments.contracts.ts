import { z } from "zod";

import {
  createDiscussionCommentRequestSchema,
  createDiscussionCommentResponseSchema,
  createGetDiscussionCommentResponseSchema,
  createListDiscussionCommentsResponseSchema,
  deleteDiscussionAttachmentResponseSchema,
  deleteDiscussionCommentResponseSchema,
  discussionAttachmentSummarySchema,
  discussionPositiveIntegerSchema,
  listDiscussionAttachmentsResponseSchema,
  updateDiscussionCommentRequestSchema,
  uploadDiscussionAttachmentResponseSchema,
} from "../../../../../common/discussion/discussion.contracts.js";

export const issueCommentSchema = createDiscussionCommentResponseSchema(
  "issueId",
  discussionPositiveIntegerSchema,
);

export const listIssueCommentsResponseSchema =
  createListDiscussionCommentsResponseSchema(issueCommentSchema);

export const getIssueCommentResponseSchema =
  createGetDiscussionCommentResponseSchema(issueCommentSchema);

export const createIssueCommentRequestSchema = createDiscussionCommentRequestSchema;

export const updateIssueCommentRequestSchema = updateDiscussionCommentRequestSchema;

export const deleteIssueCommentResponseSchema = deleteDiscussionCommentResponseSchema;

export const listIssueAttachmentsResponseSchema = listDiscussionAttachmentsResponseSchema;

export const uploadIssueAttachmentResponseSchema = uploadDiscussionAttachmentResponseSchema;

export const deleteIssueAttachmentResponseSchema = deleteDiscussionAttachmentResponseSchema;

export type IssueComment = z.infer<typeof issueCommentSchema>;
export type IssueAttachmentSummary = z.infer<typeof discussionAttachmentSummarySchema>;
export type ListIssueCommentsResponse = z.infer<typeof listIssueCommentsResponseSchema>;
export type GetIssueCommentResponse = z.infer<typeof getIssueCommentResponseSchema>;
export type CreateIssueCommentRequest = z.infer<typeof createIssueCommentRequestSchema>;
export type UpdateIssueCommentRequest = z.infer<typeof updateIssueCommentRequestSchema>;
export type DeleteIssueCommentResponse = z.infer<typeof deleteIssueCommentResponseSchema>;
export type ListIssueAttachmentsResponse = z.infer<typeof listIssueAttachmentsResponseSchema>;
export type DeleteIssueAttachmentResponse = z.infer<typeof deleteIssueAttachmentResponseSchema>;
