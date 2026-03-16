import { getReferenceSeedData } from "./reference-seed-data.mjs";

function escapeSqlString(value) {
  return String(value).replaceAll("'", "''");
}

function toSqlNullableText(value) {
  return value === null || value === undefined
    ? "NULL"
    : `'${escapeSqlString(value)}'`;
}

function toSqlBooleanInteger(value) {
  return value ? "1" : "0";
}

function runReferenceUpsert(db, tableName, valuesSql) {
  db.exec(valuesSql);
}

function createCodeReferenceUpsertSql(tableName, row) {
  return `INSERT INTO ${tableName} (code, displayName, description)
VALUES ('${escapeSqlString(row.code)}', '${escapeSqlString(row.displayName)}', ${toSqlNullableText(row.description)})
ON CONFLICT(code) DO UPDATE SET
  displayName = excluded.displayName,
  description = excluded.description;`;
}

function createCredentialTypeUpsertSql(row) {
  return `INSERT INTO CredentialTypes (code, displayName, description, allowsMultiplePerUser)
VALUES ('${escapeSqlString(row.code)}', '${escapeSqlString(row.displayName)}', ${toSqlNullableText(row.description)}, ${toSqlBooleanInteger(row.allowsMultiplePerUser)})
ON CONFLICT(code) DO UPDATE SET
  displayName = excluded.displayName,
  description = excluded.description,
  allowsMultiplePerUser = excluded.allowsMultiplePerUser;`;
}

function ensureV1ReferenceData(db) {
  const referenceSeedData = getReferenceSeedData("v1");

  for (const credentialType of referenceSeedData.credentialTypes) {
    runReferenceUpsert(db, "CredentialTypes", createCredentialTypeUpsertSql(credentialType));
  }

  for (const role of referenceSeedData.roles) {
    runReferenceUpsert(db, "Roles", createCodeReferenceUpsertSql("Roles", role));
  }
}

function ensureV2StyleReferenceData(db, schemaName) {
  const referenceSeedData = getReferenceSeedData(schemaName);

  for (const credentialType of referenceSeedData.credentialTypes) {
    runReferenceUpsert(db, "CredentialTypes", createCredentialTypeUpsertSql(credentialType));
  }

  for (const systemRole of referenceSeedData.systemRoles) {
    runReferenceUpsert(db, "SystemRoles", createCodeReferenceUpsertSql("SystemRoles", systemRole));
  }

  for (const projectRole of referenceSeedData.projectRoles) {
    runReferenceUpsert(db, "ProjectRoles", createCodeReferenceUpsertSql("ProjectRoles", projectRole));
  }

  for (const teamRole of referenceSeedData.teamRoles) {
    runReferenceUpsert(db, "TeamRoles", createCodeReferenceUpsertSql("TeamRoles", teamRole));
  }

  for (const organizationRole of referenceSeedData.organizationRoles) {
    runReferenceUpsert(db, "OrganizationRoles", createCodeReferenceUpsertSql("OrganizationRoles", organizationRole));
  }

  for (const issueStatus of referenceSeedData.issueStatuses) {
    runReferenceUpsert(db, "IssueStatuses", createCodeReferenceUpsertSql("IssueStatuses", issueStatus));
  }

  for (const closedReason of referenceSeedData.closedReasons) {
    runReferenceUpsert(db, "ClosedReasons", createCodeReferenceUpsertSql("ClosedReasons", closedReason));
  }
}

function ensureReferenceData(db, schemaName) {
  db.exec("BEGIN TRANSACTION;");

  try {
    if (schemaName === "v1") {
      ensureV1ReferenceData(db);
    } else if (schemaName === "v2" || schemaName === "v3") {
      ensureV2StyleReferenceData(db, schemaName);
    } else {
      throw new Error(`Unsupported schema for reference data reconciliation: ${schemaName}`);
    }

    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

export {
  ensureReferenceData,
};
