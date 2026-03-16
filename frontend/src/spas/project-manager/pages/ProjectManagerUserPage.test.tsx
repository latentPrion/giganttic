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
    lobbyApiMock.getUser.mockReset();
    lobbyApiMock.getUser.mockResolvedValue(createUserResponse());
  });

  it("renders the selected user and their direct project team and organization sections", async () => {
    renderWithTheme(<ProjectManagerUserPage token={DEFAULT_TOKEN} userId={101} />);

    expect(await screen.findByText("User Profile")).toBeVisible();
    expect(await screen.findByText("demo-user")).toBeVisible();
    expect(screen.getByText("Direct Projects")).toBeVisible();
    expect(screen.getByText("Direct Teams")).toBeVisible();
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
});
