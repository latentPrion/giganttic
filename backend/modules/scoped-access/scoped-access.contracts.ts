import { z } from "zod";

export const scopedAccessTokenIdParamSchema = z.object({
  scopedAccessTokenCredentialId: z.coerce.number().int().positive(),
});

export const scopedAccessTokenProjectScopeParamsSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  scopedAccessTokenCredentialId: z.coerce.number().int().positive(),
});

export const createScopedAccessTokenRequestSchema = z.object({
  expiresAt: z.string().datetime().optional().nullable(),
});

export const redeemScopedAccessTokenRequestSchema = z.object({
  token: z.string().min(1),
});

export const addScopedAccessProjectScopeRequestSchema = z.object({
  projectId: z.number().int().positive(),
});

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

export type CreateScopedAccessTokenRequest = z.infer<
  typeof createScopedAccessTokenRequestSchema
>;
export type RedeemScopedAccessTokenRequest = z.infer<
  typeof redeemScopedAccessTokenRequestSchema
>;
export type AddScopedAccessProjectScopeRequest = z.infer<
  typeof addScopedAccessProjectScopeRequestSchema
>;
