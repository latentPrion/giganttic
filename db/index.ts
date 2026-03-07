import { z } from "zod";

import { activeSchemaVersion, availableSchemaVersions } from "./config.js";
import * as v1 from "./v1/index.js";

const schemaModules = {
  v1,
} as const;

type SchemaModuleVersion = keyof typeof schemaModules;

const activeDbModule =
  schemaModules[activeSchemaVersion as SchemaModuleVersion];

export { activeSchemaVersion, availableSchemaVersions };

export const {
  authSeedData,
  credentialTypeCodes,
  credentialTypes,
  credentialTypesInsertSchema,
  credentialTypesSelectSchema,
  roles,
  rolesInsertSchema,
  rolesSelectSchema,
  roleCodes,
  users,
  usersCredentialTypes,
  usersCredentialTypesInsertSchema,
  usersCredentialTypesSelectSchema,
  usersPasswordCredentials,
  usersPasswordCredentialsInsertSchema,
  usersPasswordCredentialsSelectSchema,
  usersRelations,
  usersRoles,
  usersRolesInsertSchema,
  usersRolesRelations,
  usersRolesSelectSchema,
  usersSelectSchema,
  usersSessions,
  usersSessionsInsertSchema,
  usersSessionsRelations,
  usersSessionsSelectSchema,
  usersInsertSchema,
  usersCredentialTypesRelations,
  usersPasswordCredentialsRelations,
  credentialTypesRelations,
  rolesRelations,
} = activeDbModule;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type CredentialType = typeof credentialTypes.$inferSelect;
export type NewCredentialType = typeof credentialTypes.$inferInsert;
export type UserRole = typeof usersRoles.$inferSelect;
export type NewUserRole = typeof usersRoles.$inferInsert;
export type UserCredentialType = typeof usersCredentialTypes.$inferSelect;
export type NewUserCredentialType = typeof usersCredentialTypes.$inferInsert;
export type UserPasswordCredential = typeof usersPasswordCredentials.$inferSelect;
export type NewUserPasswordCredential =
  typeof usersPasswordCredentials.$inferInsert;
export type UserSession = typeof usersSessions.$inferSelect;
export type NewUserSession = typeof usersSessions.$inferInsert;

export type UserInsertInput = z.infer<typeof usersInsertSchema>;
export type UserRecord = z.infer<typeof usersSelectSchema>;
export type RoleInsertInput = z.infer<typeof rolesInsertSchema>;
export type RoleRecord = z.infer<typeof rolesSelectSchema>;
export type CredentialTypeInsertInput = z.infer<
  typeof credentialTypesInsertSchema
>;
export type CredentialTypeRecord = z.infer<typeof credentialTypesSelectSchema>;
export type UserRoleInsertInput = z.infer<typeof usersRolesInsertSchema>;
export type UserRoleRecord = z.infer<typeof usersRolesSelectSchema>;
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
