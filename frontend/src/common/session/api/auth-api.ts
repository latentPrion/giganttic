import {
  currentSessionResponseSchema,
  loginRequestSchema,
  loginResponseSchema,
  registerRequestSchema,
  registerResponseSchema,
  revokeSessionsRequestSchema,
  revokeSessionsResponseSchema,
  type CurrentSessionResponse,
  type LoginRequest,
  type LoginResponse,
  type RegisterRequest,
  type RegisterResponse,
  type RevokeSessionsResponse,
} from "../contracts/auth.contracts.js";
import { requestJson } from "../../api/http-client.js";

const AUTH_REGISTER_PATH = "/auth/register";
const AUTH_LOGIN_PATH = "/auth/login";
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

  async login(payload: LoginRequest): Promise<LoginResponse> {
    return await requestJson({
      body: payload,
      method: "POST",
      path: AUTH_LOGIN_PATH,
      requestSchema: loginRequestSchema,
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
    return await requestJson({
      body: {
        sessionIds: [sessionId],
      },
      method: "POST",
      path: AUTH_REVOKE_SESSION_PATH,
      requestSchema: revokeSessionsRequestSchema,
      responseSchema: revokeSessionsResponseSchema,
      token,
    });
  },
};
