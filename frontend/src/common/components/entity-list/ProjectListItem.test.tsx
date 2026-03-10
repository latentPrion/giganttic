import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ProjectDeleteButton } from "../entity-actions/ProjectDeleteButton.js";
import { ProjectEditButton } from "../entity-actions/ProjectEditButton.js";
import { ProjectListItem } from "./ProjectListItem.js";

const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";

function createProject() {
  return {
    createdAt: DEFAULT_TIMESTAMP,
    description: "Delivery pipeline",
    id: 1,
    name: "Apollo",
    updatedAt: DEFAULT_TIMESTAMP,
  };
}

describe("ProjectListItem", () => {
  it("renders action buttons in main-listing-view and triggers navigation on row click", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    renderWithTheme(
      <ProjectListItem
        actionContent={(
          <>
            <ProjectEditButton onClick={vi.fn()} />
            <ProjectDeleteButton onClick={vi.fn()} />
          </>
        )}
        onNavigate={onNavigate}
        project={createProject()}
        viewMode="main-listing-view"
      />,
    );

    expect(screen.getByRole("button", { name: "Edit" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Apollo/i }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("hides action buttons in side-nav-narrow-view", () => {
    renderWithTheme(
      <ProjectListItem
        actionContent={(
          <>
            <ProjectEditButton onClick={vi.fn()} />
            <ProjectDeleteButton onClick={vi.fn()} />
          </>
        )}
        onNavigate={vi.fn()}
        project={createProject()}
        viewMode="side-nav-narrow-view"
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("hides action buttons but stays navigable in link-only-no-action-buttons view", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    renderWithTheme(
      <ProjectListItem
        actionContent={(
          <>
            <ProjectEditButton onClick={vi.fn()} />
            <ProjectDeleteButton onClick={vi.fn()} />
          </>
        )}
        onNavigate={onNavigate}
        project={createProject()}
        viewMode="link-only-no-action-buttons"
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Apollo/i }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not trigger the summary handler when action buttons are clicked", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onEdit = vi.fn();

    renderWithTheme(
      <ProjectListItem
        actionContent={<ProjectEditButton onClick={onEdit} />}
        onNavigate={onNavigate}
        project={createProject()}
        viewMode="main-listing-view"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
