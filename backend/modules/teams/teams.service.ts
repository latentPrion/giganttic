import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  projectsTeams,
  systemRoleCodes,
  teams,
  teamsUsers,
  users,
  usersSystemRoles,
  usersTeamsTeamRoles,
} from "../../../db/index.js";
import { DatabaseService } from "../database/database.service.js";
import type { AuthContext } from "../auth/auth.types.js";
import type {
  CreateTeamRequest,
  DeleteTeamResponse,
  GetTeamResponse,
  ListTeamsResponse,
  TeamMember,
  TeamResponse,
  UpdateTeamMembershipRequest,
  UpdateTeamMembershipResponse,
  UpdateTeamRequest,
} from "./teams.contracts.js";

const SYSTEM_ADMIN_ROLE_CODE = systemRoleCodes.admin;
const TEAM_MANAGER_ROLE_CODE = "GGTC_TEAMROLE_TEAM_MANAGER";
const TEAM_ROLE_CODES = [
  "GGTC_TEAMROLE_PROJECT_MANAGER",
  "GGTC_TEAMROLE_TEAM_MANAGER",
] as const;
const LAST_TEAM_MANAGER_MESSAGE =
  "A team must retain at least one TEAM_MANAGER member";

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

function hasTeamManager(
  payload: UpdateTeamMembershipRequest,
): boolean {
  return payload.members.some((member) =>
    member.roleCodes.includes(TEAM_MANAGER_ROLE_CODE),
  );
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
        .returning({
          id: teams.id,
        })
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

    return {
      team: this.getTeamRecordByIdOrThrow(createdTeamId),
    };
  }

  listTeams(authContext: AuthContext): ListTeamsResponse {
    if (this.hasSystemAdminRole(authContext)) {
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

    return {
      team: this.getTeamRecordByIdOrThrow(teamId),
    };
  }

  async replaceTeamMembers(
    authContext: AuthContext,
    teamId: number,
    payload: UpdateTeamMembershipRequest,
  ): Promise<UpdateTeamMembershipResponse> {
    this.assertTeamExists(teamId);
    this.assertCanManageTeam(authContext, teamId);
    this.assertUsersExist(payload.members.map((member) => member.userId));

    if (!hasTeamManager(payload)) {
      throw new ConflictException(LAST_TEAM_MANAGER_MESSAGE);
    }

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

    return {
      members: this.listTeamMembers(teamId),
      teamId,
    };
  }

  async deleteTeam(
    authContext: AuthContext,
    teamId: number,
  ): Promise<DeleteTeamResponse> {
    this.assertTeamExists(teamId);
    this.assertCanManageTeam(authContext, teamId);

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

    return {
      deletedTeamId: teamId,
    };
  }

  private assertCanManageTeam(authContext: AuthContext, teamId: number): void {
    if (this.hasSystemAdminRole(authContext)) {
      return;
    }

    const managerRow = this.databaseService.db
      .select({ teamId: usersTeamsTeamRoles.teamId })
      .from(usersTeamsTeamRoles)
      .where(and(
        eq(usersTeamsTeamRoles.roleCode, TEAM_MANAGER_ROLE_CODE),
        eq(usersTeamsTeamRoles.teamId, teamId),
        eq(usersTeamsTeamRoles.userId, authContext.userId),
      ))
      .get();

    if (!managerRow) {
      throw new ForbiddenException("Not permitted to manage that team");
    }
  }

  private assertCanViewTeam(authContext: AuthContext, teamId: number): void {
    if (this.hasSystemAdminRole(authContext)) {
      return;
    }

    const membershipRow = this.databaseService.db
      .select({ teamId: teamsUsers.teamId })
      .from(teamsUsers)
      .where(and(
        eq(teamsUsers.teamId, teamId),
        eq(teamsUsers.userId, authContext.userId),
      ))
      .get();

    if (!membershipRow) {
      throw new ForbiddenException("Not permitted to access that team");
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

  private hasSystemAdminRole(authContext: AuthContext): boolean {
    return authContext.roleCodes.includes(SYSTEM_ADMIN_ROLE_CODE);
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
      .orderBy(asc(usersTeamsTeamRoles.userId), asc(usersTeamsTeamRoles.roleCode))
      .all();
    const roleCodesByUserId = new Map<number, Array<(typeof TEAM_ROLE_CODES)[number]>>();

    for (const roleRow of roleRows) {
      const currentRoleCodes = roleCodesByUserId.get(roleRow.userId) ?? [];
      currentRoleCodes.push(roleRow.roleCode as (typeof TEAM_ROLE_CODES)[number]);
      roleCodesByUserId.set(roleRow.userId, currentRoleCodes);
    }

    return membershipRows.map((membershipRow) => ({
      roleCodes: roleCodesByUserId.get(membershipRow.userId) ?? [],
      userId: membershipRow.userId,
      username: membershipRow.username,
    }));
  }
}
