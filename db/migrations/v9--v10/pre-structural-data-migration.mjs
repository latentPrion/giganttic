import path from "node:path";
import { pathToFileURL } from "node:url";

const MENTIONS_TABLE_NAME = "Mentions";
const NOTIFICATIONS_TABLE_NAME = "Notifications";
const CONTAINER_KEY_COLUMN_NAME = "containerKey";
const NOTIFICATION_MENTIONED_USER_COLUMN_NAME = "mentionedUserId";
const CONTAINER_KEY_INDEX_NAME = "Mentions_containerKey_idx";
const CONTAINER_UNIQUE_INDEX_NAME = "Mentions_mentionedUserId_mentionContainerType_containerKey_unique";
const LEGACY_CONTAINER_INDEX_NAME = "Mentions_projectId_issueId_taskId_commentId_idx";
const NOTIFICATION_MENTIONED_USER_INDEX_NAME = "Notifications_commentId_mentionedUserId_idx";
const EMPTY_CONTAINER_KEY = "-:-:-:-";

function readColumnNames(db, tableName) {
  return db.prepare(`PRAGMA table_info(${tableName});`).all().map((row) => String(row.name));
}

function readIndexNames(db, tableName) {
  return db.prepare(`PRAGMA index_list(${tableName});`).all().map((row) => String(row.name));
}

function hasColumn(db, tableName, columnName) {
  return readColumnNames(db, tableName).includes(columnName);
}

function hasIndex(db, tableName, indexName) {
  return readIndexNames(db, tableName).includes(indexName);
}

function createContainerKeySqlExpression() {
  return [
    "CAST(projectId AS TEXT)",
    "COALESCE(CAST(issueId AS TEXT), '-')",
    "COALESCE(taskId, '-')",
    "COALESCE(CAST(commentId AS TEXT), '-')",
  ].join(" || ':' || ");
}

function ensureMentionsContainerKeyColumn(db) {
  if (hasColumn(db, MENTIONS_TABLE_NAME, CONTAINER_KEY_COLUMN_NAME)) {
    return;
  }

  db.exec(
    `ALTER TABLE ${MENTIONS_TABLE_NAME}
     ADD COLUMN ${CONTAINER_KEY_COLUMN_NAME} TEXT NOT NULL DEFAULT '${EMPTY_CONTAINER_KEY}';`,
  );
}

function backfillMentionsContainerKeys(db) {
  db.exec(
    `UPDATE ${MENTIONS_TABLE_NAME}
     SET ${CONTAINER_KEY_COLUMN_NAME} = ${createContainerKeySqlExpression()};`,
  );
}

function ensureMentionsIndexes(db) {
  if (!hasIndex(db, MENTIONS_TABLE_NAME, CONTAINER_UNIQUE_INDEX_NAME)) {
    db.exec(
      `CREATE UNIQUE INDEX ${CONTAINER_UNIQUE_INDEX_NAME}
       ON ${MENTIONS_TABLE_NAME} (mentionedUserId, mentionContainerType, ${CONTAINER_KEY_COLUMN_NAME});`,
    );
  }

  if (!hasIndex(db, MENTIONS_TABLE_NAME, CONTAINER_KEY_INDEX_NAME)) {
    db.exec(
      `CREATE INDEX ${CONTAINER_KEY_INDEX_NAME}
       ON ${MENTIONS_TABLE_NAME} (${CONTAINER_KEY_COLUMN_NAME});`,
    );
  }

  if (!hasIndex(db, MENTIONS_TABLE_NAME, LEGACY_CONTAINER_INDEX_NAME)) {
    db.exec(
      `CREATE INDEX ${LEGACY_CONTAINER_INDEX_NAME}
       ON ${MENTIONS_TABLE_NAME} (projectId, issueId, taskId, commentId);`,
    );
  }
}

function ensureNotificationsMentionedUserColumn(db) {
  if (hasColumn(db, NOTIFICATIONS_TABLE_NAME, NOTIFICATION_MENTIONED_USER_COLUMN_NAME)) {
    return;
  }

  db.exec(
    `ALTER TABLE ${NOTIFICATIONS_TABLE_NAME}
     ADD COLUMN ${NOTIFICATION_MENTIONED_USER_COLUMN_NAME} integer REFERENCES Users(id);`,
  );
}

function ensureNotificationsIndexes(db) {
  if (hasIndex(db, NOTIFICATIONS_TABLE_NAME, NOTIFICATION_MENTIONED_USER_INDEX_NAME)) {
    return;
  }

  db.exec(
    `CREATE INDEX ${NOTIFICATION_MENTIONED_USER_INDEX_NAME}
     ON ${NOTIFICATIONS_TABLE_NAME} (commentId, ${NOTIFICATION_MENTIONED_USER_COLUMN_NAME});`,
  );
}

async function importRuntimeDbState(runtimeRoot) {
  const moduleUrl = pathToFileURL(path.join(runtimeRoot, "db", "runtime-db-state.mjs"));
  return import(moduleUrl.href);
}

function repairMentionsSchema(db) {
  ensureMentionsContainerKeyColumn(db);
  backfillMentionsContainerKeys(db);
  ensureMentionsIndexes(db);
}

function repairNotificationsSchema(db) {
  ensureNotificationsMentionedUserColumn(db);
  ensureNotificationsIndexes(db);
}

export async function runPreStructuralDataMigrationHook({ runtimeRoot, targetDbPath }) {
  if (!runtimeRoot || !targetDbPath) {
    throw new Error("Missing runtime root or target DB path for v9 -> v10 repair migration.");
  }

  const { openDatabaseFromPath } = await importRuntimeDbState(runtimeRoot);
  const db = await openDatabaseFromPath(targetDbPath);

  try {
    repairMentionsSchema(db);
    repairNotificationsSchema(db);
  } finally {
    db.close();
  }
}
