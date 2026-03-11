const MANAGED_TEST_DATA_RECORDS_TABLE = "ManagedTestDataRecords";
const TEST_DATA_ENTITY_TABLES = {
  organization: "Organizations",
  project: "Projects",
  team: "Teams",
  user: "Users",
};

function runDelete(db, sql) {
  db.exec(sql);
}

function createIdInClause(ids) {
  if (ids.length === 0) {
    return "(NULL)";
  }

  return `(${ids.join(", ")})`;
}

function readTrackedEntityIds(db) {
  const rows = db.exec(
    `SELECT entityTable, entityId FROM ${MANAGED_TEST_DATA_RECORDS_TABLE};`,
  );

  if (rows.length === 0) {
    return {
      organizationIds: [],
      projectIds: [],
      teamIds: [],
      userIds: [],
    };
  }

  const values = rows[0].values.map((row) => ({
    entityId: Number(row[1]),
    entityTable: String(row[0]),
  }));

  return {
    organizationIds: values
      .filter((row) => row.entityTable === TEST_DATA_ENTITY_TABLES.organization)
      .map((row) => row.entityId),
    projectIds: values
      .filter((row) => row.entityTable === TEST_DATA_ENTITY_TABLES.project)
      .map((row) => row.entityId),
    teamIds: values
      .filter((row) => row.entityTable === TEST_DATA_ENTITY_TABLES.team)
      .map((row) => row.entityId),
    userIds: values
      .filter((row) => row.entityTable === TEST_DATA_ENTITY_TABLES.user)
      .map((row) => row.entityId),
  };
}

function hasSeededTestData(db) {
  const rows = db.exec(
    `SELECT COUNT(*) FROM ${MANAGED_TEST_DATA_RECORDS_TABLE};`,
  );

  if (rows.length === 0) {
    return false;
  }

  return Number(rows[0].values[0][0]) > 0;
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
  const credentialRows = db.exec(
    `SELECT id FROM Users_CredentialTypes WHERE userId IN ${ids};`,
  );
  const credentialIds = credentialRows.length === 0
    ? []
    : credentialRows[0].values.map((row) => Number(row[0]));

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

function purgeSeededTestData(db) {
  const trackedIds = readTrackedEntityIds(db);

  db.exec("BEGIN TRANSACTION;");

  try {
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
}

export {
  hasSeededTestData,
  purgeSeededTestData,
};
