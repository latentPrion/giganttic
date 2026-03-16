import { z } from "zod";

const ORGANIZATION_ROLE_CODES = [
  "GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER",
  "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
  "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
] as const;
const ORGANIZATION_ROLE_ENUM = z.enum(ORGANIZATION_ROLE_CODES);
const ORGANIZATION_ID_PARAM_NAME = "organizationId";
const TEAM_ID_PARAM_NAME = "teamId";
const ORGANIZATION_UPDATE_REQUIRED_MESSAGE =
  "At least one field must be provided";
const DUPLICATE_USER_MEMBERS_MESSAGE =
  "Each organization member must be unique";
const DUPLICATE_PROJECTS_MESSAGE =
  "Each associated project must be unique";

function createOptionalDescriptionSchema() {
  return z.string().trim().min(1).nullable().optional();
}

function createRequiredNameSchema() {
  return z.string().trim().min(1);
}

function hasUniqueUserIds(
  members: ReadonlyArray<{ userId: number }>,
): boolean {
  return new Set(members.map((member) => member.userId)).size === members.length;
}

function hasUniqueProjectIds(
  projects: ReadonlyArray<{ projectId: number }>,
): boolean {
  return new Set(projects.map((project) => project.projectId)).size ===
    projects.length;
}

export const organizationIdParamSchema = z.object({
  [ORGANIZATION_ID_PARAM_NAME]: z.coerce.number().int().positive(),
});

export const organizationTeamParamsSchema = z.object({
  [ORGANIZATION_ID_PARAM_NAME]: z.coerce.number().int().positive(),
  [TEAM_ID_PARAM_NAME]: z.coerce.number().int().positive(),
});

export const createOrganizationRequestSchema = z.object({
  description: createOptionalDescriptionSchema(),
  name: createRequiredNameSchema(),
});

export const updateOrganizationRequestSchema = z.object({
  description: createOptionalDescriptionSchema(),
  name: createRequiredNameSchema().optional(),
}).refine(
  (value) => value.description !== undefined || value.name !== undefined,
  ORGANIZATION_UPDATE_REQUIRED_MESSAGE,
);

export const updateOrganizationUsersRequestSchema = z.object({
  members: z.array(
    z.object({
      userId: z.number().int().positive(),
    }),
  ).min(1).refine(hasUniqueUserIds, DUPLICATE_USER_MEMBERS_MESSAGE),
});

export const updateOrganizationProjectsRequestSchema = z.object({
  projects: z.array(
    z.object({
      projectId: z.number().int().positive(),
    }),
  ).min(1).refine(hasUniqueProjectIds, DUPLICATE_PROJECTS_MESSAGE),
});

export const assignOrganizationTeamRequestSchema = z.object({
  teamId: z.number().int().positive(),
});

export const organizationRoleAssignmentRequestSchema = z.object({
  roleCode: ORGANIZATION_ROLE_ENUM,
  userId: z.number().int().positive(),
});

export const organizationSchema = z.object({
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.number().int().positive(),
  name: z.string(),
  updatedAt: z.string(),
});

export const organizationMemberSchema = z.object({
  roleCodes: z.array(ORGANIZATION_ROLE_ENUM),
  userId: z.number().int().positive(),
  username: z.string(),
});

export const organizationManagerSchema = z.object({
  userId: z.number().int().positive(),
  username: z.string(),
});

export const organizationProjectSchema = z.object({
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.number().int().positive(),
  name: z.string(),
  updatedAt: z.string(),
});

export const organizationTeamSchema = z.object({
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.number().int().positive(),
  name: z.string(),
  updatedAt: z.string(),
});

export const createOrganizationResponseSchema = z.object({
  organization: organizationSchema,
});

export const listOrganizationsResponseSchema = z.object({
  organizations: z.array(organizationSchema),
});

export const getOrganizationResponseSchema = z.object({
  members: z.array(organizationMemberSchema),
  organization: organizationSchema,
  organizationManagers: z.array(organizationManagerSchema),
  organizationProjectManagers: z.array(organizationManagerSchema),
  organizationTeamManagers: z.array(organizationManagerSchema),
  projects: z.array(organizationProjectSchema),
  teams: z.array(organizationTeamSchema),
});

export const updateOrganizationResponseSchema = z.object({
  organization: organizationSchema,
});

export const updateOrganizationUsersResponseSchema = z.object({
  members: z.array(organizationMemberSchema),
  organizationId: z.number().int().positive(),
});

export const updateOrganizationProjectsResponseSchema = z.object({
  organizationId: z.number().int().positive(),
  projects: z.array(organizationProjectSchema),
});

export const updateOrganizationTeamsResponseSchema = z.object({
  organizationId: z.number().int().positive(),
  teams: z.array(organizationTeamSchema),
});

export const updateOrganizationRoleAssignmentResponseSchema = z.object({
  members: z.array(organizationMemberSchema),
  organizationId: z.number().int().positive(),
});

export const deleteOrganizationResponseSchema = z.object({
  deletedOrganizationId: z.number().int().positive(),
});

export type AssignOrganizationTeamRequest = z.infer<
  typeof assignOrganizationTeamRequestSchema
>;
export type CreateOrganizationRequest = z.infer<
  typeof createOrganizationRequestSchema
>;
export type DeleteOrganizationResponse = z.infer<
  typeof deleteOrganizationResponseSchema
>;
export type GetOrganizationResponse = z.infer<
  typeof getOrganizationResponseSchema
>;
export type ListOrganizationsResponse = z.infer<
  typeof listOrganizationsResponseSchema
>;
export type OrganizationManager = z.infer<typeof organizationManagerSchema>;
export type OrganizationMember = z.infer<typeof organizationMemberSchema>;
export type OrganizationProject = z.infer<typeof organizationProjectSchema>;
export type OrganizationResponse = z.infer<typeof organizationSchema>;
export type OrganizationRoleAssignmentRequest = z.infer<
  typeof organizationRoleAssignmentRequestSchema
>;
export type OrganizationTeam = z.infer<typeof organizationTeamSchema>;
export type UpdateOrganizationProjectsRequest = z.infer<
  typeof updateOrganizationProjectsRequestSchema
>;
export type UpdateOrganizationProjectsResponse = z.infer<
  typeof updateOrganizationProjectsResponseSchema
>;
export type UpdateOrganizationRequest = z.infer<
  typeof updateOrganizationRequestSchema
>;
export type UpdateOrganizationRoleAssignmentResponse = z.infer<
  typeof updateOrganizationRoleAssignmentResponseSchema
>;
export type UpdateOrganizationTeamsResponse = z.infer<
  typeof updateOrganizationTeamsResponseSchema
>;
export type UpdateOrganizationUsersRequest = z.infer<
  typeof updateOrganizationUsersRequestSchema
>;
export type UpdateOrganizationUsersResponse = z.infer<
  typeof updateOrganizationUsersResponseSchema
>;
