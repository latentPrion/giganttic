import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  getSeededTestData,
  TEST_DATA_PROFILE_APP,
} from "./test-data-seed-data.mjs";
import { ensureReferenceData } from "./sqlite-reference-data-manager.mjs";
import {
  deleteProjectChartXml,
  writeProjectChartXml,
} from "../backend/modules/project-charts/project-chart-files.js";

const MANAGED_TEST_DATA_RECORDS_TABLE = "ManagedTestDataRecords";
const PROJECT_JOURNALS_DIR_NAME = "project-journals";
const ISSUE_JOURNALS_DIR_NAME = "issue-journals";
const TEST_DATA_ENTITY_TABLES = {
  organization: "Organizations",
  project: "Projects",
  team: "Teams",
  user: "Users",
};
const UNTRUSTED_CONTENT_DIR_NAME = "untrusted-content";

function runDelete(db, sql) {
  db.exec(sql);
}

function ensureDirectoryExists(targetPath) {
  mkdirSync(targetPath, { recursive: true });
}

function escapeSqlString(value) {
  return String(value).replaceAll("'", "''");
}

function toSqlNullableText(value) {
  return value === null || value === undefined
    ? "NULL"
    : `'${escapeSqlString(value)}'`;
}

function toSqlNullableTimestamp(value) {
  return value === null || value === undefined
    ? "NULL"
    : `${Number(new Date(value).getTime())}`;
}

function createProjectRootFromChartsDir(chartsDir) {
  if (!chartsDir) {
    return process.cwd();
  }

  return path.dirname(chartsDir);
}

function createProjectJournalsDir(projectRoot) {
  return path.join(projectRoot, UNTRUSTED_CONTENT_DIR_NAME, PROJECT_JOURNALS_DIR_NAME);
}

function createIssueJournalsDir(projectRoot) {
  return path.join(projectRoot, UNTRUSTED_CONTENT_DIR_NAME, ISSUE_JOURNALS_DIR_NAME);
}

function createProjectJournalPath(projectRoot, projectId) {
  return path.join(createProjectJournalsDir(projectRoot), `${projectId}.md`);
}

function createIssueJournalPath(projectRoot, projectId, issueId) {
  return path.join(createIssueJournalsDir(projectRoot), `${projectId}-${issueId}.md`);
}

function writeProjectJournal(projectRoot, projectId, markdown = "") {
  ensureDirectoryExists(createProjectJournalsDir(projectRoot));
  writeFileSync(createProjectJournalPath(projectRoot, projectId), markdown, "utf8");
}

function writeIssueJournal(projectRoot, projectId, issueId, markdown = "") {
  ensureDirectoryExists(createIssueJournalsDir(projectRoot));
  writeFileSync(createIssueJournalPath(projectRoot, projectId, issueId), markdown, "utf8");
}

function deleteProjectJournal(projectRoot, projectId) {
  rmSync(createProjectJournalPath(projectRoot, projectId), { force: true });
}

function deleteIssueJournal(projectRoot, projectId, issueId) {
  rmSync(createIssueJournalPath(projectRoot, projectId, issueId), { force: true });
}

function readSingleId(db, sql) {
  const row = db.prepare(sql).raw(true).get();

  if (!row || row[0] === undefined) {
    throw new Error(`Expected query to return a row: ${sql}`);
  }

  return Number(row[0]);
}

function createIdInClause(ids) {
  if (ids.length === 0) {
    return "(NULL)";
  }

  return `(${ids.join(", ")})`;
}

function readTrackedEntityIds(db) {
  const values = db.prepare(
    `SELECT entityTable, entityId FROM ${MANAGED_TEST_DATA_RECORDS_TABLE};`,
  ).raw(true).all();

  if (values.length === 0) {
    return {
      organizationIds: [],
      projectIds: [],
      teamIds: [],
      userIds: [],
    };
  }

  const trackedValues = values.map((row) => ({
    entityId: Number(row[1]),
    entityTable: String(row[0]),
  }));

  return {
    organizationIds: trackedValues
      .filter((row) => row.entityTable === TEST_DATA_ENTITY_TABLES.organization)
      .map((row) => row.entityId),
    projectIds: trackedValues
      .filter((row) => row.entityTable === TEST_DATA_ENTITY_TABLES.project)
      .map((row) => row.entityId),
    teamIds: trackedValues
      .filter((row) => row.entityTable === TEST_DATA_ENTITY_TABLES.team)
      .map((row) => row.entityId),
    userIds: trackedValues
      .filter((row) => row.entityTable === TEST_DATA_ENTITY_TABLES.user)
      .map((row) => row.entityId),
  };
}

function hasSeededTestData(db) {
  const rowCount = db.prepare(
    `SELECT COUNT(*) FROM ${MANAGED_TEST_DATA_RECORDS_TABLE};`,
  ).pluck().get();

  return Number(rowCount ?? 0) > 0;
}

function purgeSeededProjectChildren(db, projectIds) {
  if (projectIds.length === 0) {
    return;
  }

  const ids = createIdInClause(projectIds);
  runDelete(db, `DELETE FROM Issues WHERE projectId IN ${ids};`);
  runDelete(db, `DELETE FROM Projects_Organizations WHERE projectId IN ${ids};`);
  runDelete(db, `DELETE FROM Projects_Teams WHERE projectId IN ${ids};`);
  runDelete(db, `DELETE FROM Projects_Users WHERE projectId IN ${ids};`);
  runDelete(
    db,
    `DELETE FROM Users_Projects_ProjectRoles WHERE projectId IN ${ids};`,
  );
}

function readTrackedIssueJournalTargets(db, projectIds) {
  if (projectIds.length === 0) {
    return [];
  }

  const ids = createIdInClause(projectIds);
  return db.prepare(
    `SELECT id, projectId FROM Issues WHERE projectId IN ${ids};`,
  ).raw(true).all().map((row) => ({
    issueId: Number(row[0]),
    projectId: Number(row[1]),
  }));
}

function purgeSeededTeamChildren(db, teamIds) {
  if (teamIds.length === 0) {
    return;
  }

  const ids = createIdInClause(teamIds);
  runDelete(db, `DELETE FROM Projects_Teams WHERE teamId IN ${ids};`);
  runDelete(db, `DELETE FROM Organizations_Teams WHERE teamId IN ${ids};`);
  runDelete(db, `DELETE FROM Teams_Users WHERE teamId IN ${ids};`);
  runDelete(db, `DELETE FROM Users_Teams_TeamRoles WHERE teamId IN ${ids};`);
}

function purgeSeededOrganizationChildren(db, organizationIds) {
  if (organizationIds.length === 0) {
    return;
  }

  const ids = createIdInClause(organizationIds);
  runDelete(
    db,
    `DELETE FROM Projects_Organizations WHERE organizationId IN ${ids};`,
  );
  runDelete(
    db,
    `DELETE FROM Organizations_Teams WHERE organizationId IN ${ids};`,
  );
  runDelete(
    db,
    `DELETE FROM Users_Organizations_OrganizationRoles WHERE organizationId IN ${ids};`,
  );
  runDelete(
    db,
    `DELETE FROM Users_Organizations WHERE organizationId IN ${ids};`,
  );
}

function purgeSeededUserChildren(db, userIds) {
  if (userIds.length === 0) {
    return;
  }

  const ids = createIdInClause(userIds);
  const credentialIds = db.prepare(
    `SELECT id FROM Users_CredentialTypes WHERE userId IN ${ids};`,
  ).raw(true).all().map((row) => Number(row[0]));

  runDelete(db, `DELETE FROM Users_Sessions WHERE userId IN ${ids};`);
  runDelete(
    db,
    `DELETE FROM Users_Organizations_OrganizationRoles WHERE userId IN ${ids};`,
  );
  runDelete(db, `DELETE FROM Users_Organizations WHERE userId IN ${ids};`);
  runDelete(
    db,
    `DELETE FROM Users_Projects_ProjectRoles WHERE userId IN ${ids};`,
  );
  runDelete(db, `DELETE FROM Projects_Users WHERE userId IN ${ids};`);
  runDelete(db, `DELETE FROM Users_Teams_TeamRoles WHERE userId IN ${ids};`);
  runDelete(db, `DELETE FROM Teams_Users WHERE userId IN ${ids};`);
  runDelete(db, `DELETE FROM Users_SystemRoles WHERE userId IN ${ids};`);

  if (credentialIds.length > 0) {
    runDelete(
      db,
      `DELETE FROM Users_PasswordCredentials WHERE userCredentialTypeId IN ${createIdInClause(credentialIds)};`,
    );
  }

  runDelete(db, `DELETE FROM Users_CredentialTypes WHERE userId IN ${ids};`);
}

function purgeTrackedTopLevelEntities(db, trackedIds) {
  if (trackedIds.projectIds.length > 0) {
    runDelete(
      db,
      `DELETE FROM Projects WHERE id IN ${createIdInClause(trackedIds.projectIds)};`,
    );
  }
  if (trackedIds.teamIds.length > 0) {
    runDelete(
      db,
      `DELETE FROM Teams WHERE id IN ${createIdInClause(trackedIds.teamIds)};`,
    );
  }
  if (trackedIds.organizationIds.length > 0) {
    runDelete(
      db,
      `DELETE FROM Organizations WHERE id IN ${createIdInClause(trackedIds.organizationIds)};`,
    );
  }
  if (trackedIds.userIds.length > 0) {
    runDelete(
      db,
      `DELETE FROM Users WHERE id IN ${createIdInClause(trackedIds.userIds)};`,
    );
  }
}

function purgeSeededProjectCharts(chartsDir, projectIds) {
  if (!chartsDir) {
    return;
  }

  for (const projectId of projectIds) {
    deleteProjectChartXml(chartsDir, projectId);
  }
}

function purgeSeededJournalFiles(chartsDir, projectIds, issueTargets) {
  const projectRoot = createProjectRootFromChartsDir(chartsDir);

  for (const projectId of projectIds) {
    deleteProjectJournal(projectRoot, projectId);
  }

  for (const issueTarget of issueTargets) {
    deleteIssueJournal(projectRoot, issueTarget.projectId, issueTarget.issueId);
  }
}

/**
 * @param {import("better-sqlite3").Database} db
 * @param {string | null | undefined} [chartsDir]
 */
function purgeSeededTestData(db, chartsDir = null) {
  const trackedIds = readTrackedEntityIds(db);
  const trackedIssueTargets = readTrackedIssueJournalTargets(db, trackedIds.projectIds);

  db.exec("BEGIN TRANSACTION;");

  try {
    purgeSeededProjectCharts(chartsDir, trackedIds.projectIds);
    purgeSeededProjectChildren(db, trackedIds.projectIds);
    purgeSeededTeamChildren(db, trackedIds.teamIds);
    purgeSeededOrganizationChildren(db, trackedIds.organizationIds);
    purgeSeededUserChildren(db, trackedIds.userIds);
    purgeTrackedTopLevelEntities(db, trackedIds);
    runDelete(db, `DELETE FROM ${MANAGED_TEST_DATA_RECORDS_TABLE};`);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }

  purgeSeededJournalFiles(chartsDir, trackedIds.projectIds, trackedIssueTargets);
}

function writeSeededProjectCharts(chartsDir, projectIds, seededCharts) {
  if (!chartsDir) {
    return;
  }

  writeProjectChartXml(
    chartsDir,
    projectIds.orgProjectManager,
    seededCharts.orgProjectManager,
  );
  writeProjectChartXml(
    chartsDir,
    projectIds.projectProjectManager,
    seededCharts.projectProjectManager,
  );
  writeProjectChartXml(
    chartsDir,
    projectIds.teamProjectManager,
    seededCharts.teamProjectManager,
  );
}

function insertTrackedRecord(db, seedKey, entityTable, entityId) {
  db.exec(
    `INSERT INTO ${MANAGED_TEST_DATA_RECORDS_TABLE} (seedKey, entityTable, entityId)
VALUES ('${escapeSqlString(seedKey)}', '${escapeSqlString(entityTable)}', ${entityId});`,
  );
}

function insertSeedUser(db, seededAccount) {
  db.exec(
    `INSERT INTO Users (username, email, isActive)
VALUES ('${escapeSqlString(seededAccount.username)}', '${escapeSqlString(seededAccount.email)}', 1);`,
  );
  const userId = readSingleId(
    db,
    `SELECT id FROM Users WHERE username = '${escapeSqlString(seededAccount.username)}';`,
  );

  db.exec(
    `INSERT INTO Users_CredentialTypes (userId, credentialTypeCode)
VALUES (${userId}, 'GGTC_CREDTYPE_USERNAME_PASSWORD');`,
  );
  const userCredentialTypeId = readSingleId(
    db,
    `SELECT id FROM Users_CredentialTypes WHERE userId = ${userId} AND credentialTypeCode = 'GGTC_CREDTYPE_USERNAME_PASSWORD';`,
  );

  db.exec(
    `INSERT INTO Users_PasswordCredentials (userCredentialTypeId, passwordHash)
VALUES (${userCredentialTypeId}, '${escapeSqlString(seededAccount.passwordHash)}');`,
  );

  if (seededAccount.systemRoleCode) {
    db.exec(
      `INSERT INTO Users_SystemRoles (userId, roleCode)
VALUES (${userId}, '${escapeSqlString(seededAccount.systemRoleCode)}');`,
    );
  }

  insertTrackedRecord(db, seededAccount.seedKey, TEST_DATA_ENTITY_TABLES.user, userId);
  return userId;
}

function insertNamedEntity(db, tableName, seed) {
  db.exec(
    `INSERT INTO ${tableName} (name, description)
VALUES ('${escapeSqlString(seed.name)}', ${toSqlNullableText(seed.description)});`,
  );

  return readSingleId(
    db,
    `SELECT id FROM ${tableName} WHERE name = '${escapeSqlString(seed.name)}';`,
  );
}

function readInsertedIssueId(db, projectId, issueName) {
  return readSingleId(
    db,
    `SELECT id FROM Issues WHERE projectId = ${projectId} AND name = '${escapeSqlString(issueName)}';`,
  );
}

function insertSeedIssues(db, schemaName, projectId, seededIssues, projectRoot = null) {
  for (const seededIssue of seededIssues) {
    const insertSql = schemaName === "v7"
      ? `INSERT INTO Issues (
  projectId,
  name,
  description,
  priority,
  status,
  closedReason,
  progressPercentage,
  openedAt,
  closedAt,
  closedReasonDescription
)
VALUES (
  ${projectId},
  '${escapeSqlString(seededIssue.name)}',
  ${toSqlNullableText(seededIssue.description)},
  ${seededIssue.priority},
  '${escapeSqlString(seededIssue.status)}',
  ${toSqlNullableText(seededIssue.closedReason)},
  ${seededIssue.progressPercentage},
  ${toSqlNullableTimestamp(seededIssue.openedAt)},
  ${toSqlNullableTimestamp(seededIssue.closedAt)},
  ${toSqlNullableText(seededIssue.closedReasonDescription)}
);`
      : `INSERT INTO Issues (
  projectId,
  name,
  description,
  journal,
  priority,
  status,
  closedReason,
  progressPercentage,
  openedAt,
  closedAt,
  closedReasonDescription
)
VALUES (
  ${projectId},
  '${escapeSqlString(seededIssue.name)}',
  ${toSqlNullableText(seededIssue.description)},
  ${toSqlNullableText(seededIssue.journal)},
  ${seededIssue.priority},
  '${escapeSqlString(seededIssue.status)}',
  ${toSqlNullableText(seededIssue.closedReason)},
  ${seededIssue.progressPercentage},
  ${toSqlNullableTimestamp(seededIssue.openedAt)},
  ${toSqlNullableTimestamp(seededIssue.closedAt)},
  ${toSqlNullableText(seededIssue.closedReasonDescription)}
);`;
    db.exec(insertSql);

    if (schemaName === "v7" && projectRoot) {
      writeIssueJournal(
        projectRoot,
        projectId,
        readInsertedIssueId(db, projectId, seededIssue.name),
        seededIssue.journal ?? "",
      );
    }
  }
}

function createV2StyleTestData(db, schemaName, profile, chartsDir = null) {
  const {
    seededScopedFixtures,
    seededTestAccounts,
  } = getSeededTestData(schemaName, profile);
  const projectRoot = createProjectRootFromChartsDir(chartsDir);

  const seededUserIds = {
    admin: insertSeedUser(db, seededTestAccounts.admin),
    noRole: insertSeedUser(db, seededTestAccounts.noRole),
    orgOrganizationManager: insertSeedUser(db, seededTestAccounts.orgOrganizationManager),
    orgProjectManager: insertSeedUser(db, seededTestAccounts.orgProjectManager),
    orgTeamManager: insertSeedUser(db, seededTestAccounts.orgTeamManager),
    projectProjectManager: insertSeedUser(db, seededTestAccounts.projectProjectManager),
    teamProjectManager: insertSeedUser(db, seededTestAccounts.teamProjectManager),
    teamTeamManager: insertSeedUser(db, seededTestAccounts.teamTeamManager),
  };

  const organizationIds = {
    orgOrganizationManager: insertNamedEntity(
      db,
      TEST_DATA_ENTITY_TABLES.organization,
      seededScopedFixtures.organizations.orgOrganizationManager,
    ),
    orgProjectManager: insertNamedEntity(
      db,
      TEST_DATA_ENTITY_TABLES.organization,
      seededScopedFixtures.organizations.orgProjectManager,
    ),
    orgTeamManager: insertNamedEntity(
      db,
      TEST_DATA_ENTITY_TABLES.organization,
      seededScopedFixtures.organizations.orgTeamManager,
    ),
  };

  insertTrackedRecord(
    db,
    seededScopedFixtures.organizations.orgOrganizationManager.seedKey,
    TEST_DATA_ENTITY_TABLES.organization,
    organizationIds.orgOrganizationManager,
  );
  insertTrackedRecord(
    db,
    seededScopedFixtures.organizations.orgProjectManager.seedKey,
    TEST_DATA_ENTITY_TABLES.organization,
    organizationIds.orgProjectManager,
  );
  insertTrackedRecord(
    db,
    seededScopedFixtures.organizations.orgTeamManager.seedKey,
    TEST_DATA_ENTITY_TABLES.organization,
    organizationIds.orgTeamManager,
  );

  const projectIds = {
    projectProjectManager: insertNamedEntity(
      db,
      TEST_DATA_ENTITY_TABLES.project,
      seededScopedFixtures.projects.projectProjectManager,
    ),
    orgProjectManager: insertNamedEntity(
      db,
      TEST_DATA_ENTITY_TABLES.project,
      seededScopedFixtures.projects.orgProjectManager,
    ),
    teamProjectManager: insertNamedEntity(
      db,
      TEST_DATA_ENTITY_TABLES.project,
      seededScopedFixtures.projects.teamProjectManager,
    ),
  };

  insertTrackedRecord(
    db,
    seededScopedFixtures.projects.projectProjectManager.seedKey,
    TEST_DATA_ENTITY_TABLES.project,
    projectIds.projectProjectManager,
  );
  insertTrackedRecord(
    db,
    seededScopedFixtures.projects.orgProjectManager.seedKey,
    TEST_DATA_ENTITY_TABLES.project,
    projectIds.orgProjectManager,
  );
  insertTrackedRecord(
    db,
    seededScopedFixtures.projects.teamProjectManager.seedKey,
    TEST_DATA_ENTITY_TABLES.project,
    projectIds.teamProjectManager,
  );

  if (schemaName === "v7") {
    writeProjectJournal(projectRoot, projectIds.projectProjectManager);
    writeProjectJournal(projectRoot, projectIds.orgProjectManager);
    writeProjectJournal(projectRoot, projectIds.teamProjectManager);
  }

  const teamIds = {
    teamTeamManager: insertNamedEntity(
      db,
      TEST_DATA_ENTITY_TABLES.team,
      seededScopedFixtures.teams.teamTeamManager,
    ),
    orgTeamManager: insertNamedEntity(
      db,
      TEST_DATA_ENTITY_TABLES.team,
      seededScopedFixtures.teams.orgTeamManager,
    ),
    teamProjectManager: insertNamedEntity(
      db,
      TEST_DATA_ENTITY_TABLES.team,
      seededScopedFixtures.teams.teamProjectManager,
    ),
  };

  insertTrackedRecord(
    db,
    seededScopedFixtures.teams.teamTeamManager.seedKey,
    TEST_DATA_ENTITY_TABLES.team,
    teamIds.teamTeamManager,
  );
  insertTrackedRecord(
    db,
    seededScopedFixtures.teams.orgTeamManager.seedKey,
    TEST_DATA_ENTITY_TABLES.team,
    teamIds.orgTeamManager,
  );
  insertTrackedRecord(
    db,
    seededScopedFixtures.teams.teamProjectManager.seedKey,
    TEST_DATA_ENTITY_TABLES.team,
    teamIds.teamProjectManager,
  );

  db.exec(`INSERT INTO Users_Organizations (organizationId, userId) VALUES (${organizationIds.orgOrganizationManager}, ${seededUserIds.orgOrganizationManager});`);
  db.exec(`INSERT INTO Users_Organizations_OrganizationRoles (userId, organizationId, roleCode) VALUES (${seededUserIds.orgOrganizationManager}, ${organizationIds.orgOrganizationManager}, 'GGTC_ORGANIZATIONROLE_ORGANIZATION_MANAGER');`);

  db.exec(`INSERT INTO Users_Organizations (organizationId, userId) VALUES (${organizationIds.orgProjectManager}, ${seededUserIds.orgProjectManager});`);
  db.exec(`INSERT INTO Users_Organizations_OrganizationRoles (userId, organizationId, roleCode) VALUES (${seededUserIds.orgProjectManager}, ${organizationIds.orgProjectManager}, 'GGTC_ORGANIZATIONROLE_PROJECT_MANAGER');`);
  db.exec(`INSERT INTO Projects_Users (projectId, userId) VALUES (${projectIds.orgProjectManager}, ${seededUserIds.orgProjectManager});`);
  db.exec(`INSERT INTO Projects_Organizations (organizationId, projectId) VALUES (${organizationIds.orgProjectManager}, ${projectIds.orgProjectManager});`);

  db.exec(`INSERT INTO Users_Organizations (organizationId, userId) VALUES (${organizationIds.orgTeamManager}, ${seededUserIds.orgTeamManager});`);
  db.exec(`INSERT INTO Users_Organizations_OrganizationRoles (userId, organizationId, roleCode) VALUES (${seededUserIds.orgTeamManager}, ${organizationIds.orgTeamManager}, 'GGTC_ORGANIZATIONROLE_TEAM_MANAGER');`);
  db.exec(`INSERT INTO Teams_Users (teamId, userId) VALUES (${teamIds.orgTeamManager}, ${seededUserIds.orgTeamManager});`);
  db.exec(`INSERT INTO Organizations_Teams (organizationId, teamId) VALUES (${organizationIds.orgTeamManager}, ${teamIds.orgTeamManager});`);

  db.exec(`INSERT INTO Teams_Users (teamId, userId) VALUES (${teamIds.teamTeamManager}, ${seededUserIds.teamTeamManager});`);
  db.exec(`INSERT INTO Users_Teams_TeamRoles (userId, teamId, roleCode) VALUES (${seededUserIds.teamTeamManager}, ${teamIds.teamTeamManager}, 'GGTC_TEAMROLE_TEAM_MANAGER');`);

  db.exec(`INSERT INTO Teams_Users (teamId, userId) VALUES (${teamIds.teamProjectManager}, ${seededUserIds.teamProjectManager});`);
  db.exec(`INSERT INTO Users_Teams_TeamRoles (userId, teamId, roleCode) VALUES (${seededUserIds.teamProjectManager}, ${teamIds.teamProjectManager}, 'GGTC_TEAMROLE_PROJECT_MANAGER');`);
  db.exec(`INSERT INTO Projects_Teams (projectId, teamId) VALUES (${projectIds.teamProjectManager}, ${teamIds.teamProjectManager});`);

  db.exec(`INSERT INTO Projects_Users (projectId, userId) VALUES (${projectIds.projectProjectManager}, ${seededUserIds.projectProjectManager});`);
  db.exec(`INSERT INTO Users_Projects_ProjectRoles (userId, projectId, roleCode) VALUES (${seededUserIds.projectProjectManager}, ${projectIds.projectProjectManager}, 'GGTC_PROJECTROLE_PROJECT_MANAGER');`);

  insertSeedIssues(
    db,
    schemaName,
    projectIds.orgProjectManager,
    seededScopedFixtures.issues.orgProjectManager,
    projectRoot,
  );
  insertSeedIssues(
    db,
    schemaName,
    projectIds.projectProjectManager,
    seededScopedFixtures.issues.projectProjectManager,
    projectRoot,
  );
  insertSeedIssues(
    db,
    schemaName,
    projectIds.teamProjectManager,
    seededScopedFixtures.issues.teamProjectManager,
    projectRoot,
  );
  writeSeededProjectCharts(chartsDir, projectIds, seededScopedFixtures.projects.charts);
}

/**
 * @param {import("better-sqlite3").Database} db
 * @param {string} schemaName
 * @param {string | null | undefined} [profile]
 * @param {string | null | undefined} [chartsDir]
 */
function ensureSeededTestData(
  db,
  schemaName,
  profile = TEST_DATA_PROFILE_APP,
  chartsDir = null,
) {
  ensureReferenceData(db, schemaName);

  db.exec("BEGIN TRANSACTION;");

  try {
    const trackedIds = readTrackedEntityIds(db);
    purgeSeededProjectCharts(chartsDir, trackedIds.projectIds);
    purgeSeededProjectChildren(db, trackedIds.projectIds);
    purgeSeededTeamChildren(db, trackedIds.teamIds);
    purgeSeededOrganizationChildren(db, trackedIds.organizationIds);
    purgeSeededUserChildren(db, trackedIds.userIds);
    purgeTrackedTopLevelEntities(db, trackedIds);
    runDelete(db, `DELETE FROM ${MANAGED_TEST_DATA_RECORDS_TABLE};`);

    if (
      schemaName !== "v2"
      && schemaName !== "v3"
      && schemaName !== "v4"
      && schemaName !== "v5"
      && schemaName !== "v6"
      && schemaName !== "v7"
    ) {
      throw new Error(`Test data seeding is only supported for schema v2/v3/v4/v5/v6/v7, received ${schemaName}.`);
    }

    createV2StyleTestData(db, schemaName, profile, chartsDir);
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export {
  ensureSeededTestData,
  hasSeededTestData,
  purgeSeededTestData,
};
