import {
  requestJson,
  requestText,
} from "../../../common/api/http-client.js";
import { isApiError } from "../../../common/api/api-error.js";
import { z } from "zod";
import {
  getProjectChartExportCapabilitiesResponseSchema,
  type GetProjectChartExportCapabilitiesResponse,
  updateProjectChartRequestSchema,
  updateProjectChartResponseSchema,
  type UpdateProjectChartResponse,
} from "../contracts/gantt-export.contracts.js";
import type { GanttChartSource } from "../models/gantt-chart-source.js";

const projectChartSchema = z.object({
  chartId: z.number().int(),
  id: z.number().int(),
  name: z.string(),
  projectId: z.number().int(),
});

const listProjectChartsResponseSchema = z.object({
  charts: z.array(projectChartSchema),
});

const createProjectChartRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const createProjectChartResponseSchema = z.object({
  chart: projectChartSchema,
});

const updateProjectChartMetadataRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const updateProjectChartMetadataResponseSchema = z.object({
  chart: projectChartSchema,
});

export type ProjectChart = z.infer<typeof projectChartSchema>;
export type ListProjectChartsResponse = z.infer<typeof listProjectChartsResponseSchema>;
export type CreateProjectChartResponse = z.infer<typeof createProjectChartResponseSchema>;
export type UpdateProjectChartMetadataResponse = z.infer<
  typeof updateProjectChartMetadataResponseSchema
>;

function createProjectChartsPath(projectId: number): string {
  return `/projects/${projectId}/charts`;
}

function createProjectChartPath(projectId: number, chartId: number): string {
  return `${createProjectChartsPath(projectId)}/${chartId}`;
}

function createProjectChartExportCapabilitiesPath(): string {
  return "/projects/chart-export-capabilities";
}

async function getProjectChart(
  token: string,
  projectId: number,
  chartId: number = 0,
): Promise<GanttChartSource> {
  return {
    content: await requestText({
      method: "GET",
      path: createProjectChartPath(projectId, chartId),
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
  chartId: number = 0,
): Promise<GanttChartSource | null> {
  try {
    return await getProjectChart(token, projectId, chartId);
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
  chartId: number = 0,
): Promise<UpdateProjectChartResponse> {
  return await requestJson({
    body: { xml },
    method: "PUT",
    path: createProjectChartPath(projectId, chartId),
    requestSchema: updateProjectChartRequestSchema,
    responseSchema: updateProjectChartResponseSchema,
    token,
  });
}

async function listProjectCharts(
  token: string,
  projectId: number,
): Promise<ListProjectChartsResponse> {
  return await requestJson({
    method: "GET",
    path: createProjectChartsPath(projectId),
    responseSchema: listProjectChartsResponseSchema,
    token,
  });
}

async function createProjectChart(
  token: string,
  projectId: number,
  name: string,
): Promise<CreateProjectChartResponse> {
  return await requestJson({
    body: { name },
    method: "POST",
    path: createProjectChartsPath(projectId),
    requestSchema: createProjectChartRequestSchema,
    responseSchema: createProjectChartResponseSchema,
    token,
  });
}

async function updateProjectChartMetadata(
  token: string,
  projectId: number,
  chartId: number,
  name: string,
): Promise<UpdateProjectChartMetadataResponse> {
  return await requestJson({
    body: { name },
    method: "PATCH",
    path: createProjectChartPath(projectId, chartId),
    requestSchema: updateProjectChartMetadataRequestSchema,
    responseSchema: updateProjectChartMetadataResponseSchema,
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
  listProjectCharts,
  putProjectChart,
  createProjectChart,
  updateProjectChartMetadata,
};
