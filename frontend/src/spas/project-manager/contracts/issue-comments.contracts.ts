import { z } from "zod";

const attachmentSummarySchema = z.object({
  byteLength: z.number(),
  id: z.string(),
  originalFilename: z.string(),
});

export const issueCommentSchema = z.object({
  attachments: z.array(attachmentSummarySchema),
  body: z.string(),
  createdAt: z.string(),
  createdByUserId: z.number(),
  id: z.number(),
  issueId: z.number(),
  parentCommentId: z.number().nullable(),
  thumbsDownCount: z.number(),
  thumbsUpCount: z.number(),
  updatedAt: z.string(),
});

export const listIssueCommentsResponseSchema = z.object({
  comments: z.array(issueCommentSchema),
});

export const getIssueCommentResponseSchema = z.object({
  comment: issueCommentSchema,
});

export const createIssueCommentRequestSchema = z.object({
  body: z.string(),
  parentCommentId: z.number().nullable().optional(),
});

export const updateIssueCommentRequestSchema = z.object({
  body: z.string(),
});

export const deleteIssueCommentResponseSchema = z.object({
  deletedCommentId: z.number(),
});

export const listIssueAttachmentsResponseSchema = z.object({
  attachments: z.array(attachmentSummarySchema),
});

export const uploadIssueAttachmentResponseSchema = z.object({
  attachment: attachmentSummarySchema,
});

export const deleteIssueAttachmentResponseSchema = z.object({
  deletedAttachmentId: z.string(),
});

export type IssueComment = z.infer<typeof issueCommentSchema>;
export type IssueAttachmentSummary = z.infer<typeof attachmentSummarySchema>;
export type ListIssueCommentsResponse = z.infer<typeof listIssueCommentsResponseSchema>;
export type GetIssueCommentResponse = z.infer<typeof getIssueCommentResponseSchema>;
export type CreateIssueCommentRequest = z.infer<typeof createIssueCommentRequestSchema>;
export type UpdateIssueCommentRequest = z.infer<typeof updateIssueCommentRequestSchema>;
export type DeleteIssueCommentResponse = z.infer<typeof deleteIssueCommentResponseSchema>;
export type ListIssueAttachmentsResponse = z.infer<typeof listIssueAttachmentsResponseSchema>;
export type DeleteIssueAttachmentResponse = z.infer<typeof deleteIssueAttachmentResponseSchema>;
