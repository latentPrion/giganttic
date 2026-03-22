import {
  requestJson,
  requestText,
} from "../../../common/api/http-client.js";
import { isApiError } from "../../../common/api/api-error.js";
import {
  getProjectChartExportCapabilitiesResponseSchema,
  type GetProjectChartExportCapabilitiesResponse,
  updateProjectChartRequestSchema,
  updateProjectChartResponseSchema,
  type UpdateProjectChartResponse,
} from "../contracts/gantt-export.contracts.js";
import type { GanttChartSource } from "../models/gantt-chart-source.js";

function createProjectChartPath(projectId: number): string {
  return `/projects/${projectId}/chart`;
}

function createProjectChartExportCapabilitiesPath(): string {
  return "/projects/chart-export-capabilities";
}

async function getProjectChart(
  token: string,
  projectId: number,
): Promise<GanttChartSource> {
  return {
    content: await requestText({
      method: "GET",
      path: createProjectChartPath(projectId),
      token,
    }),
    type: "xml",
  };
}

/**
 * Loads chart XML for a project. Used by Gantt and Kanban.
 * Returns `null` when the server has no chart file (GET 404).
 */
async function getProjectChartOrNull(
  token: string,
  projectId: number,
): Promise<GanttChartSource | null> {
  try {
    return await getProjectChart(token, projectId);
  } catch (error) {
    if (isApiError(error) && error.kind === "http" && error.status === 404) {
      return null;
    }
    throw error;
  }
}

async function putProjectChart(
  token: string,
  projectId: number,
  xml: string,
): Promise<UpdateProjectChartResponse> {
  return await requestJson({
    body: { xml },
    method: "PUT",
    path: createProjectChartPath(projectId),
    requestSchema: updateProjectChartRequestSchema,
    responseSchema: updateProjectChartResponseSchema,
    token,
  });
}

async function getProjectChartExportCapabilities(
  token: string,
): Promise<GetProjectChartExportCapabilitiesResponse> {
  return await requestJson({
    method: "GET",
    path: createProjectChartExportCapabilitiesPath(),
    responseSchema: getProjectChartExportCapabilitiesResponseSchema,
    token,
  });
}

export const ganttApi = {
  getProjectChartExportCapabilities,
  getProjectChart,
  getProjectChartOrNull,
  putProjectChart,
};
