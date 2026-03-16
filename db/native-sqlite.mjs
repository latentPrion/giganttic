import Database from "better-sqlite3";

const SQLITE_BUSY_TIMEOUT_MS = 5000;
const SQLITE_SYNC_MODE = "NORMAL";
const SQLITE_WAL_MODE = "WAL";

/**
 * @typedef {import("better-sqlite3").Database} NativeSqliteDatabase
 * @typedef {import("better-sqlite3").Options} NativeSqliteOptions
 */

/**
 * @param {NativeSqliteDatabase} db
 * @param {{ enableWal?: boolean }} [options]
 */
function applySqlitePragmas(db, options = {}) {
  const {
    enableWal = true,
  } = options;

  db.pragma("foreign_keys = ON");
  db.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
  db.pragma(`synchronous = ${SQLITE_SYNC_MODE}`);

  if (enableWal) {
    db.pragma(`journal_mode = ${SQLITE_WAL_MODE}`);
  }
}

/**
 * @param {string} dbPath
 * @param {NativeSqliteOptions & { enableWal?: boolean }} [options]
 */
function openDatabaseConnection(dbPath, options = {}) {
  const {
    enableWal = true,
    ...databaseOptions
  } = options;
  const db = new Database(dbPath, databaseOptions);

  applySqlitePragmas(db, { enableWal });
  return db;
}

/**
 * @returns {NativeSqliteDatabase}
 */
function openInMemoryDatabase() {
  const db = new Database(":memory:");

  applySqlitePragmas(db, { enableWal: false });
  return db;
}

/**
 * @param {NativeSqliteDatabase} db
 * @param {string[]} statements
 */
function executeSqlStatements(db, statements) {
  for (const statement of statements) {
    db.exec(statement);
  }
}

/**
 * @param {NativeSqliteDatabase} db
 * @param {string} sql
 * @param {(string | number | null)[]} [params]
 */
function querySingleValue(db, sql, params = []) {
  const row = db.prepare(sql).raw(true).get(...params);

  if (!row || row[0] === undefined) {
    throw new Error(`No rows returned for query: ${sql}`);
  }

  return row[0];
}

export {
  applySqlitePragmas,
  executeSqlStatements,
  openDatabaseConnection,
  openInMemoryDatabase,
  querySingleValue,
};
