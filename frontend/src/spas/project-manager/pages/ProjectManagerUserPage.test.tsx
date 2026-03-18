import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import { renderWithTheme } from "../../../test/render-with-theme.js";
import { ProjectManagerUserPage } from "./ProjectManagerUserPage.js";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../../../lobby/api/lobby-api.js", () => ({
  lobbyApi: {
    changeUserPassword: vi.fn(),
    getUser: vi.fn(),
  },
}));

const lobbyApiMock = vi.mocked(lobbyApi);
const DEFAULT_TOKEN = "user-token";
const DEFAULT_TIMESTAMP = "2026-03-08T00:00:00.000Z";

  function createUserResponse() {
  return {
    organizations: [{
      createdAt: DEFAULT_TIMESTAMP,
      description: "Organization description",
      id: 9,
      name: "Org 9",
      updatedAt: DEFAULT_TIMESTAMP,
    }],
    projects: [{
      createdAt: DEFAULT_TIMESTAMP,
      description: "Project description",
      id: 42,
      journal: "Project journal",
      name: "Project 42",
      updatedAt: DEFAULT_TIMESTAMP,
    }],
    teams: [{
      createdAt: DEFAULT_TIMESTAMP,
      description: "Team description",
      id: 7,
      name: "Team 7",
      updatedAt: DEFAULT_TIMESTAMP,
    }],
    user: {
      createdAt: DEFAULT_TIMESTAMP,
      id: 101,
      isActive: true,
      updatedAt: DEFAULT_TIMESTAMP,
      username: "demo-user",
    },
  };
}

describe("ProjectManagerUserPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    lobbyApiMock.changeUserPassword.mockReset();
    lobbyApiMock.getUser.mockReset();
    lobbyApiMock.getUser.mockResolvedValue(createUserResponse());
    lobbyApiMock.changeUserPassword.mockResolvedValue({
      revokedSessionIds: [],
      updatedUserId: 101,
    });
  });

  it("renders the selected user and their direct project team and organization sections", async () => {
    renderWithTheme(<ProjectManagerUserPage token={DEFAULT_TOKEN} userId={101} />);

    expect(await screen.findByText("User Profile")).toBeVisible();
    expect(await screen.findByText("demo-user")).toBeVisible();
    expect(screen.getByText("Visible Projects")).toBeVisible();
    expect(screen.getByText("Visible Teams")).toBeVisible();
    expect(screen.getByText("Direct Organizations")).toBeVisible();
    expect(screen.getByText("Project 42")).toBeVisible();
    expect(screen.getByText("Team 7")).toBeVisible();
    expect(screen.getByText("Org 9")).toBeVisible();
  });

  it("navigates to linked project team and organization pages from the profile", async () => {
    const user = userEvent.setup();

    renderWithTheme(<ProjectManagerUserPage token={DEFAULT_TOKEN} userId={101} />);

    await user.click(await screen.findByRole("button", { name: /Project 42/i }));
    expect(navigateMock).toHaveBeenCalledWith("/pm/project?projectId=42");

    await user.click(screen.getByRole("button", { name: /Team 7/i }));
    expect(navigateMock).toHaveBeenCalledWith("/pm/team?teamId=7");

    await user.click(screen.getByRole("button", { name: /Org 9/i }));
    expect(navigateMock).toHaveBeenCalledWith("/pm/organization?organizationId=9");
  });

  it("keeps the profile header row navigable through the shared user list item", async () => {
    const user = userEvent.setup();

    renderWithTheme(<ProjectManagerUserPage token={DEFAULT_TOKEN} userId={101} />);

    const userButtons = await screen.findAllByRole("button", { name: /demo-user/i });
    await user.click(userButtons[0]!);

    expect(navigateMock).toHaveBeenCalledWith("/pm/user?userId=101");
  });

  it("shows a self-service password modal and submits current password plus revoke toggle", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerUserPage
        currentUserId={101}
        token={DEFAULT_TOKEN}
        userId={101}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Change Password" }));
    await user.type(screen.getByLabelText("Current Password"), "old-secret");
    await user.type(screen.getByLabelText("New Password"), "new-secret");
    await user.click(screen.getByRole("switch", { name: "Revoke sessions" }));
    await user.click(screen.getByRole("button", { name: "Save Password" }));

    expect(lobbyApiMock.changeUserPassword).toHaveBeenCalledWith(DEFAULT_TOKEN, 101, {
      currentPassword: "old-secret",
      newPassword: "new-secret",
      revokeSessions: true,
    });
  });

  it("lets an admin change another user's password without requiring current password", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerUserPage
        currentUserId={999}
        currentUserRoles={["GGTC_SYSTEMROLE_ADMIN"]}
        token={DEFAULT_TOKEN}
        userId={101}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Change Password" }));
    expect(screen.queryByLabelText("Current Password")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("New Password"), "admin-secret");
    await user.click(screen.getByRole("button", { name: "Save Password" }));

    expect(lobbyApiMock.changeUserPassword).toHaveBeenCalledWith(DEFAULT_TOKEN, 101, {
      currentPassword: undefined,
      newPassword: "admin-secret",
      revokeSessions: false,
    });
  });

  it("hides the change password action for unrelated non-admin viewers", async () => {
    renderWithTheme(
      <ProjectManagerUserPage
        currentUserId={999}
        currentUserRoles={["GGTC_SYSTEMROLE_USER"]}
        token={DEFAULT_TOKEN}
        userId={101}
      />,
    );

    expect(await screen.findByText("User Profile")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Change Password" })).not.toBeInTheDocument();
  });

  it("shows the returned error message when the password change request fails", async () => {
    const user = userEvent.setup();

    lobbyApiMock.changeUserPassword.mockRejectedValueOnce("Current password is required");

    renderWithTheme(
      <ProjectManagerUserPage
        currentUserId={101}
        token={DEFAULT_TOKEN}
        userId={101}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Change Password" }));
    await user.type(screen.getByLabelText("Current Password"), "old-secret");
    await user.type(screen.getByLabelText("New Password"), "new-secret");
    await user.click(screen.getByRole("button", { name: "Save Password" }));

    expect(await screen.findByText("Unable to change that password.")).toBeVisible();
  });

  it("shows a success message after a non-revoking password change", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <ProjectManagerUserPage
        currentUserId={101}
        token={DEFAULT_TOKEN}
        userId={101}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Change Password" }));
    await user.type(screen.getByLabelText("Current Password"), "old-secret");
    await user.type(screen.getByLabelText("New Password"), "new-secret");
    await user.click(screen.getByRole("button", { name: "Save Password" }));

    expect(await screen.findByText("Password updated.")).toBeVisible();
  });

  it("logs out locally after a self-service password change that revokes sessions", async () => {
    const user = userEvent.setup();
    const onSelfPasswordRevoked = vi.fn().mockResolvedValue(undefined);

    renderWithTheme(
      <ProjectManagerUserPage
        currentUserId={101}
        onSelfPasswordRevoked={onSelfPasswordRevoked}
        token={DEFAULT_TOKEN}
        userId={101}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Change Password" }));
    await user.type(screen.getByLabelText("Current Password"), "old-secret");
    await user.type(screen.getByLabelText("New Password"), "new-secret");
    await user.click(screen.getByRole("switch", { name: "Revoke sessions" }));
    await user.click(screen.getByRole("button", { name: "Save Password" }));

    expect(onSelfPasswordRevoked).toHaveBeenCalledTimes(1);
  });
});
