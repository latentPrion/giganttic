import React, { StrictMode } from "react";
import {
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ProjectManagerGanttPage } from "./ProjectManagerGanttPage.js";

const mockRepoChartData = {
  data: [
    {
      duration: 3,
      id: 1001,
      start_date: "2026-03-09 00:00",
      text: "Repo chart task",
    },
  ],
  links: [],
};

const mockGantt = {
  clearAll: vi.fn(),
  config: {
    columns: [] as unknown[],
    date_format: "",
    grid_width: 0,
    keep_grid_width: false,
    layout: null as unknown,
    show_chart: true,
    show_grid: true,
  },
  destructor: vi.fn(),
  init: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
  resetLayout: vi.fn(),
  setSizes: vi.fn(),
};

vi.mock("../lib/dhtmlx-gantt-adapter.js", () => ({
  getDhtmlxGantt: () => mockGantt,
}));

vi.mock("../data/repo-gantt-chart-data.js", () => ({
  getRepoGanttChartData: () => mockRepoChartData,
}));

describe("ProjectManagerGanttPage", () => {
  beforeEach(() => {
    mockGantt.clearAll.mockReset();
    mockGantt.config.columns = [];
    mockGantt.config.date_format = "";
    mockGantt.config.grid_width = 0;
    mockGantt.config.keep_grid_width = false;
    mockGantt.config.layout = null;
    mockGantt.config.show_chart = true;
    mockGantt.config.show_grid = true;
    mockGantt.destructor.mockReset();
    mockGantt.init.mockReset();
    mockGantt.parse.mockReset();
    mockGantt.render.mockReset();
    mockGantt.resetLayout.mockReset();
    mockGantt.setSizes.mockReset();
  });

  it("renders the gantt container and bottom control panel", async () => {
    renderWithTheme(<ProjectManagerGanttPage projectId={42} />);

    expect(screen.getByText("Project Manager Gantt")).toBeVisible();
    expect(screen.getByText("Selected project: 42")).toBeVisible();
    expect(screen.getByTestId("pm-gantt-chart-container")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Both" })).toBeVisible();

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });
  });

  it("loads gantt data from the repo charts loader on first render", async () => {
    renderWithTheme(<ProjectManagerGanttPage projectId={null} />);

    await waitFor(() => {
      expect(mockGantt.parse).toHaveBeenCalledTimes(1);
    });

    expect(mockGantt.config.keep_grid_width).toBe(true);
    expect(mockGantt.parse.mock.calls[0]?.[0]).toEqual(mockRepoChartData);
  });

  it("cleans up the gantt instance on unmount", async () => {
    const view = renderWithTheme(<ProjectManagerGanttPage projectId={42} />);

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    view.unmount();

    expect(mockGantt.clearAll).toHaveBeenCalledTimes(1);
    expect(mockGantt.destructor).not.toHaveBeenCalled();
  });

  it("survives React Strict Mode remounts without destructing the shared gantt instance", async () => {
    renderWithTheme(
      <StrictMode>
        <ProjectManagerGanttPage projectId={42} />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalled();
    });

    expect(screen.getByText("Project Manager Gantt")).toBeVisible();
    expect(mockGantt.destructor).not.toHaveBeenCalled();
  });

  it("switches display modes from the bottom control panel tabs", async () => {
    const user = userEvent.setup();

    renderWithTheme(<ProjectManagerGanttPage projectId={42} />);

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("tab", { name: "Grid" }));

    expect(mockGantt.config.layout).toMatchObject({
      rows: [
        {
          cols: [
            { scrollX: "scrollHor", scrollY: "scrollVer", view: "grid" },
            { id: "scrollVer", view: "scrollbar" },
          ],
        },
        { height: 20, id: "scrollHor", view: "scrollbar" },
      ],
    });
    expect(mockGantt.config.show_grid).toBe(true);
    expect(mockGantt.config.show_chart).toBe(false);
    expect(mockGantt.init).toHaveBeenCalledTimes(2);
    expect(mockGantt.parse).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole("tab", { name: "Chart" }));

    expect(mockGantt.config.layout).toMatchObject({
      rows: [
        {
          cols: [
            { scrollX: "scrollHor", scrollY: "scrollVer", view: "timeline" },
            { id: "scrollVer", view: "scrollbar" },
          ],
        },
        { height: 20, id: "scrollHor", view: "scrollbar" },
      ],
    });
    expect(mockGantt.config.show_grid).toBe(false);
    expect(mockGantt.config.show_chart).toBe(true);
    expect(mockGantt.init).toHaveBeenCalledTimes(3);
    expect(mockGantt.parse).toHaveBeenCalledTimes(3);

    await user.click(screen.getByRole("tab", { name: "Both" }));

    expect(mockGantt.config.layout).toMatchObject({
      rows: [
        {
          cols: [
            { view: "grid", width: expect.any(Number) },
            { resizer: true, width: 1 },
            {
              gravity: expect.any(Number),
              scrollX: "scrollHor",
              scrollY: "scrollVer",
              view: "timeline",
            },
            { id: "scrollVer", view: "scrollbar" },
          ],
        },
        { height: 20, id: "scrollHor", view: "scrollbar" },
      ],
    });
    expect(mockGantt.config.grid_width).toBeGreaterThan(0);
    expect(mockGantt.config.show_grid).toBe(true);
    expect(mockGantt.config.show_chart).toBe(true);
    expect(mockGantt.init).toHaveBeenCalledTimes(4);
    expect(mockGantt.parse).toHaveBeenCalledTimes(4);
    expect(mockGantt.render).toHaveBeenCalled();
    expect(mockGantt.setSizes).toHaveBeenCalled();
  });

  it("can collapse and reopen the gantt control panel", async () => {
    const user = userEvent.setup();

    renderWithTheme(<ProjectManagerGanttPage projectId={42} />);

    await user.click(screen.getByRole("button", { name: "Hide Controls" }));

    expect(screen.queryByRole("tab", { name: "Both" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Controls" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Show Controls" }));

    expect(screen.getByRole("tab", { name: "Both" })).toBeVisible();
  });
});
