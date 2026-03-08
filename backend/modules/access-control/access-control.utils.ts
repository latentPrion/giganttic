import { and, eq, inArray } from "drizzle-orm";

import type { SQLJsDatabase } from "drizzle-orm/sql-js";

import {
  projectRoleCodes,
  projectsTeams,
  projectsUsers,
  systemRoleCodes,
  teamsUsers,
  users,
  usersProjectsProjectRoles,
  usersTeamsTeamRoles,
} from "../../../db/index.js";
import type { DatabaseService } from "../database/database.service.js";
import type { AuthContext } from "../auth/auth.types.js";

export const SYSTEM_ADMIN_ROLE_CODE = systemRoleCodes.admin;
export const PROJECT_MANAGER_ROLE_CODE = projectRoleCodes.projectManager;
export const TEAM_MANAGER_ROLE_CODE = "GGTC_TEAMROLE_TEAM_MANAGER";
export const TEAM_PROJECT_MANAGER_ROLE_CODE = "GGTC_TEAMROLE_PROJECT_MANAGER";

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

export function listDirectProjectManagerUserIds(
  database: AppDatabase,
  projectId: number,
): number[] {
  return database
    .select({ userId: usersProjectsProjectRoles.userId })
    .from(usersProjectsProjectRoles)
    .where(and(
      eq(usersProjectsProjectRoles.projectId, projectId),
      eq(usersProjectsProjectRoles.roleCode, PROJECT_MANAGER_ROLE_CODE),
    ))
    .all()
    .map((row) => row.userId);
}

export function listTeamManagerUserIds(
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
  ]);
}

export function hasDirectProjectManagerRole(
  database: AppDatabase,
  projectId: number,
  userId: number,
): boolean {
  return listDirectProjectManagerUserIds(database, projectId).includes(userId);
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
  return listTeamManagerUserIds(database, teamId).includes(userId);
}

export function hasTeamProjectManagerRole(
  database: AppDatabase,
  teamId: number,
  userId: number,
): boolean {
  return listTeamProjectManagerUserIds(database, teamId).includes(userId);
}

export function hasProjectAccess(
  database: AppDatabase,
  projectId: number,
  userId: number,
): boolean {
  if (hasDirectProjectMembership(database, projectId, userId)) {
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
    .innerJoin(
      teamsUsers,
      and(
        eq(teamsUsers.teamId, usersTeamsTeamRoles.teamId),
        eq(teamsUsers.userId, usersTeamsTeamRoles.userId),
      ),
    )
    .where(and(
      eq(usersTeamsTeamRoles.teamId, teamId),
      eq(usersTeamsTeamRoles.roleCode, roleCode),
    ))
    .all()
    .map((row) => row.userId);
}
