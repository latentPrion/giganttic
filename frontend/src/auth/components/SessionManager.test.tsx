import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/api-error.js";
import { authApi } from "../api/auth-api.js";
import { authTokenStorage } from "../storage/auth-token-storage.js";
import { SessionManager } from "./SessionManager.js";
import { renderWithTheme } from "../../test/render-with-theme.js";

vi.mock("../api/auth-api.js", () => ({
  authApi: {
    getCurrentSession: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    revokeCurrentSession: vi.fn(),
  },
}));

vi.mock("../storage/auth-token-storage.js", () => ({
  authTokenStorage: {
    clear: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
  },
}));

const authApiMock = vi.mocked(authApi);
const authTokenStorageMock = vi.mocked(authTokenStorage);

function createAuthenticatedResponse(roles: string[] = []) {
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
      roles,
      username: "demo-user",
    },
  };
}

describe("SessionManager", () => {
  beforeEach(() => {
    authTokenStorageMock.read.mockReturnValue(null);
    authApiMock.getCurrentSession.mockReset();
    authApiMock.login.mockReset();
    authApiMock.register.mockReset();
    authApiMock.revokeCurrentSession.mockReset();
    authTokenStorageMock.clear.mockReset();
    authTokenStorageMock.write.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while session discovery is pending", () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockReturnValue(new Promise(() => undefined));

    renderWithTheme(<SessionManager />);

    expect(screen.getByLabelText("Loading session")).toBeInTheDocument();
  });

  it("renders logged-out controls when no session exists", async () => {
    renderWithTheme(<SessionManager />);

    expect(await screen.findByRole("button", { name: "Login" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Register" })).toBeVisible();
  });

  it("renders the authenticated username when session lookup succeeds", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<SessionManager />);

    expect(await screen.findByText("demo-user")).toBeVisible();
    expect(screen.getByRole("button", { name: "Menu" })).toBeVisible();
  });

  it("logs in through the modal and stores the returned token", async () => {
    const user = userEvent.setup();
    authApiMock.login.mockResolvedValue({
      accessToken: "fresh-token",
      ...createAuthenticatedResponse(),
      tokenType: "Bearer",
    });

    renderWithTheme(<SessionManager />);

    await user.click(await screen.findByRole("button", { name: "Login" }));
    await user.type(screen.getByLabelText("Username"), "demo-user");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => {
      expect(authApiMock.login).toHaveBeenCalledWith({
        password: "secret",
        username: "demo-user",
      });
    });
    expect(authTokenStorageMock.write).toHaveBeenCalledWith("fresh-token");
    expect(await screen.findByText("demo-user")).toBeVisible();
  });

  it("focuses the first login field when the login modal opens", async () => {
    const user = userEvent.setup();

    renderWithTheme(<SessionManager />);

    await user.click(await screen.findByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Username")).toHaveFocus();
    });
  });

  it("shows login failures in a follow-up modal instead of the navbar", async () => {
    const user = userEvent.setup();
    authApiMock.login.mockRejectedValue(
      new ApiError("http", "HTTP 401", {
        responseBody: "Invalid username or password",
        status: 401,
      }),
    );

    renderWithTheme(<SessionManager />);

    await user.click(await screen.findByRole("button", { name: "Login" }));
    await user.type(screen.getByLabelText("Username"), "demo-user");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Login" }),
      ).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole("dialog", { name: "Login Failed" }),
    ).toBeVisible();
    expect(
      screen.getByText("Invalid username or password"),
    ).toBeVisible();
  });

  it("submits the login form when Enter is pressed", async () => {
    const user = userEvent.setup();
    authApiMock.login.mockResolvedValue({
      accessToken: "enter-token",
      ...createAuthenticatedResponse(),
      tokenType: "Bearer",
    });

    renderWithTheme(<SessionManager />);

    await user.click(await screen.findByRole("button", { name: "Login" }));
    await user.type(screen.getByLabelText("Username"), "demo-user");
    await user.type(screen.getByLabelText("Password"), "secret{Enter}");

    await waitFor(() => {
      expect(authApiMock.login).toHaveBeenCalledWith({
        password: "secret",
        username: "demo-user",
      });
    });
    expect(await screen.findByText("demo-user")).toBeVisible();
  });

  it("registers through the modal and returns to logged-out state", async () => {
    const user = userEvent.setup();
    authApiMock.register.mockResolvedValue({
      user: {
        email: "new@example.com",
        id: 7,
        roles: [],
        username: "new-user",
      },
    });

    renderWithTheme(<SessionManager />);

    await user.click(await screen.findByRole("button", { name: "Register" }));
    await user.type(screen.getByLabelText("Username"), "new-user");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(authApiMock.register).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "secret",
        username: "new-user",
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Register" }),
      ).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole("dialog", { name: "Registration Succeeded" }),
    ).toBeVisible();
    expect(
      screen.getByText("Registration succeeded. You can now log in."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByRole("button", { name: "Login" })).toBeVisible();
  });

  it("focuses the first registration field when the register modal opens", async () => {
    const user = userEvent.setup();

    renderWithTheme(<SessionManager />);

    await user.click(await screen.findByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Username")).toHaveFocus();
    });
  });

  it("submits the registration form when Enter is pressed", async () => {
    const user = userEvent.setup();
    authApiMock.register.mockResolvedValue({
      user: {
        email: "enter@example.com",
        id: 8,
        roles: [],
        username: "enter-user",
      },
    });

    renderWithTheme(<SessionManager />);

    await user.click(await screen.findByRole("button", { name: "Register" }));
    await user.type(screen.getByLabelText("Username"), "enter-user");
    await user.type(screen.getByLabelText("Email"), "enter@example.com");
    await user.type(screen.getByLabelText("Password"), "secret{Enter}");

    await waitFor(() => {
      expect(authApiMock.register).toHaveBeenCalledWith({
        email: "enter@example.com",
        password: "secret",
        username: "enter-user",
      });
    });
    expect(
      await screen.findByRole("dialog", { name: "Registration Succeeded" }),
    ).toBeVisible();
  });

  it("shows registration failures in a follow-up modal", async () => {
    const user = userEvent.setup();
    authApiMock.register.mockRejectedValue(
      new ApiError("http", "HTTP 409", {
        responseBody: "Username already exists",
        status: 409,
      }),
    );

    renderWithTheme(<SessionManager />);

    await user.click(await screen.findByRole("button", { name: "Register" }));
    await user.type(screen.getByLabelText("Username"), "taken-user");
    await user.type(screen.getByLabelText("Email"), "taken@example.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Register" }),
      ).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole("dialog", { name: "Registration Failed" }),
    ).toBeVisible();
    expect(screen.getByText("Username already exists")).toBeVisible();
  });

  it("shows session lookup failures in a modal", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockRejectedValue(
      new ApiError("http", "HTTP 401", {
        responseBody: "Invalid or expired session",
        status: 401,
      }),
    );

    renderWithTheme(<SessionManager />);

    expect(
      await screen.findByRole("dialog", { name: "Session Error" }),
    ).toBeVisible();
    expect(screen.getByText("Invalid or expired session")).toBeVisible();
  });

  it("clears local auth state on logout", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());
    authApiMock.revokeCurrentSession.mockResolvedValue({
      revokedSessionIds: ["session-1"],
    });

    renderWithTheme(<SessionManager />);

    await user.click(await screen.findByRole("button", { name: "Menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Logout" }));

    await waitFor(() => {
      expect(authApiMock.revokeCurrentSession).toHaveBeenCalledWith(
        "persisted-token",
        "session-1",
      );
    });
    expect(authTokenStorageMock.clear).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Login" })).toBeVisible();
  });

  it("shows the project management menu only for project managers", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(
      createAuthenticatedResponse(["GGTT_ROLE_PROJECT_MANAGER"]),
    );

    renderWithTheme(<SessionManager />);

    await user.click(await screen.findByRole("button", { name: "Menu" }));

    expect(await screen.findByRole("menuitem", { name: "Project Management Menu" })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "Admin Menu" })).not.toBeInTheDocument();
  });

  it("shows the admin menu only for admins", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(
      createAuthenticatedResponse(["GGTT_ROLE_ADMIN"]),
    );

    renderWithTheme(<SessionManager />);

    await user.click(await screen.findByRole("button", { name: "Menu" }));

    expect(await screen.findByRole("menuitem", { name: "Admin Menu" })).toBeVisible();
    expect(
      screen.queryByRole("menuitem", { name: "Project Management Menu" }),
    ).not.toBeInTheDocument();
  });
});
