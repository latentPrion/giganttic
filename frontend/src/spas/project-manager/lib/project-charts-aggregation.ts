import { ganttApi } from "../api/gantt-api.js";
import { getGanttRuntimeChartCacheEntry } from "./gantt-runtime-chart-cache.js";

export interface AggregatedProjectChartSource {
  chartId: number;
  chartName: string;
  serializedXml: string;
}

function sortByChartIdAscending<T extends { chartId: number }>(values: T[]): T[] {
  return [...values].sort((left, right) => left.chartId - right.chartId);
}

async function loadChartXmlWithRuntimeCacheFallback(
  token: string,
  projectId: number,
  chartId: number,
): Promise<string | null> {
  const runtimeCacheEntry = getGanttRuntimeChartCacheEntry(projectId, chartId);
  if (runtimeCacheEntry) {
    return runtimeCacheEntry.serializedXml;
  }

  const serverChart = await ganttApi.getProjectChartOrNull(token, projectId, chartId);
  return serverChart?.content ?? null;
}

export async function loadAggregatedProjectChartSources(
  token: string,
  projectId: number,
): Promise<AggregatedProjectChartSource[]> {
  const chartsResponse = await ganttApi.listProjectCharts(token, projectId);
  const sortedCharts = sortByChartIdAscending(chartsResponse.charts);
  const aggregatedSources = await Promise.all(
    sortedCharts.map(async (chart) => {
      const serializedXml = await loadChartXmlWithRuntimeCacheFallback(
        token,
        projectId,
        chart.chartId,
      );
      if (!serializedXml) {
        return null;
      }

      return {
        chartId: chart.chartId,
        chartName: chart.name,
        serializedXml,
      } satisfies AggregatedProjectChartSource;
    }),
  );

  return aggregatedSources.filter((entry): entry is AggregatedProjectChartSource => entry !== null);
}
