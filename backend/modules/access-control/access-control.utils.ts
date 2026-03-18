import { and, eq, inArray } from "drizzle-orm";

import {
  organizationRoleCodes,
  organizationsTeams,
  projectsOrganizations,
  projectRoleCodes,
  projectsTeams,
  projectsUsers,
  systemRoleCodes,
  teamsUsers,
  users,
  usersOrganizations,
  usersOrganizationsOrganizationRoles,
  usersProjectsProjectRoles,
  usersTeamsTeamRoles,
} from "../../../db/index.js";
import type { DatabaseService } from "../database/database.service.js";
import type { AuthContext } from "../auth/auth.types.js";

export const SYSTEM_ADMIN_ROLE_CODE = systemRoleCodes.admin;
export const PROJECT_MANAGER_ROLE_CODE = projectRoleCodes.projectManager;
export const PROJECT_OWNER_ROLE_CODE = projectRoleCodes.projectOwner;
export const TEAM_MANAGER_ROLE_CODE = "GGTC_TEAMROLE_TEAM_MANAGER";
export const TEAM_PROJECT_MANAGER_ROLE_CODE = "GGTC_TEAMROLE_PROJECT_MANAGER";
export const ORGANIZATION_MANAGER_ROLE_CODE =
  organizationRoleCodes.organizationManager;
export const ORGANIZATION_PROJECT_MANAGER_ROLE_CODE =
  organizationRoleCodes.projectManager;
export const ORGANIZATION_TEAM_MANAGER_ROLE_CODE =
  organizationRoleCodes.teamManager;

type AppDatabase = DatabaseService["db"];

export function hasSystemAdminRole(authContext: AuthContext): boolean {
  return authContext.roleCodes.includes(SYSTEM_ADMIN_ROLE_CODE);
}

export function uniqueNumberValues(values: ReadonlyArray<number>): number[] {
  return [...new Set(values)];
}

export function assertUsersExistOrThrow(
  database: AppDatabase,
  userIds: ReadonlyArray<number>,
): boolean {
  const distinctUserIds = uniqueNumberValues(userIds);
  if (distinctUserIds.length === 0) {
    return true;
  }

  const existingIds = database
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, distinctUserIds))
    .all()
    .map((row) => row.id);

  return existingIds.length === distinctUserIds.length;
}

export function hasDirectProjectMembership(
  database: AppDatabase,
  projectId: number,
  userId: number,
): boolean {
  return Boolean(
    database
      .select({ projectId: projectsUsers.projectId })
      .from(projectsUsers)
      .where(and(
        eq(projectsUsers.projectId, projectId),
        eq(projectsUsers.userId, userId),
      ))
      .get(),
  );
}

export function hasTeamMembership(
  database: AppDatabase,
  teamId: number,
  userId: number,
): boolean {
  return Boolean(
    database
      .select({ teamId: teamsUsers.teamId })
      .from(teamsUsers)
      .where(and(
        eq(teamsUsers.teamId, teamId),
        eq(teamsUsers.userId, userId),
      ))
      .get(),
  );
}

export function hasDirectOrganizationMembership(
  database: AppDatabase,
  organizationId: number,
  userId: number,
): boolean {
  return Boolean(
    database
      .select({ organizationId: usersOrganizations.organizationId })
      .from(usersOrganizations)
      .where(and(
        eq(usersOrganizations.organizationId, organizationId),
        eq(usersOrganizations.userId, userId),
      ))
      .get(),
  );
}

export function hasOrganizationMembership(
  database: AppDatabase,
  organizationId: number,
  userId: number,
): boolean {
  if (hasDirectOrganizationMembership(database, organizationId, userId)) {
    return true;
  }

  return Boolean(
    database
      .select({ organizationId: organizationsTeams.organizationId })
      .from(organizationsTeams)
      .innerJoin(teamsUsers, eq(teamsUsers.teamId, organizationsTeams.teamId))
      .where(and(
        eq(organizationsTeams.organizationId, organizationId),
        eq(teamsUsers.userId, userId),
      ))
      .get(),
  );
}

export function listProjectIdsForTeam(
  database: AppDatabase,
  teamId: number,
): number[] {
  return database
    .select({ projectId: projectsTeams.projectId })
    .from(projectsTeams)
    .where(eq(projectsTeams.teamId, teamId))
    .all()
    .map((row) => row.projectId);
}

export function listTeamIdsForProject(
  database: AppDatabase,
  projectId: number,
): number[] {
  return database
    .select({ teamId: projectsTeams.teamId })
    .from(projectsTeams)
    .where(eq(projectsTeams.projectId, projectId))
    .all()
    .map((row) => row.teamId);
}

export function listOrganizationIdsForProject(
  database: AppDatabase,
  projectId: number,
): number[] {
  const directIds = database
    .select({ organizationId: projectsOrganizations.organizationId })
    .from(projectsOrganizations)
    .where(eq(projectsOrganizations.projectId, projectId))
    .all()
    .map((row) => row.organizationId);
  const viaTeams = database
    .select({ organizationId: organizationsTeams.organizationId })
    .from(organizationsTeams)
    .innerJoin(projectsTeams, eq(projectsTeams.teamId, organizationsTeams.teamId))
    .where(eq(projectsTeams.projectId, projectId))
    .all()
    .map((row) => row.organizationId);

  return uniqueNumberValues([...directIds, ...viaTeams]);
}

export function getOrganizationIdForTeam(
  database: AppDatabase,
  teamId: number,
): number | null {
  return database
    .select({ organizationId: organizationsTeams.organizationId })
    .from(organizationsTeams)
    .where(eq(organizationsTeams.teamId, teamId))
    .get()?.organizationId ?? null;
}

export function listTeamIdsForOrganization(
  database: AppDatabase,
  organizationId: number,
): number[] {
  return database
    .select({ teamId: organizationsTeams.teamId })
    .from(organizationsTeams)
    .where(eq(organizationsTeams.organizationId, organizationId))
    .all()
    .map((row) => row.teamId);
}

export function listProjectIdsForOrganization(
  database: AppDatabase,
  organizationId: number,
): number[] {
  const directIds = database
    .select({ projectId: projectsOrganizations.projectId })
    .from(projectsOrganizations)
    .where(eq(projectsOrganizations.organizationId, organizationId))
    .all()
    .map((row) => row.projectId);
  const viaTeams = database
    .select({ projectId: projectsTeams.projectId })
    .from(projectsTeams)
    .innerJoin(
      organizationsTeams,
      eq(organizationsTeams.teamId, projectsTeams.teamId),
    )
    .where(eq(organizationsTeams.organizationId, organizationId))
    .all()
    .map((row) => row.projectId);

  return uniqueNumberValues([...directIds, ...viaTeams]);
}

export function listOrganizationIdsVisibleByMembership(
  database: AppDatabase,
  userId: number,
): number[] {
  const directOrganizationIds = database
    .select({ organizationId: usersOrganizations.organizationId })
    .from(usersOrganizations)
    .where(eq(usersOrganizations.userId, userId))
    .all()
    .map((row) => row.organizationId);
  const teamDerivedOrganizationIds = database
    .select({ organizationId: organizationsTeams.organizationId })
    .from(organizationsTeams)
    .innerJoin(teamsUsers, eq(teamsUsers.teamId, organizationsTeams.teamId))
    .where(eq(teamsUsers.userId, userId))
    .all()
    .map((row) => row.organizationId);
  const roleVisibleOrganizationIds = database
    .select({ organizationId: usersOrganizationsOrganizationRoles.organizationId })
    .from(usersOrganizationsOrganizationRoles)
    .where(eq(usersOrganizationsOrganizationRoles.userId, userId))
    .all()
    .map((row) => row.organizationId);

  return uniqueNumberValues([
    ...directOrganizationIds,
    ...teamDerivedOrganizationIds,
    ...roleVisibleOrganizationIds,
  ]);
}

export function listTeamIdsVisibleByMembership(
  database: AppDatabase,
  userId: number,
): number[] {
  const directTeamIds = database
    .select({ teamId: teamsUsers.teamId })
    .from(teamsUsers)
    .where(eq(teamsUsers.userId, userId))
    .all()
    .map((row) => row.teamId);
  const roleVisibleTeamIds = database
    .select({ teamId: usersTeamsTeamRoles.teamId })
    .from(usersTeamsTeamRoles)
    .where(eq(usersTeamsTeamRoles.userId, userId))
    .all()
    .map((row) => row.teamId);
  const organizationDerivedTeamIds = listOrganizationIdsVisibleByMembership(database, userId)
    .flatMap((organizationId) => listTeamIdsForOrganization(database, organizationId));

  return uniqueNumberValues([
    ...directTeamIds,
    ...roleVisibleTeamIds,
    ...organizationDerivedTeamIds,
  ]);
}

export function listProjectIdsVisibleByMembership(
  database: AppDatabase,
  userId: number,
): number[] {
  const directProjectIds = database
    .select({ projectId: projectsUsers.projectId })
    .from(projectsUsers)
    .where(eq(projectsUsers.userId, userId))
    .all()
    .map((row) => row.projectId);
  const teamDerivedProjectIds = listTeamIdsVisibleByMembership(database, userId)
    .flatMap((teamId) => listProjectIdsForTeam(database, teamId));
  const organizationDerivedProjectIds = listOrganizationIdsVisibleByMembership(database, userId)
    .flatMap((organizationId) => listProjectIdsForOrganization(database, organizationId));

  return uniqueNumberValues([
    ...directProjectIds,
    ...teamDerivedProjectIds,
    ...organizationDerivedProjectIds,
  ]);
}

export function listDirectProjectManagerUserIds(
  database: AppDatabase,
  projectId: number,
): number[] {
  return listDirectProjectRoleUserIds(
    database,
    projectId,
    PROJECT_MANAGER_ROLE_CODE,
  );
}

export function listDirectProjectOwnerUserIds(
  database: AppDatabase,
  projectId: number,
): number[] {
  return listDirectProjectRoleUserIds(
    database,
    projectId,
    PROJECT_OWNER_ROLE_CODE,
  );
}

function listDirectProjectRoleUserIds(
  database: AppDatabase,
  projectId: number,
  roleCode: string,
): number[] {
  return database
    .select({ userId: usersProjectsProjectRoles.userId })
    .from(usersProjectsProjectRoles)
    .where(and(
      eq(usersProjectsProjectRoles.projectId, projectId),
      eq(usersProjectsProjectRoles.roleCode, roleCode),
    ))
    .all()
    .map((row) => row.userId);
}

export function listDirectTeamManagerUserIds(
  database: AppDatabase,
  teamId: number,
): number[] {
  return listTeamRoleUserIds(database, teamId, TEAM_MANAGER_ROLE_CODE);
}

export function listTeamProjectManagerUserIds(
  database: AppDatabase,
  teamId: number,
): number[] {
  return listTeamRoleUserIds(database, teamId, TEAM_PROJECT_MANAGER_ROLE_CODE);
}

export function listOrganizationRoleUserIds(
  database: AppDatabase,
  organizationId: number,
  roleCode: string,
): number[] {
  return database
    .select({ userId: usersOrganizationsOrganizationRoles.userId })
    .from(usersOrganizationsOrganizationRoles)
    .where(and(
      eq(usersOrganizationsOrganizationRoles.organizationId, organizationId),
      eq(usersOrganizationsOrganizationRoles.roleCode, roleCode),
    ))
    .all()
    .map((row) => row.userId);
}

export function listOrganizationProjectManagerUserIdsForProject(
  database: AppDatabase,
  projectId: number,
): number[] {
  return uniqueNumberValues(
    listOrganizationIdsForProject(database, projectId).flatMap((organizationId) =>
      listOrganizationRoleUserIds(
        database,
        organizationId,
        ORGANIZATION_PROJECT_MANAGER_ROLE_CODE,
      )
    ),
  );
}

export function listIndirectProjectManagerUserIds(
  database: AppDatabase,
  projectId: number,
): number[] {
  return database
    .select({ userId: usersTeamsTeamRoles.userId })
    .from(projectsTeams)
    .innerJoin(
      usersTeamsTeamRoles,
      eq(usersTeamsTeamRoles.teamId, projectsTeams.teamId),
    )
    .innerJoin(
      teamsUsers,
      and(
        eq(teamsUsers.teamId, usersTeamsTeamRoles.teamId),
        eq(teamsUsers.userId, usersTeamsTeamRoles.userId),
      ),
    )
    .where(and(
      eq(projectsTeams.projectId, projectId),
      eq(usersTeamsTeamRoles.roleCode, TEAM_PROJECT_MANAGER_ROLE_CODE),
    ))
    .all()
    .map((row) => row.userId);
}

export function listEffectiveProjectManagerUserIds(
  database: AppDatabase,
  projectId: number,
): number[] {
  return uniqueNumberValues([
    ...listDirectProjectManagerUserIds(database, projectId),
    ...listIndirectProjectManagerUserIds(database, projectId),
    ...listOrganizationProjectManagerUserIdsForProject(database, projectId),
  ]);
}

export function listEffectiveTeamManagerUserIds(
  database: AppDatabase,
  teamId: number,
): number[] {
  const organizationId = getOrganizationIdForTeam(database, teamId);

  return uniqueNumberValues([
    ...listDirectTeamManagerUserIds(database, teamId),
    ...(organizationId === null
      ? []
      : listOrganizationRoleUserIds(
        database,
        organizationId,
        ORGANIZATION_TEAM_MANAGER_ROLE_CODE,
      )),
  ]);
}

export function hasDirectProjectManagerRole(
  database: AppDatabase,
  projectId: number,
  userId: number,
): boolean {
  return listDirectProjectManagerUserIds(database, projectId).includes(userId);
}

export function hasDirectProjectOwnerRole(
  database: AppDatabase,
  projectId: number,
  userId: number,
): boolean {
  return listDirectProjectOwnerUserIds(database, projectId).includes(userId);
}

export function hasEffectiveProjectManagerRole(
  database: AppDatabase,
  projectId: number,
  userId: number,
): boolean {
  return listEffectiveProjectManagerUserIds(database, projectId).includes(userId);
}

export function hasDirectTeamManagerRole(
  database: AppDatabase,
  teamId: number,
  userId: number,
): boolean {
  return listDirectTeamManagerUserIds(database, teamId).includes(userId);
}

export function hasEffectiveTeamManagerRole(
  database: AppDatabase,
  teamId: number,
  userId: number,
): boolean {
  return listEffectiveTeamManagerUserIds(database, teamId).includes(userId);
}

export function hasTeamProjectManagerRole(
  database: AppDatabase,
  teamId: number,
  userId: number,
): boolean {
  return hasTeamRole(database, teamId, userId, TEAM_PROJECT_MANAGER_ROLE_CODE);
}

export function hasAnyTeamRole(
  database: AppDatabase,
  teamId: number,
  userId: number,
): boolean {
  return Boolean(
    database
      .select({ id: usersTeamsTeamRoles.id })
      .from(usersTeamsTeamRoles)
      .where(and(
        eq(usersTeamsTeamRoles.teamId, teamId),
        eq(usersTeamsTeamRoles.userId, userId),
      ))
      .get(),
  );
}

export function hasOrganizationProjectManagerRoleForProject(
  database: AppDatabase,
  projectId: number,
  userId: number,
): boolean {
  return listOrganizationProjectManagerUserIdsForProject(database, projectId)
    .includes(userId);
}

export function hasOrganizationTeamManagerRoleForTeam(
  database: AppDatabase,
  teamId: number,
  userId: number,
): boolean {
  const organizationId = getOrganizationIdForTeam(database, teamId);

  if (organizationId === null) {
    return false;
  }

  return listOrganizationRoleUserIds(
    database,
    organizationId,
    ORGANIZATION_TEAM_MANAGER_ROLE_CODE,
  ).includes(userId);
}

export function hasOrganizationManagerRole(
  database: AppDatabase,
  organizationId: number,
  userId: number,
): boolean {
  return listOrganizationRoleUserIds(
    database,
    organizationId,
    ORGANIZATION_MANAGER_ROLE_CODE,
  ).includes(userId);
}

export function hasProjectAccess(
  database: AppDatabase,
  projectId: number,
  userId: number,
): boolean {
  if (hasDirectProjectMembership(database, projectId, userId)) {
    return true;
  }

  if (hasEffectiveProjectManagerRole(database, projectId, userId)) {
    return true;
  }

  if (
    listOrganizationIdsForProject(database, projectId).some((organizationId) =>
      hasOrganizationMembership(database, organizationId, userId)
    )
  ) {
    return true;
  }

  return Boolean(
    database
      .select({ projectId: projectsTeams.projectId })
      .from(projectsTeams)
      .innerJoin(teamsUsers, eq(teamsUsers.teamId, projectsTeams.teamId))
      .where(and(
        eq(projectsTeams.projectId, projectId),
        eq(teamsUsers.userId, userId),
      ))
      .get(),
  );
}

function listTeamRoleUserIds(
  database: AppDatabase,
  teamId: number,
  roleCode: string,
): number[] {
  return database
    .select({ userId: usersTeamsTeamRoles.userId })
    .from(usersTeamsTeamRoles)
    .where(and(
      eq(usersTeamsTeamRoles.teamId, teamId),
      eq(usersTeamsTeamRoles.roleCode, roleCode),
    ))
    .all()
    .map((row) => row.userId);
}

function hasTeamRole(
  database: AppDatabase,
  teamId: number,
  userId: number,
  roleCode: string,
): boolean {
  return Boolean(
    database
      .select({ id: usersTeamsTeamRoles.id })
      .from(usersTeamsTeamRoles)
      .where(and(
        eq(usersTeamsTeamRoles.teamId, teamId),
        eq(usersTeamsTeamRoles.userId, userId),
        eq(usersTeamsTeamRoles.roleCode, roleCode),
      ))
      .get(),
  );
}
