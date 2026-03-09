import { z } from "zod";


const issueStatusCodes = [
  "ISSUE_STATUS_OPEN",
  "ISSUE_STATUS_CLOSED",
  "ISSUE_STATUS_BLOCKED",
] as const;
const closedReasonCodes = [
  "ISSUE_CLOSED_REASON_WONTFIX",
  "ISSUE_CLOSED_REASON_CANTFIX",
  "ISSUE_CLOSED_REASON_RESOLVED",
] as const;
const issueStatusEnum = z.enum(issueStatusCodes);
const closedReasonEnum = z.enum(closedReasonCodes);
const issueUpdateRequiredMessage = "At least one field must be provided";
const progressPercentageMaximum = 100;

function createIssueIdSchema() {
  return z.coerce.number().int().positive();
}

function createOptionalNullableTextSchema() {
  return z.string().trim().min(1).nullable().optional();
}

function createIssueNameSchema() {
  return z.string().trim().min(1);
}

function createIssueProgressSchema() {
  return z.number().int().min(0).max(progressPercentageMaximum);
}

export const issueRouteParamsSchema = z.object({
  issueId: createIssueIdSchema(),
  projectId: createIssueIdSchema(),
});

export const projectIssueRouteParamsSchema = z.object({
  projectId: createIssueIdSchema(),
});

export const createIssueRequestSchema = z.object({
  closedReason: closedReasonEnum.nullable().optional(),
  closedReasonDescription: createOptionalNullableTextSchema(),
  description: createOptionalNullableTextSchema(),
  journal: createOptionalNullableTextSchema(),
  name: createIssueNameSchema(),
  progressPercentage: createIssueProgressSchema().optional(),
  status: issueStatusEnum.optional(),
});

export const updateIssueRequestSchema = z.object({
  closedReason: closedReasonEnum.nullable().optional(),
  closedReasonDescription: createOptionalNullableTextSchema(),
  description: createOptionalNullableTextSchema(),
  journal: createOptionalNullableTextSchema(),
  name: createIssueNameSchema().optional(),
  progressPercentage: createIssueProgressSchema().optional(),
  status: issueStatusEnum.optional(),
}).refine(
  (value) =>
    value.closedReason !== undefined
    || value.closedReasonDescription !== undefined
    || value.description !== undefined
    || value.journal !== undefined
    || value.name !== undefined
    || value.progressPercentage !== undefined
    || value.status !== undefined,
  issueUpdateRequiredMessage,
);

export const issueSchema = z.object({
  closedAt: z.string().nullable(),
  closedReason: closedReasonEnum.nullable(),
  closedReasonDescription: z.string().nullable(),
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.number().int().positive(),
  journal: z.string().nullable(),
  name: z.string(),
  openedAt: z.string(),
  progressPercentage: z.number().int().min(0).max(progressPercentageMaximum),
  projectId: z.number().int().positive(),
  status: issueStatusEnum,
  updatedAt: z.string(),
});

export const createIssueResponseSchema = z.object({
  issue: issueSchema,
});

export const getIssueResponseSchema = z.object({
  issue: issueSchema,
});

export const listIssuesResponseSchema = z.object({
  issues: z.array(issueSchema),
});

export const updateIssueResponseSchema = z.object({
  issue: issueSchema,
});

export const deleteIssueResponseSchema = z.object({
  deletedIssueId: z.number().int().positive(),
});

export type CreateIssueRequest = z.infer<typeof createIssueRequestSchema>;
export type DeleteIssueResponse = z.infer<typeof deleteIssueResponseSchema>;
export type GetIssueResponse = z.infer<typeof getIssueResponseSchema>;
export type IssueResponse = z.infer<typeof issueSchema>;
export type ListIssuesResponse = z.infer<typeof listIssuesResponseSchema>;
export type UpdateIssueRequest = z.infer<typeof updateIssueRequestSchema>;
