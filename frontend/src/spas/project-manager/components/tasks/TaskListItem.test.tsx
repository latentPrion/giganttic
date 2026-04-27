import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { TaskListItem } from "./TaskListItem.js";

const STARTED_AT = "2026-03-08T00:00:00.000Z";

describe("TaskListItem", () => {
  it("renders milestone cards with a bright border", () => {
    renderWithTheme(
      <TaskListItem
        task={{
          chartId: 0,
          id: "mile-1",
          progressPercentage: 100,
          startDate: STARTED_AT,
          status: "ISSUE_STATUS_CLOSED",
          title: "Milestone One",
          type: "milestone",
        }}
        viewMode="main-listing-view"
      />,
    );

    const card = screen.getByText("Milestone One").closest(".MuiPaper-root");
    expect(card).not.toBeNull();
    const styles = window.getComputedStyle(card!);
    expect(styles.borderTopWidth).toBe("2px");
  });
});

