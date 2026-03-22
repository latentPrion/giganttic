import {
  requestJson,
  requestText,
} from "../../../common/api/http-client.js";
import {
  getProjectChartExportCapabilitiesResponseSchema,
  type GetProjectChartExportCapabilitiesResponse,
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
};
