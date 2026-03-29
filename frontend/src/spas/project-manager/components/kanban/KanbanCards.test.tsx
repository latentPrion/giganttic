import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { KanbanIssueCard } from "./KanbanIssueCard.js";
import { KanbanTaskCard } from "./KanbanTaskCard.js";

const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";

describe("kanban cards", () => {
  it("renders issue cards with issue metadata", () => {
    renderWithTheme(
      <KanbanIssueCard
        card={{
          column: "ISSUE_STATUS_BLOCKED",
          id: "issue:9",
          issue: {
            closedAt: null,
            closedReason: null,
            closedReasonDescription: null,
            createdAt: DEFAULT_TIMESTAMP,
            description: "Investigate the blocker",
            id: 9,
            name: "Blocked issue",
            openedAt: DEFAULT_TIMESTAMP,
            priority: 3,
            progressPercentage: 25,
            projectId: 42,
            status: "ISSUE_STATUS_BLOCKED",
            updatedAt: DEFAULT_TIMESTAMP,
          },
          kind: "issue",
          title: "Blocked issue",
        }}
        onUpdateStatus={vi.fn()}
      />,
    );

    expect(screen.getByText("Blocked issue")).toBeVisible();
    expect(screen.getByText("Priority Urgent")).toBeVisible();
    expect(screen.getByText("Progress 25%")).toBeVisible();
  });

  it("renders gantt task cards separately from issue cards", () => {
    renderWithTheme(
      <KanbanTaskCard
        allowStatusChange
        card={{
          column: "ISSUE_STATUS_IN_PROGRESS",
          id: "ganttTask:101",
          kind: "ganttTask",
          task: {
            id: "101",
            isMilestone: false,
            progressPercentage: 65,
            startDate: DEFAULT_TIMESTAMP,
            status: "ISSUE_STATUS_IN_PROGRESS",
            title: "Started task",
          },
          title: "Started task",
        }}
        onUpdateStatus={vi.fn()}
      />,
    );

    expect(screen.getByText("Started task")).toBeVisible();
    expect(screen.getByText("Gantt Task")).toBeVisible();
    expect(screen.getByText("Progress 65%")).toBeVisible();
  });

  it("navigates to task detail on single click", () => {
    vi.useFakeTimers();
    const navigateToTask = vi.fn();

    renderWithTheme(
      <KanbanTaskCard
        allowStatusChange
        card={{
          column: "ISSUE_STATUS_IN_PROGRESS",
          id: "ganttTask:101",
          kind: "ganttTask",
          task: {
            id: "101",
            isMilestone: false,
            progressPercentage: 65,
            startDate: DEFAULT_TIMESTAMP,
            status: "ISSUE_STATUS_IN_PROGRESS",
            title: "Started task",
          },
          title: "Started task",
        }}
        onNavigateToTask={navigateToTask}
        onUpdateStatus={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("kanban-task-card-101"));
    vi.advanceTimersByTime(250);

    expect(navigateToTask).toHaveBeenCalledWith("101");
    vi.useRealTimers();
  });

  it("opens the task status menu on double click without navigating", () => {
    vi.useFakeTimers();
    const navigateToTask = vi.fn();

    renderWithTheme(
      <KanbanTaskCard
        allowStatusChange
        card={{
          column: "ISSUE_STATUS_IN_PROGRESS",
          id: "ganttTask:101",
          kind: "ganttTask",
          task: {
            id: "101",
            isMilestone: false,
            progressPercentage: 65,
            startDate: DEFAULT_TIMESTAMP,
            status: "ISSUE_STATUS_IN_PROGRESS",
            title: "Started task",
          },
          title: "Started task",
        }}
        onNavigateToTask={navigateToTask}
        onUpdateStatus={vi.fn()}
      />,
    );

    fireEvent.doubleClick(screen.getByTestId("kanban-task-card-101"));
    expect(screen.getByRole("menuitem", { name: "blocked" })).toBeVisible();
    vi.advanceTimersByTime(600);

    expect(navigateToTask).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("does not open the task status menu when status changes are disabled", () => {
    renderWithTheme(
      <KanbanTaskCard
        card={{
          column: "ISSUE_STATUS_IN_PROGRESS",
          id: "ganttTask:101",
          kind: "ganttTask",
          task: {
            id: "101",
            isMilestone: false,
            progressPercentage: 65,
            startDate: DEFAULT_TIMESTAMP,
            status: "ISSUE_STATUS_IN_PROGRESS",
            title: "Started task",
          },
          title: "Started task",
        }}
        onUpdateStatus={vi.fn()}
      />,
    );

    fireEvent.doubleClick(screen.getByTestId("kanban-task-card-101"));
    expect(screen.queryByRole("menuitem", { name: "blocked" })).not.toBeInTheDocument();
  });

  it("does not open status menu for milestone cards on double click", async () => {
    renderWithTheme(
      <KanbanTaskCard
        allowStatusChange
        card={{
          column: "ISSUE_STATUS_CLOSED",
          id: "ganttTask:mile-1",
          kind: "ganttTask",
          task: {
            id: "mile-1",
            isMilestone: true,
            progressPercentage: 100,
            startDate: DEFAULT_TIMESTAMP,
            status: "ISSUE_STATUS_CLOSED",
            title: "Milestone Alpha",
          },
          title: "Milestone Alpha",
        }}
        onUpdateStatus={vi.fn()}
      />,
    );

    fireEvent.doubleClick(screen.getByTestId("kanban-task-card-mile-1"));
    expect(screen.queryByRole("menuitem", { name: "open" })).not.toBeInTheDocument();
  });

  it("still navigates milestone task cards on single click", () => {
    vi.useFakeTimers();
    const navigateToTask = vi.fn();

    renderWithTheme(
      <KanbanTaskCard
        card={{
          column: "ISSUE_STATUS_CLOSED",
          id: "ganttTask:mile-1",
          kind: "ganttTask",
          task: {
            id: "mile-1",
            isMilestone: true,
            progressPercentage: 100,
            startDate: DEFAULT_TIMESTAMP,
            status: "ISSUE_STATUS_CLOSED",
            title: "Milestone Alpha",
          },
          title: "Milestone Alpha",
        }}
        onNavigateToTask={navigateToTask}
        onUpdateStatus={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("kanban-task-card-mile-1"));
    vi.advanceTimersByTime(250);

    expect(navigateToTask).toHaveBeenCalledWith("mile-1");
    vi.useRealTimers();
  });
});
