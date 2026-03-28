import { z } from "zod";

export const COMMENT_BODY_MIN_LENGTH = 16;

export const discussionPositiveIntegerSchema = z.coerce.number().int().positive();
export const discussionAttachmentIdSchema = z.string().min(1);

export const discussionAttachmentSummarySchema = z.object({
  byteLength: z.number().int().nonnegative(),
  id: z.string(),
  originalFilename: z.string(),
});

const discussionCommentBodySchema = z
  .string()
  .min(
    COMMENT_BODY_MIN_LENGTH,
    `Comment body must be at least ${COMMENT_BODY_MIN_LENGTH} characters`,
  );

const discussionCommentBaseSchema = z.object({
  attachments: z.array(discussionAttachmentSummarySchema),
  body: z.string(),
  createdAt: z.string(),
  createdByUserId: z.number().int(),
  id: z.number().int(),
  parentCommentId: z.number().int().nullable(),
  thumbsDownCount: z.number().int(),
  thumbsUpCount: z.number().int(),
  updatedAt: z.string(),
});

type DiscussionSubjectShape<
  SubjectKey extends string,
  SubjectIdSchema extends z.ZodTypeAny,
> = {
  [K in SubjectKey]: SubjectIdSchema;
};

function createSubjectShape<
  SubjectKey extends string,
  SubjectIdSchema extends z.ZodTypeAny,
>(
  subjectKey: SubjectKey,
  subjectIdSchema: SubjectIdSchema,
): DiscussionSubjectShape<SubjectKey, SubjectIdSchema> {
  return {
    [subjectKey]: subjectIdSchema,
  } as DiscussionSubjectShape<SubjectKey, SubjectIdSchema>;
}

export function createDiscussionCommentResponseSchema<
  SubjectKey extends string,
  SubjectIdSchema extends z.ZodTypeAny,
>(
  subjectKey: SubjectKey,
  subjectIdSchema: SubjectIdSchema,
) {
  return discussionCommentBaseSchema.extend(
    createSubjectShape(subjectKey, subjectIdSchema),
  );
}

export function createListDiscussionCommentsResponseSchema<
  CommentSchema extends z.ZodObject<z.ZodRawShape>,
>(commentSchema: CommentSchema) {
  return z.object({
    comments: z.array(commentSchema),
  });
}

export function createGetDiscussionCommentResponseSchema<
  CommentSchema extends z.ZodObject<z.ZodRawShape>,
>(commentSchema: CommentSchema) {
  return z.object({
    comment: commentSchema,
  });
}

export const createDiscussionCommentRequestSchema = z.object({
  body: discussionCommentBodySchema,
  parentCommentId: z.number().int().positive().nullable().optional(),
});

export const updateDiscussionCommentRequestSchema = z.object({
  body: discussionCommentBodySchema,
});

export const deleteDiscussionCommentResponseSchema = z.object({
  deletedCommentId: z.number().int(),
});

export const listDiscussionAttachmentsResponseSchema = z.object({
  attachments: z.array(discussionAttachmentSummarySchema),
});

export const uploadDiscussionAttachmentResponseSchema = z.object({
  attachment: discussionAttachmentSummarySchema,
});

export const deleteDiscussionAttachmentResponseSchema = z.object({
  deletedAttachmentId: z.string(),
});

export function createDiscussionCollectionRouteParamsSchema<
  SubjectKey extends string,
  SubjectIdSchema extends z.ZodTypeAny,
>(
  subjectKey: SubjectKey,
  subjectIdSchema: SubjectIdSchema,
) {
  return z.object({
    projectId: discussionPositiveIntegerSchema,
    ...createSubjectShape(subjectKey, subjectIdSchema),
  });
}

export function createDiscussionCommentRouteParamsSchema<
  SubjectKey extends string,
  SubjectIdSchema extends z.ZodTypeAny,
>(
  subjectKey: SubjectKey,
  subjectIdSchema: SubjectIdSchema,
) {
  return createDiscussionCollectionRouteParamsSchema(
    subjectKey,
    subjectIdSchema,
  ).extend({
    commentId: discussionPositiveIntegerSchema,
  });
}

export function createDiscussionAttachmentRouteParamsSchema<
  SubjectKey extends string,
  SubjectIdSchema extends z.ZodTypeAny,
>(
  subjectKey: SubjectKey,
  subjectIdSchema: SubjectIdSchema,
) {
  return createDiscussionCollectionRouteParamsSchema(
    subjectKey,
    subjectIdSchema,
  ).extend({
    attachmentId: discussionAttachmentIdSchema,
  });
}

export function createDiscussionCommentAttachmentRouteParamsSchema<
  SubjectKey extends string,
  SubjectIdSchema extends z.ZodTypeAny,
>(
  subjectKey: SubjectKey,
  subjectIdSchema: SubjectIdSchema,
) {
  return createDiscussionCommentRouteParamsSchema(
    subjectKey,
    subjectIdSchema,
  ).extend({
    attachmentId: discussionAttachmentIdSchema,
  });
}

export type DiscussionAttachmentSummary = z.infer<
  typeof discussionAttachmentSummarySchema
>;
export type CreateDiscussionCommentRequest = z.infer<
  typeof createDiscussionCommentRequestSchema
>;
export type UpdateDiscussionCommentRequest = z.infer<
  typeof updateDiscussionCommentRequestSchema
>;
export type DeleteDiscussionCommentResponse = z.infer<
  typeof deleteDiscussionCommentResponseSchema
>;
export type ListDiscussionAttachmentsResponse = z.infer<
  typeof listDiscussionAttachmentsResponseSchema
>;
export type UploadDiscussionAttachmentResponse = z.infer<
  typeof uploadDiscussionAttachmentResponseSchema
>;
export type DeleteDiscussionAttachmentResponse = z.infer<
  typeof deleteDiscussionAttachmentResponseSchema
>;
