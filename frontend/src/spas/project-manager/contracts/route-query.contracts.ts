import { z } from "zod";

const positiveIntegerSchema = z.coerce.number().int().positive();
const nonEmptyTrimmedStringSchema = z.string().refine(
  (value) => value.length > 0 && value.trim() === value,
);

function parsePositiveIntegerSearchParameter(
  searchParameters: URLSearchParams,
  key: string,
): number | null {
  const rawValue = searchParameters.get(key);

  if (rawValue === null) {
    return null;
  }

  const parseResult = positiveIntegerSchema.safeParse(rawValue);
  return parseResult.success ? parseResult.data : null;
}

function parseNonEmptyTrimmedStringSearchParameter(
  searchParameters: URLSearchParams,
  key: string,
): string | null {
  const rawValue = searchParameters.get(key);

  if (rawValue === null) {
    return null;
  }

  const parseResult = nonEmptyTrimmedStringSchema.safeParse(rawValue);
  return parseResult.success ? parseResult.data : null;
}

export function parseProjectIdFromSearchParameters(
  searchParameters: URLSearchParams,
): number | null {
  return parsePositiveIntegerSearchParameter(searchParameters, "projectId");
}

export function parseTeamIdFromSearchParameters(
  searchParameters: URLSearchParams,
): number | null {
  return parsePositiveIntegerSearchParameter(searchParameters, "teamId");
}

export function parseOrganizationIdFromSearchParameters(
  searchParameters: URLSearchParams,
): number | null {
  return parsePositiveIntegerSearchParameter(searchParameters, "organizationId");
}

export function parseUserIdFromSearchParameters(
  searchParameters: URLSearchParams,
): number | null {
  return parsePositiveIntegerSearchParameter(searchParameters, "userId");
}

export function parseIssueIdFromSearchParameters(
  searchParameters: URLSearchParams,
): number | null {
  return parsePositiveIntegerSearchParameter(searchParameters, "id");
}

export function parseTaskIdFromSearchParameters(
  searchParameters: URLSearchParams,
): string | null {
  return parseNonEmptyTrimmedStringSearchParameter(searchParameters, "id");
}

export const DISCUSSION_DETAIL_TAB_VALUES = [
  "details",
  "comments",
  "attachments",
] as const;

export type DiscussionDetailTab = (typeof DISCUSSION_DETAIL_TAB_VALUES)[number];

export type IssueDetailTab = DiscussionDetailTab;
export type TaskDetailTab = DiscussionDetailTab;

const DEFAULT_DISCUSSION_TAB: DiscussionDetailTab = "details";
export const PROJECT_DETAIL_TAB_VALUES = ["details", "attachments"] as const;
export type ProjectDetailTab = (typeof PROJECT_DETAIL_TAB_VALUES)[number];
export const PROJECT_TAB_QUERY_KEY = "tab";
export const PROJECT_ATTACHMENT_ID_QUERY_KEY = "attachmentId";
const DEFAULT_PROJECT_TAB: ProjectDetailTab = "details";

function parseDiscussionTabFromSearchParameters(
  searchParameters: URLSearchParams,
): DiscussionDetailTab {
  const commentIdPresent = parsePositiveIntegerSearchParameter(
    searchParameters,
    "commentId",
  ) !== null;
  const raw = searchParameters.get("tab");
  if (!raw) {
    return commentIdPresent ? "comments" : DEFAULT_DISCUSSION_TAB;
  }

  const normalized = raw.toLowerCase();
  if ((DISCUSSION_DETAIL_TAB_VALUES as readonly string[]).includes(normalized)) {
    return normalized as DiscussionDetailTab;
  }

  return DEFAULT_DISCUSSION_TAB;
}

export function parseIssueTabFromSearchParameters(
  searchParameters: URLSearchParams,
): IssueDetailTab {
  return parseDiscussionTabFromSearchParameters(searchParameters);
}

export function parseTaskTabFromSearchParameters(
  searchParameters: URLSearchParams,
): TaskDetailTab {
  return parseDiscussionTabFromSearchParameters(searchParameters);
}

export function parseIssueCommentIdFromSearchParameters(
  searchParameters: URLSearchParams,
): number | null {
  return parsePositiveIntegerSearchParameter(searchParameters, "commentId");
}

export function parseTaskCommentIdFromSearchParameters(
  searchParameters: URLSearchParams,
): number | null {
  return parsePositiveIntegerSearchParameter(searchParameters, "commentId");
}

export function parseProjectTabFromSearchParameters(
  searchParameters: URLSearchParams,
): ProjectDetailTab {
  const raw = searchParameters.get(PROJECT_TAB_QUERY_KEY);

  if (!raw) {
    return DEFAULT_PROJECT_TAB;
  }

  const normalized = raw.toLowerCase();
  if ((PROJECT_DETAIL_TAB_VALUES as readonly string[]).includes(normalized)) {
    return normalized as ProjectDetailTab;
  }

  return DEFAULT_PROJECT_TAB;
}

export function parseProjectAttachmentIdFromSearchParameters(
  searchParameters: URLSearchParams,
): string | null {
  return parseNonEmptyTrimmedStringSearchParameter(
    searchParameters,
    PROJECT_ATTACHMENT_ID_QUERY_KEY,
  );
}
