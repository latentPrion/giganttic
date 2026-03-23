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

const runtimeChartCacheByProjectId = new Map<number, GanttRuntimeChartCacheEntry>();
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
  listenersByProjectId.clear();
}

