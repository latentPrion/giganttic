import React from "react";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithTheme } from "../../../test/render-with-theme.js";
import { EntityItemList } from "./EntityItemList.js";

describe("EntityItemList", () => {
  it("renders its children inside a reusable list container with the selected view mode", () => {
    renderWithTheme(
      <EntityItemList viewMode="main-listing-view">
        <div>First Item</div>
        <div>Second Item</div>
      </EntityItemList>,
    );

    const list = document.querySelector('[data-entity-item-list="true"]');

    expect(list).not.toBeNull();
    expect(list).toHaveAttribute("data-view-mode", "main-listing-view");
    expect(screen.getByText("First Item")).toBeVisible();
    expect(screen.getByText("Second Item")).toBeVisible();
  });

  it("supports the reusable link-only-no-action-buttons view mode", () => {
    renderWithTheme(
      <EntityItemList viewMode="link-only-no-action-buttons">
        <div>Linked Item</div>
      </EntityItemList>,
    );

    const list = document.querySelector('[data-entity-item-list="true"]');

    expect(list).not.toBeNull();
    expect(list).toHaveAttribute("data-view-mode", "link-only-no-action-buttons");
    expect(screen.getByText("Linked Item")).toBeVisible();
  });
});
