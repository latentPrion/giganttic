import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
            journal: "Blocked on dependency",
            name: "Blocked issue",
            openedAt: DEFAULT_TIMESTAMP,
            priority: 4,
            progressPercentage: 25,
            projectId: 42,
            status: "ISSUE_STATUS_BLOCKED",
            updatedAt: DEFAULT_TIMESTAMP,
          },
          kind: "issue",
          title: "Blocked issue",
        }}
      />,
    );

    expect(screen.getByText("Blocked issue")).toBeVisible();
    expect(screen.getByText("Priority 4")).toBeVisible();
    expect(screen.getByText("Progress 25%")).toBeVisible();
  });

  it("renders gantt task cards separately from issue cards", () => {
    renderWithTheme(
      <KanbanTaskCard
        card={{
          column: "ISSUE_STATUS_IN_PROGRESS",
          id: "ganttTask:101",
          kind: "ganttTask",
          task: {
            id: "101",
            progressPercentage: 65,
            startDate: DEFAULT_TIMESTAMP,
            title: "Started task",
          },
          title: "Started task",
        }}
      />,
    );

    expect(screen.getByText("Started task")).toBeVisible();
    expect(screen.getByText("Gantt Task")).toBeVisible();
    expect(screen.getByText("Progress 65%")).toBeVisible();
  });
});
