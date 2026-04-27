import { beforeEach, describe, expect, it, vi } from "vitest";

import { ganttApi } from "../api/gantt-api.js";
import { getGanttRuntimeChartCacheEntry } from "./gantt-runtime-chart-cache.js";
import { loadAggregatedProjectChartSources } from "./project-charts-aggregation.js";

vi.mock("../api/gantt-api.js", () => ({
  ganttApi: {
    getProjectChartOrNull: vi.fn(),
    listProjectCharts: vi.fn(),
  },
}));

vi.mock("./gantt-runtime-chart-cache.js", () => ({
  getGanttRuntimeChartCacheEntry: vi.fn(),
}));

const ganttApiMock = vi.mocked(ganttApi);
const getGanttRuntimeChartCacheEntryMock = vi.mocked(getGanttRuntimeChartCacheEntry);

describe("project-charts-aggregation", () => {
  beforeEach(() => {
    ganttApiMock.listProjectCharts.mockReset();
    ganttApiMock.getProjectChartOrNull.mockReset();
    getGanttRuntimeChartCacheEntryMock.mockReset();
  });

  it("loads and sorts chart sources by chart id", async () => {
    ganttApiMock.listProjectCharts.mockResolvedValue({
      charts: [
        { chartId: 2, id: 30, name: "third", projectId: 7 },
        { chartId: 0, id: 10, name: "default", projectId: 7 },
        { chartId: 1, id: 20, name: "second", projectId: 7 },
      ],
    });
    getGanttRuntimeChartCacheEntryMock.mockReturnValue(undefined);
    ganttApiMock.getProjectChartOrNull
      .mockResolvedValueOnce({ content: "<data id=\"0\"/>", type: "xml" })
      .mockResolvedValueOnce({ content: "<data id=\"1\"/>", type: "xml" })
      .mockResolvedValueOnce({ content: "<data id=\"2\"/>", type: "xml" });

    const result = await loadAggregatedProjectChartSources("token", 7);

    expect(result.map((entry) => entry.chartId)).toEqual([0, 1, 2]);
    expect(result.map((entry) => entry.chartName)).toEqual(["default", "second", "third"]);
    expect(result.map((entry) => entry.serializedXml)).toEqual([
      "<data id=\"0\"/>",
      "<data id=\"1\"/>",
      "<data id=\"2\"/>",
    ]);
  });

  it("prefers runtime cache entries and skips server fetch for cached charts", async () => {
    ganttApiMock.listProjectCharts.mockResolvedValue({
      charts: [
        { chartId: 0, id: 10, name: "default", projectId: 11 },
        { chartId: 1, id: 20, name: "second", projectId: 11 },
      ],
    });
    getGanttRuntimeChartCacheEntryMock.mockImplementation((_projectId, chartId) => {
      if (chartId === 1) {
        return { serializedXml: "<data id=\"cached-1\"/>", type: "xml" };
      }
      return undefined;
    });
    ganttApiMock.getProjectChartOrNull.mockResolvedValueOnce({
      content: "<data id=\"server-0\"/>",
      type: "xml",
    });

    const result = await loadAggregatedProjectChartSources("token", 11);

    expect(result).toEqual([
      { chartId: 0, chartName: "default", serializedXml: "<data id=\"server-0\"/>" },
      { chartId: 1, chartName: "second", serializedXml: "<data id=\"cached-1\"/>" },
    ]);
    expect(ganttApiMock.getProjectChartOrNull).toHaveBeenCalledTimes(1);
    expect(ganttApiMock.getProjectChartOrNull).toHaveBeenCalledWith("token", 11, 0);
  });

  it("filters out charts whose XML is missing from both cache and server", async () => {
    ganttApiMock.listProjectCharts.mockResolvedValue({
      charts: [
        { chartId: 0, id: 10, name: "default", projectId: 15 },
        { chartId: 1, id: 20, name: "second", projectId: 15 },
      ],
    });
    getGanttRuntimeChartCacheEntryMock.mockReturnValue(undefined);
    ganttApiMock.getProjectChartOrNull
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ content: "<data id=\"only-second\"/>", type: "xml" });

    const result = await loadAggregatedProjectChartSources("token", 15);

    expect(result).toEqual([
      { chartId: 1, chartName: "second", serializedXml: "<data id=\"only-second\"/>" },
    ]);
  });
});
