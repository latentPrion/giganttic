import { z } from "zod";

export const registerRequestSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export const loginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const sessionQuerySchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export const revokeSessionsRequestSchema = z.object({
  sessionIds: z.array(z.string().min(1)).min(1),
});

export const sessionSummarySchema = z.object({
  id: z.string(),
  userId: z.number().int().positive(),
  startTimestamp: z.string(),
  expirationTimestamp: z.string(),
  revokedAt: z.string().nullable(),
  ipAddress: z.string(),
  location: z.string().nullable(),
});

export const authUserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string(),
  email: z.string().email(),
  roles: z.array(z.string()),
});

export const registerResponseSchema = z.object({
  user: authUserSchema,
});

export const loginResponseSchema = z.object({
  tokenType: z.literal("Bearer"),
  accessToken: z.string(),
  user: authUserSchema,
  session: sessionSummarySchema,
});

export const currentSessionResponseSchema = z.object({
  user: authUserSchema,
  session: sessionSummarySchema,
});

export const listSessionsResponseSchema = z.object({
  sessions: z.array(sessionSummarySchema),
});

export const revokeSessionsResponseSchema = z.object({
  revokedSessionIds: z.array(z.string()),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type SessionQuery = z.infer<typeof sessionQuerySchema>;
export type RevokeSessionsRequest = z.infer<typeof revokeSessionsRequestSchema>;
export type AuthUserResponse = z.infer<typeof authUserSchema>;
export type SessionSummary = z.infer<typeof sessionSummarySchema>;
