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

const runtimeChartCacheByProjectId = new Map<number, GanttRuntimeChartCacheEntry>();
const runtimeChartValidationErrorByProjectId = new Map<
  number,
  ProjectChartTaskIdValidationIssue
>();
const listenersByProjectId = new Map<number, Set<() => void>>();

function getOrCreateListeners(projectId: number): Set<() => void> {
  const existing = listenersByProjectId.get(projectId);
  if (existing) {
    return existing;
  }

  const created = new Set<() => void>();
  listenersByProjectId.set(projectId, created);
  return created;
}

export function setGanttRuntimeChartCacheEntry(
  projectId: number,
  entry: GanttRuntimeChartCacheEntry,
): void {
  runtimeChartCacheByProjectId.set(projectId, entry);
  runtimeChartValidationErrorByProjectId.delete(projectId);
  getOrCreateListeners(projectId).forEach((listener) => {
    listener();
  });
}

export function trySetValidatedGanttRuntimeChartCacheEntry(
  projectId: number,
  entry: GanttRuntimeChartCacheEntry,
): GanttRuntimeChartValidationResult {
  try {
    validateProjectChartTaskIdsInFrontend(entry.serializedXml);
    setGanttRuntimeChartCacheEntry(projectId, entry);
    return {
      error: null,
      ok: true,
    };
  } catch (error) {
    const issue = error instanceof ProjectChartTaskIdValidationError
      ? error.issue
      : createInvalidValidationIssue();
    runtimeChartValidationErrorByProjectId.set(projectId, issue);
    getOrCreateListeners(projectId).forEach((listener) => {
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
): ProjectChartTaskIdValidationIssue | null {
  return runtimeChartValidationErrorByProjectId.get(projectId) ?? null;
}

export function clearGanttRuntimeChartValidationError(projectId: number): void {
  runtimeChartValidationErrorByProjectId.delete(projectId);
  getOrCreateListeners(projectId).forEach((listener) => {
    listener();
  });
}

export function getGanttRuntimeChartCacheEntry(
  projectId: number,
): GanttRuntimeChartCacheEntry | undefined {
  return runtimeChartCacheByProjectId.get(projectId);
}

export function subscribeGanttRuntimeChartCache(
  projectId: number,
  listener: () => void,
): () => void {
  const listeners = getOrCreateListeners(projectId);
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      listenersByProjectId.delete(projectId);
    }
  };
}

export function clearGanttRuntimeChartCacheEntry(projectId: number): void {
  runtimeChartCacheByProjectId.delete(projectId);
  runtimeChartValidationErrorByProjectId.delete(projectId);
  const listeners = listenersByProjectId.get(projectId);
  listeners?.forEach((listener) => {
    listener();
  });
}

export function clearGanttRuntimeChartCache(): void {
  for (const projectId of runtimeChartCacheByProjectId.keys()) {
    clearGanttRuntimeChartCacheEntry(projectId);
  }
  runtimeChartCacheByProjectId.clear();
  runtimeChartValidationErrorByProjectId.clear();
  listenersByProjectId.clear();
}
