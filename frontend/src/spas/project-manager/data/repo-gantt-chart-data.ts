import type { GanttChartFile } from "../contracts/gantt-chart-file.contracts.js";
import { ganttChartFileSchema } from "../contracts/gantt-chart-file.contracts.js";

const DEFAULT_REPO_CHART_FILENAME = "welcome-chart.json";

const repoChartModules = import.meta.glob("../../../../../charts/*.json", {
  eager: true,
  import: "default",
});

function createChartBasename(modulePath: string): string {
  return modulePath.split("/").at(-1) ?? modulePath;
}

function createValidatedRepoCharts(
  rawChartModules: Record<string, unknown>,
): Map<string, GanttChartFile> {
  const validatedCharts = new Map<string, GanttChartFile>();

  for (const [modulePath, moduleValue] of Object.entries(rawChartModules)) {
    const parsedChart = ganttChartFileSchema.safeParse(moduleValue);

    if (parsedChart.success) {
      validatedCharts.set(createChartBasename(modulePath), parsedChart.data);
    }
  }

  return validatedCharts;
}

function createFallbackChartData(): GanttChartFile {
  return {
    data: [],
    links: [],
  };
}

const validatedRepoCharts = createValidatedRepoCharts(repoChartModules);

export function getRepoGanttChartData(_projectId: number | null): GanttChartFile {
  return validatedRepoCharts.get(DEFAULT_REPO_CHART_FILENAME) ?? createFallbackChartData();
}
