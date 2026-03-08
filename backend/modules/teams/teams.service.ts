import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  projectsOrganizations,
  projectsTeams,
  teams,
  teamsUsers,
  users,
  usersOrganizationsOrganizationRoles,
  usersTeamsTeamRoles,
} from "../../../db/index.js";
import {
  assertUsersExistOrThrow,
  getOrganizationIdForTeam,
  hasEffectiveTeamManagerRole,
  hasOrganizationMembership,
  hasOrganizationTeamManagerRoleForTeam,
  hasSystemAdminRole,
  hasTeamMembership,
  hasTeamProjectManagerRole,
  listDirectProjectManagerUserIds,
  listEffectiveTeamManagerUserIds,
  listProjectIdsForTeam,
  listTeamIdsForProject,
  listTeamProjectManagerUserIds,
  ORGANIZATION_PROJECT_MANAGER_ROLE_CODE,
  TEAM_MANAGER_ROLE_CODE,
  TEAM_PROJECT_MANAGER_ROLE_CODE,
} from "../access-control/access-control.utils.js";
import type { AuthContext } from "../auth/auth.types.js";
import { DatabaseService } from "../database/database.service.js";
import type {
  CreateTeamRequest,
  DeleteTeamResponse,
  GetTeamResponse,
  ListTeamsResponse,
  TeamMember,
  TeamResponse,
  TeamRoleAssignmentRequest,
  UpdateTeamMembershipRequest,
  UpdateTeamMembershipResponse,
  UpdateTeamRequest,
  UpdateTeamRoleAssignmentResponse,
} from "./teams.contracts.js";

const LAST_LINKED_PROJECT_MANAGER_MESSAGE =
  "Deleting or downgrading that team would strand at least one linked project without a PROJECT_MANAGER";
const LAST_TEAM_MANAGER_MESSAGE =
  "A team must retain at least one TEAM_MANAGER member";
const TEAM_ROLE_ALREADY_ASSIGNED_MESSAGE = "That team role is already assigned";
const TEAM_ROLE_NOT_ASSIGNED_MESSAGE =
  "That team role assignment was not found";
const TEAM_ROLE_REQUIRES_MEMBERSHIP_MESSAGE =
  "A team role requires team membership";

function normalizeDescription(
  description: string | null | undefined,
): string | null {
  if (description === undefined || description === null) {
    return description ?? null;
  }

  return description.trim();
}

function toTeamResponse(team: typeof teams.$inferSelect): TeamResponse {
  return {
    createdAt: team.createdAt.toISOString(),
    description: team.description ?? null,
    id: team.id,
    name: team.name,
    updatedAt: team.updatedAt.toISOString(),
  };
}

function createMembershipRoleRows(
  teamId: number,
  payload: UpdateTeamMembershipRequest,
) {
  return payload.members.flatMap((member) =>
    member.roleCodes.map((roleCode) => ({
      roleCode,
      teamId,
      userId: member.userId,
    })));
}

function createMembershipRows(teamId: number, payload: UpdateTeamMembershipRequest) {
  return payload.members.map((member) => ({
    teamId,
    userId: member.userId,
  }));
}

function extractTeamManagerIds(
  payload: UpdateTeamMembershipRequest,
): number[] {
  return payload.members
    .filter((member) => member.roleCodes.includes(TEAM_MANAGER_ROLE_CODE))
    .map((member) => member.userId);
}

function extractTeamProjectManagerIds(
  payload: UpdateTeamMembershipRequest,
): number[] {
  return payload.members
    .filter((member) => member.roleCodes.includes(TEAM_PROJECT_MANAGER_ROLE_CODE))
    .map((member) => member.userId);
}

@Injectable()
export class TeamsService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async createTeam(
    authContext: AuthContext,
    payload: CreateTeamRequest,
  ): Promise<{ team: TeamResponse }> {
    const createdTeamId = this.databaseService.db.transaction((tx) => {
      const [createdTeam] = tx.insert(teams)
        .values({
          description: normalizeDescription(payload.description),
          name: payload.name.trim(),
        })
        .returning({ id: teams.id })
        .all();

      tx.insert(teamsUsers)
        .values({
          teamId: createdTeam.id,
          userId: authContext.userId,
        })
        .run();
      tx.insert(usersTeamsTeamRoles)
        .values({
          roleCode: TEAM_MANAGER_ROLE_CODE,
          teamId: createdTeam.id,
          userId: authContext.userId,
        })
        .run();

      return createdTeam.id;
    });
    await this.databaseService.persist();

    return { team: this.getTeamRecordByIdOrThrow(createdTeamId) };
  }

  listTeams(authContext: AuthContext): ListTeamsResponse {
    if (hasSystemAdminRole(authContext)) {
      return {
        teams: this.databaseService.db
          .select()
          .from(teams)
          .orderBy(asc(teams.id))
          .all()
          .map(toTeamResponse),
      };
    }

    const teamIds = this.databaseService.db
      .select({ teamId: teamsUsers.teamId })
      .from(teamsUsers)
      .where(eq(teamsUsers.userId, authContext.userId))
      .all()
      .map((row) => row.teamId);

    if (teamIds.length === 0) {
      return { teams: [] };
    }

    return {
      teams: this.databaseService.db
        .select()
        .from(teams)
        .where(inArray(teams.id, teamIds))
        .orderBy(asc(teams.id))
        .all()
        .map(toTeamResponse),
    };
  }

  getTeam(authContext: AuthContext, teamId: number): GetTeamResponse {
    this.assertTeamExists(teamId);
    this.assertCanViewTeam(authContext, teamId);

    return {
      members: this.listTeamMembers(teamId),
      team: this.getTeamRecordByIdOrThrow(teamId),
    };
  }

  async updateTeam(
    authContext: AuthContext,
    teamId: number,
    payload: UpdateTeamRequest,
  ): Promise<{ team: TeamResponse }> {
    this.assertTeamExists(teamId);
    this.assertCanManageTeam(authContext, teamId);

    this.databaseService.db.transaction((tx) => {
      tx.update(teams)
        .set({
          description: payload.description === undefined
            ? undefined
            : normalizeDescription(payload.description),
          name: payload.name?.trim(),
          updatedAt: new Date(),
        })
        .where(eq(teams.id, teamId))
        .run();
    });
    await this.databaseService.persist();

    return { team: this.getTeamRecordByIdOrThrow(teamId) };
  }

  async replaceTeamMembers(
    authContext: AuthContext,
    teamId: number,
    payload: UpdateTeamMembershipRequest,
  ): Promise<UpdateTeamMembershipResponse> {
    this.assertTeamExists(teamId);
    this.assertCanManageTeam(authContext, teamId);
    this.assertUsersExist(payload.members.map((member) => member.userId));
    this.assertTeamRetainsManagerAfterMembershipReplace(teamId, payload);
    this.assertLinkedProjectsRetainManagers(
      teamId,
      extractTeamProjectManagerIds(payload),
      false,
    );

    this.databaseService.db.transaction((tx) => {
      tx.delete(usersTeamsTeamRoles)
        .where(eq(usersTeamsTeamRoles.teamId, teamId))
        .run();
      tx.delete(teamsUsers)
        .where(eq(teamsUsers.teamId, teamId))
        .run();
      tx.insert(teamsUsers)
        .values(createMembershipRows(teamId, payload))
        .run();

      const roleRows = createMembershipRoleRows(teamId, payload);
      if (roleRows.length > 0) {
        tx.insert(usersTeamsTeamRoles).values(roleRows).run();
      }
    });
    await this.databaseService.persist();

    return this.buildTeamMembershipResponse(teamId);
  }

  async grantTeamRole(
    authContext: AuthContext,
    teamId: number,
    payload: TeamRoleAssignmentRequest,
  ): Promise<UpdateTeamRoleAssignmentResponse> {
    this.assertTeamExists(teamId);
    this.assertUsersExist([payload.userId]);
    this.assertCanGrantTeamRole(authContext, teamId, payload);
    this.assertCanTargetTeamRole(authContext, teamId, payload);
    this.assertTeamRoleAbsent(teamId, payload.userId, payload.roleCode);

    this.databaseService.db.transaction((tx) => {
      this.ensureTeamMembershipForRoleGrant(tx, authContext, teamId, payload);
      tx.insert(usersTeamsTeamRoles)
        .values({
          roleCode: payload.roleCode,
          teamId,
          userId: payload.userId,
        })
        .run();
    });
    await this.databaseService.persist();

    return this.buildTeamMembershipResponse(teamId);
  }

  async revokeTeamRole(
    authContext: AuthContext,
    teamId: number,
    payload: TeamRoleAssignmentRequest,
  ): Promise<UpdateTeamRoleAssignmentResponse> {
    this.assertTeamExists(teamId);
    this.assertUsersExist([payload.userId]);
    this.assertCanRevokeTeamRole(authContext, teamId, payload);
    this.assertTeamRolePresent(teamId, payload.userId, payload.roleCode);
    this.assertTeamRetainsManagerAfterRoleRevoke(teamId, payload);
    this.assertLinkedProjectsRetainManagersAfterRoleRevoke(teamId, payload);

    this.databaseService.db.transaction((tx) => {
      tx.delete(usersTeamsTeamRoles)
        .where(and(
          eq(usersTeamsTeamRoles.teamId, teamId),
          eq(usersTeamsTeamRoles.roleCode, payload.roleCode),
          eq(usersTeamsTeamRoles.userId, payload.userId),
        ))
        .run();
    });
    await this.databaseService.persist();

    return this.buildTeamMembershipResponse(teamId);
  }

  async deleteTeam(
    authContext: AuthContext,
    teamId: number,
  ): Promise<DeleteTeamResponse> {
    this.assertTeamExists(teamId);
    this.assertCanDeleteTeam(authContext, teamId);
    this.assertLinkedProjectsRetainManagers(teamId, [], true);

    this.databaseService.db.transaction((tx) => {
      tx.delete(usersTeamsTeamRoles)
        .where(eq(usersTeamsTeamRoles.teamId, teamId))
        .run();
      tx.delete(teamsUsers)
        .where(eq(teamsUsers.teamId, teamId))
        .run();
      tx.delete(projectsTeams)
        .where(eq(projectsTeams.teamId, teamId))
        .run();
      tx.delete(teams)
        .where(eq(teams.id, teamId))
        .run();
    });
    await this.databaseService.persist();

    return { deletedTeamId: teamId };
  }

  private assertCanDeleteTeam(authContext: AuthContext, teamId: number): void {
    if (hasEffectiveTeamManagerRole(this.databaseService.db, teamId, authContext.userId)) {
      return;
    }

    throw new ForbiddenException("Not permitted to delete that team");
  }

  private assertCanGrantTeamRole(
    authContext: AuthContext,
    teamId: number,
    payload: TeamRoleAssignmentRequest,
  ): void {
    if (payload.roleCode === TEAM_MANAGER_ROLE_CODE) {
      if (
        hasSystemAdminRole(authContext) ||
        hasEffectiveTeamManagerRole(this.databaseService.db, teamId, authContext.userId)
      ) {
        return;
      }
    }

    if (
      payload.roleCode === TEAM_PROJECT_MANAGER_ROLE_CODE &&
      (
        hasTeamProjectManagerRole(this.databaseService.db, teamId, authContext.userId) ||
        this.canOrganizationTeamManagerGrantTeamProjectManager(
          authContext,
          teamId,
        )
      )
    ) {
      return;
    }

    throw new ForbiddenException("Not permitted to grant that team role");
  }

  private assertCanManageTeam(authContext: AuthContext, teamId: number): void {
    if (
      hasSystemAdminRole(authContext) ||
      hasEffectiveTeamManagerRole(this.databaseService.db, teamId, authContext.userId)
    ) {
      return;
    }

    throw new ForbiddenException("Not permitted to manage that team");
  }

  private assertCanRevokeTeamRole(
    authContext: AuthContext,
    teamId: number,
    payload: TeamRoleAssignmentRequest,
  ): void {
    if (payload.roleCode === TEAM_MANAGER_ROLE_CODE) {
      if (
        hasSystemAdminRole(authContext) ||
        hasEffectiveTeamManagerRole(this.databaseService.db, teamId, authContext.userId)
      ) {
        return;
      }
    }

    if (
      payload.roleCode === TEAM_PROJECT_MANAGER_ROLE_CODE &&
      hasTeamProjectManagerRole(this.databaseService.db, teamId, authContext.userId)
    ) {
      return;
    }

    throw new ForbiddenException("Not permitted to revoke that team role");
  }

  private assertCanTargetTeamRole(
    authContext: AuthContext,
    teamId: number,
    payload: TeamRoleAssignmentRequest,
  ): void {
    if (hasTeamMembership(this.databaseService.db, teamId, payload.userId)) {
      return;
    }

    if (
      hasSystemAdminRole(authContext) &&
      payload.userId === authContext.userId &&
      payload.roleCode === TEAM_MANAGER_ROLE_CODE
    ) {
      return;
    }

    if (
      payload.roleCode === TEAM_MANAGER_ROLE_CODE &&
      this.canOrganizationTeamManagerBootstrapMembership(authContext, teamId, payload.userId)
    ) {
      return;
    }

    throw new ConflictException(TEAM_ROLE_REQUIRES_MEMBERSHIP_MESSAGE);
  }

  private assertCanViewTeam(authContext: AuthContext, teamId: number): void {
    if (hasSystemAdminRole(authContext)) {
      return;
    }

    if (!hasTeamMembership(this.databaseService.db, teamId, authContext.userId)) {
      throw new ForbiddenException("Not permitted to access that team");
    }
  }

  private assertLinkedProjectsRetainManagers(
    teamId: number,
    replacementTeamProjectManagerIds: number[],
    treatChangedTeamAsRemoved: boolean,
  ): void {
    const linkedProjectIds = listProjectIdsForTeam(this.databaseService.db, teamId);
    for (const projectId of linkedProjectIds) {
      if (
        this.listEffectiveManagerIdsForTeamChange(
          projectId,
          teamId,
          replacementTeamProjectManagerIds,
          treatChangedTeamAsRemoved,
        ).length === 0
      ) {
        throw new ConflictException(LAST_LINKED_PROJECT_MANAGER_MESSAGE);
      }
    }
  }

  private assertLinkedProjectsRetainManagersAfterRoleRevoke(
    teamId: number,
    payload: TeamRoleAssignmentRequest,
  ): void {
    if (payload.roleCode !== TEAM_PROJECT_MANAGER_ROLE_CODE) {
      return;
    }

    const replacementTeamProjectManagerIds = listTeamProjectManagerUserIds(
      this.databaseService.db,
      teamId,
    ).filter((userId) => userId !== payload.userId);

    this.assertLinkedProjectsRetainManagers(
      teamId,
      replacementTeamProjectManagerIds,
      false,
    );
  }

  private assertTeamExists(teamId: number): void {
    const team = this.databaseService.db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (!team) {
      throw new NotFoundException("Team not found");
    }
  }

  private assertTeamRetainsManagerAfterMembershipReplace(
    teamId: number,
    payload: UpdateTeamMembershipRequest,
  ): void {
    const effectiveManagerIds = new Set([
      ...extractTeamManagerIds(payload),
      ...this.listRetainedOrganizationTeamManagerIds(teamId),
    ]);

    if (effectiveManagerIds.size === 0) {
      throw new ConflictException(LAST_TEAM_MANAGER_MESSAGE);
    }
  }

  private assertTeamRetainsManagerAfterRoleRevoke(
    teamId: number,
    payload: TeamRoleAssignmentRequest,
  ): void {
    if (payload.roleCode !== TEAM_MANAGER_ROLE_CODE) {
      return;
    }

    const remainingManagerIds = listEffectiveTeamManagerUserIds(this.databaseService.db, teamId)
      .filter((userId) => userId !== payload.userId);

    if (remainingManagerIds.length === 0) {
      throw new ConflictException(LAST_TEAM_MANAGER_MESSAGE);
    }
  }

  private assertTeamRoleAbsent(
    teamId: number,
    userId: number,
    roleCode: string,
  ): void {
    const existingRow = this.databaseService.db
      .select({ id: usersTeamsTeamRoles.id })
      .from(usersTeamsTeamRoles)
      .where(and(
        eq(usersTeamsTeamRoles.teamId, teamId),
        eq(usersTeamsTeamRoles.roleCode, roleCode),
        eq(usersTeamsTeamRoles.userId, userId),
      ))
      .get();

    if (existingRow) {
      throw new ConflictException(TEAM_ROLE_ALREADY_ASSIGNED_MESSAGE);
    }
  }

  private assertTeamRolePresent(
    teamId: number,
    userId: number,
    roleCode: string,
  ): void {
    const existingRow = this.databaseService.db
      .select({ id: usersTeamsTeamRoles.id })
      .from(usersTeamsTeamRoles)
      .where(and(
        eq(usersTeamsTeamRoles.teamId, teamId),
        eq(usersTeamsTeamRoles.roleCode, roleCode),
        eq(usersTeamsTeamRoles.userId, userId),
      ))
      .get();

    if (!existingRow) {
      throw new NotFoundException(TEAM_ROLE_NOT_ASSIGNED_MESSAGE);
    }
  }

  private assertUsersExist(userIds: number[]): void {
    if (!assertUsersExistOrThrow(this.databaseService.db, userIds)) {
      throw new NotFoundException("One or more users were not found");
    }
  }

  private buildTeamMembershipResponse(
    teamId: number,
  ): UpdateTeamRoleAssignmentResponse {
    return {
      members: this.listTeamMembers(teamId),
      teamId,
    };
  }

  private ensureTeamMembershipForRoleGrant(
    tx: DatabaseService["db"],
    authContext: AuthContext,
    teamId: number,
    payload: TeamRoleAssignmentRequest,
  ): void {
    if (
      !hasSystemAdminRole(authContext) ||
      payload.userId !== authContext.userId ||
      payload.roleCode !== TEAM_MANAGER_ROLE_CODE ||
      hasTeamMembership(this.databaseService.db, teamId, payload.userId)
    ) {
      if (
        !this.canOrganizationTeamManagerBootstrapMembership(
          authContext,
          teamId,
          payload.userId,
        )
      ) {
        return;
      }
    }

    tx.insert(teamsUsers)
      .values({
        teamId,
        userId: payload.userId,
      })
      .run();
  }

  private getTeamRecordByIdOrThrow(teamId: number): TeamResponse {
    const team = this.databaseService.db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId))
      .get();

    if (!team) {
      throw new NotFoundException("Team not found");
    }

    return toTeamResponse(team);
  }

  private listEffectiveManagerIdsForTeamChange(
    projectId: number,
    changedTeamId: number,
    replacementTeamProjectManagerIds: number[],
    treatChangedTeamAsRemoved: boolean,
  ): number[] {
    const managerIds = new Set(listDirectProjectManagerUserIds(
      this.databaseService.db,
      projectId,
    ));
    for (const userId of this.listOrganizationProjectManagerIdsForTeamChange(
      projectId,
      changedTeamId,
      treatChangedTeamAsRemoved,
    )) {
      managerIds.add(userId);
    }

    for (const teamId of listTeamIdsForProject(this.databaseService.db, projectId)) {
      if (teamId === changedTeamId) {
        for (const userId of replacementTeamProjectManagerIds) {
          managerIds.add(userId);
        }
        continue;
      }

      for (const userId of listTeamProjectManagerUserIds(
        this.databaseService.db,
        teamId,
      )) {
        managerIds.add(userId);
      }
    }

    return [...managerIds];
  }

  private listOrganizationProjectManagerIdsForTeamChange(
    projectId: number,
    changedTeamId: number,
    treatChangedTeamAsRemoved: boolean,
  ): number[] {
    const directOrganizationIds = this.databaseService.db
      .select({ organizationId: projectsOrganizations.organizationId })
      .from(projectsOrganizations)
      .where(eq(projectsOrganizations.projectId, projectId))
      .all()
      .map((row) => row.organizationId);
    const survivingTeamOrganizationIds = listTeamIdsForProject(
      this.databaseService.db,
      projectId,
    )
      .filter((teamId) => !treatChangedTeamAsRemoved || teamId !== changedTeamId)
      .flatMap((teamId) => {
        const organizationId = getOrganizationIdForTeam(this.databaseService.db, teamId);

        return organizationId === null ? [] : [organizationId];
      });
    const organizationIds = [...new Set([
      ...directOrganizationIds,
      ...survivingTeamOrganizationIds,
    ])];

    if (organizationIds.length === 0) {
      return [];
    }

    return this.databaseService.db
      .select({ userId: usersOrganizationsOrganizationRoles.userId })
      .from(usersOrganizationsOrganizationRoles)
      .where(and(
        inArray(usersOrganizationsOrganizationRoles.organizationId, organizationIds),
        eq(
          usersOrganizationsOrganizationRoles.roleCode,
          ORGANIZATION_PROJECT_MANAGER_ROLE_CODE,
        ),
      ))
      .all()
      .map((row) => row.userId);
  }

  private canOrganizationTeamManagerBootstrapMembership(
    authContext: AuthContext,
    teamId: number,
    userId: number,
  ): boolean {
    if (hasTeamMembership(this.databaseService.db, teamId, userId)) {
      return false;
    }

    if (
      !hasOrganizationTeamManagerRoleForTeam(
        this.databaseService.db,
        teamId,
        authContext.userId,
      )
    ) {
      return false;
    }

    const organizationId = getOrganizationIdForTeam(this.databaseService.db, teamId);

    return organizationId !== null &&
      hasOrganizationMembership(this.databaseService.db, organizationId, userId);
  }

  private canOrganizationTeamManagerGrantTeamProjectManager(
    authContext: AuthContext,
    teamId: number,
  ): boolean {
    return hasOrganizationTeamManagerRoleForTeam(
      this.databaseService.db,
      teamId,
      authContext.userId,
    ) &&
      listProjectIdsForTeam(this.databaseService.db, teamId).length > 0;
  }

  private listRetainedOrganizationTeamManagerIds(teamId: number): number[] {
    const organizationId = getOrganizationIdForTeam(this.databaseService.db, teamId);

    if (organizationId === null) {
      return [];
    }

    return listEffectiveTeamManagerUserIds(this.databaseService.db, teamId)
      .filter((userId) =>
        hasOrganizationTeamManagerRoleForTeam(this.databaseService.db, teamId, userId)
      );
  }

  private listTeamMembers(teamId: number): TeamMember[] {
    const membershipRows = this.databaseService.db
      .select({
        userId: teamsUsers.userId,
        username: users.username,
      })
      .from(teamsUsers)
      .innerJoin(users, eq(users.id, teamsUsers.userId))
      .where(eq(teamsUsers.teamId, teamId))
      .orderBy(asc(teamsUsers.userId))
      .all();
    const roleRows = this.databaseService.db
      .select({
        roleCode: usersTeamsTeamRoles.roleCode,
        userId: usersTeamsTeamRoles.userId,
      })
      .from(usersTeamsTeamRoles)
      .where(eq(usersTeamsTeamRoles.teamId, teamId))
      .all();

    return membershipRows.map((member) => ({
      roleCodes: roleRows
        .filter((roleRow) => roleRow.userId === member.userId)
        .map((roleRow) =>
          roleRow.roleCode as
            | typeof TEAM_MANAGER_ROLE_CODE
            | typeof TEAM_PROJECT_MANAGER_ROLE_CODE
        ),
      userId: member.userId,
      username: member.username,
    }));
  }
}
