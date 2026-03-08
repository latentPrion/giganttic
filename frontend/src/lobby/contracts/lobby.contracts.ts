import { z } from "zod";

const timestampSchema = z.string();
const roleCodesSchema = z.array(z.string());

const projectSchema = z.object({
  createdAt: timestampSchema,
  description: z.string().nullable(),
  id: z.number().int().positive(),
  name: z.string(),
  updatedAt: timestampSchema,
});

const teamSchema = z.object({
  createdAt: timestampSchema,
  description: z.string().nullable(),
  id: z.number().int().positive(),
  name: z.string(),
  updatedAt: timestampSchema,
});

const organizationSchema = z.object({
  createdAt: timestampSchema,
  description: z.string().nullable(),
  id: z.number().int().positive(),
  name: z.string(),
  updatedAt: timestampSchema,
});

const teamMemberSchema = z.object({
  roleCodes: roleCodesSchema,
  userId: z.number().int().positive(),
  username: z.string(),
});

const organizationMemberSchema = z.object({
  roleCodes: roleCodesSchema,
  userId: z.number().int().positive(),
  username: z.string(),
});

export const listProjectsResponseSchema = z.object({
  projects: z.array(projectSchema),
});

export const deleteProjectResponseSchema = z.object({
  deletedProjectId: z.number().int().positive(),
});

export const listTeamsResponseSchema = z.object({
  teams: z.array(teamSchema),
});

export const getTeamResponseSchema = z.object({
  members: z.array(teamMemberSchema),
  team: teamSchema,
});

export const replaceTeamMembersRequestSchema = z.object({
  members: z.array(teamMemberSchema.pick({
    roleCodes: true,
    userId: true,
  })).min(1),
});

export const replaceTeamMembersResponseSchema = z.object({
  members: z.array(teamMemberSchema),
  teamId: z.number().int().positive(),
});

export const listOrganizationsResponseSchema = z.object({
  organizations: z.array(organizationSchema),
});

export const getOrganizationResponseSchema = z.object({
  members: z.array(organizationMemberSchema),
  organization: organizationSchema,
  projects: z.array(z.object({
    projectId: z.number().int().positive(),
  })),
  teams: z.array(z.object({
    teamId: z.number().int().positive(),
  })),
});

export const replaceOrganizationUsersRequestSchema = z.object({
  members: z.array(z.object({
    userId: z.number().int().positive(),
  })).min(1),
});

export const replaceOrganizationUsersResponseSchema = z.object({
  members: z.array(organizationMemberSchema),
  organizationId: z.number().int().positive(),
});

export type DeleteProjectResponse = z.infer<typeof deleteProjectResponseSchema>;
export type GetOrganizationResponse = z.infer<typeof getOrganizationResponseSchema>;
export type GetTeamResponse = z.infer<typeof getTeamResponseSchema>;
export type ListOrganizationsResponse = z.infer<typeof listOrganizationsResponseSchema>;
export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;
export type ListTeamsResponse = z.infer<typeof listTeamsResponseSchema>;
export type LobbyOrganization = z.infer<typeof organizationSchema>;
export type LobbyProject = z.infer<typeof projectSchema>;
export type LobbyTeam = z.infer<typeof teamSchema>;
export type ReplaceOrganizationUsersRequest = z.infer<
  typeof replaceOrganizationUsersRequestSchema
>;
export type ReplaceOrganizationUsersResponse = z.infer<
  typeof replaceOrganizationUsersResponseSchema
>;
export type ReplaceTeamMembersRequest = z.infer<
  typeof replaceTeamMembersRequestSchema
>;
export type ReplaceTeamMembersResponse = z.infer<
  typeof replaceTeamMembersResponseSchema
>;
