import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/api-error.js";
import { authApi } from "../api/auth-api.js";
import { authTokenStorage } from "../storage/auth-token-storage.js";
import {
  AuthSessionProvider,
  useAuthSessionContext,
} from "./AuthSessionContext.js";

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
const LOGIN_BUTTON_LABEL = "Context Login";
const REGISTER_BUTTON_LABEL = "Context Register";
const LOGOUT_BUTTON_LABEL = "Context Logout";
const DISMISS_BUTTON_LABEL = "Dismiss Failure";
const TEST_ACCESS_TOKEN = "context-token";
const TEST_SESSION_ID = "session-1";
const TEST_USER_ID = 101;
const DEFAULT_AUTH_ERROR_MESSAGE = "Unable to load the current session.";
const AUTH_SESSION_CONTEXT_ERROR =
  "useSessionManager must be used within AuthSessionProvider";

function createAuthenticatedResponse(roles: string[] = []) {
  return {
    session: {
      expirationTimestamp: "2026-03-08T00:00:00.000Z",
      id: TEST_SESSION_ID,
      ipAddress: "127.0.0.1",
      location: null,
      revokedAt: null,
      startTimestamp: "2026-03-07T00:00:00.000Z",
      userId: TEST_USER_ID,
    },
    user: {
      email: "demo@example.com",
      id: TEST_USER_ID,
      roles,
      username: "demo-user",
    },
  };
}

function createLoginResponse() {
  return {
    accessToken: TEST_ACCESS_TOKEN,
    ...createAuthenticatedResponse(),
    tokenType: "Bearer" as const,
  };
}

function ContextHarness() {
  const { actions, authState, isBusy } = useAuthSessionContext();

  return (
    <div>
      <div data-testid="busy">{isBusy ? "busy" : "idle"}</div>
      <div data-testid="status">{authState.status}</div>
      <div data-testid="message">
        {authState.status === "error" ? authState.message : ""}
      </div>
      <div data-testid="username">
        {authState.status === "authenticated" ? authState.auth.user.username : ""}
      </div>
      <button
        onClick={() => void actions.login({ password: "secret", username: "demo-user" })}
        type="button"
      >
        {LOGIN_BUTTON_LABEL}
      </button>
      <button
        onClick={() => void actions.register({
          email: "demo@example.com",
          password: "secret",
          username: "demo-user",
        })}
        type="button"
      >
        {REGISTER_BUTTON_LABEL}
      </button>
      <button onClick={() => void actions.logout()} type="button">
        {LOGOUT_BUTTON_LABEL}
      </button>
      <button onClick={actions.dismissFailure} type="button">
        {DISMISS_BUTTON_LABEL}
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthSessionProvider>
      <ContextHarness />
    </AuthSessionProvider>,
  );
}

describe("AuthSessionContext", () => {
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

  it("throws when used outside the provider", () => {
    function NakedConsumer() {
      useAuthSessionContext();
      return null;
    }

    expect(() => render(<NakedConsumer />)).toThrow(AUTH_SESSION_CONTEXT_ERROR);
  });

  it("initializes to anonymous when no token is stored", async () => {
    renderWithProvider();

    expect(await screen.findByTestId("status")).toHaveTextContent("anonymous");
    expect(authApiMock.getCurrentSession).not.toHaveBeenCalled();
  });

  it("hydrates an authenticated session from a persisted token", async () => {
    authTokenStorageMock.read.mockReturnValue(TEST_ACCESS_TOKEN);
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());

    renderWithProvider();

    expect(await screen.findByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("username")).toHaveTextContent("demo-user");
    expect(authApiMock.getCurrentSession).toHaveBeenCalledWith(TEST_ACCESS_TOKEN);
  });

  it("turns initialization failures into error state and clears the token", async () => {
    authTokenStorageMock.read.mockReturnValue(TEST_ACCESS_TOKEN);
    authApiMock.getCurrentSession.mockRejectedValue(
      new ApiError("http", "HTTP 401", {
        responseBody: "Invalid or expired session",
        status: 401,
      }),
    );

    renderWithProvider();

    expect(await screen.findByTestId("status")).toHaveTextContent("error");
    expect(screen.getByTestId("message")).toHaveTextContent("Invalid or expired session");
    expect(authTokenStorageMock.clear).toHaveBeenCalled();
  });

  it("uses the fallback initialization error message for non-http failures", async () => {
    authTokenStorageMock.read.mockReturnValue(TEST_ACCESS_TOKEN);
    authApiMock.getCurrentSession.mockRejectedValue(
      new ApiError("network", "Network request failed"),
    );

    renderWithProvider();

    expect(await screen.findByTestId("status")).toHaveTextContent("error");
    expect(screen.getByTestId("message")).toHaveTextContent(DEFAULT_AUTH_ERROR_MESSAGE);
  });

  it("dismisses an initialization error back to anonymous", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue(TEST_ACCESS_TOKEN);
    authApiMock.getCurrentSession.mockRejectedValue(
      new ApiError("network", "Network request failed"),
    );

    renderWithProvider();

    expect(await screen.findByTestId("status")).toHaveTextContent("error");
    await user.click(screen.getByRole("button", { name: DISMISS_BUTTON_LABEL }));
    expect(await screen.findByTestId("status")).toHaveTextContent("anonymous");
  });

  it("logs in, persists the token, and exposes authenticated state", async () => {
    const user = userEvent.setup();
    authApiMock.login.mockResolvedValue(createLoginResponse());

    renderWithProvider();

    await user.click(screen.getByRole("button", { name: LOGIN_BUTTON_LABEL }));

    await waitFor(() => {
      expect(authApiMock.login).toHaveBeenCalledWith({
        password: "secret",
        username: "demo-user",
      });
    });
    expect(authTokenStorageMock.write).toHaveBeenCalledWith(TEST_ACCESS_TOKEN);
    expect(await screen.findByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("username")).toHaveTextContent("demo-user");
  });

  it("toggles the busy state during login", async () => {
    const user = userEvent.setup();
    let resolveLogin: ((value: ReturnType<typeof createLoginResponse>) => void) | undefined;
    authApiMock.login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );

    renderWithProvider();

    await user.click(screen.getByRole("button", { name: LOGIN_BUTTON_LABEL }));
    expect(screen.getByTestId("busy")).toHaveTextContent("busy");

    resolveLogin?.(createLoginResponse());

    await waitFor(() => {
      expect(screen.getByTestId("busy")).toHaveTextContent("idle");
    });
  });

  it("keeps the provider anonymous after registration", async () => {
    const user = userEvent.setup();
    authApiMock.register.mockResolvedValue({
      user: {
        email: "demo@example.com",
        id: TEST_USER_ID,
        roles: [],
        username: "demo-user",
      },
    });

    renderWithProvider();

    await user.click(screen.getByRole("button", { name: REGISTER_BUTTON_LABEL }));

    await waitFor(() => {
      expect(authApiMock.register).toHaveBeenCalledWith({
        email: "demo@example.com",
        password: "secret",
        username: "demo-user",
      });
    });
    expect(await screen.findByTestId("status")).toHaveTextContent("anonymous");
    expect(authTokenStorageMock.write).not.toHaveBeenCalled();
  });

  it("toggles the busy state during registration", async () => {
    const user = userEvent.setup();
    let resolveRegister: ((value: { user: { email: string; id: number; roles: string[]; username: string } }) => void) | undefined;
    authApiMock.register.mockReturnValue(
      new Promise((resolve) => {
        resolveRegister = resolve;
      }),
    );

    renderWithProvider();

    await user.click(screen.getByRole("button", { name: REGISTER_BUTTON_LABEL }));
    expect(screen.getByTestId("busy")).toHaveTextContent("busy");

    resolveRegister?.({
      user: {
        email: "demo@example.com",
        id: TEST_USER_ID,
        roles: [],
        username: "demo-user",
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId("busy")).toHaveTextContent("idle");
    });
  });

  it("revokes the current session and clears local state on logout", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue(TEST_ACCESS_TOKEN);
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());
    authApiMock.revokeCurrentSession.mockResolvedValue({
      revokedSessionIds: [TEST_SESSION_ID],
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    await user.click(screen.getByRole("button", { name: LOGOUT_BUTTON_LABEL }));

    await waitFor(() => {
      expect(authApiMock.revokeCurrentSession).toHaveBeenCalledWith(
        TEST_ACCESS_TOKEN,
        TEST_SESSION_ID,
      );
    });
    expect(authTokenStorageMock.clear).toHaveBeenCalled();
    expect(await screen.findByTestId("status")).toHaveTextContent("anonymous");
  });

  it("still clears local state when logout revocation fails", async () => {
    const user = userEvent.setup();
    authTokenStorageMock.read.mockReturnValue(TEST_ACCESS_TOKEN);
    authApiMock.getCurrentSession.mockResolvedValue(createAuthenticatedResponse());
    authApiMock.revokeCurrentSession.mockRejectedValue(new Error("revoke failed"));

    renderWithProvider();

    expect(await screen.findByTestId("status")).toHaveTextContent("authenticated");
    await user.click(screen.getByRole("button", { name: LOGOUT_BUTTON_LABEL }));

    expect(authTokenStorageMock.clear).toHaveBeenCalled();
    expect(await screen.findByTestId("status")).toHaveTextContent("anonymous");
  });

  it("clears storage immediately when logout is called from anonymous state", async () => {
    const user = userEvent.setup();

    renderWithProvider();

    expect(await screen.findByTestId("status")).toHaveTextContent("anonymous");
    await user.click(screen.getByRole("button", { name: LOGOUT_BUTTON_LABEL }));

    expect(authTokenStorageMock.clear).toHaveBeenCalled();
    expect(authApiMock.revokeCurrentSession).not.toHaveBeenCalled();
  });
});
