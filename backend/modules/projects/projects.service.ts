import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  issues,
  projects,
  projectsTeams,
  projectsUsers,
  teamsUsers,
  users,
  usersProjectsProjectRoles,
} from "../../../db/index.js";
import {
  assertUsersExistOrThrow,
  getOrganizationIdForTeam,
  hasDirectProjectMembership,
  hasEffectiveProjectManagerRole,
  hasOrganizationTeamManagerRoleForTeam,
  hasProjectAccess,
  hasSystemAdminRole,
  listDirectProjectManagerUserIds,
  listEffectiveProjectManagerUserIds,
  listIndirectProjectManagerUserIds,
  listOrganizationProjectManagerUserIdsForProject,
  PROJECT_MANAGER_ROLE_CODE,
} from "../access-control/access-control.utils.js";
import type { AuthContext } from "../auth/auth.types.js";
import { DatabaseService } from "../database/database.service.js";
import type {
  CreateProjectRequest,
  DeleteProjectResponse,
  GetProjectResponse,
  ListProjectsResponse,
  ProjectMember,
  ProjectResponse,
  ProjectRoleAssignmentRequest,
  UpdateProjectMembershipRequest,
  UpdateProjectMembershipResponse,
  UpdateProjectRequest,
  UpdateProjectRoleAssignmentResponse,
} from "./projects.contracts.js";

const LAST_PROJECT_MANAGER_MESSAGE =
  "A project must retain at least one PROJECT_MANAGER member";
const PROJECT_ROLE_ALREADY_ASSIGNED_MESSAGE =
  "That project role is already assigned";
const PROJECT_ROLE_NOT_ASSIGNED_MESSAGE =
  "That project role assignment was not found";
const PROJECT_ROLE_REQUIRES_DIRECT_MEMBERSHIP_MESSAGE =
  "A direct project role requires direct project membership";

function normalizeDescription(
  description: string | null | undefined,
): string | null {
  if (description === undefined || description === null) {
    return description ?? null;
  }

  return description.trim();
}

function toProjectResponse(project: typeof projects.$inferSelect): ProjectResponse {
  return {
    createdAt: project.createdAt.toISOString(),
    description: project.description ?? null,
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt.toISOString(),
  };
}

function createProjectMembershipRows(
  projectId: number,
  payload: UpdateProjectMembershipRequest,
) {
  return payload.members.map((member) => ({
    projectId,
    userId: member.userId,
  }));
}

function createProjectRoleRows(
  projectId: number,
  payload: UpdateProjectMembershipRequest,
) {
  return payload.members.flatMap((member) =>
    member.roleCodes.map((roleCode) => ({
      projectId,
      roleCode,
      userId: member.userId,
    })));
}

function extractDirectProjectManagerIds(
  payload: UpdateProjectMembershipRequest,
): number[] {
  return payload.members
    .filter((member) => member.roleCodes.includes(PROJECT_MANAGER_ROLE_CODE))
    .map((member) => member.userId);
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async createProject(
    authContext: AuthContext,
    payload: CreateProjectRequest,
  ): Promise<{ project: ProjectResponse }> {
    const createdProjectId = this.databaseService.db.transaction((tx) => {
      const [createdProject] = tx.insert(projects)
        .values({
          description: normalizeDescription(payload.description),
          name: payload.name.trim(),
        })
        .returning({ id: projects.id })
        .all();

      tx.insert(projectsUsers)
        .values({
          projectId: createdProject.id,
          userId: authContext.userId,
        })
        .run();
      tx.insert(usersProjectsProjectRoles)
        .values({
          projectId: createdProject.id,
          roleCode: PROJECT_MANAGER_ROLE_CODE,
          userId: authContext.userId,
        })
        .run();

      return createdProject.id;
    });
    await this.databaseService.persist();

    return { project: this.getProjectRecordByIdOrThrow(createdProjectId) };
  }

  listProjects(authContext: AuthContext): ListProjectsResponse {
    const accessibleProjectIds = this.listAccessibleProjectIds(authContext.userId);
    if (accessibleProjectIds.length === 0) {
      return { projects: [] };
    }

    return {
      projects: this.databaseService.db
        .select()
        .from(projects)
        .where(inArray(projects.id, accessibleProjectIds))
        .orderBy(asc(projects.id))
        .all()
        .map(toProjectResponse),
    };
  }

  getProject(authContext: AuthContext, projectId: number): GetProjectResponse {
    this.assertProjectExists(projectId);
    this.assertCanViewProject(authContext, projectId);

    return {
      members: this.listProjectMembers(projectId),
      project: this.getProjectRecordByIdOrThrow(projectId),
    };
  }

  async updateProject(
    authContext: AuthContext,
    projectId: number,
    payload: UpdateProjectRequest,
  ): Promise<{ project: ProjectResponse }> {
    this.assertProjectExists(projectId);
    this.assertCanManageProject(authContext, projectId);

    this.databaseService.db.transaction((tx) => {
      tx.update(projects)
        .set({
          description: payload.description === undefined
            ? undefined
            : normalizeDescription(payload.description),
          name: payload.name?.trim(),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId))
        .run();
    });
    await this.databaseService.persist();

    return { project: this.getProjectRecordByIdOrThrow(projectId) };
  }

  async replaceProjectMembers(
    authContext: AuthContext,
    projectId: number,
    payload: UpdateProjectMembershipRequest,
  ): Promise<UpdateProjectMembershipResponse> {
    this.assertProjectExists(projectId);
    this.assertCanManageProject(authContext, projectId);
    this.assertUsersExist(payload.members.map((member) => member.userId));
    this.assertProjectRetainsEffectiveManagerAfterMembershipReplace(
      projectId,
      payload,
    );

    this.databaseService.db.transaction((tx) => {
      tx.delete(usersProjectsProjectRoles)
        .where(eq(usersProjectsProjectRoles.projectId, projectId))
        .run();
      tx.delete(projectsUsers)
        .where(eq(projectsUsers.projectId, projectId))
        .run();
      tx.insert(projectsUsers)
        .values(createProjectMembershipRows(projectId, payload))
        .run();

      const roleRows = createProjectRoleRows(projectId, payload);
      if (roleRows.length > 0) {
        tx.insert(usersProjectsProjectRoles).values(roleRows).run();
      }
    });
    await this.databaseService.persist();

    return this.buildProjectMembershipResponse(projectId);
  }

  async grantProjectRole(
    authContext: AuthContext,
    projectId: number,
    payload: ProjectRoleAssignmentRequest,
  ): Promise<UpdateProjectRoleAssignmentResponse> {
    this.assertProjectExists(projectId);
    this.assertUsersExist([payload.userId]);
    this.assertCanGrantProjectRole(authContext, projectId, payload);
    this.assertCanTargetDirectProjectRole(authContext, projectId, payload.userId);
    this.assertProjectRoleAbsent(projectId, payload.userId, payload.roleCode);

    this.databaseService.db.transaction((tx) => {
      this.ensureDirectProjectMembershipForRoleGrant(tx, authContext, projectId, payload);
      tx.insert(usersProjectsProjectRoles)
        .values({
          projectId,
          roleCode: payload.roleCode,
          userId: payload.userId,
        })
        .run();
    });
    await this.databaseService.persist();

    return this.buildProjectMembershipResponse(projectId);
  }

  async revokeProjectRole(
    authContext: AuthContext,
    projectId: number,
    payload: ProjectRoleAssignmentRequest,
  ): Promise<UpdateProjectRoleAssignmentResponse> {
    this.assertProjectExists(projectId);
    this.assertUsersExist([payload.userId]);
    this.assertCanRevokeProjectRole(authContext, projectId, payload);
    this.assertProjectRolePresent(projectId, payload.userId, payload.roleCode);
    this.assertProjectRetainsEffectiveManagerAfterRoleRevocation(
      projectId,
      payload,
    );

    this.databaseService.db.transaction((tx) => {
      tx.delete(usersProjectsProjectRoles)
        .where(and(
          eq(usersProjectsProjectRoles.projectId, projectId),
          eq(usersProjectsProjectRoles.roleCode, payload.roleCode),
          eq(usersProjectsProjectRoles.userId, payload.userId),
        ))
        .run();
    });
    await this.databaseService.persist();

    return this.buildProjectMembershipResponse(projectId);
  }

  async deleteProject(
    authContext: AuthContext,
    projectId: number,
  ): Promise<DeleteProjectResponse> {
    this.assertProjectExists(projectId);
    this.assertCanDeleteProject(authContext, projectId);

    this.databaseService.db.transaction((tx) => {
      tx.delete(issues)
        .where(eq(issues.projectId, projectId))
        .run();
      tx.delete(usersProjectsProjectRoles)
        .where(eq(usersProjectsProjectRoles.projectId, projectId))
        .run();
      tx.delete(projectsUsers)
        .where(eq(projectsUsers.projectId, projectId))
        .run();
      tx.delete(projectsTeams)
        .where(eq(projectsTeams.projectId, projectId))
        .run();
      tx.delete(projects)
        .where(eq(projects.id, projectId))
        .run();
    });
    await this.databaseService.persist();

    return { deletedProjectId: projectId };
  }

  private assertCanDeleteProject(
    authContext: AuthContext,
    projectId: number,
  ): void {
    if (hasEffectiveProjectManagerRole(
      this.databaseService.db,
      projectId,
      authContext.userId,
    )) {
      return;
    }

    throw new ForbiddenException("Not permitted to delete that project");
  }

  private assertCanGrantProjectRole(
    authContext: AuthContext,
    projectId: number,
    payload: ProjectRoleAssignmentRequest,
  ): void {
    if (this.canSelfGrantProjectManager(authContext, payload)) {
      return;
    }

    if (this.canManageProject(authContext, projectId)) {
      return;
    }

    if (this.canOrganizationTeamManagerGrantProjectRole(authContext, projectId)) {
      return;
    }

    throw new ForbiddenException("Not permitted to grant that project role");
  }

  private assertCanManageProject(
    authContext: AuthContext,
    projectId: number,
  ): void {
    if (this.canManageProject(authContext, projectId)) {
      return;
    }

    throw new ForbiddenException("Not permitted to manage that project");
  }

  private assertCanRevokeProjectRole(
    authContext: AuthContext,
    projectId: number,
    payload: ProjectRoleAssignmentRequest,
  ): void {
    if (this.canSelfGrantProjectManager(authContext, payload)) {
      return;
    }

    if (this.canManageProject(authContext, projectId)) {
      return;
    }

    throw new ForbiddenException("Not permitted to revoke that project role");
  }

  private assertCanTargetDirectProjectRole(
    authContext: AuthContext,
    projectId: number,
    userId: number,
  ): void {
    if (hasDirectProjectMembership(this.databaseService.db, projectId, userId)) {
      return;
    }

    if (hasSystemAdminRole(authContext) && authContext.userId === userId) {
      return;
    }

    throw new ConflictException(PROJECT_ROLE_REQUIRES_DIRECT_MEMBERSHIP_MESSAGE);
  }

  private assertCanViewProject(authContext: AuthContext, projectId: number): void {
    if (hasSystemAdminRole(authContext)) {
      return;
    }

    if (!hasProjectAccess(this.databaseService.db, projectId, authContext.userId)) {
      throw new ForbiddenException("Not permitted to access that project");
    }
  }

  private assertProjectExists(projectId: number): void {
    const project = this.databaseService.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!project) {
      throw new NotFoundException("Project not found");
    }
  }

  private assertProjectRetainsEffectiveManagerAfterMembershipReplace(
    projectId: number,
    payload: UpdateProjectMembershipRequest,
  ): void {
    const currentDirectManagerIds = listDirectProjectManagerUserIds(
      this.databaseService.db,
      projectId,
    );
    const retainedNonDirectManagerIds = listEffectiveProjectManagerUserIds(
      this.databaseService.db,
      projectId,
    ).filter((userId) => !currentDirectManagerIds.includes(userId));
    const effectiveManagerIds = new Set([
      ...extractDirectProjectManagerIds(payload),
      ...retainedNonDirectManagerIds,
    ]);

    if (effectiveManagerIds.size === 0) {
      throw new ConflictException(LAST_PROJECT_MANAGER_MESSAGE);
    }
  }

  private assertProjectRetainsEffectiveManagerAfterRoleRevocation(
    projectId: number,
    payload: ProjectRoleAssignmentRequest,
  ): void {
    if (payload.roleCode !== PROJECT_MANAGER_ROLE_CODE) {
      return;
    }

    const currentDirectManagerIds = listDirectProjectManagerUserIds(
      this.databaseService.db,
      projectId,
    );
    const remainingManagerIds = new Set([
      ...currentDirectManagerIds.filter((userId) => userId !== payload.userId),
      ...listIndirectProjectManagerUserIds(this.databaseService.db, projectId),
      ...listOrganizationProjectManagerUserIdsForProject(
        this.databaseService.db,
        projectId,
      ),
    ]);

    if (remainingManagerIds.size === 0) {
      throw new ConflictException(LAST_PROJECT_MANAGER_MESSAGE);
    }
  }

  private assertProjectRoleAbsent(
    projectId: number,
    userId: number,
    roleCode: string,
  ): void {
    const existingRow = this.databaseService.db
      .select({ id: usersProjectsProjectRoles.id })
      .from(usersProjectsProjectRoles)
      .where(and(
        eq(usersProjectsProjectRoles.projectId, projectId),
        eq(usersProjectsProjectRoles.roleCode, roleCode),
        eq(usersProjectsProjectRoles.userId, userId),
      ))
      .get();

    if (existingRow) {
      throw new ConflictException(PROJECT_ROLE_ALREADY_ASSIGNED_MESSAGE);
    }
  }

  private assertProjectRolePresent(
    projectId: number,
    userId: number,
    roleCode: string,
  ): void {
    const existingRow = this.databaseService.db
      .select({ id: usersProjectsProjectRoles.id })
      .from(usersProjectsProjectRoles)
      .where(and(
        eq(usersProjectsProjectRoles.projectId, projectId),
        eq(usersProjectsProjectRoles.roleCode, roleCode),
        eq(usersProjectsProjectRoles.userId, userId),
      ))
      .get();

    if (!existingRow) {
      throw new NotFoundException(PROJECT_ROLE_NOT_ASSIGNED_MESSAGE);
    }
  }

  private assertUsersExist(userIds: number[]): void {
    if (!assertUsersExistOrThrow(this.databaseService.db, userIds)) {
      throw new NotFoundException("One or more users were not found");
    }
  }

  private buildProjectMembershipResponse(
    projectId: number,
  ): UpdateProjectRoleAssignmentResponse {
    return {
      members: this.listProjectMembers(projectId),
      projectId,
    };
  }

  private canManageProject(authContext: AuthContext, projectId: number): boolean {
    if (hasSystemAdminRole(authContext)) {
      return true;
    }

    return hasEffectiveProjectManagerRole(
      this.databaseService.db,
      projectId,
      authContext.userId,
    );
  }

  private canSelfGrantProjectManager(
    authContext: AuthContext,
    payload: ProjectRoleAssignmentRequest,
  ): boolean {
    return hasSystemAdminRole(authContext) &&
      payload.roleCode === PROJECT_MANAGER_ROLE_CODE &&
      payload.userId === authContext.userId;
  }

  private ensureDirectProjectMembershipForRoleGrant(
    tx: DatabaseService["db"],
    authContext: AuthContext,
    projectId: number,
    payload: ProjectRoleAssignmentRequest,
  ): void {
    if (
      !hasSystemAdminRole(authContext) ||
      authContext.userId !== payload.userId ||
      hasDirectProjectMembership(this.databaseService.db, projectId, payload.userId)
    ) {
      return;
    }

    tx.insert(projectsUsers)
      .values({
        projectId,
        userId: payload.userId,
      })
      .run();
  }

  private canOrganizationTeamManagerGrantProjectRole(
    authContext: AuthContext,
    projectId: number,
  ): boolean {
    return this.listLinkedTeamIdsForProject(projectId)
      .some((teamId) =>
        hasOrganizationTeamManagerRoleForTeam(
          this.databaseService.db,
          teamId,
          authContext.userId,
        ) &&
        getOrganizationIdForTeam(this.databaseService.db, teamId) !== null
      );
  }

  private listLinkedTeamIdsForProject(projectId: number): number[] {
    return this.databaseService.db
      .select({ teamId: projectsTeams.teamId })
      .from(projectsTeams)
      .where(eq(projectsTeams.projectId, projectId))
      .all()
      .map((row) => row.teamId);
  }

  private getProjectRecordByIdOrThrow(projectId: number): ProjectResponse {
    const project = this.databaseService.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return toProjectResponse(project);
  }

  private listAccessibleProjectIds(userId: number): number[] {
    return [...new Set([
      ...this.databaseService.db
        .select({ projectId: projectsUsers.projectId })
        .from(projectsUsers)
        .where(eq(projectsUsers.userId, userId))
        .all()
        .map((row) => row.projectId),
      ...this.databaseService.db
        .select({ projectId: projectsTeams.projectId })
        .from(projectsTeams)
        .innerJoin(teamsUsers, eq(teamsUsers.teamId, projectsTeams.teamId))
        .where(eq(teamsUsers.userId, userId))
        .all()
        .map((row) => row.projectId),
    ])];
  }

  private listProjectMembers(projectId: number): ProjectMember[] {
    const membershipRows = this.databaseService.db
      .select({
        userId: projectsUsers.userId,
        username: users.username,
      })
      .from(projectsUsers)
      .innerJoin(users, eq(users.id, projectsUsers.userId))
      .where(eq(projectsUsers.projectId, projectId))
      .orderBy(asc(projectsUsers.userId))
      .all();
    const roleRows = this.databaseService.db
      .select({
        roleCode: usersProjectsProjectRoles.roleCode,
        userId: usersProjectsProjectRoles.userId,
      })
      .from(usersProjectsProjectRoles)
      .where(eq(usersProjectsProjectRoles.projectId, projectId))
      .all();

    return membershipRows.map((member) => ({
      roleCodes: roleRows
        .filter((roleRow) => roleRow.userId === member.userId)
        .map((roleRow) => roleRow.roleCode as typeof PROJECT_MANAGER_ROLE_CODE),
      userId: member.userId,
      username: member.username,
    }));
  }
}
