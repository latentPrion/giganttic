import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Full v7 schema: v6 plus project attachments and file-backed journals.

export const credentialTypeCodes = {
  scopedAccessToken: "CREDTYPE_SCOPED_ACCESS_TOKEN",
  usernamePassword: "GGTC_CREDTYPE_USERNAME_PASSWORD",
} as const;

export const projectRoleCodes = {
  projectManager: "GGTC_PROJECTROLE_PROJECT_MANAGER",
  projectOwner: "GGTC_PROJECTROLE_PROJECT_OWNER",
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

export enum IssuePriorityCode {
  ISSUE_PRIORITY_LOW = 0,
  ISSUE_PRIORITY_MEDIUM = 1,
  ISSUE_PRIORITY_HIGH = 2,
  ISSUE_PRIORITY_URGENT = 3,
}

export const issuePriorityValues = [
  IssuePriorityCode.ISSUE_PRIORITY_LOW,
  IssuePriorityCode.ISSUE_PRIORITY_MEDIUM,
  IssuePriorityCode.ISSUE_PRIORITY_HIGH,
  IssuePriorityCode.ISSUE_PRIORITY_URGENT,
] as const;

export const issuePriorityLabels: Record<IssuePriorityCode, string> = {
  [IssuePriorityCode.ISSUE_PRIORITY_LOW]: "Low",
  [IssuePriorityCode.ISSUE_PRIORITY_MEDIUM]: "Medium",
  [IssuePriorityCode.ISSUE_PRIORITY_HIGH]: "High",
  [IssuePriorityCode.ISSUE_PRIORITY_URGENT]: "Urgent",
};

export const closedReasonCodes = {
  cantFix: "ISSUE_CLOSED_REASON_CANTFIX",
  resolved: "ISSUE_CLOSED_REASON_RESOLVED",
  wontFix: "ISSUE_CLOSED_REASON_WONTFIX",
} as const;

export const mentionContainerTypeCodes = {
  issueComment: "MENTION_CONTAINER_ISSUE_COMMENT",
  issueJournal: "MENTION_CONTAINER_ISSUE_JOURNAL",
  projectJournal: "MENTION_CONTAINER_PROJECT_JOURNAL",
  taskComment: "MENTION_CONTAINER_TASK_COMMENT",
  taskJournal: "MENTION_CONTAINER_TASK_JOURNAL",
} as const;

export const teamRoleCodes = {
  projectManager: "GGTC_TEAMROLE_PROJECT_MANAGER",
  teamManager: "GGTC_TEAMROLE_TEAM_MANAGER",
} as const;

const nowTimestampExpression = sql`(CAST(unixepoch('subsec') * 1000 AS INTEGER))`;
export const issuePriorityMinimum = IssuePriorityCode.ISSUE_PRIORITY_LOW;
export const issuePriorityMaximum = IssuePriorityCode.ISSUE_PRIORITY_URGENT;
const issuePriorityMinimumLiteral = sql.raw(`${issuePriorityMinimum}`);
const issuePriorityMaximumLiteral = sql.raw(`${issuePriorityMaximum}`);
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
  reusableV7ProjectsJournal: text("reusable-v7-projects-journal"),
  ...createTimestampColumns(),
});

export const projectGanttCharts = sqliteTable(
  "ProjectGanttCharts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("projectId")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    chartId: integer("chartId").notNull().default(0),
    name: text("name").notNull().default("default"),
    ...createTimestampColumns(),
  },
  (table) => [
    uniqueIndex("ProjectGanttCharts_projectId_chartId_unique").on(
      table.projectId,
      table.chartId,
    ),
  ],
);

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
    reusableV7IssuesJournal: text("reusable-v7-issues-journal"),
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
      "Issues_priority_range_check",
      sql`${table.priority} >= ${issuePriorityMinimumLiteral} AND ${table.priority} <= ${issuePriorityMaximumLiteral}`,
    ),
    check(
      "Issues_progressPercentage_range_check",
      sql`${table.progressPercentage} >= 0 AND ${table.progressPercentage} <= ${issueProgressPercentageMaximumLiteral}`,
    ),
  ],
);

export const attachments = sqliteTable("Attachments", {
  id: text("id").primaryKey(),
  originalFilename: text("originalFilename").notNull(),
  byteLength: integer("byteLength").notNull(),
  contentHash: text("contentHash").notNull(),
  uploadedAt: integer("uploadedAt", { mode: "timestamp_ms" })
    .notNull()
    .default(nowTimestampExpression),
  uploadedByUserId: integer("uploadedByUserId")
    .notNull()
    .references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  ...createTimestampColumns(),
});

export const issuesAttachments = sqliteTable(
  "Issues_Attachments",
  {
    issueId: integer("issueId")
      .notNull()
      .references(() => issues.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    attachmentId: text("attachmentId")
      .notNull()
      .references(() => attachments.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [primaryKey({ columns: [table.issueId, table.attachmentId] })],
);

export const projectsAttachments = sqliteTable(
  "Projects_Attachments",
  {
    projectId: integer("projectId")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    attachmentId: text("attachmentId")
      .notNull()
      .references(() => attachments.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.attachmentId] })],
);

export const issueComments = sqliteTable("IssueComments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  issueId: integer("issueId")
    .notNull()
    .references(() => issues.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  createdByUserId: integer("createdByUserId")
    .notNull()
    .references(() => users.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  parentCommentId: integer("parentCommentId"),
  thumbsUpCount: integer("thumbsUpCount").notNull().default(0),
  thumbsDownCount: integer("thumbsDownCount").notNull().default(0),
  ...createTimestampColumns(),
});

export const issueCommentsAttachments = sqliteTable(
  "IssueComments_Attachments",
  {
    issueId: integer("issueId")
      .notNull()
      .references(() => issues.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    commentId: integer("commentId")
      .notNull()
      .references(() => issueComments.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    attachmentId: text("attachmentId")
      .notNull()
      .references(() => attachments.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [
    primaryKey({ columns: [table.issueId, table.commentId, table.attachmentId] }),
  ],
);

export const taskMirror = sqliteTable(
  "TaskMirror",
  {
    projectGanttChartId: integer("projectGanttChartId")
      .notNull()
      .references(() => projectGanttCharts.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    taskId: text("taskId").notNull(),
    ...createTimestampColumns(),
  },
  (table) => [primaryKey({ columns: [table.projectGanttChartId, table.taskId] })],
);

export const taskAttachments = sqliteTable(
  "TaskAttachments",
  {
    projectGanttChartId: integer("projectGanttChartId")
      .notNull()
      .references(() => projectGanttCharts.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    taskId: text("taskId").notNull(),
    attachmentId: text("attachmentId")
      .notNull()
      .references(() => attachments.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [
    primaryKey({ columns: [table.projectGanttChartId, table.taskId, table.attachmentId] }),
    foreignKey({
      columns: [table.projectGanttChartId, table.taskId],
      foreignColumns: [taskMirror.projectGanttChartId, taskMirror.taskId],
      name: "TaskAttachments_projectGanttChartId_taskId_TaskMirror_projectGanttChartId_taskId_fk",
    }).onDelete("cascade").onUpdate("cascade"),
  ],
);

export const taskComments = sqliteTable(
  "TaskComments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectGanttChartId: integer("projectGanttChartId")
      .notNull()
      .references(() => projectGanttCharts.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    taskId: text("taskId").notNull(),
    createdByUserId: integer("createdByUserId")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    parentCommentId: integer("parentCommentId"),
    thumbsUpCount: integer("thumbsUpCount").notNull().default(0),
    thumbsDownCount: integer("thumbsDownCount").notNull().default(0),
    ...createTimestampColumns(),
  },
  (table) => [
    foreignKey({
      columns: [table.projectGanttChartId, table.taskId],
      foreignColumns: [taskMirror.projectGanttChartId, taskMirror.taskId],
      name: "TaskComments_projectGanttChartId_taskId_TaskMirror_projectGanttChartId_taskId_fk",
    }).onDelete("cascade").onUpdate("cascade"),
  ],
);

export const taskCommentsAttachments = sqliteTable(
  "TaskComments_Attachments",
  {
    projectGanttChartId: integer("projectGanttChartId")
      .notNull()
      .references(() => projectGanttCharts.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    taskId: text("taskId").notNull(),
    commentId: integer("commentId")
      .notNull()
      .references(() => taskComments.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    attachmentId: text("attachmentId")
      .notNull()
      .references(() => attachments.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.projectGanttChartId, table.taskId, table.commentId, table.attachmentId],
    }),
    foreignKey({
      columns: [table.projectGanttChartId, table.taskId],
      foreignColumns: [taskMirror.projectGanttChartId, taskMirror.taskId],
      name: "TaskComments_Attachments_projectGanttChartId_taskId_TaskMirror_projectGanttChartId_taskId_fk",
    }).onDelete("cascade").onUpdate("cascade"),
  ],
);

export const notifications = sqliteTable(
  "Notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventType: text("eventType").notNull(),
    actorUserId: integer("actorUserId")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    projectId: integer("projectId")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    issueId: integer("issueId").references(() => issues.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    taskId: text("taskId"),
    commentId: integer("commentId"),
    attachmentId: text("attachmentId").references(() => attachments.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    mentionedUserId: integer("mentionedUserId").references(() => users.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    message: text("message").notNull(),
    targetUrl: text("targetUrl").notNull(),
    ...createTimestampColumns(),
  },
  (table) => [
    index("Notifications_eventType_createdAt_idx").on(table.eventType, table.createdAt),
    index("Notifications_projectId_createdAt_idx").on(table.projectId, table.createdAt),
    index("Notifications_commentId_mentionedUserId_idx").on(
      table.commentId,
      table.mentionedUserId,
    ),
  ],
);

export const usersNotifications = sqliteTable(
  "Users_Notifications",
  {
    userId: integer("userId")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    notificationId: integer("notificationId")
      .notNull()
      .references(() => notifications.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    hasBeenNoticed: integer("hasBeenNoticed", { mode: "boolean" })
      .notNull()
      .default(false),
    noticedTimestamp: integer("noticedTimestamp", { mode: "timestamp_ms" }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.notificationId] }),
    index("Users_Notifications_userId_hasBeenNoticed_notificationId_idx").on(
      table.userId,
      table.hasBeenNoticed,
      table.notificationId,
    ),
    index("Users_Notifications_notificationId_idx").on(table.notificationId),
  ],
);

export const mentions = sqliteTable(
  "Mentions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    speakerUserId: integer("speakerUserId")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    mentionedUserId: integer("mentionedUserId")
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
    issueId: integer("issueId").references(() => issues.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    taskId: text("taskId"),
    commentId: integer("commentId"),
    mentionContainerType: text("mentionContainerType").notNull(),
    containerKey: text("containerKey").notNull(),
    ...createTimestampColumns(),
  },
  (table) => [
    uniqueIndex(
      "Mentions_mentionedUserId_mentionContainerType_containerKey_unique",
    ).on(
      table.mentionedUserId,
      table.mentionContainerType,
      table.containerKey,
    ),
    index("Mentions_containerKey_idx").on(table.containerKey),
    index("Mentions_projectId_issueId_taskId_commentId_idx").on(
      table.projectId,
      table.issueId,
      table.taskId,
      table.commentId,
    ),
    index("Mentions_mentionedUserId_idx").on(table.mentionedUserId),
  ],
);

export const managedTestDataRecords = sqliteTable(
  "ManagedTestDataRecords",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    seedKey: text("seedKey").notNull(),
    entityTable: text("entityTable").notNull(),
    entityId: integer("entityId").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" })
      .notNull()
      .default(nowTimestampExpression),
  },
  (table) => [
    uniqueIndex("ManagedTestDataRecords_seedKey_unique").on(table.seedKey),
    uniqueIndex("ManagedTestDataRecords_entityTable_entityId_unique").on(
      table.entityTable,
      table.entityId,
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
    authSourceCredentialTypeCode: text("authSourceCredentialTypeCode"),
    authSourceCredentialId: integer("authSourceCredentialId"),
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


export const scopedAccessObjectTypeCodes = {
  organization: "SCOPED_ACCESS_OBJECT_TYPE_ORGANIZATION",
  project: "SCOPED_ACCESS_OBJECT_TYPE_PROJECT",
  team: "SCOPED_ACCESS_OBJECT_TYPE_TEAM",
} as const;

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
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    userCredentialTypeId: integer("userCredentialTypeId")
      .notNull()
      .references(() => usersCredentialTypes.id, {
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

export const usersRelations = relations(users, ({ many }) => ({
  credentialInstances: many(usersCredentialTypes),
  notificationEvents: many(notifications, { relationName: "notificationActor" }),
  notificationDeliveries: many(usersNotifications),
  organizationMemberships: many(usersOrganizations),
  organizationRoleAssignments: many(usersOrganizationsOrganizationRoles),
  projectAccess: many(projectsUsers),
  projectRoleAssignments: many(usersProjectsProjectRoles),
  scopedAccessTokenCredentials: many(usersScopedAccessTokenCredentials),
  sessions: many(usersSessions),
  systemRoleAssignments: many(usersSystemRoles),
  taskComments: many(taskComments),
  teamMemberships: many(teamsUsers),
  teamRoleAssignments: many(usersTeamsTeamRoles),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  issues: many(issues),
  notifications: many(notifications),
  organizationAccess: many(projectsOrganizations),
  projectGanttCharts: many(projectGanttCharts),
  projectAttachments: many(projectsAttachments),
  taskMirrorEntries: many(taskMirror),
  teamAccess: many(projectsTeams),
  userAccess: many(projectsUsers),
  userRoleAssignments: many(usersProjectsProjectRoles),
}));

export const projectGanttChartsRelations = relations(
  projectGanttCharts,
  ({ many, one }) => ({
    project: one(projects, {
      fields: [projectGanttCharts.projectId],
      references: [projects.id],
    }),
    taskMirrorEntries: many(taskMirror),
  }),
);

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
    scopedAccessTokenCredentials: many(usersScopedAccessTokenCredentials),
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


export const scopedAccessObjectTypesRelations = relations(
  scopedAccessObjectTypes,
  ({ many }) => ({
    tokenCredentialObjects: many(scopedAccessTokenCredentialsObjects),
  }),
);

export const usersScopedAccessTokenCredentialsRelations = relations(
  usersScopedAccessTokenCredentials,
  ({ many, one }) => ({
    ownerUser: one(users, {
      fields: [usersScopedAccessTokenCredentials.ownerUserId],
      references: [users.id],
    }),
    scopedAccessObjects: many(scopedAccessTokenCredentialsObjects),
    userCredentialType: one(usersCredentialTypes, {
      fields: [usersScopedAccessTokenCredentials.userCredentialTypeId],
      references: [usersCredentialTypes.id],
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

export const issuesRelations = relations(issues, ({ one, many }) => ({
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
  issueComments: many(issueComments),
  issuesAttachments: many(issuesAttachments),
  notifications: many(notifications),
}));

export const attachmentsRelations = relations(attachments, ({ one, many }) => ({
  uploadedByUser: one(users, {
    fields: [attachments.uploadedByUserId],
    references: [users.id],
  }),
  projectsAttachments: many(projectsAttachments),
  issuesAttachments: many(issuesAttachments),
  issueCommentsAttachments: many(issueCommentsAttachments),
  taskAttachments: many(taskAttachments),
  taskCommentsAttachments: many(taskCommentsAttachments),
  notifications: many(notifications),
}));

export const projectsAttachmentsRelations = relations(
  projectsAttachments,
  ({ one }) => ({
    attachment: one(attachments, {
      fields: [projectsAttachments.attachmentId],
      references: [attachments.id],
    }),
    project: one(projects, {
      fields: [projectsAttachments.projectId],
      references: [projects.id],
    }),
  }),
);

export const issuesAttachmentsRelations = relations(issuesAttachments, ({ one }) => ({
  issue: one(issues, {
    fields: [issuesAttachments.issueId],
    references: [issues.id],
  }),
  attachment: one(attachments, {
    fields: [issuesAttachments.attachmentId],
    references: [attachments.id],
  }),
}));

export const issueCommentsRelations = relations(issueComments, ({ one, many }) => ({
  issue: one(issues, {
    fields: [issueComments.issueId],
    references: [issues.id],
  }),
  createdByUser: one(users, {
    fields: [issueComments.createdByUserId],
    references: [users.id],
  }),
  parentComment: one(issueComments, {
    fields: [issueComments.parentCommentId],
    references: [issueComments.id],
    relationName: "issueCommentParent",
  }),
  replies: many(issueComments, { relationName: "issueCommentParent" }),
  issueCommentsAttachments: many(issueCommentsAttachments),
}));

export const issueCommentsAttachmentsRelations = relations(
  issueCommentsAttachments,
  ({ one }) => ({
    issue: one(issues, {
      fields: [issueCommentsAttachments.issueId],
      references: [issues.id],
    }),
    comment: one(issueComments, {
      fields: [issueCommentsAttachments.commentId],
      references: [issueComments.id],
    }),
    attachment: one(attachments, {
      fields: [issueCommentsAttachments.attachmentId],
      references: [attachments.id],
    }),
  }),
);

export const taskMirrorRelations = relations(taskMirror, ({ many, one }) => ({
  projectGanttChart: one(projectGanttCharts, {
    fields: [taskMirror.projectGanttChartId],
    references: [projectGanttCharts.id],
  }),
  taskAttachments: many(taskAttachments),
  taskComments: many(taskComments),
  taskCommentsAttachments: many(taskCommentsAttachments),
}));

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
  attachment: one(attachments, {
    fields: [taskAttachments.attachmentId],
    references: [attachments.id],
  }),
  taskMirror: one(taskMirror, {
    fields: [taskAttachments.projectGanttChartId, taskAttachments.taskId],
    references: [taskMirror.projectGanttChartId, taskMirror.taskId],
  }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [taskComments.createdByUserId],
    references: [users.id],
  }),
  parentComment: one(taskComments, {
    fields: [taskComments.parentCommentId],
    references: [taskComments.id],
    relationName: "taskCommentParent",
  }),
  replies: many(taskComments, { relationName: "taskCommentParent" }),
  taskCommentsAttachments: many(taskCommentsAttachments),
  taskMirror: one(taskMirror, {
    fields: [taskComments.projectGanttChartId, taskComments.taskId],
    references: [taskMirror.projectGanttChartId, taskMirror.taskId],
  }),
}));

export const taskCommentsAttachmentsRelations = relations(
  taskCommentsAttachments,
  ({ one }) => ({
    attachment: one(attachments, {
      fields: [taskCommentsAttachments.attachmentId],
      references: [attachments.id],
    }),
    comment: one(taskComments, {
      fields: [taskCommentsAttachments.commentId],
      references: [taskComments.id],
    }),
    taskMirror: one(taskMirror, {
      fields: [taskCommentsAttachments.projectGanttChartId, taskCommentsAttachments.taskId],
      references: [taskMirror.projectGanttChartId, taskMirror.taskId],
    }),
  }),
);

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  actorUser: one(users, {
    fields: [notifications.actorUserId],
    references: [users.id],
    relationName: "notificationActor",
  }),
  attachment: one(attachments, {
    fields: [notifications.attachmentId],
    references: [attachments.id],
  }),
  issue: one(issues, {
    fields: [notifications.issueId],
    references: [issues.id],
  }),
  project: one(projects, {
    fields: [notifications.projectId],
    references: [projects.id],
  }),
  mentionedUser: one(users, {
    fields: [notifications.mentionedUserId],
    references: [users.id],
    relationName: "notificationMentionedUser",
  }),
  userNotifications: many(usersNotifications),
}));

export const usersNotificationsRelations = relations(usersNotifications, ({ one }) => ({
  notification: one(notifications, {
    fields: [usersNotifications.notificationId],
    references: [notifications.id],
  }),
  user: one(users, {
    fields: [usersNotifications.userId],
    references: [users.id],
  }),
}));

export const mentionsRelations = relations(mentions, ({ one }) => ({
  project: one(projects, {
    fields: [mentions.projectId],
    references: [projects.id],
  }),
  issue: one(issues, {
    fields: [mentions.issueId],
    references: [issues.id],
  }),
  speakerUser: one(users, {
    fields: [mentions.speakerUserId],
    references: [users.id],
    relationName: "mentionSpeakerUser",
  }),
  mentionedUser: one(users, {
    fields: [mentions.mentionedUserId],
    references: [users.id],
    relationName: "mentionMentionedUser",
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
