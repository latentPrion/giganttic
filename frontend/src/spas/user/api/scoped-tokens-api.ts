import { requestJson } from "../../../common/api/http-client.js";
import {
  addScopedAccessOrganizationScopeRequestSchema,
  addScopedAccessProjectScopeRequestSchema,
  createScopedAccessTokenRequestSchema,
  createScopedAccessTokenResponseSchema,
  listScopedAccessTokensResponseSchema,
  revokeScopedAccessTokenResponseSchema,
  updateScopedAccessTokenScopeResponseSchema,
} from "../contracts/scoped-token.contracts.js";

function createTokenBasePath(): string {
  return "/scoped-access/tokens";
}

function createTokenPath(tokenId: number): string {
  return `${createTokenBasePath()}/${tokenId}`;
}

export const scopedTokensApi = {
  async addProjectScope(token: string, tokenId: number, projectId: number) {
    return await requestJson({
      body: { projectId },
      method: "POST",
      path: `${createTokenPath(tokenId)}/scopes/projects`,
      requestSchema: addScopedAccessProjectScopeRequestSchema,
      responseSchema: updateScopedAccessTokenScopeResponseSchema,
      token,
    });
  },

  async addOrganizationScope(token: string, tokenId: number, organizationId: number) {
    return await requestJson({
      body: { organizationId },
      method: "POST",
      path: `${createTokenPath(tokenId)}/scopes/organizations`,
      requestSchema: addScopedAccessOrganizationScopeRequestSchema,
      responseSchema: updateScopedAccessTokenScopeResponseSchema,
      token,
    });
  },

  async createToken(token: string, expiresAt?: string | null) {
    return await requestJson({
      body: { expiresAt: expiresAt ?? null },
      method: "POST",
      path: createTokenBasePath(),
      requestSchema: createScopedAccessTokenRequestSchema,
      responseSchema: createScopedAccessTokenResponseSchema,
      token,
    });
  },

  async listTokens(token: string) {
    return await requestJson({
      method: "GET",
      path: createTokenBasePath(),
      responseSchema: listScopedAccessTokensResponseSchema,
      token,
    });
  },

  async removeProjectScope(token: string, tokenId: number, projectId: number) {
    return await requestJson({
      method: "DELETE",
      path: `${createTokenPath(tokenId)}/scopes/projects/${projectId}`,
      responseSchema: updateScopedAccessTokenScopeResponseSchema,
      token,
    });
  },

  async removeOrganizationScope(token: string, tokenId: number, organizationId: number) {
    return await requestJson({
      method: "DELETE",
      path: `${createTokenPath(tokenId)}/scopes/organizations/${organizationId}`,
      responseSchema: updateScopedAccessTokenScopeResponseSchema,
      token,
    });
  },

  async revokeToken(token: string, tokenId: number) {
    return await requestJson({
      method: "POST",
      path: `${createTokenPath(tokenId)}/revoke`,
      responseSchema: revokeScopedAccessTokenResponseSchema,
      token,
    });
  },
};
