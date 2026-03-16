import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  organizationRoleCodes,
  organizations,
  organizationsTeams,
  projects,
  projectsOrganizations,
  teams,
  teamsUsers,
  users,
  usersOrganizations,
  usersOrganizationsOrganizationRoles,
} from "../../../db/index.js";
import {
  assertUsersExistOrThrow,
  hasDirectOrganizationMembership,
  getOrganizationIdForTeam,
  hasOrganizationManagerRole,
  hasOrganizationMembership,
  hasSystemAdminRole,
  listDirectProjectManagerUserIds,
  listDirectTeamManagerUserIds,
  listIndirectProjectManagerUserIds,
  listOrganizationIdsForProject,
  listOrganizationRoleUserIds,
  listTeamIdsForOrganization,
  ORGANIZATION_MANAGER_ROLE_CODE,
  ORGANIZATION_PROJECT_MANAGER_ROLE_CODE,
  ORGANIZATION_TEAM_MANAGER_ROLE_CODE,
} from "../access-control/access-control.utils.js";
import {
  BLOCKING_OBJECT_KIND_ORGANIZATION,
  BLOCKING_OBJECT_KIND_PROJECT,
  BLOCKING_OBJECT_KIND_TEAM,
  BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_ORGANIZATION_MANAGER,
  BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_PROJECT_MANAGER,
  BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_TEAM_MANAGER,
  createBlockingConflictException,
} from "../access-control/blocking-conflicts.js";
import type { AuthContext } from "../auth/auth.types.js";
import { DatabaseService } from "../database/database.service.js";
import type {
  AssignOrganizationTeamRequest,
  CreateOrganizationRequest,
  DeleteOrganizationResponse,
  GetOrganizationResponse,
  ListOrganizationsResponse,
  OrganizationMember,
  OrganizationResponse,
  OrganizationRoleAssignmentRequest,
  UpdateOrganizationProjectsRequest,
  UpdateOrganizationProjectsResponse,
  UpdateOrganizationRequest,
  UpdateOrganizationRoleAssignmentResponse,
  UpdateOrganizationTeamsResponse,
  UpdateOrganizationUsersRequest,
  UpdateOrganizationUsersResponse,
} from "./organizations.contracts.js";

const LAST_PROJECT_MANAGER_MESSAGE =
  "Organization change would remove the last effective project manager";
const LAST_TEAM_MANAGER_MESSAGE =
  "Organization change would remove the last effective team manager";
const LAST_ORGANIZATION_MANAGER_MESSAGE =
  "Organization change would remove the last effective organization manager";
const ORGANIZATION_ROLE_ALREADY_ASSIGNED_MESSAGE =
  "That organization role is already assigned";
const ORGANIZATION_ROLE_NOT_ASSIGNED_MESSAGE =
  "That organization role assignment was not found";
const ORGANIZATION_ROLE_REQUIRES_MEMBERSHIP_MESSAGE =
  "An organization role requires organization membership";
const TEAM_ALREADY_ASSIGNED_MESSAGE =
  "That team is already assigned to an organization";

function normalizeDescription(
  description: string | null | undefined,
): string | null {
  if (description === undefined || description === null) {
    return description ?? null;
  }

  return description.trim();
}

function toOrganizationResponse(
  organization: typeof organizations.$inferSelect,
): OrganizationResponse {
  return {
    createdAt: organization.createdAt.toISOString(),
    description: organization.description ?? null,
    id: organization.id,
    name: organization.name,
    updatedAt: organization.updatedAt.toISOString(),
  };
}

function createOrganizationUserRows(
  organizationId: number,
  payload: UpdateOrganizationUsersRequest,
) {
  return payload.members.map((member) => ({
    organizationId,
    userId: member.userId,
  }));
}

function createOrganizationProjectRows(
  organizationId: number,
  payload: UpdateOrganizationProjectsRequest,
) {
  return payload.projects.map((project) => ({
    organizationId,
    projectId: project.projectId,
  }));
}

function roleRequiresDirectOrganizationMembership(roleCode: string) {
  return roleCode === ORGANIZATION_MANAGER_ROLE_CODE;
}

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async createOrganization(
    authContext: AuthContext,
    payload: CreateOrganizationRequest,
  ): Promise<{ organization: OrganizationResponse }> {
    const createdOrganizationId = this.databaseService.db.transaction((tx) => {
      const [createdOrganization] = tx.insert(organizations)
        .values({
          description: normalizeDescription(payload.description),
          name: payload.name.trim(),
        })
        .returning({ id: organizations.id })
        .all();

      tx.insert(usersOrganizations)
        .values({
          organizationId: createdOrganization.id,
          userId: authContext.userId,
        })
        .run();
      tx.insert(usersOrganizationsOrganizationRoles)
        .values({
          organizationId: createdOrganization.id,
          roleCode: ORGANIZATION_MANAGER_ROLE_CODE,
          userId: authContext.userId,
        })
        .run();

      return createdOrganization.id;
    });
    return {
      organization: this.getOrganizationRecordByIdOrThrow(createdOrganizationId),
    };
  }

  listOrganizations(authContext: AuthContext): ListOrganizationsResponse {
    const visibleOrganizationIds = this.listVisibleOrganizationIds(authContext.userId);
    if (visibleOrganizationIds.length === 0) {
      return { organizations: [] };
    }

    return {
      organizations: this.databaseService.db
        .select()
        .from(organizations)
        .where(inArray(organizations.id, visibleOrganizationIds))
        .orderBy(asc(organizations.id))
        .all()
        .map(toOrganizationResponse),
    };
  }

  getOrganization(
    authContext: AuthContext,
    organizationId: number,
  ): GetOrganizationResponse {
    this.assertOrganizationExists(organizationId);
    this.assertCanViewOrganization(authContext, organizationId);

    return {
      members: this.listOrganizationMembers(organizationId),
      organization: this.getOrganizationRecordByIdOrThrow(organizationId),
      projects: this.listOrganizationProjects(organizationId),
      teams: this.listOrganizationTeams(organizationId),
    };
  }

  async updateOrganization(
    authContext: AuthContext,
    organizationId: number,
    payload: UpdateOrganizationRequest,
  ): Promise<{ organization: OrganizationResponse }> {
    this.assertOrganizationExists(organizationId);
    this.assertCanManageOrganization(authContext, organizationId);

    this.databaseService.db.transaction((tx) => {
      tx.update(organizations)
        .set({
          description: payload.description === undefined
            ? undefined
            : normalizeDescription(payload.description),
          name: payload.name?.trim(),
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId))
        .run();
    });
    return {
      organization: this.getOrganizationRecordByIdOrThrow(organizationId),
    };
  }

  async replaceOrganizationUsers(
    authContext: AuthContext,
    organizationId: number,
    payload: UpdateOrganizationUsersRequest,
  ): Promise<UpdateOrganizationUsersResponse> {
    this.assertOrganizationExists(organizationId);
    this.assertCanManageOrganization(authContext, organizationId);
    this.assertUsersExist(payload.members.map((member) => member.userId));
    this.assertOrganizationRetainsManagerAfterUserReplace(organizationId, payload);

    this.databaseService.db.transaction((tx) => {
      const retainedUserIds = payload.members.map((member) => member.userId);
      const retainedRoleRows = tx.select({
        roleCode: usersOrganizationsOrganizationRoles.roleCode,
        userId: usersOrganizationsOrganizationRoles.userId,
      })
        .from(usersOrganizationsOrganizationRoles)
        .where(eq(usersOrganizationsOrganizationRoles.organizationId, organizationId))
        .all()
        .filter((row) => retainedUserIds.includes(row.userId));

      tx.delete(usersOrganizationsOrganizationRoles)
        .where(eq(usersOrganizationsOrganizationRoles.organizationId, organizationId))
        .run();
      tx.delete(usersOrganizations)
        .where(eq(usersOrganizations.organizationId, organizationId))
        .run();
      tx.insert(usersOrganizations)
        .values(createOrganizationUserRows(organizationId, payload))
        .run();
      if (retainedRoleRows.length > 0) {
        tx.insert(usersOrganizationsOrganizationRoles)
          .values(retainedRoleRows.map((row) => ({
            organizationId,
            roleCode: row.roleCode,
            userId: row.userId,
          })))
          .run();
      }
    });
    return this.buildOrganizationUsersResponse(organizationId);
  }

  async replaceOrganizationProjects(
    authContext: AuthContext,
    organizationId: number,
    payload: UpdateOrganizationProjectsRequest,
  ): Promise<UpdateOrganizationProjectsResponse> {
    this.assertOrganizationExists(organizationId);
    this.assertCanManageOrganization(authContext, organizationId);
    this.assertProjectsExist(payload.projects.map((project) => project.projectId));

    this.databaseService.db.transaction((tx) => {
      tx.delete(projectsOrganizations)
        .where(eq(projectsOrganizations.organizationId, organizationId))
        .run();
      tx.insert(projectsOrganizations)
        .values(createOrganizationProjectRows(organizationId, payload))
        .run();
    });
    return {
      organizationId,
      projects: this.listOrganizationProjects(organizationId),
    };
  }

  async assignTeam(
    authContext: AuthContext,
    organizationId: number,
    payload: AssignOrganizationTeamRequest,
  ): Promise<UpdateOrganizationTeamsResponse> {
    this.assertOrganizationExists(organizationId);
    this.assertTeamExists(payload.teamId);
    this.assertCanManageOrganization(authContext, organizationId);
    this.assertTeamUnassigned(payload.teamId);

    this.databaseService.db.transaction((tx) => {
      tx.insert(organizationsTeams)
        .values({
          organizationId,
          teamId: payload.teamId,
        })
        .run();
    });
    return {
      organizationId,
      teams: this.listOrganizationTeams(organizationId),
    };
  }

  async grantOrganizationRole(
    authContext: AuthContext,
    organizationId: number,
    payload: OrganizationRoleAssignmentRequest,
  ): Promise<UpdateOrganizationRoleAssignmentResponse> {
    this.assertOrganizationExists(organizationId);
    this.assertUsersExist([payload.userId]);
    this.assertCanGrantOrganizationRole(authContext, organizationId, payload);
    this.assertCanTargetOrganizationRole(authContext, organizationId, payload);
    this.assertOrganizationRoleAbsent(organizationId, payload.userId, payload.roleCode);

    this.databaseService.db.transaction((tx) => {
      this.ensureDirectOrganizationMembershipForAdminSelfGrant(
        tx,
        authContext,
        organizationId,
        payload,
      );
      tx.insert(usersOrganizationsOrganizationRoles)
        .values({
          organizationId,
          roleCode: payload.roleCode,
          userId: payload.userId,
        })
        .run();
    });
    return this.buildOrganizationRoleAssignmentResponse(organizationId);
  }

  async revokeOrganizationRole(
    authContext: AuthContext,
    organizationId: number,
    payload: OrganizationRoleAssignmentRequest,
  ): Promise<UpdateOrganizationRoleAssignmentResponse> {
    this.assertOrganizationExists(organizationId);
    this.assertUsersExist([payload.userId]);
    this.assertCanGrantOrganizationRole(authContext, organizationId, payload);
    this.assertOrganizationRolePresent(organizationId, payload.userId, payload.roleCode);
    this.assertOrganizationRetainsManagerAfterRoleRevoke(organizationId, payload);

    this.databaseService.db.transaction((tx) => {
      tx.delete(usersOrganizationsOrganizationRoles)
        .where(and(
          eq(usersOrganizationsOrganizationRoles.organizationId, organizationId),
          eq(usersOrganizationsOrganizationRoles.roleCode, payload.roleCode),
          eq(usersOrganizationsOrganizationRoles.userId, payload.userId),
        ))
        .run();
    });
    return this.buildOrganizationRoleAssignmentResponse(organizationId);
  }

  async deleteOrganization(
    authContext: AuthContext,
    organizationId: number,
  ): Promise<DeleteOrganizationResponse> {
    this.assertOrganizationExists(organizationId);
    this.assertCanDeleteOrganization(authContext, organizationId);
    this.assertOrganizationDeletionPreservesCoverage(organizationId);

    this.databaseService.db.transaction((tx) => {
      tx.delete(usersOrganizationsOrganizationRoles)
        .where(eq(usersOrganizationsOrganizationRoles.organizationId, organizationId))
        .run();
      tx.delete(usersOrganizations)
        .where(eq(usersOrganizations.organizationId, organizationId))
        .run();
      tx.delete(projectsOrganizations)
        .where(eq(projectsOrganizations.organizationId, organizationId))
        .run();
      tx.delete(organizationsTeams)
        .where(eq(organizationsTeams.organizationId, organizationId))
        .run();
      tx.delete(organizations)
        .where(eq(organizations.id, organizationId))
        .run();
    });
    return { deletedOrganizationId: organizationId };
  }

  private assertCanDeleteOrganization(
    authContext: AuthContext,
    organizationId: number,
  ): void {
    if (
      hasOrganizationManagerRole(
        this.databaseService.db,
        organizationId,
        authContext.userId,
      )
    ) {
      return;
    }

    throw new ForbiddenException("Not permitted to delete that organization");
  }

  private assertCanGrantOrganizationRole(
    authContext: AuthContext,
    organizationId: number,
    payload: OrganizationRoleAssignmentRequest,
  ): void {
    if (this.canAdminSelfGrantOrganizationManager(authContext, payload)) {
      return;
    }

    if (this.canManageOrganization(authContext, organizationId)) {
      return;
    }

    throw new ForbiddenException("Not permitted to grant that organization role");
  }

  private assertCanManageOrganization(
    authContext: AuthContext,
    organizationId: number,
  ): void {
    if (this.canManageOrganization(authContext, organizationId)) {
      return;
    }

    throw new ForbiddenException("Not permitted to manage that organization");
  }

  private assertCanTargetOrganizationRole(
    authContext: AuthContext,
    organizationId: number,
    payload: OrganizationRoleAssignmentRequest,
  ): void {
    if (
      !roleRequiresDirectOrganizationMembership(payload.roleCode) ||
      hasOrganizationMembership(this.databaseService.db, organizationId, payload.userId)
    ) {
      return;
    }

    if (hasSystemAdminRole(authContext) && authContext.userId === payload.userId) {
      return;
    }

    throw new ConflictException(ORGANIZATION_ROLE_REQUIRES_MEMBERSHIP_MESSAGE);
  }

  private assertCanViewOrganization(
    authContext: AuthContext,
    organizationId: number,
  ): void {
    if (hasSystemAdminRole(authContext)) {
      return;
    }

    if (
      hasOrganizationMembership(this.databaseService.db, organizationId, authContext.userId) ||
      this.hasAnyOrganizationRole(organizationId, authContext.userId)
    ) {
      return;
    }

    throw new ForbiddenException("Not permitted to access that organization");
  }

  private assertOrganizationDeletionPreservesCoverage(organizationId: number): void {
    const associatedTeamIds = listTeamIdsForOrganization(
      this.databaseService.db,
      organizationId,
    );
    const directlyAssociatedProjectIds = this.listOrganizationProjects(organizationId)
      .map((project) => project.projectId);

    if (associatedTeamIds.length > 0) {
      throw createBlockingConflictException(LAST_TEAM_MANAGER_MESSAGE, [
        {
          id: organizationId,
          kind: BLOCKING_OBJECT_KIND_ORGANIZATION,
          reason: BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_TEAM_MANAGER,
        },
      ]);
    }

    for (const projectId of directlyAssociatedProjectIds) {
      if (this.listRemainingProjectManagerUserIdsAfterOrganizationDelete(
        organizationId,
        projectId,
      ).length === 0) {
        throw createBlockingConflictException(LAST_PROJECT_MANAGER_MESSAGE, [
          {
            id: projectId,
            kind: BLOCKING_OBJECT_KIND_PROJECT,
            reason: BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_PROJECT_MANAGER,
          },
        ]);
      }
    }

    for (const teamId of associatedTeamIds) {
      if (listDirectTeamManagerUserIds(this.databaseService.db, teamId).length === 0) {
        throw createBlockingConflictException(LAST_TEAM_MANAGER_MESSAGE, [
          {
            id: teamId,
            kind: BLOCKING_OBJECT_KIND_TEAM,
            reason: BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_TEAM_MANAGER,
          },
        ]);
      }
    }
  }

  private assertOrganizationExists(organizationId: number): void {
    const organization = this.databaseService.db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .get();

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }
  }

  private assertOrganizationRetainsManagerAfterRoleRevoke(
    organizationId: number,
    payload: OrganizationRoleAssignmentRequest,
  ): void {
    if (payload.roleCode !== ORGANIZATION_MANAGER_ROLE_CODE) {
      return;
    }

    const remainingManagerIds = listOrganizationRoleUserIds(
      this.databaseService.db,
      organizationId,
      ORGANIZATION_MANAGER_ROLE_CODE,
    ).filter((userId) => userId !== payload.userId);

    if (remainingManagerIds.length === 0) {
      throw createBlockingConflictException(LAST_ORGANIZATION_MANAGER_MESSAGE, [
        {
          id: organizationId,
          kind: BLOCKING_OBJECT_KIND_ORGANIZATION,
          reason: BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_ORGANIZATION_MANAGER,
        },
      ]);
    }
  }

  private assertOrganizationRetainsManagerAfterUserReplace(
    organizationId: number,
    payload: UpdateOrganizationUsersRequest,
  ): void {
    const retainedUserIds = payload.members.map((member) => member.userId);
    const currentManagerIds = listOrganizationRoleUserIds(
      this.databaseService.db,
      organizationId,
      ORGANIZATION_MANAGER_ROLE_CODE,
    );

    if (!currentManagerIds.some((userId) => retainedUserIds.includes(userId))) {
      throw createBlockingConflictException(LAST_ORGANIZATION_MANAGER_MESSAGE, [
        {
          id: organizationId,
          kind: BLOCKING_OBJECT_KIND_ORGANIZATION,
          reason: BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_ORGANIZATION_MANAGER,
        },
      ]);
    }
  }

  private assertOrganizationRoleAbsent(
    organizationId: number,
    userId: number,
    roleCode: string,
  ): void {
    const existingRow = this.databaseService.db
      .select({ id: usersOrganizationsOrganizationRoles.id })
      .from(usersOrganizationsOrganizationRoles)
      .where(and(
        eq(usersOrganizationsOrganizationRoles.organizationId, organizationId),
        eq(usersOrganizationsOrganizationRoles.roleCode, roleCode),
        eq(usersOrganizationsOrganizationRoles.userId, userId),
      ))
      .get();

    if (existingRow) {
      throw new ConflictException(ORGANIZATION_ROLE_ALREADY_ASSIGNED_MESSAGE);
    }
  }

  private assertOrganizationRolePresent(
    organizationId: number,
    userId: number,
    roleCode: string,
  ): void {
    const existingRow = this.databaseService.db
      .select({ id: usersOrganizationsOrganizationRoles.id })
      .from(usersOrganizationsOrganizationRoles)
      .where(and(
        eq(usersOrganizationsOrganizationRoles.organizationId, organizationId),
        eq(usersOrganizationsOrganizationRoles.roleCode, roleCode),
        eq(usersOrganizationsOrganizationRoles.userId, userId),
      ))
      .get();

    if (!existingRow) {
      throw new NotFoundException(ORGANIZATION_ROLE_NOT_ASSIGNED_MESSAGE);
    }
  }

  private assertProjectsExist(projectIds: number[]): void {
    const existingIds = this.databaseService.db
      .select({ id: projects.id })
      .from(projects)
      .where(inArray(projects.id, projectIds))
      .all()
      .map((row) => row.id);

    if (existingIds.length !== new Set(projectIds).size) {
      throw new NotFoundException("One or more projects were not found");
    }
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

  private assertTeamUnassigned(teamId: number): void {
    const existingRow = this.databaseService.db
      .select({ organizationId: organizationsTeams.organizationId })
      .from(organizationsTeams)
      .where(eq(organizationsTeams.teamId, teamId))
      .get();

    if (existingRow) {
      throw new ConflictException(TEAM_ALREADY_ASSIGNED_MESSAGE);
    }
  }

  private assertUsersExist(userIds: number[]): void {
    if (!assertUsersExistOrThrow(this.databaseService.db, userIds)) {
      throw new NotFoundException("One or more users were not found");
    }
  }

  private buildOrganizationRoleAssignmentResponse(
    organizationId: number,
  ): UpdateOrganizationRoleAssignmentResponse {
    return {
      members: this.listOrganizationMembers(organizationId),
      organizationId,
    };
  }

  private buildOrganizationUsersResponse(
    organizationId: number,
  ): UpdateOrganizationUsersResponse {
    return {
      members: this.listOrganizationMembers(organizationId),
      organizationId,
    };
  }

  private canAdminSelfGrantOrganizationManager(
    authContext: AuthContext,
    payload: OrganizationRoleAssignmentRequest,
  ): boolean {
    return hasSystemAdminRole(authContext) &&
      payload.roleCode === ORGANIZATION_MANAGER_ROLE_CODE &&
      payload.userId === authContext.userId;
  }

  private canManageOrganization(
    authContext: AuthContext,
    organizationId: number,
  ): boolean {
    if (hasSystemAdminRole(authContext)) {
      return true;
    }

    return hasOrganizationManagerRole(
      this.databaseService.db,
      organizationId,
      authContext.userId,
    );
  }

  private ensureDirectOrganizationMembershipForAdminSelfGrant(
    tx: DatabaseService["db"],
    authContext: AuthContext,
    organizationId: number,
    payload: OrganizationRoleAssignmentRequest,
  ): void {
    if (
      !this.canAdminSelfGrantOrganizationManager(authContext, payload) ||
      hasDirectOrganizationMembership(this.databaseService.db, organizationId, payload.userId)
    ) {
      return;
    }

    tx.insert(usersOrganizations)
      .values({
        organizationId,
        userId: payload.userId,
      })
      .run();
  }

  private getOrganizationRecordByIdOrThrow(
    organizationId: number,
  ): OrganizationResponse {
    const organization = this.databaseService.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .get();

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    return toOrganizationResponse(organization);
  }

  private hasAnyOrganizationRole(organizationId: number, userId: number): boolean {
    return this.databaseService.db
      .select({ id: usersOrganizationsOrganizationRoles.id })
      .from(usersOrganizationsOrganizationRoles)
      .where(and(
        eq(usersOrganizationsOrganizationRoles.organizationId, organizationId),
        eq(usersOrganizationsOrganizationRoles.userId, userId),
      ))
      .get() !== undefined;
  }

  private listOrganizationMembers(organizationId: number): OrganizationMember[] {
    const roleAssignments = this.databaseService.db
      .select({
        roleCode: usersOrganizationsOrganizationRoles.roleCode,
        userId: usersOrganizationsOrganizationRoles.userId,
      })
      .from(usersOrganizationsOrganizationRoles)
      .where(eq(usersOrganizationsOrganizationRoles.organizationId, organizationId))
      .all();

    return this.databaseService.db
      .select({
        userId: users.id,
        username: users.username,
      })
      .from(usersOrganizations)
      .innerJoin(users, eq(users.id, usersOrganizations.userId))
      .where(eq(usersOrganizations.organizationId, organizationId))
      .orderBy(asc(users.id))
      .all()
      .map((member) => ({
        roleCodes: roleAssignments
          .filter((assignment) => assignment.userId === member.userId)
          .map((assignment) => assignment.roleCode as OrganizationMember["roleCodes"][number]),
        userId: member.userId,
        username: member.username,
      }));
  }

  private listOrganizationProjects(organizationId: number) {
    return this.databaseService.db
      .select({ projectId: projectsOrganizations.projectId })
      .from(projectsOrganizations)
      .where(eq(projectsOrganizations.organizationId, organizationId))
      .orderBy(asc(projectsOrganizations.projectId))
      .all();
  }

  private listOrganizationTeams(organizationId: number) {
    return this.databaseService.db
      .select({ teamId: organizationsTeams.teamId })
      .from(organizationsTeams)
      .where(eq(organizationsTeams.organizationId, organizationId))
      .orderBy(asc(organizationsTeams.teamId))
      .all();
  }

  private listRemainingProjectManagerUserIdsAfterOrganizationDelete(
    organizationId: number,
    projectId: number,
  ): number[] {
    const directManagerIds = listDirectProjectManagerUserIds(
      this.databaseService.db,
      projectId,
    );
    const indirectManagerIds = listIndirectProjectManagerUserIds(
      this.databaseService.db,
      projectId,
    );
    const otherOrganizationManagerIds = listOrganizationIdsForProject(
      this.databaseService.db,
      projectId,
    )
      .filter((currentOrganizationId) => currentOrganizationId !== organizationId)
      .flatMap((currentOrganizationId) =>
        listOrganizationRoleUserIds(
          this.databaseService.db,
          currentOrganizationId,
          ORGANIZATION_PROJECT_MANAGER_ROLE_CODE,
        )
      );

    return [...new Set([
      ...directManagerIds,
      ...indirectManagerIds,
      ...otherOrganizationManagerIds,
    ])];
  }

  private listVisibleOrganizationIds(userId: number): number[] {
    const directIds = this.databaseService.db
      .select({ organizationId: usersOrganizations.organizationId })
      .from(usersOrganizations)
      .where(eq(usersOrganizations.userId, userId))
      .all()
      .map((row) => row.organizationId);
    const indirectIds = this.databaseService.db
      .select({ organizationId: organizationsTeams.organizationId })
      .from(organizationsTeams)
      .innerJoin(teamsUsers, eq(teamsUsers.teamId, organizationsTeams.teamId))
      .where(eq(teamsUsers.userId, userId))
      .all()
      .map((row) => row.organizationId);
    const roleIds = this.databaseService.db
      .select({ organizationId: usersOrganizationsOrganizationRoles.organizationId })
      .from(usersOrganizationsOrganizationRoles)
      .where(eq(usersOrganizationsOrganizationRoles.userId, userId))
      .all()
      .map((row) => row.organizationId);

    return [...new Set([...directIds, ...indirectIds, ...roleIds])];
  }
}
