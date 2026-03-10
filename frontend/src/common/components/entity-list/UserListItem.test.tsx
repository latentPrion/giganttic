import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectEditButton } from "../entity-actions/ProjectEditButton.js";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { UserListItem } from "./UserListItem.js";

function createUser() {
  return {
    description: "Project manager",
    id: 101,
    username: "demo-user",
  };
}

describe("UserListItem", () => {
  it("renders children content below the username", () => {
    renderWithTheme(
      <UserListItem
        user={createUser()}
        viewMode="link-only-no-action-buttons"
      >
        <div>Direct</div>
        <div>Team</div>
      </UserListItem>,
    );

    expect(screen.getByText("demo-user")).toBeVisible();
    expect(screen.getByText("Direct")).toBeVisible();
    expect(screen.getByText("Team")).toBeVisible();
  });

  it("hides action buttons but stays navigable in link-only-no-action-buttons view", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    renderWithTheme(
      <UserListItem
        actionContent={<ProjectEditButton onClick={vi.fn()} />}
        onNavigate={onNavigate}
        user={createUser()}
        viewMode="link-only-no-action-buttons"
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /demo-user/i }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
