import { z } from "zod";

const PROJECT_MANAGER_ROLE_CODE = "GGTC_PROJECTROLE_PROJECT_MANAGER";
const PROJECT_ROLE_CODES = [PROJECT_MANAGER_ROLE_CODE] as const;
const PROJECT_ROLE_ENUM = z.enum(PROJECT_ROLE_CODES);
const PROJECT_MANAGER_SOURCE_CODES = ["direct", "org", "team"] as const;
const PROJECT_ID_PARAM_NAME = "projectId";
const PROJECT_UPDATE_REQUIRED_MESSAGE = "At least one field must be provided";
const PROJECT_DUPLICATE_MEMBERS_MESSAGE = "Each project member must be unique";
const PROJECT_DUPLICATE_ROLE_CODES_MESSAGE =
  "Role codes must be unique per member";
const PROJECT_ROLE_ASSIGNMENT_REQUIRED_MESSAGE =
  "A project role assignment requires userId and roleCode";

function createOptionalDescriptionSchema() {
  return z.string().trim().min(1).nullable().optional();
}

function createOptionalJournalSchema() {
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

export const projectIdParamSchema = z.object({
  [PROJECT_ID_PARAM_NAME]: z.coerce.number().int().positive(),
});

export const createProjectRequestSchema = z.object({
  description: createOptionalDescriptionSchema(),
  journal: createOptionalJournalSchema(),
  name: createRequiredNameSchema(),
});

export const updateProjectRequestSchema = z.object({
  description: createOptionalDescriptionSchema(),
  journal: createOptionalJournalSchema(),
  name: createRequiredNameSchema().optional(),
}).refine(
  (value) => value.description !== undefined || value.journal !== undefined || value.name !== undefined,
  PROJECT_UPDATE_REQUIRED_MESSAGE,
);

export const updateProjectMembershipRequestSchema = z.object({
  members: z.array(
    z.object({
      roleCodes: z.array(PROJECT_ROLE_ENUM)
        .refine(hasUniqueItems, PROJECT_DUPLICATE_ROLE_CODES_MESSAGE),
      userId: z.number().int().positive(),
    }),
  ).min(1).refine(hasUniqueUserIds, PROJECT_DUPLICATE_MEMBERS_MESSAGE),
});

export const projectRoleAssignmentRequestSchema = z.object({
  roleCode: PROJECT_ROLE_ENUM,
  userId: z.number().int().positive(),
}, PROJECT_ROLE_ASSIGNMENT_REQUIRED_MESSAGE);

export const projectSchema = z.object({
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.number().int().positive(),
  journal: z.string().nullable(),
  name: z.string(),
  updatedAt: z.string(),
});

export const projectMemberSchema = z.object({
  roleCodes: z.array(PROJECT_ROLE_ENUM),
  userId: z.number().int().positive(),
  username: z.string(),
});

export const projectManagerSourceSchema = z.enum(PROJECT_MANAGER_SOURCE_CODES);

export const projectManagerSchema = z.object({
  sourceKinds: z.array(projectManagerSourceSchema),
  userId: z.number().int().positive(),
  username: z.string(),
});

export const projectTeamSchema = z.object({
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.number().int().positive(),
  name: z.string(),
  updatedAt: z.string(),
});

export const projectOrganizationSchema = z.object({
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.number().int().positive(),
  name: z.string(),
  updatedAt: z.string(),
});

export const createProjectResponseSchema = z.object({
  project: projectSchema,
});

export const listProjectsResponseSchema = z.object({
  projects: z.array(projectSchema),
});

export const getProjectResponseSchema = z.object({
  members: z.array(projectMemberSchema),
  organizations: z.array(projectOrganizationSchema),
  project: projectSchema,
  projectManagers: z.array(projectManagerSchema),
  teams: z.array(projectTeamSchema),
});

export const updateProjectResponseSchema = z.object({
  project: projectSchema,
});

export const updateProjectMembershipResponseSchema = z.object({
  members: z.array(projectMemberSchema),
  projectId: z.number().int().positive(),
});

export const deleteProjectResponseSchema = z.object({
  deletedProjectId: z.number().int().positive(),
});

export const updateProjectRoleAssignmentResponseSchema = z.object({
  members: z.array(projectMemberSchema),
  projectId: z.number().int().positive(),
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type DeleteProjectResponse = z.infer<typeof deleteProjectResponseSchema>;
export type GetProjectResponse = z.infer<typeof getProjectResponseSchema>;
export type ListProjectsResponse = z.infer<typeof listProjectsResponseSchema>;
export type ProjectMember = z.infer<typeof projectMemberSchema>;
export type ProjectManager = z.infer<typeof projectManagerSchema>;
export type ProjectManagerSource = z.infer<typeof projectManagerSourceSchema>;
export type ProjectOrganization = z.infer<typeof projectOrganizationSchema>;
export type ProjectResponse = z.infer<typeof projectSchema>;
export type ProjectTeam = z.infer<typeof projectTeamSchema>;
export type ProjectRoleAssignmentRequest = z.infer<
  typeof projectRoleAssignmentRequestSchema
>;
export type UpdateProjectMembershipRequest = z.infer<
  typeof updateProjectMembershipRequestSchema
>;
export type UpdateProjectMembershipResponse = z.infer<
  typeof updateProjectMembershipResponseSchema
>;
export type UpdateProjectRoleAssignmentResponse = z.infer<
  typeof updateProjectRoleAssignmentResponseSchema
>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
