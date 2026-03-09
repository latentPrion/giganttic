import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ProjectManagerIssuesPage } from "./ProjectManagerIssuesPage.js";
import { issuesApi } from "../api/issues-api.js";
import type { Issue } from "../contracts/issue.contracts.js";

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
    status: "ISSUE_STATUS_OPEN" as const,
    updatedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  };
}

describe("ProjectManagerIssuesPage", () => {
  beforeEach(() => {
    issuesApiMock.createIssue.mockReset();
    issuesApiMock.deleteIssue.mockReset();
    issuesApiMock.getIssue.mockReset();
    issuesApiMock.listIssues.mockReset();
    issuesApiMock.updateIssue.mockReset();
    issuesApiMock.listIssues.mockResolvedValue({ issues: [createIssue()] });
    issuesApiMock.getIssue.mockResolvedValue({ issue: createIssue() });
  });

  it("renders all issues for the selected project", async () => {
    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    expect(await screen.findByText("Project Issues")).toBeVisible();
    expect(screen.getByText("Selected project: 42")).toBeVisible();
    expect(await screen.findByText("Issue 7")).toBeVisible();
    expect(issuesApiMock.listIssues).toHaveBeenCalledWith(DEFAULT_TOKEN, 42);
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

  it("opens the summary modal from the view button", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerIssuesPage projectId={42} token={DEFAULT_TOKEN} />,
    );

    await user.click(await screen.findByRole("button", { name: "View" }));

    expect(await screen.findByRole("dialog", { name: "Issue Summary" })).toBeVisible();
    expect(issuesApiMock.getIssue).toHaveBeenCalledWith(DEFAULT_TOKEN, 42, 7);
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
