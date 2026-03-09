import type { GanttChartSource } from "../models/gantt-chart-source.js";

const DEFAULT_REPO_CHART_FILENAME = "development-planner-chart.xml";

const repoChartModules = import.meta.glob("../../../../../charts/*.xml", {
  eager: true,
  import: "default",
  query: "?raw",
});

function createChartBasename(modulePath: string): string {
  return modulePath.split("/").at(-1) ?? modulePath;
}

function createValidatedRepoCharts(
  rawChartModules: Record<string, unknown>,
): Map<string, GanttChartSource> {
  const validatedCharts = new Map<string, GanttChartSource>();

  for (const [modulePath, moduleValue] of Object.entries(rawChartModules)) {
    if (typeof moduleValue === "string" && moduleValue.trim().length > 0) {
      validatedCharts.set(createChartBasename(modulePath), {
        content: moduleValue,
        type: "xml",
      });
    }
  }

  return validatedCharts;
}

function createFallbackChartSource(): GanttChartSource {
  return {
    content: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><data></data>",
    type: "xml",
  };
}

const validatedRepoCharts = createValidatedRepoCharts(repoChartModules);

export function getRepoGanttChartSource(_projectId: number | null): GanttChartSource {
  return validatedRepoCharts.get(DEFAULT_REPO_CHART_FILENAME) ?? createFallbackChartSource();
}
