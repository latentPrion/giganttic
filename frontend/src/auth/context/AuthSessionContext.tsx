import React, {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
} from "react";

import { authApi } from "../api/auth-api.js";
import { isApiError } from "../api/api-error.js";
import type {
  LoginRequest,
  RegisterRequest,
} from "../contracts/auth.contracts.js";
import {
  createAnonymousState,
  createAuthenticatedState,
  createErrorState,
  createLoadingState,
  type AuthState,
} from "../models/auth-state.js";
import { authTokenStorage } from "../storage/auth-token-storage.js";

interface SessionManagerActions {
  dismissFailure(): void;
  initialize(): Promise<void>;
  login(payload: LoginRequest): Promise<void>;
  logout(): Promise<void>;
  register(payload: RegisterRequest): Promise<void>;
}

interface SessionManagerModel {
  actions: SessionManagerActions;
  authState: AuthState;
  isBusy: boolean;
}

interface AuthSessionProviderProps {
  children: React.ReactNode;
}

const DEFAULT_AUTH_ERROR_MESSAGE = "Unable to load the current session.";
const AUTH_SESSION_CONTEXT_ERROR =
  "useSessionManager must be used within AuthSessionProvider";

const AuthSessionContext = createContext<SessionManagerModel | null>(null);

function buildInitializationErrorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return DEFAULT_AUTH_ERROR_MESSAGE;
  }

  if (error.kind === "http" && error.responseBody) {
    return error.responseBody;
  }

  return DEFAULT_AUTH_ERROR_MESSAGE;
}

export function AuthSessionProvider(props: AuthSessionProviderProps) {
  const [authState, setAuthState] = useState<AuthState>(createLoadingState());
  const [isBusy, setIsBusy] = useState(false);

  async function initialize(): Promise<void> {
    const token = authTokenStorage.read();

    if (!token) {
      startTransition(() => {
        setAuthState(createAnonymousState());
      });
      return;
    }

    try {
      const response = await authApi.getCurrentSession(token);
      startTransition(() => {
        setAuthState(
          createAuthenticatedState({
            session: response.session,
            token,
            user: response.user,
          }),
        );
      });
    } catch (error) {
      authTokenStorage.clear();
      startTransition(() => {
        setAuthState(
          createErrorState(buildInitializationErrorMessage(error)),
        );
      });
    }
  }

  useEffect(() => {
    void initialize();
  }, []);

  function dismissFailure(): void {
    startTransition(() => {
      setAuthState(createAnonymousState());
    });
  }

  async function login(payload: LoginRequest): Promise<void> {
    setIsBusy(true);

    try {
      const response = await authApi.login(payload);
      authTokenStorage.write(response.accessToken);
      startTransition(() => {
        setAuthState(
          createAuthenticatedState({
            session: response.session,
            token: response.accessToken,
            user: response.user,
          }),
        );
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function register(payload: RegisterRequest): Promise<void> {
    setIsBusy(true);

    try {
      await authApi.register(payload);
      startTransition(() => {
        setAuthState(createAnonymousState());
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function logout(): Promise<void> {
    if (authState.status === "authenticated") {
      setIsBusy(true);

      try {
        await authApi.revokeCurrentSession(
          authState.auth.token,
          authState.auth.session.id,
        );
      } catch {
        // Local logout still proceeds even if the revoke request fails.
      } finally {
        authTokenStorage.clear();
        startTransition(() => {
          setAuthState(createAnonymousState());
        });
        setIsBusy(false);
      }

      return;
    }

    authTokenStorage.clear();
    startTransition(() => {
      setAuthState(createAnonymousState());
    });
  }

  return (
    <AuthSessionContext.Provider
      value={{
        actions: {
          dismissFailure,
          initialize,
          login,
          logout,
          register,
        },
        authState,
        isBusy,
      }}
    >
      {props.children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSessionContext(): SessionManagerModel {
  const contextValue = useContext(AuthSessionContext);

  if (!contextValue) {
    throw new Error(AUTH_SESSION_CONTEXT_ERROR);
  }

  return contextValue;
}
