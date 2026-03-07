import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import {
  credentialTypes,
  roles,
  users,
  usersCredentialTypes,
  usersPasswordCredentials,
  usersRoles,
  usersSessions,
} from "../schema.js";

export const usersInsertSchema = createInsertSchema(users);
export const usersSelectSchema = createSelectSchema(users);

export const rolesInsertSchema = createInsertSchema(roles);
export const rolesSelectSchema = createSelectSchema(roles);

export const credentialTypesInsertSchema = createInsertSchema(credentialTypes);
export const credentialTypesSelectSchema = createSelectSchema(credentialTypes);

export const usersRolesInsertSchema = createInsertSchema(usersRoles);
export const usersRolesSelectSchema = createSelectSchema(usersRoles);

export const usersCredentialTypesInsertSchema =
  createInsertSchema(usersCredentialTypes);
export const usersCredentialTypesSelectSchema =
  createSelectSchema(usersCredentialTypes);

export const usersPasswordCredentialsInsertSchema =
  createInsertSchema(usersPasswordCredentials);
export const usersPasswordCredentialsSelectSchema =
  createSelectSchema(usersPasswordCredentials);

export const usersSessionsInsertSchema = createInsertSchema(usersSessions);
export const usersSessionsSelectSchema = createSelectSchema(usersSessions);
