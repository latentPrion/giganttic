import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearGanttRuntimeChartCache,
  getGanttRuntimeChartCacheEntry,
} from "./gantt-runtime-chart-cache.js";
import {
  emitGanttRuntimeChartUpdatedEvent,
  emitGanttRuntimeMetadataReloadRequestedEvent,
  subscribeGanttRuntimeChartUpdatedEvent,
  subscribeGanttRuntimeMetadataReloadRequestedEvent,
} from "./gantt-runtime-chart-events.js";

describe("gantt-runtime-chart-events", () => {
  beforeEach(() => {
    clearGanttRuntimeChartCache();
  });

  afterEach(() => {
    clearGanttRuntimeChartCache();
  });

  it("writes runtime update payload into cache and dispatches update subscribers", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeGanttRuntimeChartUpdatedEvent(handler);

    emitGanttRuntimeChartUpdatedEvent({
      projectId: 42,
      serializedXml: "<data><task id=\"42\"/></data>",
    });

    expect(handler).toHaveBeenCalledWith({
      projectId: 42,
      serializedXml: "<data><task id=\"42\"/></data>",
    });
    expect(getGanttRuntimeChartCacheEntry(42)?.serializedXml).toContain("task id=\"42\"");

    unsubscribe();
  });

  it("dispatches metadata-reload requests with project-scoped payload", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeGanttRuntimeMetadataReloadRequestedEvent(handler);

    emitGanttRuntimeMetadataReloadRequestedEvent({ projectId: 7 });

    expect(handler).toHaveBeenCalledWith({ projectId: 7 });
    unsubscribe();
  });
});

