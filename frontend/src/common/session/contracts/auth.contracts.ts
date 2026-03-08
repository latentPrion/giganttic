import { z } from "zod";

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  username: z.string().min(1),
});

export const loginRequestSchema = z.object({
  password: z.string().min(1),
  username: z.string().min(1),
});

export const revokeSessionsRequestSchema = z.object({
  sessionIds: z.array(z.string().min(1)).min(1),
});

export const sessionSummarySchema = z.object({
  expirationTimestamp: z.string(),
  id: z.string(),
  ipAddress: z.string(),
  location: z.string().nullable(),
  revokedAt: z.string().nullable(),
  startTimestamp: z.string(),
  userId: z.number().int().positive(),
});

export const authUserSchema = z.object({
  email: z.string().email(),
  id: z.number().int().positive(),
  roles: z.array(z.string()),
  username: z.string(),
});

export const registerResponseSchema = z.object({
  user: authUserSchema,
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  session: sessionSummarySchema,
  tokenType: z.literal("Bearer"),
  user: authUserSchema,
});

export const currentSessionResponseSchema = z.object({
  session: sessionSummarySchema,
  user: authUserSchema,
});

export const revokeSessionsResponseSchema = z.object({
  revokedSessionIds: z.array(z.string()),
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type CurrentSessionResponse = z.infer<typeof currentSessionResponseSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export type RevokeSessionsRequest = z.infer<typeof revokeSessionsRequestSchema>;
export type RevokeSessionsResponse = z.infer<typeof revokeSessionsResponseSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
