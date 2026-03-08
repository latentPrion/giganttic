import { z } from "zod";

const TEAM_ROLE_CODES = [
  "GGTC_TEAMROLE_TEAM_MANAGER",
  "GGTC_TEAMROLE_PROJECT_MANAGER",
] as const;
const TEAM_ROLE_ENUM = z.enum(TEAM_ROLE_CODES);
const TEAM_ID_PARAM_NAME = "teamId";
const TEAM_UPDATE_REQUIRED_MESSAGE = "At least one field must be provided";
const TEAM_DUPLICATE_MEMBERS_MESSAGE = "Each team member must be unique";
const TEAM_DUPLICATE_ROLE_CODES_MESSAGE = "Role codes must be unique per member";

function createOptionalDescriptionSchema() {
  return z.string().trim().min(1).nullable().optional();
}

function createRequiredNameSchema() {
  return z.string().trim().min(1);
}

function hasUniqueItems(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function hasUniqueUserIds(
  members: ReadonlyArray<{ userId: number }>,
): boolean {
  return new Set(members.map((member) => member.userId)).size === members.length;
}

export const teamIdParamSchema = z.object({
  [TEAM_ID_PARAM_NAME]: z.coerce.number().int().positive(),
});

export const createTeamRequestSchema = z.object({
  description: createOptionalDescriptionSchema(),
  name: createRequiredNameSchema(),
});

export const updateTeamRequestSchema = z.object({
  description: createOptionalDescriptionSchema(),
  name: createRequiredNameSchema().optional(),
}).refine(
  (value) => value.description !== undefined || value.name !== undefined,
  TEAM_UPDATE_REQUIRED_MESSAGE,
);

export const updateTeamMembershipRequestSchema = z.object({
  members: z.array(
    z.object({
      roleCodes: z.array(TEAM_ROLE_ENUM)
        .refine(hasUniqueItems, TEAM_DUPLICATE_ROLE_CODES_MESSAGE),
      userId: z.number().int().positive(),
    }),
  ).min(1).refine(hasUniqueUserIds, TEAM_DUPLICATE_MEMBERS_MESSAGE),
});

export const teamSchema = z.object({
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.number().int().positive(),
  name: z.string(),
  updatedAt: z.string(),
});

export const teamMemberSchema = z.object({
  roleCodes: z.array(TEAM_ROLE_ENUM),
  userId: z.number().int().positive(),
  username: z.string(),
});

export const createTeamResponseSchema = z.object({
  team: teamSchema,
});

export const listTeamsResponseSchema = z.object({
  teams: z.array(teamSchema),
});

export const getTeamResponseSchema = z.object({
  members: z.array(teamMemberSchema),
  team: teamSchema,
});

export const updateTeamResponseSchema = z.object({
  team: teamSchema,
});

export const updateTeamMembershipResponseSchema = z.object({
  members: z.array(teamMemberSchema),
  teamId: z.number().int().positive(),
});

export const deleteTeamResponseSchema = z.object({
  deletedTeamId: z.number().int().positive(),
});

export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>;
export type DeleteTeamResponse = z.infer<typeof deleteTeamResponseSchema>;
export type GetTeamResponse = z.infer<typeof getTeamResponseSchema>;
export type ListTeamsResponse = z.infer<typeof listTeamsResponseSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamResponse = z.infer<typeof teamSchema>;
export type UpdateTeamMembershipRequest = z.infer<
  typeof updateTeamMembershipRequestSchema
>;
export type UpdateTeamMembershipResponse = z.infer<
  typeof updateTeamMembershipResponseSchema
>;
export type UpdateTeamRequest = z.infer<typeof updateTeamRequestSchema>;
