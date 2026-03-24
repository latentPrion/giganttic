import { setGanttRuntimeChartCacheEntry } from "./gantt-runtime-chart-cache.js";

export const GANTT_RUNTIME_CHART_UPDATED_EVENT = "gantt-runtime-chart-updated";
export const GANTT_RUNTIME_METADATA_RELOAD_REQUESTED_EVENT = "gantt-runtime-metadata-reload-requested";

export interface GanttRuntimeChartUpdatedEventDetail {
  projectId: number;
  /**
   * Post-inference serialized XML that represents the chart state in the editor runtime.
   * This is what other UI surfaces (Tasks tab) should parse for milestone bucketing.
   */
  serializedXml: string;
}

export interface GanttRuntimeMetadataReloadRequestedEventDetail {
  projectId: number;
}

export function emitGanttRuntimeChartUpdatedEvent(
  detail: GanttRuntimeChartUpdatedEventDetail,
): void {
  if (typeof window === "undefined") {
    return;
  }

  setGanttRuntimeChartCacheEntry(detail.projectId, { serializedXml: detail.serializedXml, type: "xml" });

  window.dispatchEvent(
    new CustomEvent<GanttRuntimeChartUpdatedEventDetail>(GANTT_RUNTIME_CHART_UPDATED_EVENT, {
      detail,
    }),
  );
}

export function subscribeGanttRuntimeChartUpdatedEvent(
  handler: (detail: GanttRuntimeChartUpdatedEventDetail) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = (event: Event): void => {
    const customEvent = event as CustomEvent<GanttRuntimeChartUpdatedEventDetail>;
    if (!customEvent.detail) {
      return;
    }
    handler(customEvent.detail);
  };

  window.addEventListener(GANTT_RUNTIME_CHART_UPDATED_EVENT, listener);
  return () => window.removeEventListener(GANTT_RUNTIME_CHART_UPDATED_EVENT, listener);
}

export function emitGanttRuntimeMetadataReloadRequestedEvent(
  detail: GanttRuntimeMetadataReloadRequestedEventDetail,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<GanttRuntimeMetadataReloadRequestedEventDetail>(
      GANTT_RUNTIME_METADATA_RELOAD_REQUESTED_EVENT,
      { detail },
    ),
  );
}

export function subscribeGanttRuntimeMetadataReloadRequestedEvent(
  handler: (detail: GanttRuntimeMetadataReloadRequestedEventDetail) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const listener = (event: Event): void => {
    const customEvent = event as CustomEvent<GanttRuntimeMetadataReloadRequestedEventDetail>;
    if (!customEvent.detail) {
      return;
    }
    handler(customEvent.detail);
  };

  window.addEventListener(GANTT_RUNTIME_METADATA_RELOAD_REQUESTED_EVENT, listener);
  return () => window.removeEventListener(GANTT_RUNTIME_METADATA_RELOAD_REQUESTED_EVENT, listener);
}

