import { relations, sql } from "drizzle-orm";
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const credentialTypeCodes = {
  usernamePassword: "GGTT_CREDTYPE_USERNAME_PASSWORD",
} as const;

export const roleCodes = {
  admin: "GGTT_ROLE_ADMIN",
  projectManager: "GGTT_ROLE_PROJECT_MANAGER",
} as const;

const nowTimestampExpression = sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`;
const usernamePasswordCredentialTypeLiteral = sql.raw(
  `'${credentialTypeCodes.usernamePassword}'`,
);

export const users = sqliteTable(
  "Users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    email: text("email").notNull(),
    isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
    deactivatedAt: integer("deactivatedAt", { mode: "timestamp_ms" }),
    deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("Users_username_unique").on(table.username),
    uniqueIndex("Users_email_unique").on(table.email),
  ],
);

export const roles = sqliteTable("Roles", {
  code: text("code").primaryKey(),
  displayName: text("displayName").notNull(),
  description: text("description"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .default(nowTimestampExpression),
});

export const credentialTypes = sqliteTable("CredentialTypes", {
  code: text("code").primaryKey(),
  displayName: text("displayName").notNull(),
  description: text("description"),
  allowsMultiplePerUser: integer("allowsMultiplePerUser", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .default(nowTimestampExpression),
});

export const usersRoles = sqliteTable(
  "Users_Roles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    roleCode: text("roleCode")
      .notNull()
      .references(() => roles.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
  },
  (table) => [
    uniqueIndex("Users_Roles_userId_roleCode_unique").on(
      table.userId,
      table.roleCode,
    ),
  ],
);

export const usersCredentialTypes = sqliteTable(
  "Users_CredentialTypes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    credentialTypeCode: text("credentialTypeCode")
      .notNull()
      .references(() => credentialTypes.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    credentialLabel: text("credentialLabel"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
    revokedAt: integer("revokedAt", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("Users_CredentialTypes_password_singleton_unique")
      .on(table.userId)
      .where(sql`${table.credentialTypeCode} = ${usernamePasswordCredentialTypeLiteral}`),
  ],
);

export const usersPasswordCredentials = sqliteTable(
  "Users_PasswordCredentials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userCredentialTypeId: integer("userCredentialTypeId")
      .notNull()
      .references(() => usersCredentialTypes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    passwordHash: text("passwordHash").notNull(),
    passwordAlgorithm: text("passwordAlgorithm").notNull().default("argon2id"),
    passwordVersion: integer("passwordVersion").notNull().default(1),
    passwordUpdatedAt: integer("passwordUpdatedAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
  },
  (table) => [
    uniqueIndex("Users_PasswordCredentials_userCredentialTypeId_unique").on(
      table.userCredentialTypeId,
    ),
  ],
);

export const usersSessions = sqliteTable(
  "Users_Sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    sessionTokenHash: text("sessionTokenHash").notNull(),
    startTimestamp: integer("startTimestamp", { mode: "timestamp_ms" }).notNull(),
    expirationTimestamp: integer("expirationTimestamp", {
      mode: "timestamp_ms",
    }).notNull(),
    ipAddress: text("ipAddress").notNull(),
    location: text("location"),
    oauthAuthorizationCode: text("oauthAuthorizationCode"),
    oauthAccessToken: text("oauthAccessToken"),
    oauthRefreshToken: text("oauthRefreshToken"),
    revokedAt: integer("revokedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
  },
  (table) => [
    uniqueIndex("Users_Sessions_sessionTokenHash_unique").on(
      table.sessionTokenHash,
    ),
    check(
      "Users_Sessions_expirationTimestamp_after_startTimestamp_check",
      sql`${table.expirationTimestamp} > ${table.startTimestamp}`,
    ),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(usersRoles),
  credentialInstances: many(usersCredentialTypes),
  sessions: many(usersSessions),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(usersRoles),
}));

export const credentialTypesRelations = relations(
  credentialTypes,
  ({ many }) => ({
    userCredentialInstances: many(usersCredentialTypes),
  }),
);

export const usersRolesRelations = relations(usersRoles, ({ one }) => ({
  user: one(users, {
    fields: [usersRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [usersRoles.roleCode],
    references: [roles.code],
  }),
}));

export const usersCredentialTypesRelations = relations(
  usersCredentialTypes,
  ({ one, many }) => ({
    user: one(users, {
      fields: [usersCredentialTypes.userId],
      references: [users.id],
    }),
    credentialType: one(credentialTypes, {
      fields: [usersCredentialTypes.credentialTypeCode],
      references: [credentialTypes.code],
    }),
    passwordCredentials: many(usersPasswordCredentials),
  }),
);

export const usersPasswordCredentialsRelations = relations(
  usersPasswordCredentials,
  ({ one }) => ({
    userCredentialType: one(usersCredentialTypes, {
      fields: [usersPasswordCredentials.userCredentialTypeId],
      references: [usersCredentialTypes.id],
    }),
  }),
);

export const usersSessionsRelations = relations(usersSessions, ({ one }) => ({
  user: one(users, {
    fields: [usersSessions.userId],
    references: [users.id],
  }),
}));

export const authSeedData = {
  credentialTypes: [
    {
      code: credentialTypeCodes.usernamePassword,
      displayName: "Username and Password",
      description: "Primary username/password login credential.",
      allowsMultiplePerUser: false,
    },
  ],
  roles: [
    {
      code: roleCodes.projectManager,
      displayName: "Project Manager",
      description: "Standard project management access within Gigantt.",
    },
    {
      code: roleCodes.admin,
      displayName: "Administrator",
      description: "Full administrative access within Gigantt.",
    },
  ],
} as const;

export type AuthSeedData = typeof authSeedData;
