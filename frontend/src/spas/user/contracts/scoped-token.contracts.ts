import { z } from "zod";

export const scopedAccessTokenScopeSchema = z.object({
  objectId: z.number().int().positive(),
  objectTypeCode: z.string(),
});

export const scopedAccessTokenSchema = z.object({
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  id: z.number().int().positive(),
  lastUsedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  scopes: z.array(scopedAccessTokenScopeSchema),
  updatedAt: z.string().datetime(),
});

export const createScopedAccessTokenRequestSchema = z.object({
  expiresAt: z.string().datetime().nullable().optional(),
});

export const addScopedAccessProjectScopeRequestSchema = z.object({
  projectId: z.number().int().positive(),
});

export const createScopedAccessTokenResponseSchema = z.object({
  token: z.string(),
  tokenCredential: scopedAccessTokenSchema,
});

export const listScopedAccessTokensResponseSchema = z.object({
  tokenCredentials: z.array(scopedAccessTokenSchema),
});

export const revokeScopedAccessTokenResponseSchema = z.object({
  revokedTokenCredentialId: z.number().int().positive(),
});

export const updateScopedAccessTokenScopeResponseSchema = z.object({
  tokenCredential: scopedAccessTokenSchema,
});

export type ScopedAccessTokenScope = z.infer<typeof scopedAccessTokenScopeSchema>;
export type ScopedAccessToken = z.infer<typeof scopedAccessTokenSchema>;
