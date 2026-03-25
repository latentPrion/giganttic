import { z } from "zod";

const positiveIntegerSchema = z.coerce.number().int().positive();

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

export const ISSUE_DETAIL_TAB_VALUES = ["details", "comments", "attachments"] as const;

export type IssueDetailTab = (typeof ISSUE_DETAIL_TAB_VALUES)[number];

const DEFAULT_ISSUE_TAB: IssueDetailTab = "details";

export function parseIssueTabFromSearchParameters(
  searchParameters: URLSearchParams,
): IssueDetailTab {
  const commentIdPresent = parsePositiveIntegerSearchParameter(
    searchParameters,
    "commentId",
  ) !== null;
  const raw = searchParameters.get("tab");
  if (!raw) {
    return commentIdPresent ? "comments" : DEFAULT_ISSUE_TAB;
  }

  const normalized = raw.toLowerCase();
  if ((ISSUE_DETAIL_TAB_VALUES as readonly string[]).includes(normalized)) {
    return normalized as IssueDetailTab;
  }

  return DEFAULT_ISSUE_TAB;
}

export function parseIssueCommentIdFromSearchParameters(
  searchParameters: URLSearchParams,
): number | null {
  return parsePositiveIntegerSearchParameter(searchParameters, "commentId");
}
