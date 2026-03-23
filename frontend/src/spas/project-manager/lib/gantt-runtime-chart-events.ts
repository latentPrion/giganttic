export const GANTT_RUNTIME_CHART_UPDATED_EVENT = "gantt-runtime-chart-updated";

export interface GanttRuntimeChartUpdatedEventDetail {
  projectId: number;
  /**
   * Post-inference serialized XML that represents the chart state in the editor runtime.
   * This is what other UI surfaces (Tasks tab) should parse for milestone bucketing.
   */
  serializedXml: string;
}

export function emitGanttRuntimeChartUpdatedEvent(
  detail: GanttRuntimeChartUpdatedEventDetail,
): void {
  if (typeof window === "undefined") {
    return;
  }

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

