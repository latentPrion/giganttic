const DEFAULT_DEV_DB_BASENAME = "giganttic-dev.sqlite";
const DEFAULT_PROD_DB_BASENAME = "giganttic-prod.sqlite";
const DEFAULT_PRODDEV_DB_PREFIX = "giganttic-proddev-";
const DEFAULT_SQLITE_DB_DIR = "run";

function sanitizeMigrationPairName(migrationPairName) {
  return migrationPairName.replaceAll(/[^A-Za-z0-9._-]/g, "_");
}

function createDbPath(basename) {
  return `${DEFAULT_SQLITE_DB_DIR}/${basename}`;
}

export const defaultDevSqliteDbPath = createDbPath(DEFAULT_DEV_DB_BASENAME);
export const defaultProdSqliteDbPath = createDbPath(DEFAULT_PROD_DB_BASENAME);

export function createDefaultProddevSqliteDbPath(migrationPairName) {
  return createDbPath(
    `${DEFAULT_PRODDEV_DB_PREFIX}${sanitizeMigrationPairName(migrationPairName)}.sqlite`,
  );
}
