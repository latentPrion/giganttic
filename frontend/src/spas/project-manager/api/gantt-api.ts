import { requestText } from "../../../common/api/http-client.js";
import type { GanttChartSource } from "../models/gantt-chart-source.js";

function createProjectChartPath(projectId: number): string {
  return `/projects/${projectId}/chart`;
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

export const ganttApi = {
  getProjectChart,
};
