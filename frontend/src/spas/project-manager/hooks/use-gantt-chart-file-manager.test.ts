import { act, renderHook, waitFor } from "@testing-library/react";
import type { RefObject } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../common/api/api-error.js";
import { ganttApi } from "../api/gantt-api.js";
import { DEFAULT_PROJECT_CHART_XML } from "../lib/default-project-chart-xml.js";
import {
  GGTC_TASK_CLOSED_REASON_ATTRIBUTE,
  GGTC_TASK_STATUS_ATTRIBUTE,
} from "../lib/ggtc-dhtmlx-gantt-extensions-manager.js";
import type { GanttChartHandle } from "../models/gantt-chart-handle.js";
import { useGanttChartFileManager } from "./use-gantt-chart-file-manager.js";

function stubGanttRef(
  current: { getSerializedXml: () => string } | null,
): RefObject<GanttChartHandle | null> {
  if (current === null) {
    return { current: null };
  }
  return { current: current as unknown as GanttChartHandle | null };
}

vi.mock("../api/gantt-api.js", () => ({
  ganttApi: {
    getProjectChartOrNull: vi.fn(),
    putProjectChart: vi.fn(),
  },
}));

const ganttApiMock = vi.mocked(ganttApi);

const SERVER_XML = "<?xml version=\"1.0\"?><data><task id=\"1\" ggtc_task_status=\"ISSUE_STATUS_OPEN\" ggtc_task_closed_reason=\"\"/></data>";
const BASELINE_XML = "<baseline/>";
const MISSING_EXTENSION_XML = "<?xml version=\"1.0\"?><data><task id=\"1\"/></data>";
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
    const ganttRef = stubGanttRef(null);

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
    const ganttRef = stubGanttRef(null);

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
    expect(result.current.chartSource).toBeNull();
  });

  it("sets loadErrorMessage when chart load fails", async () => {
    ganttApiMock.getProjectChartOrNull.mockRejectedValue(
      new ApiError("http", "HTTP 500", {
        responseBody: "{\"message\":\"Chart service down\"}",
        status: 500,
      }),
    );
    const ganttRef = stubGanttRef(null);

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

  it("normalizes missing task extension attrs during load", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: MISSING_EXTENSION_XML,
      type: "xml",
    });
    const ganttRef = stubGanttRef(null);

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 15,
        token: "token-normalize",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const normalizedXml = result.current.chartSource?.content ?? "";
    const xmlDocument = new DOMParser().parseFromString(normalizedXml, "application/xml");
    const taskElement = xmlDocument.querySelector("task[id=\"1\"]");

    expect(taskElement?.getAttribute(GGTC_TASK_STATUS_ATTRIBUTE)).toBe("ISSUE_STATUS_OPEN");
    expect(taskElement?.getAttribute(GGTC_TASK_CLOSED_REASON_ATTRIBUTE)).toBe("");
  });

  it("resets state when projectId is null", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: SERVER_XML,
      type: "xml",
    });
    const ganttRef = stubGanttRef(null);

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
    const ganttRef = stubGanttRef({ getSerializedXml });

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
    const ganttRef = stubGanttRef({ getSerializedXml: () => MODIFIED_XML });

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
    const ganttRef = stubGanttRef({ getSerializedXml });

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
      const persistResult = await result.current.persistChart();
      expect(persistResult.didPersist).toBe(true);
      expect(persistResult.missingExtensionAttributeReports).toEqual([]);
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
    const ganttRef = stubGanttRef({ getSerializedXml: () => MODIFIED_XML });

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
      const persistResult = await result.current.persistChart();
      expect(persistResult.didPersist).toBe(false);
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
    const ganttRef = stubGanttRef({ getSerializedXml: () => MODIFIED_XML });

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

  it("returns save diagnostics when extension attrs are missing at save", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: SERVER_XML,
      type: "xml",
    });
    ganttApiMock.putProjectChart.mockResolvedValue({ ok: true });
    const ganttRef = stubGanttRef({ getSerializedXml: () => "<data><task id=\"55\"/></data>" });

    const { result } = renderHook(() =>
      useGanttChartFileManager({
        ganttRef,
        projectId: 22,
        token: "tok-diag",
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      const persistResult = await result.current.persistChart();
      expect(persistResult.didPersist).toBe(true);
      expect(persistResult.missingExtensionAttributeReports).toEqual([
        {
          missingAttributes: [
            GGTC_TASK_STATUS_ATTRIBUTE,
            GGTC_TASK_CLOSED_REASON_ATTRIBUTE,
          ],
          taskId: "55",
        },
      ]);
    });
  });

  it("does not call putProjectChart when projectId is null", async () => {
    const ganttRef = stubGanttRef({ getSerializedXml: () => MODIFIED_XML });

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

  it("creates a default chart when no server chart exists yet", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValue(null);
    ganttApiMock.putProjectChart.mockResolvedValue({ ok: true });
    const ganttRef = stubGanttRef(null);

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

    expect(ganttApiMock.putProjectChart).toHaveBeenCalledWith(
      "tok-i",
      8,
      DEFAULT_PROJECT_CHART_XML,
    );
    expect(result.current.chartSource).toEqual({
      content: DEFAULT_PROJECT_CHART_XML,
      type: "xml",
    });
    expect(result.current.hasServerChart).toBe(true);
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
    const ganttRef = stubGanttRef({ getSerializedXml: () => MODIFIED_XML });

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

    let persistPromise: ReturnType<typeof result.current.persistChart>;
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
    const ganttRef = stubGanttRef(null);

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
