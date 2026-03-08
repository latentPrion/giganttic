import type {
  AuthUser,
  SessionSummary,
} from "../contracts/auth.contracts.js";

export interface AuthenticatedSession {
  session: SessionSummary;
  token: string;
  user: AuthUser;
}

export type AuthState =
  | { status: "anonymous" }
  | { status: "loading" }
  | { message: string; status: "error" }
  | { auth: AuthenticatedSession; status: "authenticated" };

export function createAnonymousState(): AuthState {
  return { status: "anonymous" };
}

export function createLoadingState(): AuthState {
  return { status: "loading" };
}

export function createErrorState(message: string): AuthState {
  return { message, status: "error" };
}

export function createAuthenticatedState(
  auth: AuthenticatedSession,
): AuthState {
  return { auth, status: "authenticated" };
}
