import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearGanttRuntimeChartCache,
  clearGanttRuntimeChartCacheEntry,
  getGanttRuntimeChartCacheEntry,
  getGanttRuntimeChartValidationError,
  setGanttRuntimeChartCacheEntry,
  subscribeGanttRuntimeChartCache,
  trySetValidatedGanttRuntimeChartCacheEntry,
} from "./gantt-runtime-chart-cache.js";

describe("gantt-runtime-chart-cache", () => {
  beforeEach(() => {
    clearGanttRuntimeChartCache();
  });

  it("stores cache entries per project id without clobbering other projects", () => {
    setGanttRuntimeChartCacheEntry(4, 0, { serializedXml: "<data id=\"4\"/>", type: "xml" });
    setGanttRuntimeChartCacheEntry(9, 0, { serializedXml: "<data id=\"9\"/>", type: "xml" });

    expect(getGanttRuntimeChartCacheEntry(4, 0)?.serializedXml).toContain("id=\"4\"");
    expect(getGanttRuntimeChartCacheEntry(9, 0)?.serializedXml).toContain("id=\"9\"");
  });

  it("notifies only listeners subscribed to the updated project id", () => {
    const listener4 = vi.fn();
    const listener9 = vi.fn();
    const unsubscribe4 = subscribeGanttRuntimeChartCache(4, 0, listener4);
    const unsubscribe9 = subscribeGanttRuntimeChartCache(9, 0, listener9);

    setGanttRuntimeChartCacheEntry(4, 0, { serializedXml: "<data/>", type: "xml" });

    expect(listener4).toHaveBeenCalledTimes(1);
    expect(listener9).not.toHaveBeenCalled();

    unsubscribe4();
    unsubscribe9();
  });

  it("clears only one project entry when clear entry is used", () => {
    setGanttRuntimeChartCacheEntry(4, 0, { serializedXml: "<data id=\"4\"/>", type: "xml" });
    setGanttRuntimeChartCacheEntry(9, 0, { serializedXml: "<data id=\"9\"/>", type: "xml" });

    clearGanttRuntimeChartCacheEntry(4, 0);

    expect(getGanttRuntimeChartCacheEntry(4, 0)).toBeUndefined();
    expect(getGanttRuntimeChartCacheEntry(9, 0)).toBeDefined();
  });

  it("rejects duplicate task ids and stores a validation error without overwriting cache", () => {
    setGanttRuntimeChartCacheEntry(4, 0, {
      serializedXml: "<data><task id=\"stable\"/></data>",
      type: "xml",
    });

    const result = trySetValidatedGanttRuntimeChartCacheEntry(4, 0, {
      serializedXml: "<data><task id=\"dup\"/><task id=\"dup\"/></data>",
      type: "xml",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: "duplicate_id",
      taskId: "dup",
    });
    expect(getGanttRuntimeChartCacheEntry(4, 0)?.serializedXml).toContain("stable");
    expect(getGanttRuntimeChartValidationError(4, 0)).toMatchObject({
      code: "duplicate_id",
      taskId: "dup",
    });
  });
});
