import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ganttApi } from "../api/gantt-api.js";
import { ProjectManagerTasksPage } from "./ProjectManagerTasksPage.js";
import {
  GANTT_RUNTIME_CHART_UPDATED_EVENT,
} from "../lib/gantt-runtime-chart-events.js";
import { emitGanttRuntimeChartUpdatedEvent } from "../lib/gantt-runtime-chart-events.js";
import { clearGanttRuntimeChartCache } from "../lib/gantt-runtime-chart-cache.js";
import { clearSubtabMemory } from "../lib/subtab-memory.js";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const DEFAULT_TOKEN = "pm-token";
const TASKS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="p1" type="project" start_date="2026-01-01 00:00" ggtc_task_status="ISSUE_STATUS_OPEN"><![CDATA[Project Root]]></task>
  <task id="open-early" type="task" start_date="2026-03-01 09:00" ggtc_task_status="ISSUE_STATUS_OPEN" progress="0"><![CDATA[Open Early]]></task>
  <task id="open-late" type="task" start_date="2026-03-05 09:00" ggtc_task_status="ISSUE_STATUS_OPEN" progress="0"><![CDATA[Open Late]]></task>
  <task id="inprog" type="task" start_date="2026-03-03 09:00" ggtc_task_status="ISSUE_STATUS_IN_PROGRESS" progress="0.25"><![CDATA[In Progress Task]]></task>
  <task id="blocked-task" type="task" start_date="2026-03-02 09:00" ggtc_task_status="ISSUE_STATUS_BLOCKED" progress="0.2"><![CDATA[Blocked Task]]></task>
  <task id="closed-task" type="task" start_date="2026-03-04 09:00" ggtc_task_status="ISSUE_STATUS_CLOSED" progress="1"><![CDATA[Closed Task]]></task>
  <task id="future-task" type="task" start_date="2099-03-02 09:00" ggtc_task_status="ISSUE_STATUS_OPEN"><![CDATA[Future Task]]></task>
  <task id="mile-closed" type="milestone" start_date="2026-03-06 09:00"><![CDATA[Milestone Closed]]></task>
  <task id="mile-blocked" type="milestone" start_date="2026-03-06 10:00"><![CDATA[Milestone Blocked]]></task>
  <link id="1" source="closed-task" target="mile-closed" />
  <link id="2" source="blocked-task" target="mile-blocked" />
</data>`;

vi.mock("../api/gantt-api.js", () => ({
  ganttApi: {
    getProjectChartOrNull: vi.fn(),
  },
}));

const ganttApiMock = vi.mocked(ganttApi);

describe("ProjectManagerTasksPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    clearGanttRuntimeChartCache();
    clearSubtabMemory();
    ganttApiMock.getProjectChartOrNull.mockReset();
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: TASKS_XML,
      type: "xml",
    });
  });

  it("renders tasks page and excludes project/future nodes", async () => {
    renderWithTheme(<ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />);

    expect(await screen.findByText("Project Tasks")).toBeVisible();
    expect(screen.getByText("Selected project: 42")).toBeVisible();
    expect(screen.queryByText("Project Root")).not.toBeInTheDocument();
    expect(screen.queryByText("Future Task")).not.toBeInTheDocument();
  });

  it("filters tasks by selected status tab", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />);

    expect(await screen.findByText("In Progress Task")).toBeVisible();
    expect(screen.queryByText("Milestone Blocked")).not.toBeInTheDocument();
    expect(screen.queryByText("Open Early")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Open" }));
    expect(await screen.findByText("Open Early")).toBeVisible();
    expect(screen.getByText("Open Late")).toBeVisible();
    expect(screen.queryByText("In Progress Task")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Blocked" }));
    expect(await screen.findByText("Blocked Task")).toBeVisible();
    expect(screen.getByText("Milestone Blocked")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Closed" }));
    expect(await screen.findByText("Closed Task")).toBeVisible();
    expect(screen.getByText("Milestone Closed")).toBeVisible();
  });

  it("remembers the selected task status sub-tab when returning to the list", async () => {
    const user = userEvent.setup();

    const { unmount } = renderWithTheme(
      <ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    expect(await screen.findByText("In Progress Task")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Open" }));
    expect(await screen.findByText("Open Early")).toBeVisible();

    unmount();

    renderWithTheme(<ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />);

    expect(screen.getByRole("tab", { name: "Open", selected: true })).toBeVisible();
    expect(await screen.findByText("Open Early")).toBeVisible();
  });

  it("re-buckets milestones immediately when gantt runtime emits an update", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />);

    await user.click(screen.getByRole("tab", { name: "Closed" }));
    expect(await screen.findByText("Milestone Closed")).toBeVisible();

    const updatedXml = TASKS_XML.replace(
      'id="closed-task" type="task" start_date="2026-03-04 09:00" ggtc_task_status="ISSUE_STATUS_CLOSED" progress="1"',
      'id="closed-task" type="task" start_date="2026-03-04 09:00" ggtc_task_status="ISSUE_STATUS_OPEN" progress="1"',
    );

    emitGanttRuntimeChartUpdatedEvent({
      projectId: 42,
      serializedXml: updatedXml,
    });

    await waitFor(() => {
      expect(screen.queryByText("Milestone Closed")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: "In Progress" }));
    expect(await screen.findByText("Milestone Closed")).toBeVisible();
  });

  it("re-buckets transitive milestone inference immediately when a dependency task is blocked", async () => {
    const user = userEvent.setup();
    const transitiveXml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="t1" type="task" start_date="2026-03-01 09:00" ggtc_task_status="ISSUE_STATUS_CLOSED" progress="0"><![CDATA[T1]]></task>
  <task id="t2" type="task" start_date="2026-03-02 09:00" ggtc_task_status="ISSUE_STATUS_CLOSED" progress="0"><![CDATA[T2]]></task>
  <task id="t3" type="task" start_date="2026-03-03 09:00" ggtc_task_status="ISSUE_STATUS_CLOSED" progress="0"><![CDATA[T3]]></task>
  <task id="mile" type="milestone" start_date="2026-03-06 09:00"><![CDATA[Transitive Milestone]]></task>

  <!-- t1 -> t2 -> t3 -> mile (mile depends transitively on t1) -->
  <link id="1" source="t1" target="t2" />
  <link id="2" source="t2" target="t3" />
  <link id="3" source="t3" target="mile" />
</data>`;

    ganttApiMock.getProjectChartOrNull.mockResolvedValueOnce({
      content: transitiveXml,
      type: "xml",
    });

    renderWithTheme(<ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />);

    // Default tab is "In Progress"; with all dependencies closed, inferred milestone should be "Closed".
    await user.click(screen.getByRole("tab", { name: "Closed" }));
    expect(await screen.findByText("Transitive Milestone")).toBeVisible();

    // Block t1, which should make the transitive milestone blocked.
    const updatedXml = transitiveXml.replace(
      'id="t1" type="task" start_date="2026-03-01 09:00" ggtc_task_status="ISSUE_STATUS_CLOSED"',
      'id="t1" type="task" start_date="2026-03-01 09:00" ggtc_task_status="ISSUE_STATUS_BLOCKED"',
    );

    emitGanttRuntimeChartUpdatedEvent({
      projectId: 42,
      serializedXml: updatedXml,
    });

    await waitFor(() => {
      expect(screen.queryByText("Transitive Milestone")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: "Blocked" }));
    expect(await screen.findByText("Transitive Milestone")).toBeVisible();
  });

  it("keeps transitive milestone in progress when transitive dependency is open", async () => {
    const user = userEvent.setup();
    const transitiveXml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="t1" type="task" start_date="2026-03-01 09:00" ggtc_task_status="ISSUE_STATUS_OPEN" progress="0"><![CDATA[T1]]></task>
  <task id="t2" type="task" start_date="2026-03-02 09:00" ggtc_task_status="ISSUE_STATUS_CLOSED" progress="0"><![CDATA[T2]]></task>
  <task id="t3" type="task" start_date="2026-03-03 09:00" ggtc_task_status="ISSUE_STATUS_CLOSED" progress="0"><![CDATA[T3]]></task>
  <task id="mile" type="milestone" start_date="2026-03-06 09:00"><![CDATA[Transitive Milestone]]></task>

  <link id="1" source="t1" target="t2" />
  <link id="2" source="t2" target="t3" />
  <link id="3" source="t3" target="mile" />
</data>`;

    ganttApiMock.getProjectChartOrNull.mockResolvedValueOnce({
      content: transitiveXml,
      type: "xml",
    });

    renderWithTheme(<ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />);

    expect(await screen.findByText("Transitive Milestone")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Closed" }));
    expect(screen.queryByText("Transitive Milestone")).not.toBeInTheDocument();
  });

  it("initializes from cached gantt runtime xml when a runtime update happened before mount", async () => {
    const user = userEvent.setup();
    const transitiveXml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="t1" type="task" start_date="2026-03-01 09:00" ggtc_task_status="ISSUE_STATUS_BLOCKED" progress="0"><![CDATA[T1]]></task>
  <task id="t2" type="task" start_date="2026-03-02 09:00" ggtc_task_status="ISSUE_STATUS_CLOSED" progress="0"><![CDATA[T2]]></task>
  <task id="mile" type="milestone" start_date="2026-03-06 09:00"><![CDATA[Cached Milestone]]></task>
  <link id="1" source="t1" target="t2" />
  <link id="2" source="t2" target="mile" />
</data>`;

    emitGanttRuntimeChartUpdatedEvent({
      projectId: 42,
      serializedXml: transitiveXml,
    });

    renderWithTheme(<ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />);

    expect(ganttApiMock.getProjectChartOrNull).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Blocked" }));
    expect(await screen.findByText("Cached Milestone")).toBeVisible();
  });

  it("ignores gantt runtime updates for other projects", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />);

    await user.click(screen.getByRole("tab", { name: "Closed" }));
    expect(await screen.findByText("Milestone Closed")).toBeVisible();

    const updatedXml = TASKS_XML.replace(
      'id="closed-task" type="task" start_date="2026-03-04 09:00" ggtc_task_status="ISSUE_STATUS_CLOSED" progress="1"',
      'id="closed-task" type="task" start_date="2026-03-04 09:00" ggtc_task_status="ISSUE_STATUS_OPEN" progress="1"',
    );

    emitGanttRuntimeChartUpdatedEvent({
      projectId: 999,
      serializedXml: updatedXml,
    });

    // Still on Closed tab; milestone should not disappear due to the mismatched projectId.
    expect(await screen.findByText("Milestone Closed")).toBeVisible();
  });

  it("sorts tasks by most recent start date first within a status tab", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />);

    await user.click(await screen.findByRole("tab", { name: "Open" }));
    const openLate = await screen.findByText("Open Late");
    const openEarly = screen.getByText("Open Early");

    const lateCard = openLate.closest(".MuiPaper-root");
    const earlyCard = openEarly.closest(".MuiPaper-root");
    expect(lateCard).not.toBeNull();
    expect(earlyCard).not.toBeNull();
    expect(
      lateCard!.compareDocumentPosition(earlyCard!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows fallback when projectId is missing", async () => {
    renderWithTheme(<ProjectManagerTasksPage projectId={null} token={DEFAULT_TOKEN} />);

    expect(await screen.findByText("Select a valid project to view its tasks.")).toBeVisible();
    expect(ganttApiMock.getProjectChartOrNull).not.toHaveBeenCalled();
  });

  it("loads chart xml for selected project", async () => {
    renderWithTheme(<ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />);

    await waitFor(() => {
      expect(ganttApiMock.getProjectChartOrNull).toHaveBeenCalledWith(DEFAULT_TOKEN, 42);
    });
  });

  it("navigates to the task detail route when a task row is clicked", async () => {
    const user = userEvent.setup();

    renderWithTheme(<ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />);

    await user.click(await screen.findByRole("button", { name: /In Progress Task/i }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/pm/project/task?projectId=42&id=inprog");
  });

  it("shows runtime validation errors when the loaded chart contains duplicate task ids", async () => {
    ganttApiMock.getProjectChartOrNull.mockResolvedValueOnce({
      content: "<data><task id=\"dup\"/><task id=\"dup\"/></data>",
      type: "xml",
    });

    renderWithTheme(<ProjectManagerTasksPage projectId={42} token={DEFAULT_TOKEN} />);

    expect(
      await screen.findByText("Task id \"dup\" is duplicated in the chart."),
    ).toBeVisible();
  });
});
