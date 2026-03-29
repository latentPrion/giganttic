import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../../common/api/api-error.js";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ganttApi } from "../api/gantt-api.js";
import { taskAttachmentsApi } from "../api/task-attachments-api.js";
import { taskCommentsApi } from "../api/task-comments-api.js";
import { taskJournalApi } from "../api/task-journal-api.js";
import { emitProjectManagerTaskDiscussionStateEvent } from "../lib/task-discussion-state-events.js";
import { ProjectManagerTaskPage } from "./ProjectManagerTaskPage.js";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../api/gantt-api.js", () => ({
  ganttApi: {
    getProjectChartOrNull: vi.fn(),
    putProjectChart: vi.fn(),
  },
}));

vi.mock("../api/task-comments-api.js", () => ({
  taskCommentsApi: {
    createComment: vi.fn(),
    deleteComment: vi.fn(),
    deleteCommentAttachment: vi.fn(),
    listComments: vi.fn(),
    updateComment: vi.fn(),
    uploadCommentAttachment: vi.fn(),
  },
}));

vi.mock("../api/task-attachments-api.js", () => ({
  taskAttachmentsApi: {
    deleteAttachment: vi.fn(),
    listAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
  },
}));

vi.mock("../api/task-journal-api.js", () => ({
  taskJournalApi: {
    getJournal: vi.fn(),
    updateJournal: vi.fn(),
  },
}));

const ganttApiMock = vi.mocked(ganttApi);
const taskCommentsApiMock = vi.mocked(taskCommentsApi);
const taskAttachmentsApiMock = vi.mocked(taskAttachmentsApi);
const taskJournalApiMock = vi.mocked(taskJournalApi);

const DEFAULT_TOKEN = "pm-token";
const TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="task-7" type="task" start_date="2026-03-05 09:00" ggtc_task_status="ISSUE_STATUS_BLOCKED" ggtc_task_description="Investigate the gateway timeout"><![CDATA[Gateway rollout]]></task>
</data>`;

const DEFAULT_TASK_PAGE_PROPS = {
  commentId: null,
  currentUserId: 1,
  projectId: 42,
  taskId: "task-7",
  taskTab: "details" as const,
  token: DEFAULT_TOKEN,
};

describe("ProjectManagerTaskPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    ganttApiMock.getProjectChartOrNull.mockReset();
    taskJournalApiMock.getJournal.mockReset();
    taskCommentsApiMock.listComments.mockReset();
    taskAttachmentsApiMock.listAttachments.mockReset();
    ganttApiMock.getProjectChartOrNull.mockResolvedValue({
      content: TASK_XML,
      type: "xml",
    });
    taskJournalApiMock.getJournal.mockResolvedValue({
      journalExists: true,
      markdown: "Task journal",
      taskMirrorExists: true,
    });
    taskCommentsApiMock.listComments.mockResolvedValue({ comments: [] });
    taskAttachmentsApiMock.listAttachments.mockResolvedValue({ attachments: [] });
  });

  it("renders the selected task detail card from gantt xml", async () => {
    renderWithTheme(<ProjectManagerTaskPage {...DEFAULT_TASK_PAGE_PROPS} />);

    expect(await screen.findByText("Task Detail")).toBeVisible();
    expect(await screen.findByText("Gateway rollout")).toBeVisible();
    expect(screen.getByText("Detailed Task View")).toBeVisible();
    expect(screen.getByText("Investigate the gateway timeout")).toBeVisible();
    expect(ganttApiMock.getProjectChartOrNull).toHaveBeenCalledWith(DEFAULT_TOKEN, 42);
    expect(screen.getByTestId("discussion-tab-count-comments")).toHaveTextContent("0");
    expect(screen.getByTestId("discussion-tab-count-attachments")).toHaveTextContent("0");
  });

  it("navigates back to the tasks route from the back button", async () => {
    const user = userEvent.setup();

    renderWithTheme(<ProjectManagerTaskPage {...DEFAULT_TASK_PAGE_PROPS} />);

    await user.click(await screen.findByRole("button", { name: "Back to Tasks" }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/project/tasks?projectId=42");
  });

  it("uses the shared project-scoped navigation tabs including the task detail tab", async () => {
    const user = userEvent.setup();

    renderWithTheme(<ProjectManagerTaskPage {...DEFAULT_TASK_PAGE_PROPS} />);

    const projectWorkspaceTabs = await screen.findByRole("tablist", {
      name: "Project workspace sections",
    });
    expect(
      within(projectWorkspaceTabs).getByRole("tab", { name: "Task task-7" }),
    ).toBeVisible();

    await user.click(within(projectWorkspaceTabs).getByRole("tab", { name: "Gantt" }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/project/gantt?projectId=42");
  });

  it("loads task comments in the comments tab", async () => {
    renderWithTheme(
      <ProjectManagerTaskPage
        {...DEFAULT_TASK_PAGE_PROPS}
        commentId={19}
        taskTab="comments"
      />,
    );

    await waitFor(() => {
      expect(taskCommentsApiMock.listComments).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        42,
        "task-7",
      );
    });
    expect(screen.getByText("Comments", { selector: "h6" })).toBeVisible();
  });

  it("renders task tab count chips from the current discussion totals", async () => {
    taskCommentsApiMock.listComments.mockResolvedValue({
      comments: [{ id: 1 }, { id: 2 }, { id: 3 }] as never[],
    });
    taskAttachmentsApiMock.listAttachments.mockResolvedValue({
      attachments: [{ id: "att-1" }, { id: "att-2" }] as never[],
    });

    renderWithTheme(<ProjectManagerTaskPage {...DEFAULT_TASK_PAGE_PROPS} />);

    expect(await screen.findByTestId("discussion-tab-count-comments")).toHaveTextContent("3");
    expect(screen.getByTestId("discussion-tab-count-attachments")).toHaveTextContent("2");
  });

  it("loads task attachments in the attachments tab", async () => {
    renderWithTheme(
      <ProjectManagerTaskPage
        {...DEFAULT_TASK_PAGE_PROPS}
        taskTab="attachments"
      />,
    );

    await waitFor(() => {
      expect(taskAttachmentsApiMock.listAttachments).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        42,
        "task-7",
      );
    });
    expect(screen.getByText("Task-level attachments")).toBeVisible();
  });

  it("shows zero-valued task tab chips when discussion endpoints return 404", async () => {
    taskCommentsApiMock.listComments.mockRejectedValue(
      new ApiError("http", "HTTP 404", {
        responseBody: "TaskMirror missing",
        status: 404,
      }),
    );
    taskAttachmentsApiMock.listAttachments.mockRejectedValue(
      new ApiError("http", "HTTP 404", {
        responseBody: "TaskMirror missing",
        status: 404,
      }),
    );

    renderWithTheme(<ProjectManagerTaskPage {...DEFAULT_TASK_PAGE_PROPS} />);

    expect(await screen.findByTestId("discussion-tab-count-comments")).toHaveTextContent("0");
    expect(screen.getByTestId("discussion-tab-count-attachments")).toHaveTextContent("0");
  });

  it("refreshes task tab count chips when task discussion state changes", async () => {
    taskCommentsApiMock.listComments
      .mockResolvedValueOnce({ comments: [{ id: 1 }] as never[] })
      .mockResolvedValue({ comments: [{ id: 1 }, { id: 2 }] as never[] });
    taskAttachmentsApiMock.listAttachments
      .mockResolvedValueOnce({ attachments: [] })
      .mockResolvedValue({ attachments: [{ id: "att-1" }] as never[] });

    renderWithTheme(<ProjectManagerTaskPage {...DEFAULT_TASK_PAGE_PROPS} />);

    expect(await screen.findByTestId("discussion-tab-count-comments")).toHaveTextContent("1");
    expect(screen.getByTestId("discussion-tab-count-attachments")).toHaveTextContent("0");

    emitProjectManagerTaskDiscussionStateEvent({ projectId: 42, taskId: "task-7" });

    await waitFor(() => {
      expect(screen.getByTestId("discussion-tab-count-comments")).toHaveTextContent("2");
      expect(screen.getByTestId("discussion-tab-count-attachments")).toHaveTextContent("1");
    });
  });

  it("renders a safe fallback when task id or projectId is missing", async () => {
    renderWithTheme(
      <ProjectManagerTaskPage
        {...DEFAULT_TASK_PAGE_PROPS}
        projectId={null}
        taskId={null}
      />,
    );

    expect(
      await screen.findByText("Provide both a valid task id and projectId to view a task."),
    ).toBeVisible();
  });

  it("shows a not-found message when the selected task is missing from the current chart", async () => {
    renderWithTheme(
      <ProjectManagerTaskPage
        {...DEFAULT_TASK_PAGE_PROPS}
        taskId="missing-task"
      />,
    );

    expect(
      await screen.findByText("That task was not found in the current gantt chart."),
    ).toBeVisible();
  });
});
