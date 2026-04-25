import React from "react";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../../test/render-with-theme.js";
import { DiscussionWorkspaceTabs } from "./DiscussionWorkspaceTabs.js";

describe("DiscussionWorkspaceTabs", () => {
  it("renders comment and attachment count chips when counts are provided", () => {
    renderWithTheme(
      <DiscussionWorkspaceTabs
        ariaLabel="Discussion tabs"
        attachmentsCount={2}
        commentsCount={5}
        onChange={vi.fn()}
        value="details"
      />,
    );

    expect(within(screen.getByRole("tab", { name: /Comments/i })).getByTestId(
      "discussion-tab-count-comments",
    )).toHaveTextContent("5");
    expect(within(screen.getByRole("tab", { name: /Attachments/i })).getByTestId(
      "discussion-tab-count-attachments",
    )).toHaveTextContent("2");
  });

  it("omits count chips while counts are still loading", () => {
    renderWithTheme(
      <DiscussionWorkspaceTabs
        ariaLabel="Discussion tabs"
        attachmentsCount={null}
        commentsCount={null}
        onChange={vi.fn()}
        value="details"
      />,
    );

    expect(screen.queryByTestId("discussion-tab-count-comments")).not.toBeInTheDocument();
    expect(screen.queryByTestId("discussion-tab-count-attachments")).not.toBeInTheDocument();
  });

  it("keeps discussion tabs horizontally scrollable", () => {
    renderWithTheme(
      <DiscussionWorkspaceTabs
        ariaLabel="Discussion tabs"
        attachmentsCount={2}
        commentsCount={5}
        onChange={vi.fn()}
        value="details"
      />,
    );

    const tabList = screen.getByRole("tablist", { name: "Discussion tabs" });
    const tabsRoot = tabList.closest(".MuiTabs-root");
    const tabsScroller = tabsRoot?.querySelector(".MuiTabs-scroller");

    expect(tabsScroller).toHaveClass("MuiTabs-scrollableX");
    expect(tabsScroller).not.toHaveClass("MuiTabs-fixed");
  });
});
