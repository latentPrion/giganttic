import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ganttApi } from "../api/gantt-api.js";
import { useProjectChartList } from "./use-project-chart-list.js";

vi.mock("../api/gantt-api.js", () => ({
  ganttApi: {
    listProjectCharts: vi.fn(),
  },
}));

const ganttApiMock = vi.mocked(ganttApi);

describe("useProjectChartList", () => {
  beforeEach(() => {
    ganttApiMock.listProjectCharts.mockReset();
  });

  it("returns an empty list and does not fetch when token is missing", async () => {
    const { result } = renderHook(() =>
      useProjectChartList({
        projectId: 42,
        token: undefined,
      }),
    );

    expect(result.current).toEqual([]);
    expect(ganttApiMock.listProjectCharts).not.toHaveBeenCalled();
  });

  it("loads charts for the selected project", async () => {
    ganttApiMock.listProjectCharts.mockResolvedValue({
      charts: [
        { chartId: 0, id: 1, name: "default", projectId: 42 },
        { chartId: 1, id: 2, name: "roadmap", projectId: 42 },
      ],
    });

    const { result } = renderHook(() =>
      useProjectChartList({
        projectId: 42,
        token: "token",
      }),
    );

    await waitFor(() => {
      expect(result.current).toHaveLength(2);
    });
    expect(result.current.map((entry) => entry.chartId)).toEqual([0, 1]);
    expect(ganttApiMock.listProjectCharts).toHaveBeenCalledWith("token", 42);
  });

  it("resets to empty list when loading charts fails", async () => {
    ganttApiMock.listProjectCharts.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() =>
      useProjectChartList({
        projectId: 42,
        token: "token",
      }),
    );

    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });
});

