import { relations, sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import * as v3 from "../v3/schema.ts";

export * from "../v3/schema.ts";

export const scopedAccessObjectTypeCodes = {
  organization: "SCOPED_ACCESS_OBJECT_TYPE_ORGANIZATION",
  project: "SCOPED_ACCESS_OBJECT_TYPE_PROJECT",
  team: "SCOPED_ACCESS_OBJECT_TYPE_TEAM",
} as const;

const nowTimestampExpression = sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`;

function createTimestampColumns() {
  return {
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
  };
}

export const scopedAccessObjectTypes = sqliteTable("ScopedAccessObjectTypes", {
  code: text("code").primaryKey(),
  displayName: text("displayName").notNull(),
  description: text("description"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .default(nowTimestampExpression),
});

export const usersScopedAccessTokenCredentials = sqliteTable(
  "Users_ScopedAccessTokenCredentials",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerUserId: integer("ownerUserId")
      .notNull()
      .references(() => v3.users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    userCredentialTypeId: integer("userCredentialTypeId")
      .notNull()
      .references(() => v3.usersCredentialTypes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    tokenHash: text("tokenHash").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }),
    revokedAt: integer("revokedAt", { mode: "timestamp_ms" }),
    lastUsedAt: integer("lastUsedAt", { mode: "timestamp_ms" }),
    ...createTimestampColumns(),
  },
  (table) => [
    uniqueIndex("Users_ScopedAccessTokenCredentials_tokenHash_unique").on(table.tokenHash),
    uniqueIndex("Users_ScopedAccessTokenCredentials_userCredentialTypeId_unique").on(
      table.userCredentialTypeId,
    ),
  ],
);

export const scopedAccessTokenCredentialsObjects = sqliteTable(
  "ScopedAccessTokenCredentials_Objects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scopedAccessTokenCredentialId: integer("scopedAccessTokenCredentialId")
      .notNull()
      .references(() => usersScopedAccessTokenCredentials.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    scopedAccessObjectTypeCode: text("scopedAccessObjectTypeCode")
      .notNull()
      .references(() => scopedAccessObjectTypes.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    scopedAccessObjectId: integer("scopedAccessObjectId").notNull(),
    ...createTimestampColumns(),
  },
  (table) => [
    uniqueIndex(
      "ScopedAccessTokenCredentials_Objects_tokenCredentialId_objectTypeCode_objectId_unique",
    ).on(
      table.scopedAccessTokenCredentialId,
      table.scopedAccessObjectTypeCode,
      table.scopedAccessObjectId,
    ),
  ],
);

export const scopedAccessObjectTypesRelations = relations(
  scopedAccessObjectTypes,
  ({ many }) => ({
    tokenCredentialObjects: many(scopedAccessTokenCredentialsObjects),
  }),
);

export const usersScopedAccessTokenCredentialsRelations = relations(
  usersScopedAccessTokenCredentials,
  ({ many, one }) => ({
    ownerUser: one(v3.users, {
      fields: [usersScopedAccessTokenCredentials.ownerUserId],
      references: [v3.users.id],
    }),
    scopedAccessObjects: many(scopedAccessTokenCredentialsObjects),
    userCredentialType: one(v3.usersCredentialTypes, {
      fields: [usersScopedAccessTokenCredentials.userCredentialTypeId],
      references: [v3.usersCredentialTypes.id],
    }),
  }),
);

export const scopedAccessTokenCredentialsObjectsRelations = relations(
  scopedAccessTokenCredentialsObjects,
  ({ one }) => ({
    objectType: one(scopedAccessObjectTypes, {
      fields: [scopedAccessTokenCredentialsObjects.scopedAccessObjectTypeCode],
      references: [scopedAccessObjectTypes.code],
    }),
    scopedAccessTokenCredential: one(usersScopedAccessTokenCredentials, {
      fields: [scopedAccessTokenCredentialsObjects.scopedAccessTokenCredentialId],
      references: [usersScopedAccessTokenCredentials.id],
    }),
  }),
);

