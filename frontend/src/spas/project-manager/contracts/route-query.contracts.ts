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
