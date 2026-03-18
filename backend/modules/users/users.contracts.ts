import { z } from "zod";

const USER_ID_PARAM_NAME = "userId";
const timestampSchema = z.string();

const userSummarySchema = z.object({
  createdAt: timestampSchema,
  id: z.number().int().positive(),
  isActive: z.boolean(),
  updatedAt: timestampSchema,
  username: z.string(),
});

const projectSummarySchema = z.object({
  createdAt: timestampSchema,
  description: z.string().nullable(),
  id: z.number().int().positive(),
  name: z.string(),
  updatedAt: timestampSchema,
});

const teamSummarySchema = z.object({
  createdAt: timestampSchema,
  description: z.string().nullable(),
  id: z.number().int().positive(),
  name: z.string(),
  updatedAt: timestampSchema,
});

const organizationSummarySchema = z.object({
  createdAt: timestampSchema,
  description: z.string().nullable(),
  id: z.number().int().positive(),
  name: z.string(),
  updatedAt: timestampSchema,
});

export const userIdParamSchema = z.object({
  [USER_ID_PARAM_NAME]: z.coerce.number().int().positive(),
});

export const deleteUserResponseSchema = z.object({
  deletedUserId: z.number().int().positive(),
});

export const changeUserPasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(1),
  revokeSessions: z.boolean(),
});

export const changeUserPasswordResponseSchema = z.object({
  revokedSessionIds: z.array(z.string()),
  updatedUserId: z.number().int().positive(),
});

export const getUserResponseSchema = z.object({
  organizations: z.array(organizationSummarySchema),
  projects: z.array(projectSummarySchema),
  teams: z.array(teamSummarySchema),
  user: userSummarySchema,
});

export const listUsersResponseSchema = z.object({
  users: z.array(userSummarySchema),
});

export type ChangeUserPasswordRequest = z.infer<typeof changeUserPasswordRequestSchema>;
export type ChangeUserPasswordResponse = z.infer<typeof changeUserPasswordResponseSchema>;
export type DeleteUserResponse = z.infer<typeof deleteUserResponseSchema>;
export type GetUserResponse = z.infer<typeof getUserResponseSchema>;
export type ListUsersResponse = z.infer<typeof listUsersResponseSchema>;
