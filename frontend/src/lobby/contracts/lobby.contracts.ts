import { z } from "zod";

const timestampSchema = z.string();
const roleCodesSchema = z.array(z.string());

const projectSchema = z.object({
  createdAt: timestampSchema,
  description: z.string().nullable(),
  id: z.number().int().positive(),
  journal: z.string().nullable().optional(),
  name: z.string(),
  updatedAt: timestampSchema,
});
const projectMemberSchema = z.object({
  roleCodes: roleCodesSchema,
  userId: z.number().int().positive(),
  username: z.string(),
});
const projectManagerSourceSchema = z.enum(["direct", "org", "team"]);
const projectManagerSchema = z.object({
  sourceKinds: z.array(projectManagerSourceSchema),
  userId: z.number().int().positive(),
  username: z.string(),
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

const scopedManagerSchema = z.object({
  userId: z.number().int().positive(),
  username: z.string(),
});

const organizationMemberSchema = z.object({
  roleCodes: roleCodesSchema,
  userId: z.number().int().positive(),
  username: z.string(),
});

const userProfileSchema = z.object({
  createdAt: timestampSchema,
  id: z.number().int().positive(),
  isActive: z.boolean(),
  updatedAt: timestampSchema,
  username: z.string(),
});

export const listProjectsResponseSchema = z.object({
  projects: z.array(projectSchema),
});
export const createProjectRequestSchema = z.object({
  description: z.string().trim().min(1).nullable().optional(),
  journal: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1),
});
export const createProjectResponseSchema = z.object({
  project: projectSchema,
});
export const getProjectResponseSchema = z.object({
  members: z.array(projectMemberSchema),
  organizations: z.array(organizationSchema),
  project: projectSchema,
  projectManagers: z.array(projectManagerSchema),
  teams: z.array(teamSchema),
});
export const updateProjectRequestSchema = z.object({
  description: z.string().trim().min(1).nullable().optional(),
  journal: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1).optional(),
}).refine(
  (value) => value.description !== undefined || value.journal !== undefined || value.name !== undefined,
  "At least one field must be provided",
);
export const updateProjectResponseSchema = z.object({
  project: projectSchema,
});

export const deleteProjectResponseSchema = z.object({
  deletedProjectId: z.number().int().positive(),
});

export const listTeamsResponseSchema = z.object({
  teams: z.array(teamSchema),
});
export const createTeamRequestSchema = z.object({
  description: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1),
});
export const createTeamResponseSchema = z.object({
  team: teamSchema,
});

export const getTeamResponseSchema = z.object({
  members: z.array(teamMemberSchema),
  projects: z.array(projectSchema),
  team: teamSchema,
  teamManagers: z.array(scopedManagerSchema),
  teamProjectManagers: z.array(scopedManagerSchema),
});
export const updateTeamRequestSchema = z.object({
  description: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1).optional(),
}).refine(
  (value) => value.description !== undefined || value.name !== undefined,
  "At least one field must be provided",
);
export const updateTeamResponseSchema = z.object({
  team: teamSchema,
});
export const deleteTeamResponseSchema = z.object({
  deletedTeamId: z.number().int().positive(),
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
export const createOrganizationRequestSchema = z.object({
  description: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1),
});
export const createOrganizationResponseSchema = z.object({
  organization: organizationSchema,
});

export const getOrganizationResponseSchema = z.object({
  members: z.array(organizationMemberSchema),
  organization: organizationSchema,
  organizationManagers: z.array(scopedManagerSchema),
  organizationProjectManagers: z.array(scopedManagerSchema),
  organizationTeamManagers: z.array(scopedManagerSchema),
  projects: z.array(projectSchema),
  teams: z.array(teamSchema),
});

export const getUserResponseSchema = z.object({
  organizations: z.array(organizationSchema),
  projects: z.array(projectSchema),
  teams: z.array(teamSchema),
  user: userProfileSchema,
});

export const listUsersResponseSchema = z.object({
  users: z.array(userProfileSchema),
});

export const projectTeamAssociationRequestSchema = z.object({
  teamId: z.number().int().positive(),
});

export const projectOrganizationAssociationRequestSchema = z.object({
  organizationId: z.number().int().positive(),
});

export const updateProjectTeamsResponseSchema = z.object({
  projectId: z.number().int().positive(),
  teams: z.array(teamSchema),
});

export const updateProjectOrganizationsResponseSchema = z.object({
  organizations: z.array(organizationSchema),
  projectId: z.number().int().positive(),
});
export const updateOrganizationRequestSchema = z.object({
  description: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(1).optional(),
}).refine(
  (value) => value.description !== undefined || value.name !== undefined,
  "At least one field must be provided",
);
export const updateOrganizationResponseSchema = z.object({
  organization: organizationSchema,
});
export const deleteOrganizationResponseSchema = z.object({
  deletedOrganizationId: z.number().int().positive(),
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

export const assignOrganizationTeamRequestSchema = z.object({
  teamId: z.number().int().positive(),
});

export const updateOrganizationTeamsResponseSchema = z.object({
  organizationId: z.number().int().positive(),
  teams: z.array(teamSchema),
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type CreateProjectResponse = z.infer<typeof createProjectResponseSchema>;
export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>;
export type CreateTeamResponse = z.infer<typeof createTeamResponseSchema>;
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;
export type CreateOrganizationResponse = z.infer<typeof createOrganizationResponseSchema>;
export type DeleteOrganizationResponse = z.infer<typeof deleteOrganizationResponseSchema>;
export type DeleteProjectResponse = z.infer<typeof deleteProjectResponseSchema>;
export type DeleteTeamResponse = z.infer<typeof deleteTeamResponseSchema>;
export type AssignOrganizationTeamRequest = z.infer<typeof assignOrganizationTeamRequestSchema>;
export type GetOrganizationResponse = z.infer<typeof getOrganizationResponseSchema>;
export type GetProjectResponse = z.infer<typeof getProjectResponseSchema>;
export type GetTeamResponse = z.infer<typeof getTeamResponseSchema>;
export type GetUserResponse = z.infer<typeof getUserResponseSchema>;
export type ListUsersResponse = z.infer<typeof listUsersResponseSchema>;
export type ListOrganizationsResponse = z.infer<typeof listOrganizationsResponseSchema>;
export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;
export type ListTeamsResponse = z.infer<typeof listTeamsResponseSchema>;
export type LobbyOrganization = z.infer<typeof organizationSchema>;
export type LobbyProject = z.infer<typeof projectSchema>;
export type LobbyTeam = z.infer<typeof teamSchema>;
export type LobbyUser = z.infer<typeof userProfileSchema>;
export type ProjectMember = z.infer<typeof projectMemberSchema>;
export type ProjectManager = z.infer<typeof projectManagerSchema>;
export type ProjectManagerSource = z.infer<typeof projectManagerSourceSchema>;
export type ProjectOrganizationAssociationRequest = z.infer<
  typeof projectOrganizationAssociationRequestSchema
>;
export type ProjectTeamAssociationRequest = z.infer<
  typeof projectTeamAssociationRequestSchema
>;
export type ReplaceOrganizationUsersRequest = z.infer<
  typeof replaceOrganizationUsersRequestSchema
>;
export type ReplaceOrganizationUsersResponse = z.infer<
  typeof replaceOrganizationUsersResponseSchema
>;
export type UpdateOrganizationTeamsResponse = z.infer<
  typeof updateOrganizationTeamsResponseSchema
>;
export type ReplaceTeamMembersRequest = z.infer<
  typeof replaceTeamMembersRequestSchema
>;
export type ReplaceTeamMembersResponse = z.infer<
  typeof replaceTeamMembersResponseSchema
>;
export type ScopedManager = z.infer<typeof scopedManagerSchema>;
export type UpdateProjectOrganizationsResponse = z.infer<
  typeof updateProjectOrganizationsResponseSchema
>;
export type UpdateProjectTeamsResponse = z.infer<
  typeof updateProjectTeamsResponseSchema
>;
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationRequestSchema>;
export type UpdateOrganizationResponse = z.infer<typeof updateOrganizationResponseSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type UpdateProjectResponse = z.infer<typeof updateProjectResponseSchema>;
export type UpdateTeamRequest = z.infer<typeof updateTeamRequestSchema>;
export type UpdateTeamResponse = z.infer<typeof updateTeamResponseSchema>;
