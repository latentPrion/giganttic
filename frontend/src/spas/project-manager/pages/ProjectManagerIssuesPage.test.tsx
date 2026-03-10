import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ProjectManagerIssuesPage } from "./ProjectManagerIssuesPage.js";
import { issuesApi } from "../api/issues-api.js";
import type { Issue } from "../contracts/issue.contracts.js";

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

function createIssue(id = 7, overrides: Partial<Issue> = {}): Issue {
  return {
    closedAt: null,
    closedReason: null,
    closedReasonDescription: null,
    createdAt: DEFAULT_TIMESTAMP,
    description: "Upload summary mismatch",
    id,
    journal: "Investigate the payload mismatch",
    name: `Issue ${id}`,
    openedAt: DEFAULT_TIMESTAMP,
    priority: 2,
    progressPercentage: 35,
    projectId: 42,
    status: "ISSUE_STATUS_IN_PROGRESS" as const,
    updatedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  };
}

describe("ProjectManagerIssuesPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    issuesApiMock.createIssue.mockReset();
    issuesApiMock.deleteIssue.mockReset();
    issuesApiMock.getIssue.mockReset();
    issuesApiMock.listIssues.mockReset();
    issuesApiMock.updateIssue.mockReset();
    issuesApiMock.listIssues.mockResolvedValue({
      issues: [
        createIssue(7, { name: "In Progress High", priority: 5, progressPercentage: 35 }),
        createIssue(8, { name: "Open Low", priority: 1, progressPercentage: 10, status: "ISSUE_STATUS_OPEN" }),
        createIssue(9, { name: "Blocked Medium", priority: 3, progressPercentage: 20, status: "ISSUE_STATUS_BLOCKED" }),
        createIssue(10, {
          closedAt: DEFAULT_TIMESTAMP,
          closedReason: "ISSUE_CLOSED_REASON_RESOLVED",
          name: "Closed Done",
          progressPercentage: 100,
          status: "ISSUE_STATUS_CLOSED",
        }),
      ],
    });
    issuesApiMock.getIssue.mockResolvedValue({ issue: createIssue() });
  });

  it("renders all issues for the selected project", async () => {
    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    expect(await screen.findByText("Project Issues")).toBeVisible();
    expect(screen.getByText("Selected project: 42")).toBeVisible();
    expect(await screen.findByText("In Progress High")).toBeVisible();
    expect(screen.queryByText("Open Low")).not.toBeInTheDocument();
    expect(issuesApiMock.listIssues).toHaveBeenCalledWith(DEFAULT_TOKEN, 42);
    expect(screen.getByRole("tab", { name: "In Progress", selected: true })).toBeVisible();
  });

  it("filters issues through the Open, In Progress, Blocked, and Closed tabs", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    expect(await screen.findByText("In Progress High")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Open" }));
    expect(await screen.findByText("Open Low")).toBeVisible();
    expect(screen.queryByText("In Progress High")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Blocked" }));
    expect(await screen.findByText("Blocked Medium")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Closed" }));
    expect(await screen.findByText("Closed Done")).toBeVisible();
  });

  it("shows the filtered empty state by default when only non-in-progress issues exist", async () => {
    const user = userEvent.setup();
    issuesApiMock.listIssues.mockResolvedValue({
      issues: [
        createIssue(8, { name: "Open Only", status: "ISSUE_STATUS_OPEN" }),
        createIssue(9, { name: "Blocked Only", status: "ISSUE_STATUS_BLOCKED" }),
      ],
    });

    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    expect(await screen.findByText("No issues match the current filters yet.")).toBeVisible();
    expect(screen.queryByText("Open Only")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Open" }));

    expect(await screen.findByText("Open Only")).toBeVisible();
  });

  it("sorts visible issues by priority and progress percentage", async () => {
    const user = userEvent.setup();
    issuesApiMock.listIssues.mockResolvedValue({
      issues: [
        createIssue(7, { name: "In Progress Low Priority", priority: 1, progressPercentage: 90 }),
        createIssue(8, { name: "In Progress High Priority", priority: 5, progressPercentage: 10 }),
      ],
    });

    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    expect(await screen.findByText("In Progress High Priority")).toBeVisible();
    const defaultButtons = screen.getAllByRole("button", { name: /In Progress .* Priority/i });
    expect(defaultButtons[0]).toHaveTextContent("In Progress High Priority");

    await user.click(screen.getByRole("combobox", { name: "Sort By" }));
    await user.click(await screen.findByRole("option", { name: "Progress" }));

    const progressButtons = screen.getAllByRole("button", { name: /In Progress .* Priority/i });
    expect(progressButtons[0]).toHaveTextContent("In Progress Low Priority");
  });

  it("opens the create issue modal and adds the new issue to the list", async () => {
    const user = userEvent.setup();
    const createdIssue = createIssue(9, { name: "Created issue" });
    issuesApiMock.createIssue.mockResolvedValue({ issue: createdIssue });

    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    await user.click(await screen.findByRole("button", { name: "Create Issue" }));
    await user.type(screen.getByLabelText("Name"), "Created issue");
    await user.click(screen.getByRole("button", { name: "Create Issue" }));

    await waitFor(() => {
      expect(issuesApiMock.createIssue).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        42,
        expect.objectContaining({ name: "Created issue" }),
      );
    });
    expect(await screen.findByText("Created issue")).toBeVisible();
  });

  it("keeps a newly created open issue hidden until the Open tab is selected", async () => {
    const user = userEvent.setup();
    const createdIssue = createIssue(11, {
      name: "Created Open Issue",
      status: "ISSUE_STATUS_OPEN",
    });
    issuesApiMock.createIssue.mockResolvedValue({ issue: createdIssue });

    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    await user.click(await screen.findByRole("button", { name: "Create Issue" }));

    const createDialog = await screen.findByRole("dialog", { name: "Create Issue" });
    await user.type(within(createDialog).getByLabelText("Name"), "Created Open Issue");
    await user.click(within(createDialog).getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "open" }));
    await user.click(within(createDialog).getByRole("button", { name: "Create Issue" }));

    await waitFor(() => {
      expect(issuesApiMock.createIssue).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        42,
        expect.objectContaining({
          name: "Created Open Issue",
          status: "ISSUE_STATUS_OPEN",
        }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Create Issue" })).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Created Open Issue")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Open" }));
    expect(await screen.findByText("Created Open Issue")).toBeVisible();
  });

  it("opens the summary modal from the view button", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    await user.click(await screen.findByRole("button", { name: "View" }));

    expect(await screen.findByRole("dialog", { name: "Issue Summary" })).toBeVisible();
    expect(issuesApiMock.getIssue).toHaveBeenCalledWith(DEFAULT_TOKEN, 42, 7);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("navigates to the nested issue-detail route when the issue row is clicked", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    await user.click(await screen.findByRole("button", { name: /In Progress High/i }));

    expect(navigateMock).toHaveBeenCalledWith("/pm/project/issue?projectId=42&id=7");
  });

  it("uses the shared project-scoped navigation tabs", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    await user.click(await screen.findByRole("tab", { name: "Details" }));
    await user.click(screen.getByRole("tab", { name: "Gantt" }));

    expect(navigateMock).toHaveBeenNthCalledWith(1, "/pm/project?projectId=42");
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/pm/project/gantt?projectId=42");
  });

  it("renders the missing-project fallback and disables create when no project is selected", async () => {
    renderWithTheme(
      <ProjectManagerIssuesPage projectId={null} token={DEFAULT_TOKEN} />,
    );

    expect(await screen.findByText("Select a valid project to view its issues.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create Issue" })).toBeDisabled();
  });

  it("updates an issue through the edit modal", async () => {
    const user = userEvent.setup();
    issuesApiMock.updateIssue.mockResolvedValue({
      issue: createIssue(7, { name: "Updated issue", progressPercentage: 80 }),
    });

    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("dialog", { name: "Edit Issue" })).toBeVisible();
    const nameField = screen.getByLabelText("Name");
    await user.clear(nameField);
    await user.type(nameField, "Updated issue");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(issuesApiMock.updateIssue).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        42,
        7,
        expect.objectContaining({ name: "Updated issue" }),
      );
    });
    expect(await screen.findByText("Updated issue")).toBeVisible();
  });

  it("moves an updated issue into the matching status tab when its status changes", async () => {
    const user = userEvent.setup();
    issuesApiMock.updateIssue.mockResolvedValue({
      issue: createIssue(7, {
        name: "Blocked After Update",
        progressPercentage: 55,
        status: "ISSUE_STATUS_BLOCKED",
      }),
    });

    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    expect(await screen.findByText("In Progress High")).toBeVisible();

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const editDialog = await screen.findByRole("dialog", { name: "Edit Issue" });
    await user.clear(within(editDialog).getByLabelText("Name"));
    await user.type(within(editDialog).getByLabelText("Name"), "Blocked After Update");
    await user.click(within(editDialog).getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "blocked" }));
    await user.click(within(editDialog).getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(issuesApiMock.updateIssue).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        42,
        7,
        expect.objectContaining({
          name: "Blocked After Update",
          status: "ISSUE_STATUS_BLOCKED",
        }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit Issue" })).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Blocked After Update")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Blocked" }));
    expect(await screen.findByText("Blocked After Update")).toBeVisible();
  });

  it("deletes an issue and removes it from the list", async () => {
    const user = userEvent.setup();
    issuesApiMock.deleteIssue.mockResolvedValue({ deletedIssueId: 7 });

    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(issuesApiMock.deleteIssue).toHaveBeenCalledWith(DEFAULT_TOKEN, 42, 7);
    });
    expect(screen.queryByText("Issue 7")).not.toBeInTheDocument();
  });
});
