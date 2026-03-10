import { relations, sql } from "drizzle-orm";
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const credentialTypeCodes = {
  usernamePassword: "GGTC_CREDTYPE_USERNAME_PASSWORD",
} as const;

export const projectRoleCodes = {
  projectManager: "GGTC_PROJECTROLE_PROJECT_MANAGER",
} as const;

export const systemRoleCodes = {
  admin: "GGTC_SYSTEMROLE_ADMIN",
} as const;

export const organizationRoleCodes = {
  organizationManager: "GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER",
  projectManager: "GGTC_ORGANIZATIONROLE_PROJECT_MANAGER",
  teamManager: "GGTC_ORGANIZATIONROLE_TEAM_MANAGER",
} as const;

export const issueStatusCodes = {
  blocked: "ISSUE_STATUS_BLOCKED",
  closed: "ISSUE_STATUS_CLOSED",
  inProgress: "ISSUE_STATUS_IN_PROGRESS",
  open: "ISSUE_STATUS_OPEN",
} as const;

export const closedReasonCodes = {
  cantFix: "ISSUE_CLOSED_REASON_CANTFIX",
  resolved: "ISSUE_CLOSED_REASON_RESOLVED",
  wontFix: "ISSUE_CLOSED_REASON_WONTFIX",
} as const;

export const teamRoleCodes = {
  projectManager: "GGTC_TEAMROLE_PROJECT_MANAGER",
  teamManager: "GGTC_TEAMROLE_TEAM_MANAGER",
} as const;

const nowTimestampExpression = sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`;
const issuePriorityMinimum = 0;
const issuePriorityMinimumLiteral = sql.raw(`${issuePriorityMinimum}`);
const issueProgressPercentageMaximum = 100;
const issueProgressPercentageMaximumLiteral = sql.raw(
  `${issueProgressPercentageMaximum}`,
);
const usernamePasswordCredentialTypeLiteral = sql.raw(
  `'${credentialTypeCodes.usernamePassword}'`,
);

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

function createReferenceTimestampColumns() {
  return {
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
  };
}

function createCodeReferenceTable(tableName: string) {
  return sqliteTable(tableName, {
    code: text("code").primaryKey(),
    displayName: text("displayName").notNull(),
    description: text("description"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
  });
}

export const users = sqliteTable(
  "Users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    email: text("email").notNull(),
    isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
    ...createTimestampColumns(),
    deactivatedAt: integer("deactivatedAt", { mode: "timestamp_ms" }),
    deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("Users_username_unique").on(table.username),
    uniqueIndex("Users_email_unique").on(table.email),
  ],
);

export const projects = sqliteTable("Projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  ...createTimestampColumns(),
});

export const teams = sqliteTable("Teams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  ...createTimestampColumns(),
});

export const organizations = sqliteTable("Organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  ...createTimestampColumns(),
});

export const systemRoles = createCodeReferenceTable("SystemRoles");
export const projectRoles = createCodeReferenceTable("ProjectRoles");
export const teamRoles = createCodeReferenceTable("TeamRoles");
export const organizationRoles = createCodeReferenceTable("OrganizationRoles");
export const issueStatuses = createCodeReferenceTable("IssueStatuses");
export const closedReasons = createCodeReferenceTable("ClosedReasons");

export const issues = sqliteTable(
  "Issues",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("projectId")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    description: text("description"),
    journal: text("journal"),
    priority: integer("priority").notNull().default(issuePriorityMinimum),
    status: text("status")
      .notNull()
      .references(() => issueStatuses.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      })
      .default(issueStatusCodes.open),
    closedReason: text("closedReason").references(() => closedReasons.code, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
    progressPercentage: integer("progressPercentage").notNull().default(0),
    openedAt: integer("openedAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
    closedAt: integer("closedAt", { mode: "timestamp_ms" }),
    closedReasonDescription: text("closedReasonDescription"),
    ...createTimestampColumns(),
  },
  (table) => [
    check(
      "Issues_priority_non_negative_check",
      sql`${table.priority} >= ${issuePriorityMinimumLiteral}`,
    ),
    check(
      "Issues_progressPercentage_range_check",
      sql`${table.progressPercentage} >= 0 AND ${table.progressPercentage} <= ${issueProgressPercentageMaximumLiteral}`,
    ),
  ],
);

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

export const projectsUsers = sqliteTable(
  "Projects_Users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("projectId")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ...createReferenceTimestampColumns(),
  },
  (table) => [
    uniqueIndex("Projects_Users_projectId_userId_unique").on(
      table.projectId,
      table.userId,
    ),
  ],
);

export const teamsUsers = sqliteTable(
  "Teams_Users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    teamId: integer("teamId")
      .notNull()
      .references(() => teams.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ...createReferenceTimestampColumns(),
  },
  (table) => [
    uniqueIndex("Teams_Users_teamId_userId_unique").on(
      table.teamId,
      table.userId,
    ),
  ],
);

export const projectsTeams = sqliteTable(
  "Projects_Teams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("projectId")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    teamId: integer("teamId")
      .notNull()
      .references(() => teams.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ...createReferenceTimestampColumns(),
  },
  (table) => [
    uniqueIndex("Projects_Teams_projectId_teamId_unique").on(
      table.projectId,
      table.teamId,
    ),
  ],
);

export const usersOrganizations = sqliteTable(
  "Users_Organizations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ...createReferenceTimestampColumns(),
  },
  (table) => [
    uniqueIndex("Users_Organizations_organizationId_userId_unique").on(
      table.organizationId,
      table.userId,
    ),
  ],
);

export const projectsOrganizations = sqliteTable(
  "Projects_Organizations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    projectId: integer("projectId")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ...createReferenceTimestampColumns(),
  },
  (table) => [
    uniqueIndex("Projects_Organizations_organizationId_projectId_unique").on(
      table.organizationId,
      table.projectId,
    ),
  ],
);

export const organizationsTeams = sqliteTable(
  "Organizations_Teams",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    teamId: integer("teamId")
      .notNull()
      .references(() => teams.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ...createReferenceTimestampColumns(),
  },
  (table) => [
    uniqueIndex("Organizations_Teams_organizationId_teamId_unique").on(
      table.organizationId,
      table.teamId,
    ),
    uniqueIndex("Organizations_Teams_teamId_unique").on(table.teamId),
  ],
);

export const usersSystemRoles = sqliteTable(
  "Users_SystemRoles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    roleCode: text("roleCode")
      .notNull()
      .references(() => systemRoles.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    ...createReferenceTimestampColumns(),
  },
  (table) => [
    uniqueIndex("Users_SystemRoles_userId_roleCode_unique").on(
      table.userId,
      table.roleCode,
    ),
  ],
);

export const usersProjectsProjectRoles = sqliteTable(
  "Users_Projects_ProjectRoles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    projectId: integer("projectId")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    roleCode: text("roleCode")
      .notNull()
      .references(() => projectRoles.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    ...createReferenceTimestampColumns(),
  },
  (table) => [
    uniqueIndex("Users_Projects_ProjectRoles_userId_projectId_roleCode_unique")
      .on(table.userId, table.projectId, table.roleCode),
  ],
);

export const usersTeamsTeamRoles = sqliteTable(
  "Users_Teams_TeamRoles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    teamId: integer("teamId")
      .notNull()
      .references(() => teams.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    roleCode: text("roleCode")
      .notNull()
      .references(() => teamRoles.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    ...createReferenceTimestampColumns(),
  },
  (table) => [
    uniqueIndex("Users_Teams_TeamRoles_userId_teamId_roleCode_unique")
      .on(table.userId, table.teamId, table.roleCode),
  ],
);

export const usersOrganizationsOrganizationRoles = sqliteTable(
  "Users_Organizations_OrganizationRoles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    roleCode: text("roleCode")
      .notNull()
      .references(() => organizationRoles.code, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    ...createReferenceTimestampColumns(),
  },
  (table) => [
    uniqueIndex(
      "Users_Organizations_OrganizationRoles_userId_organizationId_roleCode_unique",
    ).on(table.userId, table.organizationId, table.roleCode),
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
    ...createTimestampColumns(),
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
    ...createTimestampColumns(),
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
    ...createTimestampColumns(),
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
  credentialInstances: many(usersCredentialTypes),
  organizationMemberships: many(usersOrganizations),
  organizationRoleAssignments: many(usersOrganizationsOrganizationRoles),
  projectAccess: many(projectsUsers),
  projectRoleAssignments: many(usersProjectsProjectRoles),
  sessions: many(usersSessions),
  systemRoleAssignments: many(usersSystemRoles),
  teamMemberships: many(teamsUsers),
  teamRoleAssignments: many(usersTeamsTeamRoles),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  issues: many(issues),
  organizationAccess: many(projectsOrganizations),
  teamAccess: many(projectsTeams),
  userAccess: many(projectsUsers),
  userRoleAssignments: many(usersProjectsProjectRoles),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  organizationAccess: many(organizationsTeams),
  projectAccess: many(projectsTeams),
  userMemberships: many(teamsUsers),
  userRoleAssignments: many(usersTeamsTeamRoles),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  projectAccess: many(projectsOrganizations),
  teamAccess: many(organizationsTeams),
  userMemberships: many(usersOrganizations),
  userRoleAssignments: many(usersOrganizationsOrganizationRoles),
}));

export const systemRolesRelations = relations(systemRoles, ({ many }) => ({
  userRoleAssignments: many(usersSystemRoles),
}));

export const projectRolesRelations = relations(projectRoles, ({ many }) => ({
  userRoleAssignments: many(usersProjectsProjectRoles),
}));

export const teamRolesRelations = relations(teamRoles, ({ many }) => ({
  userRoleAssignments: many(usersTeamsTeamRoles),
}));

export const organizationRolesRelations = relations(
  organizationRoles,
  ({ many }) => ({
    userRoleAssignments: many(usersOrganizationsOrganizationRoles),
  }),
);

export const issueStatusesRelations = relations(issueStatuses, ({ many }) => ({
  issues: many(issues),
}));

export const closedReasonsRelations = relations(closedReasons, ({ many }) => ({
  issues: many(issues),
}));

export const credentialTypesRelations = relations(
  credentialTypes,
  ({ many }) => ({
    userCredentialInstances: many(usersCredentialTypes),
  }),
);

export const projectsUsersRelations = relations(projectsUsers, ({ one }) => ({
  project: one(projects, {
    fields: [projectsUsers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectsUsers.userId],
    references: [users.id],
  }),
}));

export const teamsUsersRelations = relations(teamsUsers, ({ one }) => ({
  team: one(teams, {
    fields: [teamsUsers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamsUsers.userId],
    references: [users.id],
  }),
}));

export const projectsTeamsRelations = relations(projectsTeams, ({ one }) => ({
  project: one(projects, {
    fields: [projectsTeams.projectId],
    references: [projects.id],
  }),
  team: one(teams, {
    fields: [projectsTeams.teamId],
    references: [teams.id],
  }),
}));

export const usersOrganizationsRelations = relations(
  usersOrganizations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [usersOrganizations.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [usersOrganizations.userId],
      references: [users.id],
    }),
  }),
);

export const projectsOrganizationsRelations = relations(
  projectsOrganizations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [projectsOrganizations.organizationId],
      references: [organizations.id],
    }),
    project: one(projects, {
      fields: [projectsOrganizations.projectId],
      references: [projects.id],
    }),
  }),
);

export const organizationsTeamsRelations = relations(
  organizationsTeams,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationsTeams.organizationId],
      references: [organizations.id],
    }),
    team: one(teams, {
      fields: [organizationsTeams.teamId],
      references: [teams.id],
    }),
  }),
);

export const usersSystemRolesRelations = relations(
  usersSystemRoles,
  ({ one }) => ({
    role: one(systemRoles, {
      fields: [usersSystemRoles.roleCode],
      references: [systemRoles.code],
    }),
    user: one(users, {
      fields: [usersSystemRoles.userId],
      references: [users.id],
    }),
  }),
);

export const usersProjectsProjectRolesRelations = relations(
  usersProjectsProjectRoles,
  ({ one }) => ({
    project: one(projects, {
      fields: [usersProjectsProjectRoles.projectId],
      references: [projects.id],
    }),
    role: one(projectRoles, {
      fields: [usersProjectsProjectRoles.roleCode],
      references: [projectRoles.code],
    }),
    user: one(users, {
      fields: [usersProjectsProjectRoles.userId],
      references: [users.id],
    }),
  }),
);

export const usersTeamsTeamRolesRelations = relations(
  usersTeamsTeamRoles,
  ({ one }) => ({
    role: one(teamRoles, {
      fields: [usersTeamsTeamRoles.roleCode],
      references: [teamRoles.code],
    }),
    team: one(teams, {
      fields: [usersTeamsTeamRoles.teamId],
      references: [teams.id],
    }),
    user: one(users, {
      fields: [usersTeamsTeamRoles.userId],
      references: [users.id],
    }),
  }),
);

export const usersOrganizationsOrganizationRolesRelations = relations(
  usersOrganizationsOrganizationRoles,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [usersOrganizationsOrganizationRoles.organizationId],
      references: [organizations.id],
    }),
    role: one(organizationRoles, {
      fields: [usersOrganizationsOrganizationRoles.roleCode],
      references: [organizationRoles.code],
    }),
    user: one(users, {
      fields: [usersOrganizationsOrganizationRoles.userId],
      references: [users.id],
    }),
  }),
);

export const usersCredentialTypesRelations = relations(
  usersCredentialTypes,
  ({ many, one }) => ({
    credentialType: one(credentialTypes, {
      fields: [usersCredentialTypes.credentialTypeCode],
      references: [credentialTypes.code],
    }),
    passwordCredentials: many(usersPasswordCredentials),
    user: one(users, {
      fields: [usersCredentialTypes.userId],
      references: [users.id],
    }),
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

export const issuesRelations = relations(issues, ({ one }) => ({
  closedReasonReference: one(closedReasons, {
    fields: [issues.closedReason],
    references: [closedReasons.code],
  }),
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  statusReference: one(issueStatuses, {
    fields: [issues.status],
    references: [issueStatuses.code],
  }),
}));

export const authSeedData = {
  credentialTypes: [
    {
      allowsMultiplePerUser: false,
      code: credentialTypeCodes.usernamePassword,
      description: "Primary username/password login credential.",
      displayName: "Username and Password",
    },
  ],
  projectRoles: [
    {
      code: projectRoleCodes.projectManager,
      description: "Project-scoped project management access within Giganttic.",
      displayName: "Project Manager",
    },
  ],
  organizationRoles: [
    {
      code: organizationRoleCodes.organizationManager,
      description: "Organization-scoped organization management access within Giganttic.",
      displayName: "Organization Manager",
    },
    {
      code: organizationRoleCodes.projectManager,
      description:
        "Organization-scoped project management authority for projects associated to the organization.",
      displayName: "Project Manager",
    },
    {
      code: organizationRoleCodes.teamManager,
      description:
        "Organization-scoped team management authority for teams assigned to the organization.",
      displayName: "Team Manager",
    },
  ],
  issueStatuses: [
    {
      code: issueStatusCodes.open,
      description: "Issue is open and actionable.",
      displayName: "Open",
    },
    {
      code: issueStatusCodes.inProgress,
      description: "Issue is actively being worked on.",
      displayName: "In Progress",
    },
    {
      code: issueStatusCodes.closed,
      description: "Issue has been closed.",
      displayName: "Closed",
    },
    {
      code: issueStatusCodes.blocked,
      description: "Issue is blocked pending external resolution.",
      displayName: "Blocked",
    },
  ],
  closedReasons: [
    {
      code: closedReasonCodes.wontFix,
      description: "Issue will not be fixed by product decision.",
      displayName: "Won't Fix",
    },
    {
      code: closedReasonCodes.cantFix,
      description: "Issue cannot be fixed within the current system constraints.",
      displayName: "Can't Fix",
    },
    {
      code: closedReasonCodes.resolved,
      description: "Issue has been resolved.",
      displayName: "Resolved",
    },
  ],
  systemRoles: [
    {
      code: systemRoleCodes.admin,
      description: "Full administrative access within Giganttic.",
      displayName: "Administrator",
    },
  ],
  teamRoles: [
    {
      code: teamRoleCodes.teamManager,
      description: "Team-scoped team management access within Giganttic.",
      displayName: "Team Manager",
    },
    {
      code: teamRoleCodes.projectManager,
      description:
        "Team-scoped project management authority for projects reachable through the team.",
      displayName: "Project Manager",
    },
  ],
} as const;

export type AuthSeedData = typeof authSeedData;
