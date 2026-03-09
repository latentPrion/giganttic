import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { IssueDeleteButton } from "../entity-actions/IssueDeleteButton.js";
import { IssueEditButton } from "../entity-actions/IssueEditButton.js";
import { IssueListItem } from "./IssueListItem.js";

const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";

function createIssue() {
  return {
    closedAt: null,
    closedReason: null,
    closedReasonDescription: null,
    createdAt: DEFAULT_TIMESTAMP,
    description: "Upload summary mismatch",
    id: 7,
    journal: "Working notes",
    name: "Fix upload summary mismatch",
    openedAt: DEFAULT_TIMESTAMP,
    progressPercentage: 35,
    projectId: 42,
    status: "ISSUE_STATUS_OPEN" as const,
    updatedAt: DEFAULT_TIMESTAMP,
  };
}

describe("IssueListItem", () => {
  it("renders action buttons in main-listing-view and opens summary on row click", async () => {
    const user = userEvent.setup();
    const onOpenSummary = vi.fn();

    renderWithTheme(
      <IssueListItem
        actionContent={(
          <>
            <IssueEditButton onClick={vi.fn()} />
            <IssueDeleteButton onClick={vi.fn()} />
          </>
        )}
        issue={createIssue()}
        onOpenSummary={onOpenSummary}
        viewMode="main-listing-view"
      />,
    );

    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
    expect(screen.getByText("Progress 35%")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Fix upload summary mismatch/i }));

    expect(onOpenSummary).toHaveBeenCalledTimes(1);
  });

  it("hides action buttons in side-nav-narrow-view", () => {
    renderWithTheme(
      <IssueListItem
        actionContent={<IssueEditButton onClick={vi.fn()} />}
        issue={createIssue()}
        onOpenSummary={vi.fn()}
        viewMode="side-nav-narrow-view"
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("does not trigger the summary handler when action buttons are clicked", async () => {
    const user = userEvent.setup();
    const onOpenSummary = vi.fn();
    const onEdit = vi.fn();

    renderWithTheme(
      <IssueListItem
        actionContent={<IssueEditButton onClick={onEdit} />}
        issue={createIssue()}
        onOpenSummary={onOpenSummary}
        viewMode="main-listing-view"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onOpenSummary).not.toHaveBeenCalled();
  });
});
