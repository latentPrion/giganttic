const DEFAULT_DEV_DB_BASENAME = "giganttic-dev.sqlite";
const DEFAULT_PROD_DB_BASENAME = "giganttic-prod.sqlite";
const DEFAULT_PRODDEV_DB_BASENAME = "giganttic-proddev.sqlite";
const DEFAULT_TESTSUITE_DB_BASENAME = "giganttic-testsuite.sqlite";
const DEFAULT_SQLITE_DB_DIR = "run";

function createDbPath(basename) {
  return `${DEFAULT_SQLITE_DB_DIR}/${basename}`;
}

export const defaultDevSqliteDbPath = createDbPath(DEFAULT_DEV_DB_BASENAME);
export const defaultProdSqliteDbPath = createDbPath(DEFAULT_PROD_DB_BASENAME);
export const defaultProddevSqliteDbPath = createDbPath(DEFAULT_PRODDEV_DB_BASENAME);
export const defaultTestsuiteSqliteDbPath = createDbPath(
  DEFAULT_TESTSUITE_DB_BASENAME,
);
