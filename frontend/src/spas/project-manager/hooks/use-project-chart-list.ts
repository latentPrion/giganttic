import { useEffect, useState } from "react";
import type { ProjectChart } from "../api/gantt-api.js";
import { ganttApi } from "../api/gantt-api.js";

interface UseProjectChartListOptions {
  projectId: number | null;
  token: string | undefined;
}

export function useProjectChartList(options: UseProjectChartListOptions): ProjectChart[] {
  const [charts, setCharts] = useState<ProjectChart[]>([]);

  useEffect(() => {
    const { projectId, token } = options;
    if (!token || projectId === null || typeof ganttApi.listProjectCharts !== "function") {
      setCharts([]);
      return;
    }
    const requestToken = token;
    const requestProjectId = projectId;

    let isMounted = true;
    async function loadProjectCharts(): Promise<void> {
      try {
        const response = await ganttApi.listProjectCharts(requestToken, requestProjectId);
        if (isMounted) {
          setCharts(response.charts);
        }
      } catch {
        if (isMounted) {
          setCharts([]);
        }
      }
    }

    void loadProjectCharts();
    return () => {
      isMounted = false;
    };
  }, [options.projectId, options.token]);

  return charts;
}
