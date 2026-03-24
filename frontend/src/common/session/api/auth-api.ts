import {
  currentSessionResponseSchema,
  listSessionsResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  registerRequestSchema,
  registerResponseSchema,
  scopedAccessTokenLoginRequestSchema,
  revokeSessionsRequestSchema,
  revokeSessionsResponseSchema,
  type CurrentSessionResponse,
  type LoginRequest,
  type LoginResponse,
  type ListSessionsResponse,
  type RegisterRequest,
  type RegisterResponse,
  type RevokeSessionsResponse,
} from "../contracts/auth.contracts.js";
import { requestJson } from "../../api/http-client.js";

const AUTH_REGISTER_PATH = "/auth/register";
const AUTH_PASSWORD_LOGIN_PATH = "/auth/login/password";
const AUTH_SCOPED_ACCESS_TOKEN_LOGIN_PATH = "/auth/login/scoped-access-token";
const AUTH_CURRENT_SESSION_PATH = "/auth/session/me";
const AUTH_REVOKE_SESSION_PATH = "/auth/session/revoke";

export const authApi = {
  async getCurrentSession(token: string): Promise<CurrentSessionResponse> {
    return await requestJson({
      method: "GET",
      path: AUTH_CURRENT_SESSION_PATH,
      responseSchema: currentSessionResponseSchema,
      token,
    });
  },

  async listSessions(token: string, userId: number): Promise<ListSessionsResponse> {
    return await requestJson({
      method: "GET",
      path: `/auth/session?userId=${encodeURIComponent(String(userId))}`,
      responseSchema: listSessionsResponseSchema,
      token,
    });
  },

  async login(payload: LoginRequest): Promise<LoginResponse> {
    return await requestJson({
      body: payload,
      method: "POST",
      path: AUTH_PASSWORD_LOGIN_PATH,
      requestSchema: loginRequestSchema,
      responseSchema: loginResponseSchema,
    });
  },

  async loginWithScopedAccessToken(token: string): Promise<LoginResponse> {
    return await requestJson({
      body: { token },
      method: "POST",
      path: AUTH_SCOPED_ACCESS_TOKEN_LOGIN_PATH,
      requestSchema: scopedAccessTokenLoginRequestSchema,
      responseSchema: loginResponseSchema,
    });
  },

  async register(payload: RegisterRequest): Promise<RegisterResponse> {
    return await requestJson({
      body: payload,
      method: "POST",
      path: AUTH_REGISTER_PATH,
      requestSchema: registerRequestSchema,
      responseSchema: registerResponseSchema,
    });
  },

  async revokeCurrentSession(
    token: string,
    sessionId: string,
  ): Promise<RevokeSessionsResponse> {
    return await this.revokeSessions(token, [sessionId]);
  },

  async revokeSessions(
    token: string,
    sessionIds: string[],
  ): Promise<RevokeSessionsResponse> {
    return await requestJson({
      body: {
        sessionIds,
      },
      method: "POST",
      path: AUTH_REVOKE_SESSION_PATH,
      requestSchema: revokeSessionsRequestSchema,
      responseSchema: revokeSessionsResponseSchema,
      token,
    });
  },
};
