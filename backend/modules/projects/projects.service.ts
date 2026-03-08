import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  projectRoleCodes,
  projects,
  projectsTeams,
  projectsUsers,
  systemRoleCodes,
  teamsUsers,
  users,
  usersProjectsProjectRoles,
} from "../../../db/index.js";
import { DatabaseService } from "../database/database.service.js";
import type { AuthContext } from "../auth/auth.types.js";
import type {
  CreateProjectRequest,
  DeleteProjectResponse,
  GetProjectResponse,
  ListProjectsResponse,
  ProjectMember,
  ProjectResponse,
  UpdateProjectMembershipRequest,
  UpdateProjectMembershipResponse,
  UpdateProjectRequest,
} from "./projects.contracts.js";

const PROJECT_MANAGER_ROLE_CODE = projectRoleCodes.projectManager;
const PROJECT_ROLE_CODES = ["GGTC_PROJECTROLE_PROJECT_MANAGER"] as const;
const SYSTEM_ADMIN_ROLE_CODE = systemRoleCodes.admin;
const LAST_PROJECT_MANAGER_MESSAGE =
  "A project must retain at least one PROJECT_MANAGER member";

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

function hasProjectManager(
  payload: UpdateProjectMembershipRequest,
): boolean {
  return payload.members.some((member) =>
    member.roleCodes.includes(PROJECT_MANAGER_ROLE_CODE),
  );
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
        .returning({
          id: projects.id,
        })
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

    return {
      project: this.getProjectRecordByIdOrThrow(createdProjectId),
    };
  }

  listProjects(authContext: AuthContext): ListProjectsResponse {
    if (this.hasSystemAdminRole(authContext)) {
      return {
        projects: this.databaseService.db
          .select()
          .from(projects)
          .orderBy(asc(projects.id))
          .all()
          .map(toProjectResponse),
      };
    }

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

    return {
      project: this.getProjectRecordByIdOrThrow(projectId),
    };
  }

  async replaceProjectMembers(
    authContext: AuthContext,
    projectId: number,
    payload: UpdateProjectMembershipRequest,
  ): Promise<UpdateProjectMembershipResponse> {
    this.assertProjectExists(projectId);
    this.assertCanManageProject(authContext, projectId);
    this.assertUsersExist(payload.members.map((member) => member.userId));

    if (!hasProjectManager(payload)) {
      throw new ConflictException(LAST_PROJECT_MANAGER_MESSAGE);
    }

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

    return {
      members: this.listProjectMembers(projectId),
      projectId,
    };
  }

  async deleteProject(
    authContext: AuthContext,
    projectId: number,
  ): Promise<DeleteProjectResponse> {
    this.assertProjectExists(projectId);
    this.assertCanManageProject(authContext, projectId);

    this.databaseService.db.transaction((tx) => {
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

    return {
      deletedProjectId: projectId,
    };
  }

  private assertCanManageProject(authContext: AuthContext, projectId: number): void {
    if (this.hasSystemAdminRole(authContext)) {
      return;
    }

    const managerRow = this.databaseService.db
      .select({ projectId: usersProjectsProjectRoles.projectId })
      .from(usersProjectsProjectRoles)
      .where(and(
        eq(usersProjectsProjectRoles.projectId, projectId),
        eq(usersProjectsProjectRoles.roleCode, PROJECT_MANAGER_ROLE_CODE),
        eq(usersProjectsProjectRoles.userId, authContext.userId),
      ))
      .get();

    if (!managerRow) {
      throw new ForbiddenException("Not permitted to manage that project");
    }
  }

  private assertCanViewProject(authContext: AuthContext, projectId: number): void {
    if (this.hasSystemAdminRole(authContext)) {
      return;
    }

    if (!this.hasProjectAccess(authContext.userId, projectId)) {
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

  private assertUsersExist(userIds: number[]): void {
    const distinctUserIds = [...new Set(userIds)];
    const existingIds = this.databaseService.db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, distinctUserIds))
      .all()
      .map((row) => row.id);

    if (existingIds.length !== distinctUserIds.length) {
      throw new NotFoundException("One or more users were not found");
    }
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

  private hasProjectAccess(userId: number, projectId: number): boolean {
    const directAccessRow = this.databaseService.db
      .select({ projectId: projectsUsers.projectId })
      .from(projectsUsers)
      .where(and(
        eq(projectsUsers.projectId, projectId),
        eq(projectsUsers.userId, userId),
      ))
      .get();

    if (directAccessRow) {
      return true;
    }

    const teamAccessRow = this.databaseService.db
      .select({ projectId: projectsTeams.projectId })
      .from(projectsTeams)
      .innerJoin(teamsUsers, eq(teamsUsers.teamId, projectsTeams.teamId))
      .where(and(
        eq(projectsTeams.projectId, projectId),
        eq(teamsUsers.userId, userId),
      ))
      .get();

    return Boolean(teamAccessRow);
  }

  private hasSystemAdminRole(authContext: AuthContext): boolean {
    return authContext.roleCodes.includes(SYSTEM_ADMIN_ROLE_CODE);
  }

  private listAccessibleProjectIds(userId: number): number[] {
    const directProjectIds = this.databaseService.db
      .select({ projectId: projectsUsers.projectId })
      .from(projectsUsers)
      .where(eq(projectsUsers.userId, userId))
      .all()
      .map((row) => row.projectId);
    const teamDerivedProjectIds = this.databaseService.db
      .select({ projectId: projectsTeams.projectId })
      .from(projectsTeams)
      .innerJoin(teamsUsers, eq(teamsUsers.teamId, projectsTeams.teamId))
      .where(eq(teamsUsers.userId, userId))
      .all()
      .map((row) => row.projectId);

    return [...new Set([...directProjectIds, ...teamDerivedProjectIds])];
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
      .orderBy(
        asc(usersProjectsProjectRoles.userId),
        asc(usersProjectsProjectRoles.roleCode),
      )
      .all();
    const roleCodesByUserId = new Map<number, Array<(typeof PROJECT_ROLE_CODES)[number]>>();

    for (const roleRow of roleRows) {
      const currentRoleCodes = roleCodesByUserId.get(roleRow.userId) ?? [];
      currentRoleCodes.push(
        roleRow.roleCode as (typeof PROJECT_ROLE_CODES)[number],
      );
      roleCodesByUserId.set(roleRow.userId, currentRoleCodes);
    }

    return membershipRows.map((membershipRow) => ({
      roleCodes: roleCodesByUserId.get(membershipRow.userId) ?? [],
      userId: membershipRow.userId,
      username: membershipRow.username,
    }));
  }
}
