import { startTransition, useEffect, useState } from "react";

import type {
  LoginRequest,
  RegisterRequest,
} from "../contracts/auth.contracts.js";
import { authApi } from "../api/auth-api.js";
import { isApiError } from "../api/api-error.js";
import { authTokenStorage } from "../storage/auth-token-storage.js";
import {
  createAnonymousState,
  createAuthenticatedState,
  createErrorState,
  createLoadingState,
  type AuthState,
} from "../models/auth-state.js";

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

const DEFAULT_AUTH_ERROR_MESSAGE = "Unable to load the current session.";

export function useSessionManager(): SessionManagerModel {
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
        if (isApiError(error)) {
          setAuthState(
            createErrorState(
              error.kind === "http" && error.responseBody
                ? error.responseBody
                : DEFAULT_AUTH_ERROR_MESSAGE,
            ),
          );
          return;
        }

        setAuthState(createErrorState(DEFAULT_AUTH_ERROR_MESSAGE));
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
    } catch (error) {
      throw error;
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
    } catch (error) {
      throw error;
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

  return {
    actions: {
      dismissFailure,
      initialize,
      login,
      logout,
      register,
    },
    authState,
    isBusy,
  };
}
