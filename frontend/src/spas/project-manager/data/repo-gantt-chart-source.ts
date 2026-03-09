import type { GanttChartSource } from "../models/gantt-chart-source.js";

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

const validatedRepoCharts = createValidatedRepoCharts(repoChartModules);

function createChartFilename(projectId: number): string {
  return `${projectId}.xml`;
}

export function getRepoGanttChartSource(projectId: number | null): GanttChartSource | null {
  if (projectId === null) {
    return null;
  }

  return validatedRepoCharts.get(createChartFilename(projectId)) ?? null;
}
