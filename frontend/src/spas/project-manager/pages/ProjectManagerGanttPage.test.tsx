import React, { StrictMode } from "react";
import {
  act,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ApiError } from "../../../common/api/api-error.js";
import type { GetProjectResponse } from "../../../lobby/contracts/lobby.contracts.js";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { appTheme } from "../../../theme/app-theme.js";
import { injectGgtcTaskAttributesIntoSerializedXml } from "../lib/ggtc-dhtmlx-gantt-xml-serialize.js";
import { GANTT_RUNTIME_CHART_UPDATED_EVENT } from "../lib/gantt-runtime-chart-events.js";
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
  content: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><data><task id=\"1001\" ggtc_task_status=\"ISSUE_STATUS_OPEN\" ggtc_task_closed_reason=\"\" ggtc_task_description=\"\"><![CDATA[Repo chart task]]></task></data>",
  type: "xml" as const,
};
const getProjectChartExportCapabilitiesMock = vi.fn();
const getProjectChartOrNullMock = vi.fn();
const getProjectMock = vi.fn();
const putProjectChartMock = vi.fn();
const createObjectUrlMock = vi.fn(() => "blob:chart-download");
const revokeObjectUrlMock = vi.fn();
const ganttEventHandlers = new Map<string, {
  handler: (...args: unknown[]) => boolean;
  name: string;
}>();
let selectedTaskId: number | string | null = null;
let selectedTaskType: "milestone" | "project" | "task" = "task";
let nextGanttEventId = 1;
let nextCreatedTaskId = 5000;
let serializedXml = mockChartSource.content;

function triggerGanttEvent(eventName: string, ...args: unknown[]): void {
  for (const registration of ganttEventHandlers.values()) {
    if (registration.name === eventName) {
      registration.handler(...args);
    }
  }
}

function getControlPanel() {
  return within(screen.getByTestId("pm-gantt-control-panel"));
}

async function findControlPanel() {
  return within(await screen.findByTestId("pm-gantt-control-panel"));
}

async function openTaskActions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(getControlPanel().getByRole("button", { name: "Task actions" }));
}

async function openMilestoneActions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(getControlPanel().getByRole("button", { name: "Milestone actions" }));
}

const mockGantt = {
  addTask: vi.fn((_task: unknown, parent?: unknown) => {
    void parent;
    selectedTaskId = nextCreatedTaskId;
    nextCreatedTaskId += 1;
    return selectedTaskId;
  }),
  attachEvent: vi.fn((name: string, handler: (...args: unknown[]) => boolean) => {
    const eventId = `${name}-${nextGanttEventId}`;
    nextGanttEventId += 1;
    ganttEventHandlers.set(eventId, { handler, name });
    return eventId;
  }),
  clearAll: vi.fn(),
  config: {
    columns: [] as unknown[],
    date_format: "",
    details_on_dblclick: false,
    drag_links: false,
    drag_move: false,
    drag_progress: false,
    drag_resize: false,
    grid_width: 0,
    keep_grid_width: false,
    layout: null as unknown,
    lightbox: {
      milestone_sections: [] as unknown[],
      project_sections: [] as unknown[],
      sections: [] as unknown[],
    },
    readonly: false,
    show_chart: true,
    show_grid: true,
  },
  deleteTask: vi.fn((taskId: unknown) => {
    if (selectedTaskId === taskId) {
      selectedTaskId = null;
    }
  }),
  destructor: vi.fn(),
  detachEvent: vi.fn((eventId: string) => {
    ganttEventHandlers.delete(eventId);
  }),
  exportToMSProject: vi.fn(),
  getLink: vi.fn((linkId: number | string) => ({
    id: linkId,
    source: 1001,
  })),
  getSelectedId: vi.fn(() => selectedTaskId),
  getTask: vi.fn(),
  init: vi.fn(),
  open: vi.fn(),
  parse: vi.fn(),
  refreshTask: vi.fn(),
  render: vi.fn(),
  resetLayout: vi.fn(),
  selectTask: vi.fn((taskId: number | string) => {
    selectedTaskId = taskId;
    return taskId;
  }),
  serialize: vi.fn((format?: string) => {
    if (format === "xml") {
      return injectGgtcTaskAttributesIntoSerializedXml(serializedXml, mockGantt);
    }

    return { data: [] };
  }),
  setSizes: vi.fn(),
  showLightbox: vi.fn(),
  showTask: vi.fn(),
  updateTask: vi.fn(),
};

vi.mock("../lib/dhtmlx-gantt-adapter.js", () => ({
  getDhtmlxGantt: () => mockGantt,
}));

vi.mock("../../../lobby/api/lobby-api.js", () => ({
  lobbyApi: {
    getProject: (...args: unknown[]) => getProjectMock(...args),
  },
}));

vi.mock("../api/gantt-api.js", () => ({
  ganttApi: {
    getProjectChartExportCapabilities: (...args: unknown[]) =>
      getProjectChartExportCapabilitiesMock(...args),
    getProjectChartOrNull: (...args: unknown[]) => getProjectChartOrNullMock(...args),
    putProjectChart: (...args: unknown[]) => putProjectChartMock(...args),
  },
}));

function createMockProjectResponse(
  projectId: number,
  viewerUserId: number,
): GetProjectResponse {
  return {
    members: [
      {
        roleCodes: ["GGTC_PROJECTROLE_PROJECT_MANAGER"],
        userId: viewerUserId,
        username: "pm-user",
      },
    ],
    organizations: [],
    project: {
      createdAt: "2026-01-01T00:00:00.000Z",
      description: null,
      id: projectId,
      journal: null,
      name: "Test Project",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    projectManagers: [
      {
        sourceKinds: ["direct"],
        userId: viewerUserId,
        username: "pm-user",
      },
    ],
    teams: [],
  };
}

const VIEWER_USER_ID = 9001;

const defaultPageProps = {
  currentUserId: VIEWER_USER_ID,
  currentUserRoles: [] as string[],
};

function renderWithProjectRouter(projectId: number) {
  return render(
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <MemoryRouter>
        <ProjectManagerGanttPage
          {...defaultPageProps}
          projectId={projectId}
          token={TEST_TOKEN}
        />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("ProjectManagerGanttPage", () => {
  beforeEach(() => {
    ganttEventHandlers.clear();
    selectedTaskId = null;
    selectedTaskType = "task";
    nextCreatedTaskId = 5000;
    nextGanttEventId = 1;
    serializedXml = mockChartSource.content;
    getProjectChartExportCapabilitiesMock.mockReset();
    getProjectChartExportCapabilitiesMock.mockResolvedValue(mockCapabilities);
    getProjectChartOrNullMock.mockReset();
    getProjectChartOrNullMock.mockResolvedValue(mockChartSource);
    getProjectMock.mockReset();
    getProjectMock.mockImplementation(async (_token: string, projectId: number) =>
      createMockProjectResponse(projectId, VIEWER_USER_ID),
    );
    putProjectChartMock.mockReset();
    putProjectChartMock.mockResolvedValue({ ok: true });
    mockGantt.attachEvent.mockReset();
    mockGantt.attachEvent.mockImplementation((name: string, handler: (...args: unknown[]) => boolean) => {
      const eventId = `${name}-${nextGanttEventId}`;
      nextGanttEventId += 1;
      ganttEventHandlers.set(eventId, { handler, name });
      return eventId;
    });
    mockGantt.clearAll.mockReset();
    mockGantt.config.columns = [];
    mockGantt.config.date_format = "";
    mockGantt.config.details_on_dblclick = false;
    mockGantt.config.drag_links = false;
    mockGantt.config.drag_move = false;
    mockGantt.config.drag_progress = false;
    mockGantt.config.drag_resize = false;
    mockGantt.config.grid_width = 0;
    mockGantt.config.keep_grid_width = false;
    mockGantt.config.layout = null;
    mockGantt.config.lightbox = {
      milestone_sections: [],
      project_sections: [],
      sections: [],
    };
    mockGantt.config.show_chart = true;
    mockGantt.config.show_grid = true;
    mockGantt.addTask.mockClear();
    mockGantt.destructor.mockReset();
    mockGantt.deleteTask.mockClear();
    mockGantt.detachEvent.mockReset();
    mockGantt.detachEvent.mockImplementation((eventId: string) => {
      ganttEventHandlers.delete(eventId);
    });
    mockGantt.exportToMSProject.mockReset();
    mockGantt.getLink.mockClear();
    mockGantt.getSelectedId.mockClear();
    mockGantt.getTask.mockClear();
    mockGantt.getTask.mockImplementation((taskId: number | string) => ({
      ggtc_task_closed_reason: "",
      ggtc_task_description: "",
      ggtc_task_status: "ISSUE_STATUS_OPEN",
      id: taskId,
      parent: 0,
      start_date: new Date("2026-03-01T09:00:00.000Z"),
      type: taskId === selectedTaskId ? selectedTaskType : "task",
    }));
    mockGantt.init.mockReset();
    mockGantt.open.mockReset();
    mockGantt.parse.mockReset();
    mockGantt.refreshTask.mockReset();
    mockGantt.render.mockReset();
    mockGantt.resetLayout.mockReset();
    mockGantt.selectTask.mockClear();
    mockGantt.serialize.mockReset();
    mockGantt.serialize.mockImplementation((format?: string) => {
      if (format === "xml") {
        return injectGgtcTaskAttributesIntoSerializedXml(serializedXml, mockGantt);
      }

      return { data: [] };
    });
    mockGantt.setSizes.mockReset();
    mockGantt.showLightbox.mockClear();
    mockGantt.showTask.mockReset();
    mockGantt.updateTask.mockReset();
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
    URL.createObjectURL = createObjectUrlMock;
    URL.revokeObjectURL = revokeObjectUrlMock;
  });

  it("renders the gantt container and bottom control panel", async () => {
    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    expect(screen.getByText("Project Manager Gantt")).toBeVisible();
    expect(screen.getByText("Selected project: 42")).toBeVisible();

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("pm-gantt-chart-container")).toBeVisible();
    expect(getControlPanel().getByRole("button", { name: "Task actions" })).toBeVisible();
    expect(getControlPanel().getByRole("button", { name: "Milestone actions" })).toBeVisible();
    expect(screen.getByLabelText("View")).toBeVisible();
    expect(screen.getByRole("button", { name: /^Download\b/i })).toBeVisible();
    expect(getControlPanel().getByRole("button", { name: "Save" })).toBeVisible();
    expect(screen.getByText("MS Project XML")).toBeVisible();
  });

  it("loads gantt XML from the backend chart api on first render", async () => {
    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.parse).toHaveBeenCalledTimes(1);
    });

    expect(mockGantt.config.keep_grid_width).toBe(true);
    expect(mockGantt.config.details_on_dblclick).toBe(true);
    expect(mockGantt.config.drag_links).toBe(true);
    expect(mockGantt.config.drag_move).toBe(true);
    expect(mockGantt.config.drag_progress).toBe(true);
    expect(mockGantt.config.drag_resize).toBe(true);
    expect(mockGantt.config.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          editor: expect.objectContaining({ map_to: "text", type: "text" }),
          name: "text",
        }),
        expect.objectContaining({
          editor: expect.objectContaining({ map_to: "start_date", type: "date" }),
          name: "start_date",
        }),
        expect.objectContaining({
          editor: expect.objectContaining({ map_to: "duration", type: "duration" }),
          name: "duration",
        }),
        expect.objectContaining({
          editor: expect.objectContaining({ map_to: "auto", type: "predecessor" }),
          name: "predecessors",
        }),
        expect.objectContaining({ name: "add" }),
      ]),
    );
    expect(mockGantt.config.lightbox.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ map_to: "text", name: "description", type: "textarea" }),
        expect.objectContaining({
          map_to: "ggtc_task_description",
          name: "ggtc description",
          type: "textarea",
        }),
        expect.objectContaining({
          map_to: "ggtc_task_status",
          name: "ggtc status",
          type: "select",
          options: expect.arrayContaining([
            expect.objectContaining({ key: "ISSUE_STATUS_OPEN", label: "Open" }),
            expect.objectContaining({ key: "ISSUE_STATUS_CLOSED", label: "Closed" }),
          ]),
        }),
        expect.objectContaining({
          map_to: "ggtc_task_closed_reason",
          name: "ggtc closed reason",
          type: "select",
          options: expect.arrayContaining([
            expect.objectContaining({ key: "", label: "None" }),
            expect.objectContaining({
              key: "ISSUE_CLOSED_REASON_RESOLVED",
              label: "Resolved",
            }),
          ]),
        }),
        expect.objectContaining({ map_to: "parent", name: "parent", type: "parent" }),
        expect.objectContaining({ map_to: "auto", name: "time", type: "duration" }),
      ]),
    );
    expect(getProjectChartOrNullMock).toHaveBeenCalledWith(TEST_TOKEN, 42);
    expect(getProjectChartExportCapabilitiesMock).toHaveBeenCalledWith(TEST_TOKEN);
    expect(mockGantt.parse.mock.calls[0]).toEqual([
      mockChartSource.content,
      mockChartSource.type,
    ]);
    expect(mockGantt.serialize).toHaveBeenCalledWith("xml");
  });

  it("configures GGTC lightbox extension fields for task, project, and milestone editors", async () => {
    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    const expectedMaps = ["ggtc_task_description", "ggtc_task_status", "ggtc_task_closed_reason"];
    const sectionGroups = [
      mockGantt.config.lightbox.sections,
      mockGantt.config.lightbox.project_sections,
      mockGantt.config.lightbox.milestone_sections,
    ];

    for (const sections of sectionGroups) {
      expect(Array.isArray(sections)).toBe(true);
      for (const mapTo of expectedMaps) {
        expect(sections).toEqual(
          expect.arrayContaining([expect.objectContaining({ map_to: mapTo })]),
        );
      }
    }
  });

  it("shows a missing-chart message when the backend has no chart file", async () => {
    getProjectChartOrNullMock.mockResolvedValue(null);

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    expect(
      await screen.findByText("No gantt chart exists for this project yet."),
    ).toBeVisible();
    expect(mockGantt.parse).not.toHaveBeenCalled();
    expect((await findControlPanel()).getByRole("button", { name: "Create" })).toBeVisible();
  });

  it("creates a default chart after clicking Create when no chart exists", async () => {
    const user = userEvent.setup();
    getProjectChartOrNullMock.mockResolvedValue(null);

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await user.click((await findControlPanel()).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(putProjectChartMock).toHaveBeenCalledTimes(1);
      expect(mockGantt.parse).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("No gantt chart exists for this project yet.")).not.toBeInTheDocument();
  });

  it("adds a task and opens the lightbox from the task actions menu", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await openTaskActions(user);
    await user.click(screen.getByRole("menuitem", { name: "Add Task" }));

    expect(mockGantt.addTask).toHaveBeenCalledTimes(1);
    expect(mockGantt.addTask).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 1,
        parent: 0,
        text: "New Task",
      }),
    );
    expect(mockGantt.showTask).toHaveBeenCalledWith(5000);
    expect(mockGantt.refreshTask).toHaveBeenCalledWith(5000);
    expect(mockGantt.open).not.toHaveBeenCalled();
    expect(mockGantt.updateTask).not.toHaveBeenCalled();
    expect(mockGantt.selectTask).toHaveBeenCalledWith(5000);
    expect(mockGantt.showLightbox).toHaveBeenCalledWith(5000);
  });

  it("keeps child, edit, and delete task actions disabled without a task selection", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await openTaskActions(user);

    expect(screen.getByRole("menuitem", { name: "Add Child Task" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Edit Selected Task" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Delete Selected Task" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("normalizes blank root parents during lightbox save", async () => {
    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    const lightboxTask = {
      parent: "",
      text: "Kekw",
    };

    await act(async () => {
      triggerGanttEvent("onLightboxSave", 5000, lightboxTask, true);
    });

    expect(lightboxTask.parent).toBe(0);
    expect(lightboxTask).toMatchObject({
      ggtc_task_closed_reason: "",
      ggtc_task_description: "",
      ggtc_task_status: "ISSUE_STATUS_OPEN",
    });
  });

  it("re-infers milestone statuses on initial load", async () => {
    serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="t1" type="task" start_date="2026-03-01 09:00" ggtc_task_status="ISSUE_STATUS_BLOCKED" progress="0"><![CDATA[Predecessor]]></task>
  <task id="m1" type="milestone" start_date="2026-03-02 09:00" progress="0"><![CDATA[Milestone]]></task>
  <link id="1" source="t1" target="m1" />
</data>`;

    mockGantt.getTask.mockImplementation((taskId: number | string) => {
      if (taskId === "t1") {
        return {
          ggtc_task_closed_reason: "",
          ggtc_task_description: "",
          ggtc_task_status: "ISSUE_STATUS_BLOCKED",
          id: taskId,
          parent: 0,
          start_date: new Date("2026-03-01T09:00:00.000Z"),
          type: "task",
        };
      }

      if (taskId === "m1") {
        // Intentionally wrong so the inference must correct it.
        return {
          ggtc_task_closed_reason: "",
          ggtc_task_description: "",
          ggtc_task_status: "ISSUE_STATUS_IN_PROGRESS",
          id: taskId,
          parent: 0,
          start_date: new Date("2026-03-02T09:00:00.000Z"),
          type: "milestone",
        };
      }

      return undefined as unknown as never;
    });

    mockGantt.updateTask.mockClear();
    mockGantt.refreshTask.mockClear();

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    expect(mockGantt.updateTask).toHaveBeenCalledWith("m1");
    expect(mockGantt.refreshTask).toHaveBeenCalledWith("m1");
  });

  it("re-infers milestone statuses and emits runtime chart update on lightbox save", async () => {
    serializedXml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="t1" type="task" start_date="2026-03-01 09:00" ggtc_task_status="ISSUE_STATUS_OPEN" progress="0"><![CDATA[Predecessor]]></task>
  <task id="m1" type="milestone" start_date="2026-03-02 09:00"><![CDATA[Milestone]]></task>
  <link id="1" source="t1" target="m1" />
</data>`;

    const predecessorTask = {
      ggtc_task_closed_reason: "",
      ggtc_task_description: "",
      ggtc_task_status: "ISSUE_STATUS_OPEN",
      id: "t1",
      parent: 0,
      start_date: new Date("2026-03-01T09:00:00.000Z"),
      type: "task",
    };
    const milestoneTask = {
      ggtc_task_closed_reason: "",
      ggtc_task_description: "",
      ggtc_task_status: "ISSUE_STATUS_IN_PROGRESS",
      id: "m1",
      parent: 0,
      start_date: new Date("2026-03-02T09:00:00.000Z"),
      type: "milestone",
    };

    mockGantt.getTask.mockImplementation((taskId: number | string) => {
      if (taskId === "t1") {
        return predecessorTask;
      }
      if (taskId === "m1") {
        return milestoneTask;
      }

      return undefined as unknown as never;
    });

    const emittedEvents: Event[] = [];
    const listener = (event: Event) => emittedEvents.push(event);
    window.addEventListener(GANTT_RUNTIME_CHART_UPDATED_EVENT, listener);

    try {
      renderWithTheme(
        <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
      );

      await waitFor(() => {
        expect(mockGantt.init).toHaveBeenCalledTimes(1);
      });

      mockGantt.updateTask.mockClear();
      mockGantt.refreshTask.mockClear();

      predecessorTask.ggtc_task_status = "ISSUE_STATUS_CLOSED";

      await act(async () => {
        triggerGanttEvent("onLightboxSave", "t1", predecessorTask, true);
      });

      expect(mockGantt.updateTask).toHaveBeenCalledWith("m1");
      expect(mockGantt.refreshTask).toHaveBeenCalledWith("m1");
      expect(emittedEvents).toHaveLength(1);

      const detail = (emittedEvents[0] as CustomEvent<{ serializedXml: string }>).detail;
      // Ensure the edited task's status is reflected in the emitted runtime XML
      // before milestone inference / bucketing runs.
      expect(detail.serializedXml).toMatch(
        /<task[^>]*id="t1"[^>]*ggtc_task_status="ISSUE_STATUS_CLOSED"/,
      );
      expect(detail.serializedXml).toMatch(/<task[^>]*id="m1"[^>]*ggtc_task_status="ISSUE_STATUS_CLOSED"/);
    } finally {
      window.removeEventListener(GANTT_RUNTIME_CHART_UPDATED_EVENT, listener);
    }
  });

  it("injects GGTC extension attrs on onAfterTaskAdd when missing", async () => {
    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    mockGantt.updateTask.mockClear();
    mockGantt.refreshTask.mockClear();

    const newTask = {
      parent: 0,
      text: "Injected by event",
    };

    await act(async () => {
      triggerGanttEvent("onAfterTaskAdd", 9101, newTask);
    });

    expect(newTask).toMatchObject({
      ggtc_task_closed_reason: "",
      ggtc_task_description: "",
      ggtc_task_status: "ISSUE_STATUS_OPEN",
    });
    expect(mockGantt.updateTask).toHaveBeenCalledWith(9101);
    expect(mockGantt.refreshTask).toHaveBeenCalledWith(9101);
  });

  it("injects GGTC extension attrs via getTask fallback on onAfterTaskUpdate", async () => {
    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    mockGantt.updateTask.mockClear();
    mockGantt.refreshTask.mockClear();

    mockGantt.getTask.mockImplementation((taskId: number | string) => {
      if (taskId === 1001) {
        return {
          ggtc_task_description: "",
          id: 1001,
          parent: 0,
          start_date: new Date("2026-03-01T09:00:00.000Z"),
          type: "task",
        };
      }
      return {
        ggtc_task_closed_reason: "",
        ggtc_task_description: "",
        ggtc_task_status: "ISSUE_STATUS_OPEN",
        id: taskId,
        parent: 0,
        start_date: new Date("2026-03-01T09:00:00.000Z"),
        type: taskId === selectedTaskId ? selectedTaskType : "task",
      };
    });

    await act(async () => {
      triggerGanttEvent("onAfterTaskUpdate", 1001);
    });

    expect(mockGantt.updateTask).toHaveBeenCalledWith(1001);
    expect(mockGantt.refreshTask).toHaveBeenCalledWith(1001);
  });

  it("does not rewrite tasks that already include GGTC extension attrs on update hooks", async () => {
    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    mockGantt.updateTask.mockClear();
    mockGantt.refreshTask.mockClear();

    const completeTask = {
      ggtc_task_closed_reason: "ISSUE_CLOSED_REASON_RESOLVED",
      ggtc_task_description: "Already complete",
      ggtc_task_status: "ISSUE_STATUS_CLOSED",
      parent: 0,
      text: "Already complete",
    };

    await act(async () => {
      triggerGanttEvent("onAfterTaskUpdate", 9202, completeTask);
    });

    expect(mockGantt.updateTask).not.toHaveBeenCalled();
    expect(mockGantt.refreshTask).not.toHaveBeenCalled();
  });

  it("normalizes blank root parents before persisting gantt XML", async () => {
    const user = userEvent.setup();
    serializedXml = "<data><task id='5000' parent='' start_date='2026-03-22 00:00' duration='1'><![CDATA[Kekw]]></task></data>";

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(putProjectChartMock).toHaveBeenCalledWith(
        TEST_TOKEN,
        42,
        "<data><task id=\"5000\" parent=\"0\" start_date=\"2026-03-22 00:00\" duration=\"1\" type=\"task\" ggtc_task_status=\"ISSUE_STATUS_OPEN\" ggtc_task_closed_reason=\"\" ggtc_task_description=\"\"><![CDATA[Kekw]]></task></data>",
      );
    });
  });

  it("does not show extension warning when serialized XML includes GGTC attrs (inject path)", async () => {
    const user = userEvent.setup();
    serializedXml = "<data><task id='5000' parent='0' start_date='2026-03-22 00:00' duration='1'><![CDATA[Kekw]]></task></data>";

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(putProjectChartMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText("Saved with extension attribute gaps")).not.toBeInTheDocument();
  });

  it("shows extension warning dialog when save XML is missing GGTC attrs", async () => {
    const user = userEvent.setup();
    serializedXml = "<data><task id='5000' parent='0' start_date='2026-03-22 00:00' duration='1'><![CDATA[Kekw]]></task></data>";

    mockGantt.serialize.mockImplementation((format?: string) => {
      if (format === "xml") {
        return serializedXml;
      }

      return { data: [] };
    });

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByText("Saved with extension attribute gaps")).toBeVisible();
    });
    expect(putProjectChartMock).toHaveBeenCalledTimes(1);
  });

  it("enables selected task menu actions and supports editing and deleting the selection", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      selectedTaskId = 1001;
      selectedTaskType = "task";
      triggerGanttEvent("onTaskSelected");
    });

    await openTaskActions(user);
    expect(screen.getByRole("menuitem", { name: "Add Child Task" })).toBeEnabled();
    await user.click(screen.getByRole("menuitem", { name: "Edit Selected Task" }));
    expect(mockGantt.showLightbox).toHaveBeenCalledWith(1001);

    await openTaskActions(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete Selected Task" }));
    expect(mockGantt.deleteTask).toHaveBeenCalledWith(1001);
  });

  it("shows a warning status icon when unsaved changes are present", async () => {
    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      serializedXml = `${mockChartSource.content}<changed />`;
      triggerGanttEvent("onAfterTaskDelete");
    });

    expect(await screen.findByTestId("gantt-save-status-unsaved")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
  });

  it("shows a green success status icon after a successful save", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(putProjectChartMock).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByTestId("gantt-save-status-saved")).toBeVisible();
  });

  it("opens refresh confirmation from the save dropdown and reloads backend state only after confirmation", async () => {
    const user = userEvent.setup();
    const refreshedChartSource = {
      content: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><data><task id=\"1002\"><![CDATA[Backend refresh]]></task></data>",
      type: "xml" as const,
    };
    getProjectChartOrNullMock.mockReset();
    getProjectChartOrNullMock
      .mockResolvedValueOnce(mockChartSource)
      .mockResolvedValueOnce(refreshedChartSource);

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      serializedXml = `${mockChartSource.content}<changed />`;
      triggerGanttEvent("onAfterTaskDelete");
    });

    expect(await screen.findByTestId("gantt-save-status-unsaved")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Choose save action" }));
    await user.click(screen.getByRole("menuitem", { name: "Refresh" }));

    expect(
      screen.getByText("Refreshing discards all unsaved changes and resets the current frontend and UI state to the chart reloaded from the backend."),
    ).toBeVisible();
    expect(getProjectChartOrNullMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(getProjectChartOrNullMock).toHaveBeenCalledTimes(2);
      const lastParseCall = mockGantt.parse.mock.calls.at(-1);
      expect(lastParseCall?.[1]).toBe(refreshedChartSource.type);
      expect(lastParseCall?.[0]).toContain("id=\"1002\"");
      expect(lastParseCall?.[0]).toContain("ggtc_task_status=\"ISSUE_STATUS_OPEN\"");
      expect(lastParseCall?.[0]).toContain("ggtc_task_closed_reason=\"\"");
      expect(lastParseCall?.[0]).toContain("ggtc_task_description=\"\"");
    });

    expect(screen.queryByTestId("gantt-save-status-unsaved")).not.toBeInTheDocument();
  });

  it("adds a child task under the currently selected task", async () => {
    const user = userEvent.setup();
    mockGantt.getTask.mockImplementation((taskId: number | string) => ({
      id: taskId,
      open: false,
      parent: 0,
      start_date: new Date("2026-03-01T09:00:00.000Z"),
      type: "task" as const,
    }));

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      selectedTaskId = 1001;
      selectedTaskType = "task";
      triggerGanttEvent("onTaskSelected");
    });

    await openTaskActions(user);
    await user.click(screen.getByRole("menuitem", { name: "Add Child Task" }));

    expect(mockGantt.getTask).toHaveBeenCalledWith(1001);
    expect(mockGantt.addTask).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 1,
        text: "New Task",
      }),
      1001,
    );
    expect(mockGantt.updateTask).toHaveBeenCalledWith(1001);
    expect(mockGantt.refreshTask).toHaveBeenNthCalledWith(1, 1001);
    expect(mockGantt.open).toHaveBeenCalledWith(1001);
    expect(mockGantt.showTask).toHaveBeenCalledWith(5000);
    expect(mockGantt.refreshTask).toHaveBeenNthCalledWith(2, 5000);
    expect(mockGantt.showLightbox).toHaveBeenCalledWith(5000);
  });

  it("does not re-update an already open parent when adding a child task", async () => {
    const user = userEvent.setup();
    mockGantt.getTask.mockImplementation((taskId: number | string) => ({
      id: taskId,
      open: true,
      parent: 0,
      start_date: new Date("2026-03-01T09:00:00.000Z"),
      type: "task" as const,
    }));

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      selectedTaskId = 1001;
      selectedTaskType = "task";
      triggerGanttEvent("onTaskSelected");
    });

    await openTaskActions(user);
    await user.click(screen.getByRole("menuitem", { name: "Add Child Task" }));

    expect(mockGantt.updateTask).not.toHaveBeenCalled();
    expect(mockGantt.open).toHaveBeenCalledWith(1001);
    expect(mockGantt.showTask).toHaveBeenCalledWith(5000);
    expect(mockGantt.refreshTask).toHaveBeenCalledWith(5000);
  });

  it("adds a root milestone from the milestone actions menu", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await openMilestoneActions(user);
    await user.click(screen.getByRole("menuitem", { name: "Add Milestone" }));

    expect(mockGantt.addTask).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 0,
        parent: 0,
        text: "New Milestone",
        type: "milestone",
      }),
    );
    expect(mockGantt.showTask).toHaveBeenCalledWith(5000);
    expect(mockGantt.showLightbox).toHaveBeenCalledWith(5000);
  });

  it("adds a child milestone under the selected task", async () => {
    const user = userEvent.setup();
    mockGantt.getTask.mockImplementation((taskId: number | string) => ({
      id: taskId,
      open: false,
      parent: 0,
      start_date: new Date("2026-03-01T09:00:00.000Z"),
      type: taskId === selectedTaskId ? selectedTaskType : "task",
    }));

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      selectedTaskId = 1001;
      selectedTaskType = "task";
      triggerGanttEvent("onTaskSelected");
    });

    await openMilestoneActions(user);
    await user.click(screen.getByRole("menuitem", { name: "Add Child Milestone" }));

    expect(mockGantt.addTask).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 0,
        text: "New Milestone",
        type: "milestone",
      }),
      1001,
    );
    expect(mockGantt.open).toHaveBeenCalledWith(1001);
    expect(mockGantt.showTask).toHaveBeenCalledWith(5000);
  });

  it("supports milestone editing, deletion, and conversion actions", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      selectedTaskId = 1001;
      selectedTaskType = "milestone";
      triggerGanttEvent("onTaskSelected");
    });

    await openMilestoneActions(user);
    await user.click(screen.getByRole("menuitem", { name: "Edit Selected Milestone" }));
    expect(mockGantt.showLightbox).toHaveBeenCalledWith(1001);

    await openMilestoneActions(user);
    await user.click(
      screen.getByRole("menuitem", { name: "Convert Selected Milestone to Task" }),
    );
    expect(mockGantt.updateTask).toHaveBeenCalledWith(1001);

    await openMilestoneActions(user);
    await user.click(screen.getByRole("menuitem", { name: "Delete Selected Milestone" }));
    expect(mockGantt.deleteTask).toHaveBeenCalledWith(1001);
  });

  it("disables child task actions when the selected item is a milestone", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      selectedTaskId = 1001;
      selectedTaskType = "milestone";
      triggerGanttEvent("onTaskSelected");
    });

    await openTaskActions(user);
    expect(screen.getByRole("menuitem", { name: "Add Child Task" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Edit Selected Task" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Delete Selected Task" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await user.keyboard("{Escape}");
    await openMilestoneActions(user);
    expect(screen.getByRole("menuitem", { name: "Add Child Milestone" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByRole("menuitem", { name: "Convert Selected Milestone to Task" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("disables task and milestone menu actions when the project has no chart yet", async () => {
    const user = userEvent.setup();
    getProjectChartOrNullMock.mockResolvedValue(null);

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    expect(
      await screen.findByText("No gantt chart exists for this project yet."),
    ).toBeVisible();

    await openTaskActions(user);
    expect(screen.getByRole("menuitem", { name: "Add Task" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Add Child Task" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await user.keyboard("{Escape}");
    await openMilestoneActions(user);
    expect(screen.getByRole("menuitem", { name: "Add Milestone" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Add Child Milestone" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("supports converting a selected task to a milestone", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      selectedTaskId = 1001;
      selectedTaskType = "task";
      triggerGanttEvent("onTaskSelected");
    });

    await openMilestoneActions(user);
    await user.click(screen.getByRole("menuitem", { name: "Convert Selected Task to Milestone" }));

    expect(mockGantt.updateTask).toHaveBeenCalledWith(1001);
    expect(mockGantt.showLightbox).toHaveBeenCalledWith(1001);
  });

  it("shows a generic error message when the backend returns a non-404 failure", async () => {
    getProjectChartOrNullMock.mockRejectedValue(
      new ApiError("http", "HTTP 500", {
        responseBody: "{\"message\":\"Broken chart endpoint\"}",
        status: 500,
      }),
    );

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    expect(await screen.findByText("Broken chart endpoint")).toBeVisible();
    expect(mockGantt.parse).not.toHaveBeenCalled();
  });

  it("cleans up the gantt instance on unmount", async () => {
    const view = renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

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
    getProjectChartOrNullMock
      .mockResolvedValueOnce(mockChartSource)
      .mockResolvedValueOnce(secondChartSource);

    const view = renderWithProjectRouter(42);

    await waitFor(() => {
      expect(getProjectChartOrNullMock).toHaveBeenCalledWith(TEST_TOKEN, 42);
    });

    view.rerender(
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <MemoryRouter>
          <ProjectManagerGanttPage {...defaultPageProps} projectId={77} token={TEST_TOKEN} />
        </MemoryRouter>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(getProjectChartOrNullMock).toHaveBeenCalledWith(TEST_TOKEN, 77);
    });

    await waitFor(() => {
      expect(mockGantt.parse).toHaveBeenCalledWith(
        expect.stringContaining("id=\"2002\""),
        secondChartSource.type,
      );
      const matchingCall = mockGantt.parse.mock.calls.find((call) =>
        typeof call[0] === "string" && call[0].includes("id=\"2002\""),
      );
      expect(matchingCall?.[0]).toContain("ggtc_task_status=\"ISSUE_STATUS_OPEN\"");
      expect(matchingCall?.[0]).toContain("ggtc_task_closed_reason=\"\"");
      expect(matchingCall?.[0]).toContain("ggtc_task_description=\"\"");
    });
  });

  it("survives React Strict Mode remounts without destructing the shared gantt instance", async () => {
    renderWithTheme(
      <StrictMode>
        <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalled();
    });

    expect(screen.getByText("Project Manager Gantt")).toBeVisible();
    expect(mockGantt.destructor).not.toHaveBeenCalled();
  });

  it("switches display modes from the bottom control panel dropdown", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByLabelText("View"));
    await user.click(screen.getByRole("option", { name: "Grid" }));

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

    await user.click(screen.getByLabelText("View"));
    await user.click(screen.getByRole("option", { name: "Chart" }));

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

    await user.click(screen.getByLabelText("View"));
    await user.click(screen.getByRole("option", { name: "Both" }));

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

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Hide Controls" }));

    expect(screen.queryByLabelText("View")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Controls" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Show Controls" }));

    expect(screen.getByLabelText("View")).toBeVisible();
  });

  it("renders gantt-specific actions inside the bottom control panel", async () => {
    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    expect((await findControlPanel()).getByRole("button", { name: /^Download\b/i })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Details" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Choose download format" })).toBeVisible();
    expect(getControlPanel().getByRole("button", { name: "Task actions" })).toBeVisible();
    expect(getControlPanel().getByRole("button", { name: "Milestone actions" })).toBeVisible();
  });

  it("downloads DHTMLX XML locally after changing the selected format", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

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
    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

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

    renderWithTheme(
      <ProjectManagerGanttPage {...defaultPageProps} projectId={42} token={TEST_TOKEN} />,
    );

    await waitFor(() => {
      expect(mockGantt.init).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Choose download format" }));

    expect(
      screen.getByRole("menuitem", { name: "MS Project XML [Unavailable]" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
