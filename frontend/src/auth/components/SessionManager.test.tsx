import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/api-error.js";
import { authApi } from "../api/auth-api.js";
import { authTokenStorage } from "../storage/auth-token-storage.js";
import { App } from "../../App.js";
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
const LOGIN_DIALOG_NAME = "Login";
const REGISTER_DIALOG_NAME = "Register";
const LOGIN_FAILURE_DIALOG_NAME = "Login Failed";
const REGISTRATION_SUCCESS_DIALOG_NAME = "Registration Succeeded";
const REGISTRATION_FAILURE_DIALOG_NAME = "Registration Failed";
const SESSION_ERROR_DIALOG_NAME = "Session Error";
const USERNAME_LABEL = "Username";
const EMAIL_LABEL = "Email";
const PASSWORD_LABEL = "Password";
const LOGIN_BUTTON_LABEL = "Login";
const REGISTER_BUTTON_LABEL = "Register";
const MENU_BUTTON_LABEL = "Menu";
const LOG_IN_BUTTON_LABEL = "Log In";
const CREATE_ACCOUNT_BUTTON_LABEL = "Create Account";
const CLOSE_BUTTON_LABEL = "Close";
const CANCEL_BUTTON_LABEL = "Cancel";
const LOGOUT_MENU_LABEL = "Logout";
const INVALID_USERNAME_OR_PASSWORD = "Invalid username or password";
const INVALID_OR_EXPIRED_SESSION = "Invalid or expired session";
const USERNAME_ALREADY_EXISTS = "Username already exists";
const LOGIN_FAILED_FALLBACK = "Login failed.";
const REGISTRATION_FAILED_FALLBACK = "Registration failed.";
const SESSION_FAILED_FALLBACK = "Unable to load the current session.";
const REGISTRATION_SUCCEEDED_MESSAGE =
  "Registration succeeded. You can now log in.";

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

function createLoginResponse(roles: string[] = []) {
  return {
    accessToken: "fresh-token",
    ...createAuthenticatedResponse(roles),
    tokenType: "Bearer" as const,
  };
}

async function openLoginDialog(user: ReturnType<typeof userEvent.setup>) {
  const loginButtons = await screen.findAllByRole("button", {
    name: LOGIN_BUTTON_LABEL,
  });
  await user.click(loginButtons[0]);
}

async function openRegisterDialog(user: ReturnType<typeof userEvent.setup>) {
  const registerButtons = await screen.findAllByRole("button", {
    name: REGISTER_BUTTON_LABEL,
  });
  await user.click(registerButtons[0]);
}

async function fillLoginForm(
  user: ReturnType<typeof userEvent.setup>,
  values: { password: string; username: string },
) {
  await user.type(screen.getByLabelText(USERNAME_LABEL), values.username);
  await user.type(screen.getByLabelText(PASSWORD_LABEL), values.password);
}

async function fillRegisterForm(
  user: ReturnType<typeof userEvent.setup>,
  values: { email: string; password: string; username: string },
) {
  await user.type(screen.getByLabelText(USERNAME_LABEL), values.username);
  await user.type(screen.getByLabelText(EMAIL_LABEL), values.email);
  await user.type(screen.getByLabelText(PASSWORD_LABEL), values.password);
}

async function expectDialogToClose(dialogName: string) {
  await waitFor(() => {
    expect(
      screen.queryByRole("dialog", { name: dialogName }),
    ).not.toBeInTheDocument();
  });
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

    renderWithTheme(<App />);

    expect(screen.getByLabelText("Loading session")).toBeInTheDocument();
  });

  it("renders logged-out controls when no session exists", async () => {
    renderWithTheme(<App />);

    expect(
      await screen.findAllByRole("button", { name: LOGIN_BUTTON_LABEL }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: REGISTER_BUTTON_LABEL }),
    ).toHaveLength(2);
  });

  it("renders the authenticated username when session lookup succeeds", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithTheme(<App />);

    expect(await screen.findByText("demo-user")).toBeVisible();
    expect(screen.getByRole("button", { name: MENU_BUTTON_LABEL })).toBeVisible();
  });

  it("logs in through the modal and stores the returned token", async () => {
    const user = userEvent.setup();
    authApiMock.login.mockResolvedValue(createLoginResponse());

    renderWithTheme(<App />);

    await openLoginDialog(user);
    await fillLoginForm(user, { password: "secret", username: "demo-user" });
    await user.click(screen.getByRole("button", { name: LOG_IN_BUTTON_LABEL }));

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

    renderWithTheme(<App />);

    await openLoginDialog(user);

    await waitFor(() => {
      expect(screen.getByLabelText(USERNAME_LABEL)).toHaveFocus();
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

    renderWithTheme(<App />);

    await openLoginDialog(user);
    await fillLoginForm(user, { password: "wrong", username: "demo-user" });
    await user.click(screen.getByRole("button", { name: LOG_IN_BUTTON_LABEL }));

    await expectDialogToClose(LOGIN_DIALOG_NAME);
    expect(
      await screen.findByRole("dialog", { name: LOGIN_FAILURE_DIALOG_NAME }),
    ).toBeVisible();
    expect(
      screen.getByText(INVALID_USERNAME_OR_PASSWORD),
    ).toBeVisible();
  });

  it("submits the login form when Enter is pressed", async () => {
    const user = userEvent.setup();
    authApiMock.login.mockResolvedValue({
      ...createLoginResponse(),
      accessToken: "enter-token",
    });

    renderWithTheme(<App />);

    await openLoginDialog(user);
    await user.type(screen.getByLabelText(USERNAME_LABEL), "demo-user");
    await user.type(screen.getByLabelText(PASSWORD_LABEL), "secret{Enter}");

    await waitFor(() => {
      expect(authApiMock.login).toHaveBeenCalledWith({
        password: "secret",
        username: "demo-user",
      });
    });
    expect(await screen.findByText("demo-user")).toBeVisible();
  });

  it("submits login failure by Enter into a failure modal", async () => {
    const user = userEvent.setup();
    authApiMock.login.mockRejectedValue(
      new ApiError("http", "HTTP 401", {
        responseBody: INVALID_USERNAME_OR_PASSWORD,
        status: 401,
      }),
    );

    renderWithTheme(<App />);

    await openLoginDialog(user);
    await user.type(screen.getByLabelText(USERNAME_LABEL), "demo-user");
    await user.type(screen.getByLabelText(PASSWORD_LABEL), "wrong{Enter}");

    expect(
      await screen.findByRole("dialog", { name: LOGIN_FAILURE_DIALOG_NAME }),
    ).toBeVisible();
    expect(screen.getByText(INVALID_USERNAME_OR_PASSWORD)).toBeVisible();
  });

  it("resets the login form when cancel is pressed", async () => {
    const user = userEvent.setup();

    renderWithTheme(<App />);

    await openLoginDialog(user);
    await fillLoginForm(user, { password: "secret", username: "demo-user" });
    await user.click(screen.getByRole("button", { name: CANCEL_BUTTON_LABEL }));

    await openLoginDialog(user);

    expect(screen.getByLabelText(USERNAME_LABEL)).toHaveValue("");
    expect(screen.getByLabelText(PASSWORD_LABEL)).toHaveValue("");
  });

  it("closes the login dialog when Escape is pressed", async () => {
    const user = userEvent.setup();

    renderWithTheme(<App />);

    await openLoginDialog(user);
    await user.keyboard("{Escape}");

    await expectDialogToClose(LOGIN_DIALOG_NAME);
  });

  it("closes the failure dialog when Escape is pressed", async () => {
    const user = userEvent.setup();
    authApiMock.login.mockRejectedValue(new Error("boom"));

    renderWithTheme(<App />);

    await openLoginDialog(user);
    await fillLoginForm(user, { password: "wrong", username: "demo-user" });
    await user.click(screen.getByRole("button", { name: LOG_IN_BUTTON_LABEL }));

    expect(
      await screen.findByRole("dialog", { name: LOGIN_FAILURE_DIALOG_NAME }),
    ).toBeVisible();
    await user.keyboard("{Escape}");

    await expectDialogToClose(LOGIN_FAILURE_DIALOG_NAME);
    const loginButtons = await screen.findAllByRole("button", {
      name: LOGIN_BUTTON_LABEL,
    });
    expect(loginButtons[0]).toHaveFocus();
  });

  it("reopens login with a clean form after a prior failure dialog is dismissed", async () => {
    const user = userEvent.setup();
    authApiMock.login.mockRejectedValue(new Error("boom"));

    renderWithTheme(<App />);

    await openLoginDialog(user);
    await fillLoginForm(user, { password: "wrong", username: "demo-user" });
    await user.click(screen.getByRole("button", { name: LOG_IN_BUTTON_LABEL }));
    await user.click(
      await screen.findByRole("button", { name: CLOSE_BUTTON_LABEL }),
    );

    await openLoginDialog(user);

    expect(screen.queryByRole("dialog", { name: LOGIN_FAILURE_DIALOG_NAME })).not.toBeInTheDocument();
    expect(screen.getByLabelText(USERNAME_LABEL)).toHaveValue("");
    expect(screen.getByLabelText(PASSWORD_LABEL)).toHaveValue("");
  });

  it("shows the fallback login failure message for network errors", async () => {
    const user = userEvent.setup();
    authApiMock.login.mockRejectedValue(new ApiError("network", "Network request failed"));

    renderWithTheme(<App />);

    await openLoginDialog(user);
    await fillLoginForm(user, { password: "secret", username: "demo-user" });
    await user.click(screen.getByRole("button", { name: LOG_IN_BUTTON_LABEL }));

    expect(
      await screen.findByRole("dialog", { name: LOGIN_FAILURE_DIALOG_NAME }),
    ).toBeVisible();
    expect(screen.getByText(LOGIN_FAILED_FALLBACK)).toBeVisible();
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

    renderWithTheme(<App />);

    await openRegisterDialog(user);
    await fillRegisterForm(user, {
      email: "new@example.com",
      password: "secret",
      username: "new-user",
    });
    await user.click(screen.getByRole("button", { name: CREATE_ACCOUNT_BUTTON_LABEL }));

    await waitFor(() => {
      expect(authApiMock.register).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "secret",
        username: "new-user",
      });
    });
    await expectDialogToClose(REGISTER_DIALOG_NAME);
    expect(
      await screen.findByRole("dialog", { name: REGISTRATION_SUCCESS_DIALOG_NAME }),
    ).toBeVisible();
    expect(
      screen.getByText(REGISTRATION_SUCCEEDED_MESSAGE),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: CLOSE_BUTTON_LABEL }));
    const loginButtons = await screen.findAllByRole("button", {
      name: LOGIN_BUTTON_LABEL,
    });
    expect(loginButtons).toHaveLength(2);
    expect(loginButtons[0]).toHaveFocus();
  });

  it("focuses the first registration field when the register modal opens", async () => {
    const user = userEvent.setup();

    renderWithTheme(<App />);

    await openRegisterDialog(user);

    await waitFor(() => {
      expect(screen.getByLabelText(USERNAME_LABEL)).toHaveFocus();
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

    renderWithTheme(<App />);

    await openRegisterDialog(user);
    await user.type(screen.getByLabelText(USERNAME_LABEL), "enter-user");
    await user.type(screen.getByLabelText(EMAIL_LABEL), "enter@example.com");
    await user.type(screen.getByLabelText(PASSWORD_LABEL), "secret{Enter}");

    await waitFor(() => {
      expect(authApiMock.register).toHaveBeenCalledWith({
        email: "enter@example.com",
        password: "secret",
        username: "enter-user",
      });
    });
    expect(
      await screen.findByRole("dialog", { name: REGISTRATION_SUCCESS_DIALOG_NAME }),
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

    renderWithTheme(<App />);

    await openRegisterDialog(user);
    await fillRegisterForm(user, {
      email: "taken@example.com",
      password: "secret",
      username: "taken-user",
    });
    await user.click(screen.getByRole("button", { name: CREATE_ACCOUNT_BUTTON_LABEL }));

    await expectDialogToClose(REGISTER_DIALOG_NAME);
    expect(
      await screen.findByRole("dialog", { name: REGISTRATION_FAILURE_DIALOG_NAME }),
    ).toBeVisible();
    expect(screen.getByText(USERNAME_ALREADY_EXISTS)).toBeVisible();
  });

  it("submits registration failure by Enter into a failure modal", async () => {
    const user = userEvent.setup();
    authApiMock.register.mockRejectedValue(
      new ApiError("http", "HTTP 409", {
        responseBody: USERNAME_ALREADY_EXISTS,
        status: 409,
      }),
    );

    renderWithTheme(<App />);

    await openRegisterDialog(user);
    await user.type(screen.getByLabelText(USERNAME_LABEL), "taken-user");
    await user.type(screen.getByLabelText(EMAIL_LABEL), "taken@example.com");
    await user.type(screen.getByLabelText(PASSWORD_LABEL), "secret{Enter}");

    expect(
      await screen.findByRole("dialog", { name: REGISTRATION_FAILURE_DIALOG_NAME }),
    ).toBeVisible();
    expect(screen.getByText(USERNAME_ALREADY_EXISTS)).toBeVisible();
  });

  it("resets the registration form when cancel is pressed", async () => {
    const user = userEvent.setup();

    renderWithTheme(<App />);

    await openRegisterDialog(user);
    await fillRegisterForm(user, {
      email: "user@example.com",
      password: "secret",
      username: "demo-user",
    });
    await user.click(screen.getByRole("button", { name: CANCEL_BUTTON_LABEL }));

    await openRegisterDialog(user);

    expect(screen.getByLabelText(USERNAME_LABEL)).toHaveValue("");
    expect(screen.getByLabelText(EMAIL_LABEL)).toHaveValue("");
    expect(screen.getByLabelText(PASSWORD_LABEL)).toHaveValue("");
  });

  it("closes the registration dialog when Escape is pressed", async () => {
    const user = userEvent.setup();

    renderWithTheme(<App />);

    await openRegisterDialog(user);
    await user.keyboard("{Escape}");

    await expectDialogToClose(REGISTER_DIALOG_NAME);
  });

  it("reopens registration with a clean form after a prior failure dialog is dismissed", async () => {
    const user = userEvent.setup();
    authApiMock.register.mockRejectedValue(new Error("boom"));

    renderWithTheme(<App />);

    await openRegisterDialog(user);
    await fillRegisterForm(user, {
      email: "user@example.com",
      password: "secret",
      username: "demo-user",
    });
    await user.click(screen.getByRole("button", { name: CREATE_ACCOUNT_BUTTON_LABEL }));
    await user.click(
      await screen.findByRole("button", { name: CLOSE_BUTTON_LABEL }),
    );

    await openRegisterDialog(user);

    expect(screen.queryByRole("dialog", { name: REGISTRATION_FAILURE_DIALOG_NAME })).not.toBeInTheDocument();
    expect(screen.getByLabelText(USERNAME_LABEL)).toHaveValue("");
    expect(screen.getByLabelText(EMAIL_LABEL)).toHaveValue("");
    expect(screen.getByLabelText(PASSWORD_LABEL)).toHaveValue("");
  });

  it("shows the fallback registration failure message for network errors", async () => {
    const user = userEvent.setup();
    authApiMock.register.mockRejectedValue(
      new ApiError("network", "Network request failed"),
    );

    renderWithTheme(<App />);

    await openRegisterDialog(user);
    await fillRegisterForm(user, {
      email: "user@example.com",
      password: "secret",
      username: "demo-user",
    });
    await user.click(screen.getByRole("button", { name: CREATE_ACCOUNT_BUTTON_LABEL }));

    expect(
      await screen.findByRole("dialog", { name: REGISTRATION_FAILURE_DIALOG_NAME }),
    ).toBeVisible();
    expect(screen.getByText(REGISTRATION_FAILED_FALLBACK)).toBeVisible();
  });

  it("shows session lookup failures in a modal", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockRejectedValue(
      new ApiError("http", "HTTP 401", {
        responseBody: "Invalid or expired session",
        status: 401,
      }),
    );

    renderWithTheme(<App />);

    expect(
      await screen.findByRole("dialog", { name: SESSION_ERROR_DIALOG_NAME }),
    ).toBeVisible();
    expect(screen.getByText(INVALID_OR_EXPIRED_SESSION)).toBeVisible();
  });

  it("dismisses the session error modal back to anonymous state", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockRejectedValue(
      new ApiError("http", "HTTP 401", {
        responseBody: INVALID_OR_EXPIRED_SESSION,
        status: 401,
      }),
    );

    renderWithTheme(<App />);

    await user.click(await screen.findByRole("button", { name: CLOSE_BUTTON_LABEL }));

    await expectDialogToClose(SESSION_ERROR_DIALOG_NAME);
    expect(
      await screen.findAllByRole("button", { name: LOGIN_BUTTON_LABEL }),
    ).toHaveLength(2);
  });

  it("shows the fallback session error message for network failures", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockRejectedValue(
      new ApiError("network", "Network request failed"),
    );

    renderWithTheme(<App />);

    expect(
      await screen.findByRole("dialog", { name: SESSION_ERROR_DIALOG_NAME }),
    ).toBeVisible();
    expect(screen.getByText(SESSION_FAILED_FALLBACK)).toBeVisible();
  });

  it("shows the fallback session error message for malformed validated responses", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockRejectedValue(
      new ApiError("validation", "Response payload failed validation"),
    );

    renderWithTheme(<App />);

    expect(
      await screen.findByRole("dialog", { name: SESSION_ERROR_DIALOG_NAME }),
    ).toBeVisible();
    expect(screen.getByText(SESSION_FAILED_FALLBACK)).toBeVisible();
  });

  it("clears the stored token when persisted session lookup fails", async () => {
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockRejectedValue(
      new ApiError("http", "HTTP 401", {
        responseBody: INVALID_OR_EXPIRED_SESSION,
        status: 401,
      }),
    );

    renderWithTheme(<App />);

    expect(await screen.findByRole("dialog", { name: SESSION_ERROR_DIALOG_NAME })).toBeVisible();
    expect(authTokenStorageMock.clear).toHaveBeenCalled();
  });

  it("clears local auth state on logout", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());
    authApiMock.revokeCurrentSession.mockResolvedValue({
      revokedSessionIds: ["session-1"],
    });

    renderWithTheme(<App />);

    await user.click(await screen.findByRole("button", { name: MENU_BUTTON_LABEL }));
    await user.click(await screen.findByRole("menuitem", { name: LOGOUT_MENU_LABEL }));

    await waitFor(() => {
      expect(authApiMock.revokeCurrentSession).toHaveBeenCalledWith(
        "persisted-token",
        "session-1",
      );
    });
    expect(authTokenStorageMock.clear).toHaveBeenCalled();
    expect(
      await screen.findAllByRole("button", { name: LOGIN_BUTTON_LABEL }),
    ).toHaveLength(2);
  });

  it("clears local auth state even when revoke fails", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());
    authApiMock.revokeCurrentSession.mockRejectedValue(new Error("revoke failed"));

    renderWithTheme(<App />);

    await user.click(await screen.findByRole("button", { name: MENU_BUTTON_LABEL }));
    await user.click(await screen.findByRole("menuitem", { name: LOGOUT_MENU_LABEL }));

    expect(authTokenStorageMock.clear).toHaveBeenCalled();
    expect(
      await screen.findAllByRole("button", { name: LOGIN_BUTTON_LABEL }),
    ).toHaveLength(2);
  });

  it("closes the menu after logout is triggered", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(
      createAuthenticatedResponse(),
    );
    authApiMock.revokeCurrentSession.mockResolvedValue({
      revokedSessionIds: ["session-1"],
    });

    renderWithTheme(<App />);

    await user.click(await screen.findByRole("button", { name: MENU_BUTTON_LABEL }));
    await user.click(await screen.findByRole("menuitem", { name: LOGOUT_MENU_LABEL }));

    expect(screen.queryByRole("menuitem", { name: LOGOUT_MENU_LABEL })).not.toBeInTheDocument();
  });

  it("supports keyboard navigation to open the menu and activate logout", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());
    authApiMock.revokeCurrentSession.mockResolvedValue({
      revokedSessionIds: ["session-1"],
    });

    renderWithTheme(<App />);

    const menuButton = await screen.findByRole("button", { name: MENU_BUTTON_LABEL });
    menuButton.focus();
    expect(menuButton).toHaveFocus();
    await user.keyboard("{Enter}");
    const logoutMenuItem = await screen.findByRole("menuitem", { name: LOGOUT_MENU_LABEL });
    expect(logoutMenuItem).toBeVisible();
    logoutMenuItem.focus();
    expect(logoutMenuItem).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findAllByRole("button", { name: LOGIN_BUTTON_LABEL }),
    ).toHaveLength(2);
  });

  it("shows the project management menu only for project managers", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(
      createAuthenticatedResponse(["GGTC_TEAMROLE_PROJECT_MANAGER"]),
    );

    renderWithTheme(<App />);

    await user.click(await screen.findByRole("button", { name: MENU_BUTTON_LABEL }));

    expect(await screen.findByRole("menuitem", { name: "Project Management Menu" })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "Admin Menu" })).not.toBeInTheDocument();
  });

  it("shows the admin menu only for admins", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(
      createAuthenticatedResponse(["GGTC_SYSTEMROLE_ADMIN"]),
    );

    renderWithTheme(<App />);

    await user.click(await screen.findByRole("button", { name: MENU_BUTTON_LABEL }));

    expect(await screen.findByRole("menuitem", { name: "Admin Menu" })).toBeVisible();
    expect(
      screen.queryByRole("menuitem", { name: "Project Management Menu" }),
    ).not.toBeInTheDocument();
  });

  it("shows both role-based menu items when the user has both roles", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(
      createAuthenticatedResponse([
        "GGTC_TEAMROLE_PROJECT_MANAGER",
        "GGTC_SYSTEMROLE_ADMIN",
      ]),
    );

    renderWithTheme(<App />);

    await user.click(await screen.findByRole("button", { name: MENU_BUTTON_LABEL }));

    expect(await screen.findByRole("menuitem", { name: "Project Management Menu" })).toBeVisible();
    expect(await screen.findByRole("menuitem", { name: "Admin Menu" })).toBeVisible();
  });

  it("shows only logout when the user has no roles", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue("persisted-token");
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse([]));

    renderWithTheme(<App />);

    await user.click(await screen.findByRole("button", { name: MENU_BUTTON_LABEL }));

    expect(await screen.findByRole("menuitem", { name: LOGOUT_MENU_LABEL })).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "Project Management Menu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Admin Menu" })).not.toBeInTheDocument();
  });
});
