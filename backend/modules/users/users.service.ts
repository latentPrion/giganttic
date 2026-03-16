import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";

import {
  organizationsTeams,
  projectsUsers,
  teamsUsers,
  users,
  usersCredentialTypes,
  usersOrganizations,
  usersOrganizationsOrganizationRoles,
  usersSessions,
  usersProjectsProjectRoles,
  usersTeamsTeamRoles,
} from "../../../db/index.js";
import {
  getOrganizationIdForTeam,
  hasOrganizationProjectManagerRoleForProject,
  hasOrganizationTeamManagerRoleForTeam,
  hasSystemAdminRole,
  listDirectProjectOwnerUserIds,
  listEffectiveProjectManagerUserIds,
  listEffectiveTeamManagerUserIds,
  listProjectIdsForOrganization,
  listProjectIdsForTeam,
  TEAM_MANAGER_ROLE_CODE,
  TEAM_PROJECT_MANAGER_ROLE_CODE,
  uniqueNumberValues,
} from "../access-control/access-control.utils.js";
import type { AuthContext } from "../auth/auth.types.js";
import { DatabaseService } from "../database/database.service.js";
import {
  BLOCKING_OBJECT_KIND_PROJECT,
  BLOCKING_OBJECT_KIND_TEAM,
  BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_PROJECT_MANAGER,
  BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_TEAM_MANAGER,
  BLOCKING_OBJECT_REASON_LAST_OWNER,
  createBlockingConflictException,
} from "../access-control/blocking-conflicts.js";
import type { DeleteUserResponse } from "./users.contracts.js";

const LAST_OWNER_DELETE_MESSAGE = "User delete would remove the last owner";
const LAST_PROJECT_MANAGER_DELETE_MESSAGE =
  "User delete would remove the last effective project manager";
const LAST_TEAM_MANAGER_DELETE_MESSAGE =
  "User delete would remove the last effective team manager";

@Injectable()
export class UsersService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async deleteUser(
    authContext: AuthContext,
    userId: number,
  ): Promise<DeleteUserResponse> {
    this.assertUserExists(userId);
    this.assertCanDeleteUser(authContext, userId);
    this.assertUserDeletionPreservesProjectOwners(userId);
    this.assertUserDeletionPreservesTeamManagers(userId);
    this.assertUserDeletionPreservesProjectManagers(userId);

    this.databaseService.db.transaction((tx) => {
      tx.delete(usersSessions)
        .where(eq(usersSessions.userId, userId))
        .run();
      tx.delete(usersProjectsProjectRoles)
        .where(eq(usersProjectsProjectRoles.userId, userId))
        .run();
      tx.delete(usersTeamsTeamRoles)
        .where(eq(usersTeamsTeamRoles.userId, userId))
        .run();
      tx.delete(usersOrganizationsOrganizationRoles)
        .where(eq(usersOrganizationsOrganizationRoles.userId, userId))
        .run();
      tx.delete(projectsUsers)
        .where(eq(projectsUsers.userId, userId))
        .run();
      tx.delete(teamsUsers)
        .where(eq(teamsUsers.userId, userId))
        .run();
      tx.delete(usersOrganizations)
        .where(eq(usersOrganizations.userId, userId))
        .run();
      tx.delete(usersCredentialTypes)
        .where(eq(usersCredentialTypes.userId, userId))
        .run();
      tx.delete(users)
        .where(eq(users.id, userId))
        .run();
    });
    return { deletedUserId: userId };
  }

  private assertCanDeleteUser(authContext: AuthContext, userId: number): void {
    if (authContext.userId === userId || hasSystemAdminRole(authContext)) {
      return;
    }

    throw new ForbiddenException("Not permitted to delete that user");
  }

  private assertUserDeletionPreservesProjectOwners(userId: number): void {
    for (const projectId of this.listOwnedProjectIds(userId)) {
      const remainingOwnerIds = listDirectProjectOwnerUserIds(
        this.databaseService.db,
        projectId,
      ).filter((ownerUserId) => ownerUserId !== userId);

      if (remainingOwnerIds.length === 0) {
        throw createBlockingConflictException(LAST_OWNER_DELETE_MESSAGE, [
          {
            id: projectId,
            kind: BLOCKING_OBJECT_KIND_PROJECT,
            reason: BLOCKING_OBJECT_REASON_LAST_OWNER,
          },
        ]);
      }
    }
  }

  private assertUserDeletionPreservesProjectManagers(userId: number): void {
    for (const projectId of this.listAffectedProjectIds(userId)) {
      const remainingManagerIds = listEffectiveProjectManagerUserIds(
        this.databaseService.db,
        projectId,
      ).filter((managerUserId) => managerUserId !== userId);

      if (remainingManagerIds.length === 0) {
        throw createBlockingConflictException(LAST_PROJECT_MANAGER_DELETE_MESSAGE, [
          {
            id: projectId,
            kind: BLOCKING_OBJECT_KIND_PROJECT,
            reason: BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_PROJECT_MANAGER,
          },
        ]);
      }
    }
  }

  private assertUserDeletionPreservesTeamManagers(userId: number): void {
    for (const teamId of this.listManagedTeamIds(userId)) {
      const remainingManagerIds = listEffectiveTeamManagerUserIds(
        this.databaseService.db,
        teamId,
      ).filter((managerUserId) => managerUserId !== userId);

      if (remainingManagerIds.length === 0) {
        throw createBlockingConflictException(LAST_TEAM_MANAGER_DELETE_MESSAGE, [
          {
            id: teamId,
            kind: BLOCKING_OBJECT_KIND_TEAM,
            reason: BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_TEAM_MANAGER,
          },
        ]);
      }
    }
  }

  private assertUserExists(userId: number): void {
    const user = this.databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) {
      throw new NotFoundException("User not found");
    }
  }

  private listAffectedProjectIds(userId: number): number[] {
    const directProjectIds = this.databaseService.db
      .select({ projectId: usersProjectsProjectRoles.projectId })
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.userId, userId))
      .all()
      .map((row) => row.projectId);
    const teamProjectIds = this.listProjectManagerTeamIds(userId)
      .flatMap((teamId) => listProjectIdsForTeam(this.databaseService.db, teamId));

    return uniqueNumberValues([...directProjectIds, ...teamProjectIds]);
  }

  private listOwnedProjectIds(userId: number): number[] {
    return this.databaseService.db
      .select({ projectId: usersProjectsProjectRoles.projectId })
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.userId, userId))
      .all()
      .filter((row) =>
        listDirectProjectOwnerUserIds(this.databaseService.db, row.projectId)
          .includes(userId)
      )
      .map((row) => row.projectId)
      .filter((projectId, index, values) => values.indexOf(projectId) === index);
  }

  private listManagedTeamIds(userId: number): number[] {
    const directTeamIds = this.databaseService.db
      .select({ teamId: usersTeamsTeamRoles.teamId })
      .from(usersTeamsTeamRoles)
      .where(eq(usersTeamsTeamRoles.userId, userId))
      .all()
      .filter((row) => row.teamId > 0)
      .map((row) => row.teamId)
      .filter((teamId, index, values) => values.indexOf(teamId) === index);
    const organizationTeamIds = this.listOrganizationManagedTeamIds(userId);

    return uniqueNumberValues([...directTeamIds, ...organizationTeamIds])
      .filter((teamId) => this.hasEffectiveTeamManagerRoleForDeletion(userId, teamId));
  }

  private listProjectManagerTeamIds(userId: number): number[] {
    const directTeamIds = this.databaseService.db
      .select({ teamId: usersTeamsTeamRoles.teamId })
      .from(usersTeamsTeamRoles)
      .where(eq(usersTeamsTeamRoles.userId, userId))
      .all()
      .filter((row) => row.teamId > 0)
      .map((row) => row.teamId)
      .filter((teamId, index, values) => values.indexOf(teamId) === index);
    const organizationProjectTeamIds = this.listOrganizationProjectManagerTeamIds(userId);

    return uniqueNumberValues([...directTeamIds, ...organizationProjectTeamIds])
      .filter((teamId) => this.hasEffectiveProjectManagerViaTeam(userId, teamId));
  }

  private hasTeamProjectManagerRole(userId: number, teamId: number): boolean {
    return this.databaseService.db
      .select({
        roleCode: usersTeamsTeamRoles.roleCode,
        teamId: usersTeamsTeamRoles.teamId,
      })
      .from(usersTeamsTeamRoles)
      .where(eq(usersTeamsTeamRoles.userId, userId))
      .all()
      .some((row) =>
        row.roleCode === TEAM_PROJECT_MANAGER_ROLE_CODE &&
        row.teamId === teamId
      );
  }

  private hasEffectiveProjectManagerViaTeam(userId: number, teamId: number): boolean {
    if (this.hasTeamProjectManagerRole(userId, teamId)) {
      return true;
    }

    return listProjectIdsForTeam(this.databaseService.db, teamId).some((projectId) =>
      hasOrganizationProjectManagerRoleForProject(
        this.databaseService.db,
        projectId,
        userId,
      )
    );
  }

  private hasEffectiveTeamManagerRoleForDeletion(userId: number, teamId: number): boolean {
    return this.hasTeamManagerRole(userId, teamId) ||
      hasOrganizationTeamManagerRoleForTeam(this.databaseService.db, teamId, userId);
  }

  private hasTeamManagerRole(userId: number, teamId: number): boolean {
    return this.databaseService.db
      .select({
        roleCode: usersTeamsTeamRoles.roleCode,
        teamId: usersTeamsTeamRoles.teamId,
      })
      .from(usersTeamsTeamRoles)
      .where(eq(usersTeamsTeamRoles.userId, userId))
      .all()
      .some((row) =>
        row.roleCode === TEAM_MANAGER_ROLE_CODE &&
        row.teamId === teamId
      );
  }

  private listOrganizationManagedTeamIds(userId: number): number[] {
    const organizationIds = this.listOrganizationIdsForUser(userId);

    return uniqueNumberValues(
      organizationIds.flatMap((organizationId) =>
        this.databaseService.db
          .select({ teamId: organizationsTeams.teamId })
          .from(organizationsTeams)
          .where(eq(organizationsTeams.organizationId, organizationId))
          .all()
          .map((row) => row.teamId)
      ),
    );
  }

  private listOrganizationProjectManagerTeamIds(userId: number): number[] {
    const organizationIds = this.listOrganizationIdsForUser(userId);
    const organizationProjectIds = uniqueNumberValues(
      organizationIds.flatMap((organizationId) =>
        listProjectIdsForOrganization(this.databaseService.db, organizationId)
      ),
    );
    const teamIds = this.databaseService.db
      .select({ teamId: organizationsTeams.teamId })
      .from(organizationsTeams)
      .all()
      .map((row) => row.teamId);

    return uniqueNumberValues(
      teamIds.filter((teamId) => {
        const organizationId = getOrganizationIdForTeam(this.databaseService.db, teamId);

        return organizationId !== null &&
          organizationIds.includes(organizationId) &&
          listProjectIdsForTeam(this.databaseService.db, teamId)
            .some((projectId) => organizationProjectIds.includes(projectId));
      }),
    );
  }

  private listOrganizationIdsForUser(userId: number): number[] {
    return this.databaseService.db
      .select({ organizationId: usersOrganizationsOrganizationRoles.organizationId })
      .from(usersOrganizationsOrganizationRoles)
      .where(eq(usersOrganizationsOrganizationRoles.userId, userId))
      .all()
      .map((row) => row.organizationId)
      .filter((organizationId, index, values) => values.indexOf(organizationId) === index);
  }
}
