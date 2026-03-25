import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { issuesApi } from "../api/issues-api.js";
import type { Issue } from "../contracts/issue.contracts.js";
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

const issuesApiMock = vi.mocked(issuesApi);
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
    journal: "Investigate the payload mismatch",
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

describe("ProjectManagerIssuePage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    issuesApiMock.deleteIssue.mockReset();
    issuesApiMock.getIssue.mockReset();
    issuesApiMock.updateIssue.mockReset();
    issuesApiMock.getIssue.mockResolvedValue({ issue: createIssue() });
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

    await user.click(await screen.findByRole("button", { name: "Edit" }));
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
    expect(navigateMock).toHaveBeenCalledWith("/pm/project/issues?projectId=42");
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

    expect(navigateMock).toHaveBeenNthCalledWith(1, "/pm/project?projectId=42");
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/pm/project/gantt?projectId=42");
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

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const editDialog = await screen.findByRole("dialog", { name: "Edit Issue" });
    await user.clear(within(editDialog).getByLabelText("Name"));
    await user.type(within(editDialog).getByLabelText("Name"), "Issue 7 Retitled");
    await user.click(within(editDialog).getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(eventListener).toHaveBeenCalled();
    });

    window.removeEventListener(PROJECT_MANAGER_ISSUE_UPDATED_EVENT, eventListener);
  });
});
