import React, { StrictMode } from "react";
import {
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ProjectManagerGanttPage } from "./ProjectManagerGanttPage.js";

const mockGantt = {
  clearAll: vi.fn(),
  config: {
    columns: [] as unknown[],
    date_format: "",
    show_chart: true,
    show_grid: true,
  },
  destructor: vi.fn(),
  init: vi.fn(),
  parse: vi.fn(),
  resetLayout: vi.fn(),
  setSizes: vi.fn(),
};

vi.mock("../lib/dhtmlx-gantt-adapter.js", () => ({
  getDhtmlxGantt: () => mockGantt,
}));

describe("ProjectManagerGanttPage", () => {
  beforeEach(() => {
    mockGantt.clearAll.mockReset();
    mockGantt.config.columns = [];
    mockGantt.config.date_format = "";
    mockGantt.config.show_chart = true;
    mockGantt.config.show_grid = true;
    mockGantt.destructor.mockReset();
    mockGantt.init.mockReset();
    mockGantt.parse.mockReset();
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

  it("loads sample gantt data on first render", async () => {
    renderWithTheme(<ProjectManagerGanttPage projectId={null} />);

    await waitFor(() => {
      expect(mockGantt.parse).toHaveBeenCalledTimes(1);
    });

    expect(mockGantt.parse.mock.calls[0]?.[0]).toMatchObject({
      data: expect.any(Array),
      links: expect.any(Array),
    });
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

    await user.click(screen.getByRole("tab", { name: "Grid" }));

    expect(mockGantt.config.show_grid).toBe(true);
    expect(mockGantt.config.show_chart).toBe(false);

    await user.click(screen.getByRole("tab", { name: "Chart" }));

    expect(mockGantt.config.show_grid).toBe(false);
    expect(mockGantt.config.show_chart).toBe(true);

    await user.click(screen.getByRole("tab", { name: "Both" }));

    expect(mockGantt.config.show_grid).toBe(true);
    expect(mockGantt.config.show_chart).toBe(true);
    expect(mockGantt.resetLayout).toHaveBeenCalled();
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
