import { z } from "zod";
import {
  issuePriorityMaximum,
  issuePriorityMinimum,
} from "../../../../../db/v3/schema.js";

const ISSUE_PROGRESS_MAXIMUM = 100;

export const issueStatusSchema = z.enum([
  "ISSUE_STATUS_OPEN",
  "ISSUE_STATUS_IN_PROGRESS",
  "ISSUE_STATUS_CLOSED",
  "ISSUE_STATUS_BLOCKED",
]);

export const closedReasonSchema = z.enum([
  "ISSUE_CLOSED_REASON_WONTFIX",
  "ISSUE_CLOSED_REASON_CANTFIX",
  "ISSUE_CLOSED_REASON_RESOLVED",
]);

function createOptionalNullableTextSchema() {
  return z.string().trim().min(1).nullable().optional();
}

function createIssueNameSchema() {
  return z.string().trim().min(1);
}

function createProgressPercentageSchema() {
  return z.number().int().min(0).max(ISSUE_PROGRESS_MAXIMUM);
}

function createIssuePrioritySchema() {
  return z.number().int().min(issuePriorityMinimum).max(issuePriorityMaximum);
}

export const issueSchema = z.object({
  closedAt: z.string().nullable(),
  closedReason: closedReasonSchema.nullable(),
  closedReasonDescription: z.string().nullable(),
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.number().int().positive(),
  journal: z.string().nullable(),
  name: z.string(),
  openedAt: z.string(),
  priority: createIssuePrioritySchema(),
  progressPercentage: createProgressPercentageSchema(),
  projectId: z.number().int().positive(),
  status: issueStatusSchema,
  updatedAt: z.string(),
});

export const listIssuesResponseSchema = z.object({
  issues: z.array(issueSchema),
});

export const getIssueResponseSchema = z.object({
  issue: issueSchema,
});

export const createIssueRequestSchema = z.object({
  closedReason: closedReasonSchema.nullable().optional(),
  closedReasonDescription: createOptionalNullableTextSchema(),
  description: createOptionalNullableTextSchema(),
  journal: createOptionalNullableTextSchema(),
  name: createIssueNameSchema(),
  priority: createIssuePrioritySchema().optional(),
  progressPercentage: createProgressPercentageSchema().optional(),
  status: issueStatusSchema.optional(),
});

export const createIssueResponseSchema = z.object({
  issue: issueSchema,
});

export const updateIssueRequestSchema = z.object({
  closedReason: closedReasonSchema.nullable().optional(),
  closedReasonDescription: createOptionalNullableTextSchema(),
  description: createOptionalNullableTextSchema(),
  journal: createOptionalNullableTextSchema(),
  name: createIssueNameSchema().optional(),
  priority: createIssuePrioritySchema().optional(),
  progressPercentage: createProgressPercentageSchema().optional(),
  status: issueStatusSchema.optional(),
}).refine(
  (value) =>
    value.closedReason !== undefined
    || value.closedReasonDescription !== undefined
    || value.description !== undefined
    || value.journal !== undefined
    || value.name !== undefined
    || value.priority !== undefined
    || value.progressPercentage !== undefined
    || value.status !== undefined,
  "At least one field must be provided",
);

export const updateIssueResponseSchema = z.object({
  issue: issueSchema,
});

export const deleteIssueResponseSchema = z.object({
  deletedIssueId: z.number().int().positive(),
});

export type ClosedReason = z.infer<typeof closedReasonSchema>;
export type CreateIssueRequest = z.infer<typeof createIssueRequestSchema>;
export type CreateIssueResponse = z.infer<typeof createIssueResponseSchema>;
export type DeleteIssueResponse = z.infer<typeof deleteIssueResponseSchema>;
export type GetIssueResponse = z.infer<typeof getIssueResponseSchema>;
export type Issue = z.infer<typeof issueSchema>;
export type IssueStatus = z.infer<typeof issueStatusSchema>;
export type ListIssuesResponse = z.infer<typeof listIssuesResponseSchema>;
export type UpdateIssueRequest = z.infer<typeof updateIssueRequestSchema>;
export type UpdateIssueResponse = z.infer<typeof updateIssueResponseSchema>;
