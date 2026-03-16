import {
  ConflictException,
  ForbiddenException,
  Inject,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  issues,
  organizations,
  projects,
  projectsTeams,
  projectsUsers,
  teams,
  teamsUsers,
  users,
  usersProjectsProjectRoles,
} from "../../../db/index.js";
import {
  assertUsersExistOrThrow,
  getOrganizationIdForTeam,
  hasDirectProjectMembership,
  hasDirectProjectOwnerRole,
  hasEffectiveProjectManagerRole,
  hasOrganizationTeamManagerRoleForTeam,
  hasProjectAccess,
  hasSystemAdminRole,
  listDirectProjectOwnerUserIds,
  listDirectProjectManagerUserIds,
  listEffectiveProjectManagerUserIds,
  listIndirectProjectManagerUserIds,
  listOrganizationIdsForProject,
  listOrganizationProjectManagerUserIdsForProject,
  listTeamIdsForProject,
  PROJECT_MANAGER_ROLE_CODE,
  PROJECT_OWNER_ROLE_CODE,
} from "../access-control/access-control.utils.js";
import {
  BLOCKING_OBJECT_KIND_PROJECT,
  BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_PROJECT_MANAGER,
  BLOCKING_OBJECT_REASON_LAST_OWNER,
  createBlockingConflictException,
} from "../access-control/blocking-conflicts.js";
import type { AuthContext } from "../auth/auth.types.js";
import { DatabaseService } from "../database/database.service.js";
import { ProjectChartsService } from "../project-charts/project-charts.service.js";
import type {
  CreateProjectRequest,
  DeleteProjectResponse,
  GetProjectResponse,
  ListProjectsResponse,
  ProjectMember,
  ProjectManager,
  ProjectManagerSource,
  ProjectOrganization,
  ProjectResponse,
  ProjectRoleAssignmentRequest,
  ProjectTeam,
  UpdateProjectMembershipRequest,
  UpdateProjectMembershipResponse,
  UpdateProjectRequest,
  UpdateProjectRoleAssignmentResponse,
} from "./projects.contracts.js";

const LAST_PROJECT_MANAGER_MESSAGE =
  "Project membership update would remove the last effective project manager";
const LAST_PROJECT_MANAGER_ROLE_REVOKE_MESSAGE =
  "Project role revoke would remove the last effective project manager";
const LAST_PROJECT_OWNER_MESSAGE =
  "Project membership update would remove the last owner";
const LAST_PROJECT_OWNER_ROLE_REVOKE_MESSAGE =
  "Project role revoke would remove the last owner";
const PROJECT_ROLE_ALREADY_ASSIGNED_MESSAGE = "That project role is already assigned";
const PROJECT_ROLE_NOT_ASSIGNED_MESSAGE = "That project role assignment was not found";

function normalizeDescription(
  description: string | null | undefined,
): string | null {
  if (description === undefined || description === null) {
    return description ?? null;
  }

  return description.trim();
}

function normalizeJournal(
  journal: string | null | undefined,
): string | null {
  if (journal === undefined || journal === null) {
    return journal ?? null;
  }

  return journal.trim();
}

function toProjectResponse(project: typeof projects.$inferSelect): ProjectResponse {
  return {
    createdAt: project.createdAt.toISOString(),
    description: project.description ?? null,
    id: project.id,
    journal: project.journal ?? null,
    name: project.name,
    updatedAt: project.updatedAt.toISOString(),
  };
}

function toProjectTeamResponse(team: typeof teams.$inferSelect): ProjectTeam {
  return {
    createdAt: team.createdAt.toISOString(),
    description: team.description ?? null,
    id: team.id,
    name: team.name,
    updatedAt: team.updatedAt.toISOString(),
  };
}

function toProjectOrganizationResponse(
  organization: typeof organizations.$inferSelect,
): ProjectOrganization {
  return {
    createdAt: organization.createdAt.toISOString(),
    description: organization.description ?? null,
    id: organization.id,
    name: organization.name,
    updatedAt: organization.updatedAt.toISOString(),
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

function extractDirectProjectOwnerIds(
  payload: UpdateProjectMembershipRequest,
): number[] {
  return payload.members
    .filter((member) => member.roleCodes.includes(PROJECT_OWNER_ROLE_CODE))
    .map((member) => member.userId);
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(ProjectChartsService)
    private readonly projectChartsService: ProjectChartsService,
  ) {}

  async createProject(
    authContext: AuthContext,
    payload: CreateProjectRequest,
  ): Promise<{ project: ProjectResponse }> {
    const createdProjectId = this.createProjectRecord(authContext, payload);

    try {
      this.projectChartsService.createDefaultProjectChart(createdProjectId);
    } catch (error) {
      this.cleanupProjectAfterChartCreationFailure(createdProjectId);
      throw new InternalServerErrorException("Unable to create a chart for that project", {
        cause: error,
      });
    }

    return this.buildProjectResponse(createdProjectId);
  }

  async getProjectChart(
    authContext: AuthContext,
    projectId: number,
  ): Promise<string> {
    this.assertProjectExists(projectId);
    this.assertCanViewProject(authContext, projectId);

    const chartXml = this.projectChartsService.readProjectChart(projectId);
    if (chartXml === null) {
      throw new NotFoundException("Project chart not found");
    }

    return chartXml;
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
      organizations: this.listProjectOrganizations(projectId),
      project: this.getProjectRecordByIdOrThrow(projectId),
      projectManagers: this.listProjectManagers(projectId),
      teams: this.listProjectTeams(projectId),
    };
  }

  async updateProject(
    authContext: AuthContext,
    projectId: number,
    payload: UpdateProjectRequest,
  ): Promise<{ project: ProjectResponse }> {
    this.assertProjectExists(projectId);
    this.assertCanEditProject(authContext, projectId);

    this.databaseService.db.transaction((tx) => {
      tx.update(projects)
        .set({
          description: payload.description === undefined
            ? undefined
            : normalizeDescription(payload.description),
          journal: payload.journal === undefined
            ? undefined
            : normalizeJournal(payload.journal),
          name: payload.name?.trim(),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId))
        .run();
    });
    return { project: this.getProjectRecordByIdOrThrow(projectId) };
  }

  async replaceProjectMembers(
    authContext: AuthContext,
    projectId: number,
    payload: UpdateProjectMembershipRequest,
  ): Promise<UpdateProjectMembershipResponse> {
    this.assertProjectExists(projectId);
    this.assertCanManageProjectMembership(authContext, projectId);
    this.assertUsersExist(payload.members.map((member) => member.userId));
    this.assertProjectRetainsOwnerAfterMembershipReplace(projectId, payload);
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
    this.assertProjectRoleAbsent(projectId, payload.userId, payload.roleCode);

    this.databaseService.db.transaction((tx) => {
      this.ensureDirectProjectMembershipForRoleGrant(tx, projectId, payload);
      tx.insert(usersProjectsProjectRoles)
        .values({
          projectId,
          roleCode: payload.roleCode,
          userId: payload.userId,
        })
        .run();
    });
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
    this.assertProjectRetainsOwnerAfterRoleRevocation(projectId, payload);
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
    return this.buildProjectMembershipResponse(projectId);
  }

  async deleteProject(
    authContext: AuthContext,
    projectId: number,
  ): Promise<DeleteProjectResponse> {
    this.assertProjectExists(projectId);
    this.assertCanDeleteProject(authContext, projectId);

    this.deleteProjectRecord(projectId);
    this.projectChartsService.deleteProjectChart(projectId);
    return { deletedProjectId: projectId };
  }

  private cleanupProjectAfterChartCreationFailure(projectId: number): void {
    try {
      this.projectChartsService.deleteProjectChart(projectId);
    } catch {
      // Best-effort cleanup only; the project row must still be removed.
    }
    this.deleteProjectRecord(projectId);
  }

  private createProjectRecord(
    authContext: AuthContext,
    payload: CreateProjectRequest,
  ): number {
    return this.databaseService.db.transaction((tx) => {
      const [createdProject] = tx.insert(projects)
        .values({
          description: normalizeDescription(payload.description),
          journal: normalizeJournal(payload.journal),
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
        .values([
          {
            projectId: createdProject.id,
            roleCode: PROJECT_MANAGER_ROLE_CODE,
            userId: authContext.userId,
          },
          {
            projectId: createdProject.id,
            roleCode: PROJECT_OWNER_ROLE_CODE,
            userId: authContext.userId,
          },
        ])
        .run();

      return createdProject.id;
    });
  }

  private deleteProjectRecord(projectId: number): void {
    this.databaseService.db.transaction((tx) => {
      this.deleteProjectRecordRows(tx, projectId);
    });
  }

  private deleteProjectRecordRows(
    tx: Parameters<DatabaseService["db"]["transaction"]>[0] extends (
      arg: infer T,
    ) => unknown ? T : never,
    projectId: number,
  ): void {
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
  }

  private assertCanDeleteProject(
    authContext: AuthContext,
    projectId: number,
  ): void {
    if (this.canOwnProject(authContext, projectId)) {
      return;
    }

    throw new ForbiddenException("Not permitted to delete that project");
  }

  private assertCanEditProject(
    authContext: AuthContext,
    projectId: number,
  ): void {
    if (this.canEditProject(authContext, projectId)) {
      return;
    }

    throw new ForbiddenException("Not permitted to manage that project");
  }

  private assertCanManageProjectMembership(
    authContext: AuthContext,
    projectId: number,
  ): void {
    if (this.canOwnProject(authContext, projectId)) {
      return;
    }

    throw new ForbiddenException("Not permitted to manage that project");
  }

  private canEditProject(
    authContext: AuthContext,
    projectId: number,
  ): boolean {
    return hasEffectiveProjectManagerRole(
      this.databaseService.db,
      projectId,
      authContext.userId,
    ) || hasDirectProjectOwnerRole(this.databaseService.db, projectId, authContext.userId);
  }

  private assertCanGrantProjectRole(
    authContext: AuthContext,
    projectId: number,
    payload: ProjectRoleAssignmentRequest,
  ): void {
    if (this.canSelfGrantProjectRole(authContext, payload)) {
      return;
    }

    if (this.canOwnProject(authContext, projectId)) {
      return;
    }

    throw new ForbiddenException("Not permitted to grant that project role");
  }

  private assertCanManageProject(
    authContext: AuthContext,
    projectId: number,
  ): void {
    if (this.canEditProject(authContext, projectId)) {
      return;
    }

    throw new ForbiddenException("Not permitted to manage that project");
  }

  private assertCanRevokeProjectRole(
    authContext: AuthContext,
    projectId: number,
    payload: ProjectRoleAssignmentRequest,
  ): void {
    if (this.canSelfGrantProjectRole(authContext, payload)) {
      return;
    }

    if (this.canOwnProject(authContext, projectId)) {
      return;
    }

    throw new ForbiddenException("Not permitted to revoke that project role");
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
      throw createBlockingConflictException(LAST_PROJECT_MANAGER_MESSAGE, [
        this.createProjectBlockingObject(
          projectId,
          BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_PROJECT_MANAGER,
        ),
      ]);
    }
  }

  private assertProjectRetainsOwnerAfterMembershipReplace(
    projectId: number,
    payload: UpdateProjectMembershipRequest,
  ): void {
    if (extractDirectProjectOwnerIds(payload).length > 0) {
      return;
    }

    throw createBlockingConflictException(LAST_PROJECT_OWNER_MESSAGE, [
      this.createProjectBlockingObject(
        projectId,
        BLOCKING_OBJECT_REASON_LAST_OWNER,
      ),
    ]);
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
      throw createBlockingConflictException(
        LAST_PROJECT_MANAGER_ROLE_REVOKE_MESSAGE,
        [
          this.createProjectBlockingObject(
            projectId,
            BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_PROJECT_MANAGER,
          ),
        ],
      );
    }
  }

  private assertProjectRetainsOwnerAfterRoleRevocation(
    projectId: number,
    payload: ProjectRoleAssignmentRequest,
  ): void {
    if (payload.roleCode !== PROJECT_OWNER_ROLE_CODE) {
      return;
    }

    const remainingOwnerIds = listDirectProjectOwnerUserIds(
      this.databaseService.db,
      projectId,
    ).filter((userId) => userId !== payload.userId);

    if (remainingOwnerIds.length > 0) {
      return;
    }

    throw createBlockingConflictException(LAST_PROJECT_OWNER_ROLE_REVOKE_MESSAGE, [
      this.createProjectBlockingObject(
        projectId,
        BLOCKING_OBJECT_REASON_LAST_OWNER,
      ),
    ]);
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

  private buildProjectResponse(projectId: number): { project: ProjectResponse } {
    return {
      project: this.getProjectRecordByIdOrThrow(projectId),
    };
  }

  private canOwnProject(authContext: AuthContext, projectId: number): boolean {
    return hasDirectProjectOwnerRole(
      this.databaseService.db,
      projectId,
      authContext.userId,
    );
  }

  private canSelfGrantProjectRole(
    authContext: AuthContext,
    payload: ProjectRoleAssignmentRequest,
  ): boolean {
    return hasSystemAdminRole(authContext) &&
      payload.userId === authContext.userId;
  }

  private ensureDirectProjectMembershipForRoleGrant(
    tx: DatabaseService["db"],
    projectId: number,
    payload: ProjectRoleAssignmentRequest,
  ): void {
    if (hasDirectProjectMembership(this.databaseService.db, projectId, payload.userId)) {
      return;
    }

    tx.insert(projectsUsers)
      .values({
        projectId,
        userId: payload.userId,
      })
      .run();
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
        .map((roleRow) => roleRow.roleCode as ProjectMember["roleCodes"][number]),
      userId: member.userId,
      username: member.username,
    }));
  }

  private listProjectManagers(projectId: number): ProjectManager[] {
    const directManagerIds = new Set(
      listDirectProjectManagerUserIds(this.databaseService.db, projectId),
    );
    const teamManagerIds = new Set(
      listIndirectProjectManagerUserIds(this.databaseService.db, projectId),
    );
    const organizationManagerIds = new Set(
      listOrganizationProjectManagerUserIdsForProject(
        this.databaseService.db,
        projectId,
      ),
    );
    const effectiveManagerIds = listEffectiveProjectManagerUserIds(
      this.databaseService.db,
      projectId,
    );

    if (effectiveManagerIds.length === 0) {
      return [];
    }

    const userRows = this.databaseService.db
      .select({
        userId: users.id,
        username: users.username,
      })
      .from(users)
      .where(inArray(users.id, effectiveManagerIds))
      .orderBy(asc(users.id))
      .all();

    return userRows.map((userRow) => ({
      sourceKinds: this.createProjectManagerSourceKinds(
        userRow.userId,
        directManagerIds,
        teamManagerIds,
        organizationManagerIds,
      ),
      userId: userRow.userId,
      username: userRow.username,
    }));
  }

  private createProjectManagerSourceKinds(
    userId: number,
    directManagerIds: ReadonlySet<number>,
    teamManagerIds: ReadonlySet<number>,
    organizationManagerIds: ReadonlySet<number>,
  ): ProjectManagerSource[] {
    const sourceKinds: ProjectManagerSource[] = [];

    if (directManagerIds.has(userId)) {
      sourceKinds.push("direct");
    }
    if (teamManagerIds.has(userId)) {
      sourceKinds.push("team");
    }
    if (organizationManagerIds.has(userId)) {
      sourceKinds.push("org");
    }

    return sourceKinds;
  }

  private listProjectTeams(projectId: number): ProjectTeam[] {
    const teamIds = listTeamIdsForProject(this.databaseService.db, projectId);
    if (teamIds.length === 0) {
      return [];
    }

    return this.databaseService.db
      .select()
      .from(teams)
      .where(inArray(teams.id, teamIds))
      .orderBy(asc(teams.id))
      .all()
      .map(toProjectTeamResponse);
  }

  private listProjectOrganizations(projectId: number): ProjectOrganization[] {
    const organizationIds = listOrganizationIdsForProject(
      this.databaseService.db,
      projectId,
    );
    if (organizationIds.length === 0) {
      return [];
    }

    return this.databaseService.db
      .select()
      .from(organizations)
      .where(inArray(organizations.id, organizationIds))
      .orderBy(asc(organizations.id))
      .all()
      .map(toProjectOrganizationResponse);
  }

  private createProjectBlockingObject(
    projectId: number,
    reason: typeof BLOCKING_OBJECT_REASON_LAST_OWNER
      | typeof BLOCKING_OBJECT_REASON_LAST_EFFECTIVE_PROJECT_MANAGER,
  ) {
    return {
      id: projectId,
      kind: BLOCKING_OBJECT_KIND_PROJECT,
      reason,
    } as const;
  }
}
