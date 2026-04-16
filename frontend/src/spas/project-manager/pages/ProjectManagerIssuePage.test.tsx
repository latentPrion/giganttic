import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { issueAttachmentsApi } from "../api/issue-attachments-api.js";
import { issueCommentsApi } from "../api/issue-comments-api.js";
import { issueJournalApi } from "../api/issue-journal-api.js";
import { issuesApi } from "../api/issues-api.js";
import type { Issue } from "../contracts/issue.contracts.js";
import { emitProjectManagerIssueDiscussionStateEvent } from "../lib/issue-discussion-state-events.js";
import { PROJECT_MANAGER_ISSUE_UPDATED_EVENT } from "../lib/issue-updated-events.js";
import { ProjectManagerIssuePage } from "./ProjectManagerIssuePage.js";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../api/issues-api.js", () => ({
  issuesApi: {
    createIssue: vi.fn(),
    deleteIssue: vi.fn(),
    getIssue: vi.fn(),
    listIssues: vi.fn(),
    updateIssue: vi.fn(),
  },
}));

vi.mock("../api/issue-comments-api.js", () => ({
  issueCommentsApi: {
    createComment: vi.fn(),
    deleteComment: vi.fn(),
    deleteCommentAttachment: vi.fn(),
    listComments: vi.fn(),
    updateComment: vi.fn(),
    uploadCommentAttachment: vi.fn(),
  },
}));

vi.mock("../api/issue-attachments-api.js", () => ({
  issueAttachmentsApi: {
    deleteAttachment: vi.fn(),
    listAttachments: vi.fn(),
    uploadAttachment: vi.fn(),
  },
}));

vi.mock("../api/issue-journal-api.js", () => ({
  issueJournalApi: {
    getJournal: vi.fn(),
    updateJournal: vi.fn(),
  },
}));

vi.mock("../../../lobby/api/lobby-api.js", () => ({
  lobbyApi: {
    getProject: vi.fn(),
  },
}));

const issuesApiMock = vi.mocked(issuesApi);
const issueCommentsApiMock = vi.mocked(issueCommentsApi);
const issueAttachmentsApiMock = vi.mocked(issueAttachmentsApi);
const issueJournalApiMock = vi.mocked(issueJournalApi);
const lobbyApiMock = vi.mocked(lobbyApi);
const DEFAULT_TOKEN = "pm-token";
const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";
const DEFAULT_ISSUE_PAGE_PROPS = {
  commentId: null,
  currentUserId: 1,
  issueTab: "details" as const,
};

function createIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    closedAt: null,
    closedReason: null,
    closedReasonDescription: null,
    createdAt: DEFAULT_TIMESTAMP,
    description: "Detailed issue description",
    id: 7,
    name: "Issue 7",
    openedAt: DEFAULT_TIMESTAMP,
    priority: 2,
    progressPercentage: 35,
    projectId: 42,
    status: "ISSUE_STATUS_OPEN" as const,
    updatedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  };
}

function requireJournalSection(title: string): HTMLElement {
  const journalSection = screen.getByText(title).closest(".MuiPaper-root");
  expect(journalSection).not.toBeNull();
  return journalSection as HTMLElement;
}

describe("ProjectManagerIssuePage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    lobbyApiMock.getProject.mockReset();
    issueAttachmentsApiMock.listAttachments.mockReset();
    issueCommentsApiMock.listComments.mockReset();
    issueJournalApiMock.getJournal.mockReset();
    issuesApiMock.deleteIssue.mockReset();
    issuesApiMock.getIssue.mockReset();
    issuesApiMock.updateIssue.mockReset();
    issuesApiMock.getIssue.mockResolvedValue({ issue: createIssue() });
    issueCommentsApiMock.listComments.mockResolvedValue({
      comments: [{ id: 1 }, { id: 2 }] as never[],
    });
    issueAttachmentsApiMock.listAttachments.mockResolvedValue({
      attachments: [{ id: "att-1" }] as never[],
    });
    issueJournalApiMock.getJournal.mockResolvedValue({
      journalExists: true,
      markdown: "Issue journal",
    });
    lobbyApiMock.getProject.mockResolvedValue({
      members: [{
        roleCodes: [],
        userId: 1,
        username: "demo-user",
      }],
      organizations: [],
      project: {
        createdAt: DEFAULT_TIMESTAMP,
        description: "Project description",
        id: 42,
        name: "Project 42",
        updatedAt: DEFAULT_TIMESTAMP,
      },
      projectManagers: [],
      teams: [],
    });
  });

  it("renders the selected issue and detailed card", async () => {
    renderWithTheme(
      <ProjectManagerIssuePage
        {...DEFAULT_ISSUE_PAGE_PROPS}
        issueId={7}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("Issue Detail")).toBeVisible();
    expect(await screen.findByText("Issue 7")).toBeVisible();
    expect(screen.getByText("Detailed Issue View")).toBeVisible();
    expect(screen.getByText("Priority: High")).toBeVisible();
    expect(issuesApiMock.getIssue).toHaveBeenCalledWith(DEFAULT_TOKEN, 42, 7);
    expect(screen.getByTestId("discussion-tab-count-comments")).toHaveTextContent("2");
    expect(screen.getByTestId("discussion-tab-count-attachments")).toHaveTextContent("1");
  });

  it("opens the summary modal from the view button", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerIssuePage
        {...DEFAULT_ISSUE_PAGE_PROPS}
        issueId={7}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "View" }));

    const summaryDialog = await screen.findByRole("dialog", { name: "Issue Summary" });
    expect(summaryDialog).toBeVisible();
    expect(within(summaryDialog).getByText("Priority: High")).toBeVisible();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows project and issue attachment embedding instructions in the issue journal editor", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerIssuePage
        {...DEFAULT_ISSUE_PAGE_PROPS}
        issueId={7}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await screen.findByText("Issue Journal");
    const journalSection = requireJournalSection("Issue Journal");
    await user.click(await within(journalSection).findByRole("button", { name: "Edit" }));

    expect(await screen.findByText(/this project's Attachments tab/i)).toBeVisible();
    expect(screen.getByText(/gigantt:\/\/project-attachment\/<attachmentId>/i)).toBeVisible();
    expect(screen.getByText(/this issue's Attachments tab/i)).toBeVisible();
    expect(screen.getByText(/gigantt:\/\/issue-attachment\/<attachmentId>/i)).toBeVisible();
    expect(screen.queryByText(/gigantt:\/\/task-attachment\/<attachmentId>/i)).not.toBeInTheDocument();
  });

  it("updates the issue and refreshes the detail preview row", async () => {
    const user = userEvent.setup();
    const updatedIssue = createIssue({ name: "Issue 7 Updated", priority: 3, progressPercentage: 90 });
    issuesApiMock.getIssue.mockResolvedValue({ issue: updatedIssue });
    issuesApiMock.updateIssue.mockResolvedValue({
      issue: updatedIssue,
    });

    renderWithTheme(
      <ProjectManagerIssuePage
        {...DEFAULT_ISSUE_PAGE_PROPS}
        issueId={7}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    expect(await screen.findByRole("dialog", { name: "Edit Issue" })).toBeVisible();
    const nameField = screen.getByLabelText("Name");
    await user.clear(nameField);
    await user.type(nameField, "Issue 7 Updated");
    await user.click(screen.getByRole("combobox", { name: "Priority" }));
    await user.click(await screen.findByRole("option", { name: "Urgent" }));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(issuesApiMock.updateIssue).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        42,
        7,
        expect.objectContaining({ name: "Issue 7 Updated", priority: 3 }),
      );
    });
    expect(await screen.findByText("Issue 7 Updated")).toBeVisible();
    expect(screen.getByText("Priority: Urgent")).toBeVisible();
    expect(screen.getByText("Progress 90%")).toBeVisible();
  }, 10000);

  it("deletes the issue and navigates back to the issues route", async () => {
    const user = userEvent.setup();
    issuesApiMock.deleteIssue.mockResolvedValue({ deletedIssueId: 7 });

    renderWithTheme(
      <ProjectManagerIssuePage
        {...DEFAULT_ISSUE_PAGE_PROPS}
        issueId={7}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(issuesApiMock.deleteIssue).toHaveBeenCalledWith(DEFAULT_TOKEN, 42, 7);
    });
    expect(navigateMock).toHaveBeenCalledWith("/pm/pm/project/issues?projectId=42");
  });

  it("uses the shared project-scoped navigation tabs", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerIssuePage
        {...DEFAULT_ISSUE_PAGE_PROPS}
        issueId={7}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    const projectWorkspaceTabs = await screen.findByRole("tablist", {
      name: "Project workspace sections",
    });
    await user.click(within(projectWorkspaceTabs).getByRole("tab", { name: "Details" }));
    await user.click(within(projectWorkspaceTabs).getByRole("tab", { name: "Gantt" }));

    expect(navigateMock).toHaveBeenNthCalledWith(1, "/pm/pm/project?projectId=42");
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/pm/pm/project/gantt?projectId=42");
  });

  it("renders a safe fallback when issue id or projectId is missing", async () => {
    renderWithTheme(
      <ProjectManagerIssuePage
        {...DEFAULT_ISSUE_PAGE_PROPS}
        issueId={null}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByText("Provide both a valid issue id and projectId to view an issue.")).toBeVisible();
  });

  it("reloads issue detail when an issue-updated event is received for same issue", async () => {
    renderWithTheme(
      <ProjectManagerIssuePage
        {...DEFAULT_ISSUE_PAGE_PROPS}
        issueId={7}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await screen.findByText("Issue 7");
    expect(issuesApiMock.getIssue).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new CustomEvent(PROJECT_MANAGER_ISSUE_UPDATED_EVENT, {
      detail: { issueId: 7, projectId: 42 },
    }));

    await waitFor(() => {
      expect(issuesApiMock.getIssue).toHaveBeenCalledTimes(2);
    });
  });

  it("emits issue-updated event after successful issue edit", async () => {
    const user = userEvent.setup();
    const eventListener = vi.fn();
    window.addEventListener(PROJECT_MANAGER_ISSUE_UPDATED_EVENT, eventListener);
    issuesApiMock.updateIssue.mockResolvedValue({
      issue: createIssue({ name: "Issue 7 Retitled" }),
    });

    renderWithTheme(
      <ProjectManagerIssuePage
        {...DEFAULT_ISSUE_PAGE_PROPS}
        issueId={7}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    await user.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);
    const editDialog = await screen.findByRole("dialog", { name: "Edit Issue" });
    await user.clear(within(editDialog).getByLabelText("Name"));
    await user.type(within(editDialog).getByLabelText("Name"), "Issue 7 Retitled");
    await user.click(within(editDialog).getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(eventListener).toHaveBeenCalled();
    });

    window.removeEventListener(PROJECT_MANAGER_ISSUE_UPDATED_EVENT, eventListener);
  });

  it("refreshes issue tab count chips when issue discussion state changes", async () => {
    issueCommentsApiMock.listComments
      .mockResolvedValueOnce({ comments: [{ id: 1 }] as never[] })
      .mockResolvedValue({ comments: [{ id: 1 }, { id: 2 }, { id: 3 }] as never[] });
    issueAttachmentsApiMock.listAttachments
      .mockResolvedValueOnce({ attachments: [{ id: "att-1" }] as never[] })
      .mockResolvedValue({ attachments: [{ id: "att-1" }, { id: "att-2" }] as never[] });

    renderWithTheme(
      <ProjectManagerIssuePage
        {...DEFAULT_ISSUE_PAGE_PROPS}
        issueId={7}
        projectId={42}
        token={DEFAULT_TOKEN}
      />,
    );

    expect(await screen.findByTestId("discussion-tab-count-comments")).toHaveTextContent("1");
    expect(screen.getByTestId("discussion-tab-count-attachments")).toHaveTextContent("1");

    emitProjectManagerIssueDiscussionStateEvent({ issueId: 7, projectId: 42 });

    await waitFor(() => {
      expect(screen.getByTestId("discussion-tab-count-comments")).toHaveTextContent("3");
      expect(screen.getByTestId("discussion-tab-count-attachments")).toHaveTextContent("2");
    });
  });
});
