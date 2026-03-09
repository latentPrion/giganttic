import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { issuesApi } from "../api/issues-api.js";
import type { Issue } from "../contracts/issue.contracts.js";
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
      <ProjectManagerIssuePage issueId={7} projectId={42} token={DEFAULT_TOKEN} />,
    );

    expect(await screen.findByText("Issue Detail")).toBeVisible();
    expect(await screen.findByText("Issue 7")).toBeVisible();
    expect(screen.getByText("Detailed Issue View")).toBeVisible();
    expect(issuesApiMock.getIssue).toHaveBeenCalledWith(DEFAULT_TOKEN, 42, 7);
  });

  it("opens the summary modal from the view button", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerIssuePage issueId={7} projectId={42} token={DEFAULT_TOKEN} />,
    );

    await user.click(await screen.findByRole("button", { name: "View" }));

    expect(await screen.findByRole("dialog", { name: "Issue Summary" })).toBeVisible();
  });

  it("updates the issue and refreshes the detail preview row", async () => {
    const user = userEvent.setup();
    issuesApiMock.updateIssue.mockResolvedValue({
      issue: createIssue({ name: "Issue 7 Updated", progressPercentage: 90 }),
    });

    renderWithTheme(
      <ProjectManagerIssuePage issueId={7} projectId={42} token={DEFAULT_TOKEN} />,
    );

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("dialog", { name: "Edit Issue" })).toBeVisible();
    const nameField = screen.getByLabelText("Name");
    await user.clear(nameField);
    await user.type(nameField, "Issue 7 Updated");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(issuesApiMock.updateIssue).toHaveBeenCalledWith(
        DEFAULT_TOKEN,
        42,
        7,
        expect.objectContaining({ name: "Issue 7 Updated" }),
      );
    });
    expect(await screen.findByText("Issue 7 Updated")).toBeVisible();
    expect(screen.getByText("Progress 90%")).toBeVisible();
  });

  it("deletes the issue and navigates back to the issues route", async () => {
    const user = userEvent.setup();
    issuesApiMock.deleteIssue.mockResolvedValue({ deletedIssueId: 7 });

    renderWithTheme(
      <ProjectManagerIssuePage issueId={7} projectId={42} token={DEFAULT_TOKEN} />,
    );

    await user.click(await screen.findByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(issuesApiMock.deleteIssue).toHaveBeenCalledWith(DEFAULT_TOKEN, 42, 7);
    });
    expect(navigateMock).toHaveBeenCalledWith("/pm/issues?projectId=42");
  });
});
