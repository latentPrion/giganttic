import type { ProjectChartTaskIdValidationIssue } from "../../../../../common/project-chart/project-chart-task-id-validation.js";
import {
  ProjectChartTaskIdValidationError,
  validateProjectChartTaskIdsInFrontend,
} from "./project-chart-task-id-validation.js";

export interface GanttRuntimeChartCacheEntry {
  /**
   * Serialized XML representing the current frontend runtime state of the Gantt editor.
   * This is what non-Gantt views (Tasks/Kanban) should render from.
   */
  serializedXml: string;

  /**
   * DHTMLX serialization format we store in the cache. We currently always cache as `xml`.
   */
  type: "xml";
}

export interface GanttRuntimeChartValidationResult {
  error: ProjectChartTaskIdValidationIssue | null;
  ok: boolean;
}

const runtimeChartCacheByScopeKey = new Map<string, GanttRuntimeChartCacheEntry>();
const runtimeChartValidationErrorByScopeKey = new Map<
  string,
  ProjectChartTaskIdValidationIssue
>();
const listenersByScopeKey = new Map<string, Set<() => void>>();

function createScopeKey(projectId: number, chartId: number): string {
  return `${projectId}:${chartId}`;
}

function getOrCreateListeners(projectId: number, chartId: number): Set<() => void> {
  const key = createScopeKey(projectId, chartId);
  const existing = listenersByScopeKey.get(key);
  if (existing) {
    return existing;
  }

  const created = new Set<() => void>();
  listenersByScopeKey.set(key, created);
  return created;
}

export function setGanttRuntimeChartCacheEntry(
  projectId: number,
  chartId: number,
  entry: GanttRuntimeChartCacheEntry,
): void {
  const key = createScopeKey(projectId, chartId);
  runtimeChartCacheByScopeKey.set(key, entry);
  runtimeChartValidationErrorByScopeKey.delete(key);
  getOrCreateListeners(projectId, chartId).forEach((listener) => {
    listener();
  });
}

export function trySetValidatedGanttRuntimeChartCacheEntry(
  projectId: number,
  chartId: number,
  entry: GanttRuntimeChartCacheEntry,
): GanttRuntimeChartValidationResult {
  try {
    validateProjectChartTaskIdsInFrontend(entry.serializedXml);
    setGanttRuntimeChartCacheEntry(projectId, chartId, entry);
    return {
      error: null,
      ok: true,
    };
  } catch (error) {
    const issue = error instanceof ProjectChartTaskIdValidationError
      ? error.issue
      : createInvalidValidationIssue();
    const key = createScopeKey(projectId, chartId);
    runtimeChartValidationErrorByScopeKey.set(key, issue);
    getOrCreateListeners(projectId, chartId).forEach((listener) => {
      listener();
    });
    return {
      error: issue,
      ok: false,
    };
  }
}

function createInvalidValidationIssue(): ProjectChartTaskIdValidationIssue {
  return {
    code: "invalid_xml",
    message: "Project chart XML could not be parsed.",
    taskId: null,
  };
}

export function getGanttRuntimeChartValidationError(
  projectId: number,
  chartId: number,
): ProjectChartTaskIdValidationIssue | null {
  return runtimeChartValidationErrorByScopeKey.get(createScopeKey(projectId, chartId)) ?? null;
}

export function clearGanttRuntimeChartValidationError(projectId: number, chartId: number): void {
  runtimeChartValidationErrorByScopeKey.delete(createScopeKey(projectId, chartId));
  getOrCreateListeners(projectId, chartId).forEach((listener) => {
    listener();
  });
}

export function getGanttRuntimeChartCacheEntry(
  projectId: number,
  chartId: number,
): GanttRuntimeChartCacheEntry | undefined {
  return runtimeChartCacheByScopeKey.get(createScopeKey(projectId, chartId));
}

export function subscribeGanttRuntimeChartCache(
  projectId: number,
  chartId: number,
  listener: () => void,
): () => void {
  const key = createScopeKey(projectId, chartId);
  const listeners = getOrCreateListeners(projectId, chartId);
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      listenersByScopeKey.delete(key);
    }
  };
}

export function clearGanttRuntimeChartCacheEntry(projectId: number, chartId: number): void {
  const key = createScopeKey(projectId, chartId);
  runtimeChartCacheByScopeKey.delete(key);
  runtimeChartValidationErrorByScopeKey.delete(key);
  const listeners = listenersByScopeKey.get(key);
  listeners?.forEach((listener) => {
    listener();
  });
}

export function clearGanttRuntimeChartCache(): void {
  for (const scopeKey of runtimeChartCacheByScopeKey.keys()) {
    const [projectIdText, chartIdText] = scopeKey.split(":");
    clearGanttRuntimeChartCacheEntry(Number(projectIdText), Number(chartIdText));
  }
  runtimeChartCacheByScopeKey.clear();
  runtimeChartValidationErrorByScopeKey.clear();
  listenersByScopeKey.clear();
}
