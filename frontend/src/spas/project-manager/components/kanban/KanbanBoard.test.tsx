import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { KanbanBoard } from "./KanbanBoard.js";

const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";

describe("KanbanBoard", () => {
  it("renders the four status columns and mixed cards within the board", () => {
    renderWithTheme(
      <KanbanBoard
        columns={[
          {
            cards: [{
              column: "ISSUE_STATUS_OPEN",
              id: "issue:1",
              issue: {
                closedAt: null,
                closedReason: null,
                closedReasonDescription: null,
                createdAt: DEFAULT_TIMESTAMP,
                description: "Open issue description",
                id: 1,
                journal: "Open issue journal",
                name: "Open issue",
                openedAt: DEFAULT_TIMESTAMP,
                priority: 1,
                progressPercentage: 10,
                projectId: 42,
                status: "ISSUE_STATUS_OPEN",
                updatedAt: DEFAULT_TIMESTAMP,
              },
              kind: "issue",
              title: "Open issue",
            }],
            value: "ISSUE_STATUS_OPEN",
          },
          {
            cards: [{
              column: "ISSUE_STATUS_IN_PROGRESS",
              id: "ganttTask:101",
              kind: "ganttTask",
              task: {
                id: "101",
                progressPercentage: 45,
                startDate: DEFAULT_TIMESTAMP,
                title: "Started task",
              },
              title: "Started task",
            }],
            value: "ISSUE_STATUS_IN_PROGRESS",
          },
          {
            cards: [],
            value: "ISSUE_STATUS_BLOCKED",
          },
          {
            cards: [],
            value: "ISSUE_STATUS_CLOSED",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Open" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "In Progress" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Blocked" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Closed" })).toBeVisible();
    expect(screen.getByText("Open issue")).toBeVisible();
    expect(screen.getByText("Started task")).toBeVisible();
    expect(screen.getAllByText("No cards in this column yet.").length).toBeGreaterThan(0);
  });
});
