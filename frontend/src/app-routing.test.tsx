import React from "react";
import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authApi } from "./auth/api/auth-api.js";
import { authTokenStorage } from "./auth/storage/auth-token-storage.js";
import { lobbyApi } from "./lobby/api/lobby-api.js";
import { renderWithTheme } from "./test/render-with-theme.js";
import { App } from "./App.js";

vi.mock("./auth/api/auth-api.js", () => ({
  authApi: {
    getCurrentSession: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    revokeCurrentSession: vi.fn(),
  },
}));

vi.mock("./auth/storage/auth-token-storage.js", () => ({
  authTokenStorage: {
    clear: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
  },
}));

vi.mock("./lobby/api/lobby-api.js", () => ({
  lobbyApi: {
    deleteProject: vi.fn(),
    getOrganization: vi.fn(),
    getTeam: vi.fn(),
    listOrganizations: vi.fn(),
    listProjects: vi.fn(),
    listTeams: vi.fn(),
    replaceOrganizationUsers: vi.fn(),
    replaceTeamMembers: vi.fn(),
  },
}));

const authApiMock = vi.mocked(authApi);
const authTokenStorageMock = vi.mocked(authTokenStorage);
const lobbyApiMock = vi.mocked(lobbyApi);

function createAuthenticatedResponse() {
  return {
    session: {
      expirationTimestamp: "2026-03-08T00:00:00.000Z",
      id: "session-1",
      ipAddress: "127.0.0.1",
      location: null,
      revokedAt: null,
      startTimestamp: "2026-03-07T00:00:00.000Z",
      userId: 101,
    },
    user: {
      email: "demo@example.com",
      id: 101,
      roles: ["GGTC_SYSTEMROLE_ADMIN"],
      username: "demo-user",
    },
  };
}

describe("app routing", () => {
  beforeEach(() => {
    authTokenStorageMock.read.mockReturnValue(null);
    authApiMock.getCurrentSession.mockReset();
    lobbyApiMock.listOrganizations.mockResolvedValue({ organizations: [] });
    lobbyApiMock.listProjects.mockResolvedValue({ projects: [] });
    lobbyApiMock.listTeams.mockResolvedValue({ teams: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the contact route in the public home app", () => {
    renderWithTheme(<App />, {
      initialEntries: ["/contact"],
    });

    expect(
      screen.getByRole("heading", { name: "Contact" }),
    ).toBeVisible();
  });

  it("renders the about route in the public home app", () => {
    renderWithTheme(<App />, {
      initialEntries: ["/about"],
    });

    expect(
      screen.getByRole("heading", { name: "About" }),
    ).toBeVisible();
  });

  it("renders the authenticated username as a lobby link", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />);

    expect(
      await screen.findByRole("link", { name: "Go to your lobby" }),
    ).toHaveAttribute("href", "/lobby");
  });

  it("redirects unauthenticated lobby requests to the public home route", async () => {
    renderWithTheme(<App />, {
      initialEntries: ["/lobby"],
    });

    expect(
      await screen.findByText("Giganttic, built by LatentPrion"),
    ).toBeVisible();
  });

  it("renders the user lobby for authenticated users", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />, {
      initialEntries: ["/lobby"],
    });

    expect(await screen.findByText("User Lobby")).toBeVisible();
    expect(await screen.findByRole("button", { name: /Projects/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Teams/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Organizations/i })).toBeVisible();
  });
});
