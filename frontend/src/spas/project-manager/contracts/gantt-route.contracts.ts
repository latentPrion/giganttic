import { z } from "zod";

const ganttRouteQuerySchema = z.object({
  projectId: z.coerce.number().int().positive(),
});

export function parseProjectIdFromSearchParameters(
  searchParameters: URLSearchParams,
): number | null {
  const projectId = searchParameters.get("projectId");

  if (projectId === null) {
    return null;
  }

  const parseResult = ganttRouteQuerySchema.safeParse({
    projectId,
  });

  return parseResult.success ? parseResult.data.projectId : null;
}
