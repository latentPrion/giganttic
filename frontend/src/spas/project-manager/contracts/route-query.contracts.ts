import { z } from "zod";

const positiveIntegerSchema = z.coerce.number().int().positive();
const projectViewSchema = z.enum(["detail", "gantt"]);
const DEFAULT_PROJECT_VIEW = "detail";

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

export function parseIssueIdFromSearchParameters(
  searchParameters: URLSearchParams,
): number | null {
  return parsePositiveIntegerSearchParameter(searchParameters, "id");
}

export function parseProjectViewFromSearchParameters(
  searchParameters: URLSearchParams,
): z.infer<typeof projectViewSchema> {
  const rawValue = searchParameters.get("view");
  const parseResult = projectViewSchema.safeParse(rawValue);

  return parseResult.success ? parseResult.data : DEFAULT_PROJECT_VIEW;
}
