import { z } from "zod";

import { activeSchemaVersion, availableSchemaVersions } from "./config.js";
import * as v1 from "./v1/index.js";
import * as v2 from "./v2/index.js";

const schemaModules = {
  v1,
  v2,
} as const;

type SchemaModuleVersion = keyof typeof schemaModules;

const activeDbModule = schemaModules[
  activeSchemaVersion as SchemaModuleVersion
] as typeof v2;

export { activeSchemaVersion, availableSchemaVersions };

export const {
  authSeedData,
  credentialTypeCodes,
  credentialTypes,
  credentialTypesInsertSchema,
  credentialTypesRelations,
  credentialTypesSelectSchema,
  projectRoleCodes,
  projectRoles,
  projectRolesInsertSchema,
  projectRolesRelations,
  projectRolesSelectSchema,
  projects,
  projectsInsertSchema,
  projectsRelations,
  projectsSelectSchema,
  projectsTeams,
  projectsTeamsInsertSchema,
  projectsTeamsRelations,
  projectsTeamsSelectSchema,
  projectsUsers,
  projectsUsersInsertSchema,
  projectsUsersRelations,
  projectsUsersSelectSchema,
  systemRoleCodes,
  systemRoles,
  systemRolesInsertSchema,
  systemRolesRelations,
  systemRolesSelectSchema,
  teamRoleCodes,
  teamRoles,
  teamRolesInsertSchema,
  teamRolesRelations,
  teamRolesSelectSchema,
  teams,
  teamsInsertSchema,
  teamsRelations,
  teamsSelectSchema,
  teamsUsers,
  teamsUsersInsertSchema,
  teamsUsersRelations,
  teamsUsersSelectSchema,
  users,
  usersCredentialTypes,
  usersCredentialTypesInsertSchema,
  usersCredentialTypesRelations,
  usersCredentialTypesSelectSchema,
  usersInsertSchema,
  usersPasswordCredentials,
  usersPasswordCredentialsInsertSchema,
  usersPasswordCredentialsRelations,
  usersPasswordCredentialsSelectSchema,
  usersProjectsProjectRoles,
  usersProjectsProjectRolesInsertSchema,
  usersProjectsProjectRolesRelations,
  usersProjectsProjectRolesSelectSchema,
  usersRelations,
  usersSelectSchema,
  usersSessions,
  usersSessionsInsertSchema,
  usersSessionsRelations,
  usersSessionsSelectSchema,
  usersSystemRoles,
  usersSystemRolesInsertSchema,
  usersSystemRolesRelations,
  usersSystemRolesSelectSchema,
  usersTeamsTeamRoles,
  usersTeamsTeamRolesInsertSchema,
  usersTeamsTeamRolesRelations,
  usersTeamsTeamRolesSelectSchema,
} = activeDbModule;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type SystemRole = typeof systemRoles.$inferSelect;
export type NewSystemRole = typeof systemRoles.$inferInsert;
export type ProjectRole = typeof projectRoles.$inferSelect;
export type NewProjectRole = typeof projectRoles.$inferInsert;
export type TeamRole = typeof teamRoles.$inferSelect;
export type NewTeamRole = typeof teamRoles.$inferInsert;
export type CredentialType = typeof credentialTypes.$inferSelect;
export type NewCredentialType = typeof credentialTypes.$inferInsert;
export type ProjectUserAccess = typeof projectsUsers.$inferSelect;
export type NewProjectUserAccess = typeof projectsUsers.$inferInsert;
export type TeamUserMembership = typeof teamsUsers.$inferSelect;
export type NewTeamUserMembership = typeof teamsUsers.$inferInsert;
export type ProjectTeamAccess = typeof projectsTeams.$inferSelect;
export type NewProjectTeamAccess = typeof projectsTeams.$inferInsert;
export type UserSystemRole = typeof usersSystemRoles.$inferSelect;
export type NewUserSystemRole = typeof usersSystemRoles.$inferInsert;
export type UserProjectRole = typeof usersProjectsProjectRoles.$inferSelect;
export type NewUserProjectRole = typeof usersProjectsProjectRoles.$inferInsert;
export type UserTeamRole = typeof usersTeamsTeamRoles.$inferSelect;
export type NewUserTeamRole = typeof usersTeamsTeamRoles.$inferInsert;
export type UserCredentialType = typeof usersCredentialTypes.$inferSelect;
export type NewUserCredentialType = typeof usersCredentialTypes.$inferInsert;
export type UserPasswordCredential = typeof usersPasswordCredentials.$inferSelect;
export type NewUserPasswordCredential =
  typeof usersPasswordCredentials.$inferInsert;
export type UserSession = typeof usersSessions.$inferSelect;
export type NewUserSession = typeof usersSessions.$inferInsert;

export type UserInsertInput = z.infer<typeof usersInsertSchema>;
export type UserRecord = z.infer<typeof usersSelectSchema>;
export type ProjectInsertInput = z.infer<typeof projectsInsertSchema>;
export type ProjectRecord = z.infer<typeof projectsSelectSchema>;
export type TeamInsertInput = z.infer<typeof teamsInsertSchema>;
export type TeamRecord = z.infer<typeof teamsSelectSchema>;
export type SystemRoleInsertInput = z.infer<typeof systemRolesInsertSchema>;
export type SystemRoleRecord = z.infer<typeof systemRolesSelectSchema>;
export type ProjectRoleInsertInput = z.infer<typeof projectRolesInsertSchema>;
export type ProjectRoleRecord = z.infer<typeof projectRolesSelectSchema>;
export type TeamRoleInsertInput = z.infer<typeof teamRolesInsertSchema>;
export type TeamRoleRecord = z.infer<typeof teamRolesSelectSchema>;
export type CredentialTypeInsertInput = z.infer<
  typeof credentialTypesInsertSchema
>;
export type CredentialTypeRecord = z.infer<typeof credentialTypesSelectSchema>;
export type ProjectUserAccessInsertInput = z.infer<
  typeof projectsUsersInsertSchema
>;
export type ProjectUserAccessRecord = z.infer<typeof projectsUsersSelectSchema>;
export type TeamUserMembershipInsertInput = z.infer<
  typeof teamsUsersInsertSchema
>;
export type TeamUserMembershipRecord = z.infer<typeof teamsUsersSelectSchema>;
export type ProjectTeamAccessInsertInput = z.infer<
  typeof projectsTeamsInsertSchema
>;
export type ProjectTeamAccessRecord = z.infer<typeof projectsTeamsSelectSchema>;
export type UserSystemRoleInsertInput = z.infer<
  typeof usersSystemRolesInsertSchema
>;
export type UserSystemRoleRecord = z.infer<typeof usersSystemRolesSelectSchema>;
export type UserProjectRoleInsertInput = z.infer<
  typeof usersProjectsProjectRolesInsertSchema
>;
export type UserProjectRoleRecord = z.infer<
  typeof usersProjectsProjectRolesSelectSchema
>;
export type UserTeamRoleInsertInput = z.infer<
  typeof usersTeamsTeamRolesInsertSchema
>;
export type UserTeamRoleRecord = z.infer<
  typeof usersTeamsTeamRolesSelectSchema
>;
export type UserCredentialTypeInsertInput = z.infer<
  typeof usersCredentialTypesInsertSchema
>;
export type UserCredentialTypeRecord = z.infer<
  typeof usersCredentialTypesSelectSchema
>;
export type UserPasswordCredentialInsertInput = z.infer<
  typeof usersPasswordCredentialsInsertSchema
>;
export type UserPasswordCredentialRecord = z.infer<
  typeof usersPasswordCredentialsSelectSchema
>;
export type UserSessionInsertInput = z.infer<typeof usersSessionsInsertSchema>;
export type UserSessionRecord = z.infer<typeof usersSessionsSelectSchema>;
