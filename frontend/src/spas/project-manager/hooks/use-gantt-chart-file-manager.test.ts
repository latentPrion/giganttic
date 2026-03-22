import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../common/api/api-error.js";
import { ganttApi } from "../api/gantt-api.js";
import { DEFAULT_PROJECT_CHART_XML } from "../lib/default-project-chart-xml.js";
import { useGanttChartFileManager } from "./use-gantt-chart-file-manager.js";

vi.mock("../api/gantt-api.js", () => ({
  ganttApi: {
    getProjectChartOrNull: vi.fn(),
    putProjectChart: vi.fn(),
  },
}));

const ganttApiMock = vi.mocked(ganttApi);

const SERVER_XML = "<?xml version=\"1.0\"?><data><task id=\"1\"/></data>";
const BASELINE_XML = "<baseline/>";
const MODIFIED_XML = "<modified/>";

describe("useGanttChartFileManager", () => {
  beforeEach(() => {
    ganttApiMock.getProjectChartOrNull.mockReset();
    ganttApiMock.putProjectChart.mockReset();
  });

  it("loads chart from the server when getProjectChartOrNull returns XML", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: SERVER_XML,
      type: "xml",
    });
    const ganttRef = { current: null };

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 42,
        token: "token-a",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(ganttApiMock.getProjectChartOrNull).toHaveBeenCalledWith("token-a", 42);
    expect(result.current.chartSource).toEqual({ content: SERVER_XML, type: "xml" });
    expect(result.current.hasServerChart).toBe(true);
    expect(result.current.loadErrorMessage).toBeNull();
    expect(result.current.isDirty).toBe(false);
  });

  it("uses default XML and hasServerChart false when the server has no chart file", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue(null);
    const ganttRef = { current: null };

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 7,
        token: "token-b",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasServerChart).toBe(false);
    expect(result.current.chartSource).toEqual({
      content: DEFAULT_PROJECT_CHART_XML,
      type: "xml",
    });
  });

  it("sets loadErrorMessage when chart load fails", async () => {
    ganttApiMock.getProjectChartOrNull.mockRejectedValue(
      new ApiError("http", "HTTP 500", {
        responseBody: "{\"message\":\"Chart service down\"}",
        status: 500,
      }),
    );
    const ganttRef = { current: null };

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 3,
        token: "token-c",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.chartSource).toBeNull();
    expect(result.current.loadErrorMessage).toBe("Chart service down");
  });

  it("resets state when projectId is null", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: SERVER_XML,
      type: "xml",
    });
    const ganttRef = { current: null };

    const { result, rerender } = renderHook(
      ({ projectId }: { projectId: number | null }) =>
        useGanttChartFileManager({
          ganttRef,
          projectId,
          token: "token-d",
        }),
      { initialProps: { projectId: 99 as number | null } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.chartSource).not.toBeNull();

    rerender({ projectId: null });

    await waitFor(() => {
      expect(result.current.chartSource).toBeNull();
    });
    expect(result.current.hasServerChart).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("marks dirty when serialized XML differs from baseline", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: SERVER_XML,
      type: "xml",
    });
    const getSerializedXml = vi.fn().mockReturnValue(MODIFIED_XML);
    const ganttRef = {
      current: { getSerializedXml },
    };

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 1,
        token: "tok",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setInitialBaseline(BASELINE_XML);
    });
    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.setDirtyFromEditor();
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      getSerializedXml.mockReturnValue(BASELINE_XML);
      result.current.setDirtyFromEditor();
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("does not mark dirty before setInitialBaseline", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: SERVER_XML,
      type: "xml",
    });
    const ganttRef = {
      current: { getSerializedXml: () => MODIFIED_XML },
    };

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 1,
        token: "tok",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setDirtyFromEditor();
    });
    expect(result.current.isDirty).toBe(false);
  });

  it("persistChart calls putProjectChart and clears dirty state", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: SERVER_XML,
      type: "xml",
    });
    ganttApiMock.putProjectChart.mockResolvedValue({ ok: true });
    const getSerializedXml = vi.fn().mockReturnValue(MODIFIED_XML);
    const ganttRef = {
      current: { getSerializedXml },
    };

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 5,
        token: "tok-e",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setInitialBaseline(BASELINE_XML);
    });
    act(() => {
      result.current.setDirtyFromEditor();
    });
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.persistChart();
    });

    expect(ganttApiMock.putProjectChart).toHaveBeenCalledWith("tok-e", 5, MODIFIED_XML);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.hasServerChart).toBe(true);
    expect(result.current.persistErrorMessage).toBeNull();
    expect(result.current.isPersisting).toBe(false);
  });

  it("persistChart sets persistErrorMessage on failure", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: SERVER_XML,
      type: "xml",
    });
    ganttApiMock.putProjectChart.mockRejectedValue(
      new ApiError("http", "HTTP 403", {
        responseBody: "",
        status: 403,
      }),
    );
    const ganttRef = {
      current: { getSerializedXml: () => MODIFIED_XML },
    };

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 2,
        token: "tok-f",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.persistChart();
    });

    expect(result.current.persistErrorMessage).toBeTruthy();
    expect(result.current.isPersisting).toBe(false);
  });

  it("clearPersistError clears persistErrorMessage", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: SERVER_XML,
      type: "xml",
    });
    ganttApiMock.putProjectChart.mockRejectedValue(new Error("network"));
    const ganttRef = {
      current: { getSerializedXml: () => MODIFIED_XML },
    };

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 2,
        token: "tok-g",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.persistChart();
    });

    expect(result.current.persistErrorMessage).toBeTruthy();

    act(() => {
      result.current.clearPersistError();
    });
    expect(result.current.persistErrorMessage).toBeNull();
  });

  it("does not call putProjectChart when projectId is null", async () => {
    const ganttRef = {
      current: { getSerializedXml: () => MODIFIED_XML },
    };

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: null,
        token: "tok-h",
      }),
    );

    await act(async () => {
      await result.current.persistChart();
    });

    expect(ganttApiMock.putProjectChart).not.toHaveBeenCalled();
  });

  it("does not call putProjectChart when gantt ref has no serializer", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: SERVER_XML,
      type: "xml",
    });
    const ganttRef = { current: null };

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 8,
        token: "tok-i",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.persistChart();
    });

    expect(ganttApiMock.putProjectChart).not.toHaveBeenCalled();
  });

  it("sets isPersisting true while putProjectChart is in flight", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: SERVER_XML,
      type: "xml",
    });
    let resolvePut!: (value: { ok: true }) => void;
    const putPromise = new Promise<{ ok: true }>((resolve) => {
      resolvePut = resolve;
    });
    ganttApiMock.putProjectChart.mockReturnValue(putPromise);
    const ganttRef = {
      current: { getSerializedXml: () => MODIFIED_XML },
    };

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 11,
        token: "tok-k",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let persistPromise: Promise<void>;
    act(() => {
      persistPromise = result.current.persistChart();
    });

    expect(result.current.isPersisting).toBe(true);

    await act(async () => {
      resolvePut({ ok: true });
      await persistPromise!;
    });

    expect(result.current.isPersisting).toBe(false);
  });

  it("reloadChart refetches from the API", async () => {
    ganttApiMock.getProjectChartOrNull
      .mockResolvedValueOnce({
        content: "<first/>",
        type: "xml",
      })
      .mockResolvedValueOnce({
        content: "<second/>",
        type: "xml",
      });
    const ganttRef = { current: null };

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 10,
        token: "tok-j",
      }),
    );

    await waitFor(() => {
      expect(result.current.chartSource?.content).toBe("<first/>");
    });

    await act(async () => {
      await result.current.reloadChart();
    });

    await waitFor(() => {
      expect(result.current.chartSource?.content).toBe("<second/>");
    });
    expect(ganttApiMock.getProjectChartOrNull).toHaveBeenCalledTimes(2);
  });
});
