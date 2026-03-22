import React, { StrictMode } from "react";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ApiError } from "../../../common/api/api-error.js";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { appTheme } from "../../../theme/app-theme.js";
import { ProjectManagerGanttPage } from "./ProjectManagerGanttPage.js";

const TEST_TOKEN = "test-token";
const mockCapabilities = {
  ganttExport: {
    dhtmlxXml: {
      enabled: true,
    },
    msProjectXml: {
      enabled: true,
      mode: "cloud_fallback" as const,
      serverUrl: null,
    },
  },
};
const mockChartSource = {
  content: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><data><task id=\"1001\"><![CDATA[Repo chart task]]></task></data>",
  type: "xml" as const,
};
const getProjectChartExportCapabilitiesMock = vi.fn();
const getProjectChartMock = vi.fn();
const createObjectUrlMock = vi.fn(() => "blob:chart-download");
const revokeObjectUrlMock = vi.fn();

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
  exportToMSProject: vi.fn(),
  init: vi.fn(),
  parse: vi.fn(),
  render: vi.fn(),
  resetLayout: vi.fn(),
  setSizes: vi.fn(),
};

vi.mock("../lib/dhtmlx-gantt-adapter.js", () => ({
  getDhtmlxGantt: () => mockGantt,
}));

vi.mock("../api/gantt-api.js", () => ({
  ganttApi: {
    getProjectChartExportCapabilities: (...args: unknown[]) =>
      getProjectChartExportCapabilitiesMock(...args),
    getProjectChart: (...args: unknown[]) => getProjectChartMock(...args),
  },
}));

function renderWithProjectRouter(projectId: number) {
  return render(
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <MemoryRouter>
        <ProjectManagerGanttPage projectId={projectId} token={TEST_TOKEN} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("ProjectManagerGanttPage", () => {
  beforeEach(() => {
    getProjectChartExportCapabilitiesMock.mockReset();
    getProjectChartExportCapabilitiesMock.mockResolvedValue(mockCapabilities);
    getProjectChartMock.mockReset();
    getProjectChartMock.mockResolvedValue(mockChartSource);
    mockGantt.clearAll.mockReset();
    mockGantt.config.columns = [];
    mockGantt.config.date_format = "";
    mockGantt.config.grid_width = 0;
    mockGantt.config.keep_grid_width = false;
    mockGantt.config.layout = null;
    mockGantt.config.show_chart = true;
    mockGantt.config.show_grid = true;
    mockGantt.destructor.mockReset();
    mockGantt.exportToMSProject.mockReset();
    mockGantt.init.mockReset();
    mockGantt.parse.mockReset();
    mockGantt.render.mockReset();
    mockGantt.resetLayout.mockReset();
    mockGantt.setSizes.mockReset();
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
    URL.createObjectURL = createObjectUrlMock;
    URL.revokeObjectURL = revokeObjectUrlMock;
  });

  it("renders the gantt container and bottom control panel", async () => {
    renderWithTheme(<ProjectManagerGanttPage projectId={42} token={TEST_TOKEN} />);

    expect(screen.getByText("Project Manager Gantt")).toBeVisible();
    expect(screen.getByText("Selected project: 42")).toBeVisible();

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("pm-gantt-chart-container")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Both" })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Download\b/i })).toBeVisible();
    expect(screen.getByText("MS Project XML")).toBeVisible();
  });

  it("loads gantt XML from the backend chart api on first render", async () => {
    renderWithTheme(<ProjectManagerGanttPage projectId={42} token={TEST_TOKEN} />);

    await waitFor(() => {
      expect(mockGantt.parse).toHaveBeenCalledTimes(1);
    });

    expect(mockGantt.config.keep_grid_width).toBe(true);
    expect(getProjectChartMock).toHaveBeenCalledWith(TEST_TOKEN, 42);
    expect(getProjectChartExportCapabilitiesMock).toHaveBeenCalledWith(TEST_TOKEN);
    expect(mockGantt.parse.mock.calls[0]).toEqual([
      mockChartSource.content,
      mockChartSource.type,
    ]);
  });

  it("shows the missing-chart message when the backend returns 404", async () => {
    getProjectChartMock.mockRejectedValue(
      new ApiError("http", "HTTP 404", {
        responseBody: "",
        status: 404,
      }),
    );

    renderWithTheme(<ProjectManagerGanttPage projectId={42} token={TEST_TOKEN} />);

    expect(await screen.findByText("No gantt chart file exists for this project yet.")).toBeVisible();
    expect(mockGantt.parse).not.toHaveBeenCalled();
  });

  it("shows a generic error message when the backend returns a non-404 failure", async () => {
    getProjectChartMock.mockRejectedValue(
      new ApiError("http", "HTTP 500", {
        responseBody: "{\"message\":\"Broken chart endpoint\"}",
        status: 500,
      }),
    );

    renderWithTheme(<ProjectManagerGanttPage projectId={42} token={TEST_TOKEN} />);

    expect(await screen.findByText("Broken chart endpoint")).toBeVisible();
    expect(mockGantt.parse).not.toHaveBeenCalled();
  });

  it("cleans up the gantt instance on unmount", async () => {
    const view = renderWithTheme(<ProjectManagerGanttPage projectId={42} token={TEST_TOKEN} />);

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    view.unmount();

    expect(mockGantt.clearAll).toHaveBeenCalledTimes(1);
    expect(mockGantt.destructor).not.toHaveBeenCalled();
  });

  it("refetches the gantt chart when the selected project changes", async () => {
    const secondChartSource = {
      content: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><data><task id=\"2002\"><![CDATA[Second chart]]></task></data>",
      type: "xml" as const,
    };
    getProjectChartMock
      .mockResolvedValueOnce(mockChartSource)
      .mockResolvedValueOnce(secondChartSource);

    const view = renderWithProjectRouter(42);

    await waitFor(() => {
      expect(getProjectChartMock).toHaveBeenCalledWith(TEST_TOKEN, 42);
    });

    view.rerender(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <MemoryRouter>
          <ProjectManagerGanttPage projectId={77} token={TEST_TOKEN} />
        </MemoryRouter>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(getProjectChartMock).toHaveBeenCalledWith(TEST_TOKEN, 77);
    });

    await waitFor(() => {
      expect(mockGantt.parse).toHaveBeenCalledWith(
        secondChartSource.content,
        secondChartSource.type,
      );
    });
  });

  it("survives React Strict Mode remounts without destructing the shared gantt instance", async () => {
    renderWithTheme(
      <StrictMode>
        <ProjectManagerGanttPage projectId={42} token={TEST_TOKEN} />
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

    renderWithTheme(<ProjectManagerGanttPage projectId={42} token={TEST_TOKEN} />);

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

    renderWithTheme(<ProjectManagerGanttPage projectId={42} token={TEST_TOKEN} />);

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Hide Controls" }));

    expect(screen.queryByRole("tab", { name: "Both" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Controls" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Show Controls" }));

    expect(screen.getByRole("tab", { name: "Both" })).toBeVisible();
  });

  it("keeps the gantt download action in the same navigation row as the project tabs", async () => {
    renderWithTheme(<ProjectManagerGanttPage projectId={42} token={TEST_TOKEN} />);

    expect(await screen.findByRole("button", { name: /^Download\b/i })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Details" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose download format" })).toBeVisible();
  });

  it("downloads DHTMLX XML locally after changing the selected format", async () => {
    const user = userEvent.setup();

    renderWithTheme(<ProjectManagerGanttPage projectId={42} token={TEST_TOKEN} />);

    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    try {
      await waitFor(() => {
        expect(mockGantt.init).toHaveBeenCalledTimes(1);
      });

      await user.click(screen.getByRole("button", { name: "Choose download format" }));
      await user.click(screen.getByRole("menuitem", { name: "DHTMLX Gantt XML" }));
      await user.click(screen.getByRole("button", { name: /^Download\b/i }));

      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(mockGantt.exportToMSProject).not.toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:chart-download");
    } finally {
      appendChildSpy.mockRestore();
      clickSpy.mockRestore();
    }
  });

  it("uses MS Project export by default", async () => {
    renderWithTheme(<ProjectManagerGanttPage projectId={42} token={TEST_TOKEN} />);

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await userEvent.setup().click(screen.getByRole("button", { name: /^Download\b/i }));

    expect(screen.getByText("MS Project XML")).toBeVisible();
    expect(mockGantt.exportToMSProject).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "project-42.ms-project.xml",
        server: "https://export.dhtmlx.com/gantt",
      }),
    );
  });

  it("shows the ms project option as unavailable when export is disabled", async () => {
    const user = userEvent.setup();

    getProjectChartExportCapabilitiesMock.mockResolvedValue({
      ganttExport: {
        dhtmlxXml: { enabled: true },
        msProjectXml: {
          enabled: false,
          mode: "unavailable" as const,
          serverUrl: null,
        },
      },
    });

    renderWithTheme(<ProjectManagerGanttPage projectId={42} token={TEST_TOKEN} />);

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Choose download format" }));

    expect(
      screen.getByRole("menuitem", { name: "MS Project XML [Unavailable]" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
