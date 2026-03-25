import { z } from "zod";

export const COMMENT_BODY_MIN_LENGTH = 16;

const issueIdSchema = z.coerce.number().int().positive();

export const issueCommentsRouteParamsSchema = z.object({
  issueId: issueIdSchema,
  projectId: issueIdSchema,
});

export const issueCommentRouteParamsSchema = z.object({
  commentId: issueIdSchema,
  issueId: issueIdSchema,
  projectId: issueIdSchema,
});

export const attachmentSummarySchema = z.object({
  byteLength: z.number().int().nonnegative(),
  id: z.string(),
  originalFilename: z.string(),
});

export const issueCommentResponseSchema = z.object({
  attachments: z.array(attachmentSummarySchema),
  body: z.string(),
  createdAt: z.string(),
  createdByUserId: z.number().int(),
  id: z.number().int(),
  issueId: z.number().int(),
  parentCommentId: z.number().int().nullable(),
  thumbsDownCount: z.number().int(),
  thumbsUpCount: z.number().int(),
  updatedAt: z.string(),
});

export const listIssueCommentsResponseSchema = z.object({
  comments: z.array(issueCommentResponseSchema),
});

export const getIssueCommentResponseSchema = z.object({
  comment: issueCommentResponseSchema,
});

const commentBodySchema = z
  .string()
  .min(
    COMMENT_BODY_MIN_LENGTH,
    `Comment body must be at least ${COMMENT_BODY_MIN_LENGTH} characters`,
  );

export const createIssueCommentRequestSchema = z.object({
  body: commentBodySchema,
  parentCommentId: z.number().int().positive().nullable().optional(),
});

export const updateIssueCommentRequestSchema = z.object({
  body: commentBodySchema,
});

export const deleteIssueCommentResponseSchema = z.object({
  deletedCommentId: z.number().int(),
});

export const listIssueAttachmentsResponseSchema = z.object({
  attachments: z.array(attachmentSummarySchema),
});

export const uploadIssueAttachmentResponseSchema = z.object({
  attachment: attachmentSummarySchema,
});

export const issueAttachmentRouteParamsSchema = z.object({
  attachmentId: z.string().min(1),
  issueId: issueIdSchema,
  projectId: issueIdSchema,
});

export type IssueCommentResponse = z.infer<typeof issueCommentResponseSchema>;
export type CreateIssueCommentRequest = z.infer<
  typeof createIssueCommentRequestSchema
>;
export type UpdateIssueCommentRequest = z.infer<
  typeof updateIssueCommentRequestSchema
>;
