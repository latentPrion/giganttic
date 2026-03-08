import { z } from "zod";

const USER_ID_PARAM_NAME = "userId";

export const userIdParamSchema = z.object({
  [USER_ID_PARAM_NAME]: z.coerce.number().int().positive(),
});

export const deleteUserResponseSchema = z.object({
  deletedUserId: z.number().int().positive(),
});

export type DeleteUserResponse = z.infer<typeof deleteUserResponseSchema>;
