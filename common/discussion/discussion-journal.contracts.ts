import { z } from "zod";

export const discussionJournalMarkdownSchema = z.string();

export const upsertDiscussionJournalRequestSchema = z.object({
  markdown: discussionJournalMarkdownSchema,
});

export const getDiscussionJournalResponseSchema = z.object({
  journalExists: z.boolean(),
  markdown: discussionJournalMarkdownSchema.nullable(),
});

export const getTaskJournalResponseSchema = getDiscussionJournalResponseSchema.extend({
  taskMirrorExists: z.boolean(),
});

export type UpsertDiscussionJournalRequest = z.infer<
  typeof upsertDiscussionJournalRequestSchema
>;
export type GetDiscussionJournalResponse = z.infer<
  typeof getDiscussionJournalResponseSchema
>;
export type GetTaskJournalResponse = z.infer<typeof getTaskJournalResponseSchema>;
