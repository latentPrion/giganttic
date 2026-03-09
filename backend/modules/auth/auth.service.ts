import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import argon2 from "argon2";
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
} from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  authSeedData,
  closedReasons,
  credentialTypes,
  credentialTypeCodes,
  issueStatuses,
  organizationRoleCodes,
  organizationRoles,
  organizations,
  organizationsTeams,
  projectRoleCodes,
  projectRoles,
  projects,
  projectsOrganizations,
  projectsTeams,
  projectsUsers,
  systemRoleCodes,
  systemRoles,
  teamRoleCodes,
  teamRoles,
  teams,
  teamsUsers,
  users,
  usersCredentialTypes,
  usersOrganizations,
  usersOrganizationsOrganizationRoles,
  usersPasswordCredentials,
  usersProjectsProjectRoles,
  usersSessions,
  usersSystemRoles,
  usersTeamsTeamRoles,
} from "../../../db/index.js";
import {
  BACKEND_CONFIG,
  type BackendConfig,
} from "../../config/backend-config.js";
import { DatabaseService } from "../database/database.service.js";
import {
  type AuthUserResponse,
  type LoginRequest,
  type RegisterRequest,
  type RevokeSessionsRequest,
  type SessionQuery,
  type SessionSummary,
} from "./auth.contracts.js";
import {
  seededScopedFixtures,
  seededTestAccounts,
} from "./auth.seed-data.js";
import type { AuthContext } from "./auth.types.js";

type SeedDatabase = DatabaseService["db"];
type SeededAccountKey = keyof typeof seededTestAccounts;
type SeededUserIds = Record<SeededAccountKey, number>;

interface NamedSeedEntity {
  description: string;
  name: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(BACKEND_CONFIG) private readonly config: BackendConfig,
  ) {}

  async ensureSeedData(): Promise<void> {
    this.databaseService.db.transaction((tx) => {
      tx
        .insert(credentialTypes)
        .values([...authSeedData.credentialTypes])
        .onConflictDoNothing()
        .run();
      tx
        .insert(systemRoles)
        .values([...authSeedData.systemRoles])
        .onConflictDoNothing()
        .run();
      tx
        .insert(projectRoles)
        .values([...authSeedData.projectRoles])
        .onConflictDoNothing()
        .run();
      tx
        .insert(organizationRoles)
        .values([...authSeedData.organizationRoles])
        .onConflictDoNothing()
        .run();
      tx
        .insert(issueStatuses)
        .values([...authSeedData.issueStatuses])
        .onConflictDoNothing()
        .run();
      tx
        .insert(closedReasons)
        .values([...authSeedData.closedReasons])
        .onConflictDoNothing()
        .run();
      tx
        .insert(teamRoles)
        .values([...authSeedData.teamRoles])
        .onConflictDoNothing()
        .run();
    });
    await this.databaseService.persist();

    const seededUserIds = await this.ensureSeedUsers();

    this.databaseService.db.transaction((tx) => {
      this.ensureScopedSeedFixtures(tx, seededUserIds);
    });
    await this.databaseService.persist();
  }

  async register(payload: RegisterRequest): Promise<{ user: AuthUserResponse }> {
    const passwordHash = await argon2.hash(payload.password);

    try {
      const createdUser = this.databaseService.db.transaction((tx) => {
        const [created] = tx
          .insert(users)
          .values({
            email: payload.email,
            username: payload.username,
          })
          .returning({
            email: users.email,
            id: users.id,
            username: users.username,
          })
          .all();

        const [credentialInstance] = tx
          .insert(usersCredentialTypes)
          .values({
            credentialTypeCode: credentialTypeCodes.usernamePassword,
            userId: created.id,
          })
          .returning({
            id: usersCredentialTypes.id,
          })
          .all();

        tx.insert(usersPasswordCredentials)
          .values({
            passwordHash,
            userCredentialTypeId: credentialInstance.id,
          })
          .run();

        return created;
      });

      await this.databaseService.persist();
      return {
        user: this.buildAuthUser(createdUser.id),
      };
    } catch (error) {
      this.translatePersistenceError(error);
    }
  }

  async login(
    payload: LoginRequest,
    requestMetadata: { ipAddress: string; location: string | null },
  ): Promise<{
    accessToken: string;
    session: SessionSummary;
    tokenType: "Bearer";
    user: AuthUserResponse;
  }> {
    const credentialRow = this.databaseService.db
      .select({
        deletedAt: users.deletedAt,
        deactivatedAt: users.deactivatedAt,
        email: users.email,
        isActive: users.isActive,
        passwordHash: usersPasswordCredentials.passwordHash,
        userId: users.id,
        username: users.username,
      })
      .from(users)
      .innerJoin(
        usersCredentialTypes,
        and(
          eq(usersCredentialTypes.userId, users.id),
          eq(
            usersCredentialTypes.credentialTypeCode,
            credentialTypeCodes.usernamePassword,
          ),
          isNull(usersCredentialTypes.revokedAt),
        ),
      )
      .innerJoin(
        usersPasswordCredentials,
        eq(
          usersPasswordCredentials.userCredentialTypeId,
          usersCredentialTypes.id,
        ),
      )
      .where(eq(users.username, payload.username))
      .get();

    if (!credentialRow) {
      throw new UnauthorizedException("Invalid username or password");
    }
    if (
      !credentialRow.isActive ||
      credentialRow.deletedAt !== null ||
      credentialRow.deactivatedAt !== null
    ) {
      throw new UnauthorizedException("User is not active");
    }

    const isPasswordValid = await argon2.verify(
      credentialRow.passwordHash,
      payload.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid username or password");
    }

    const accessToken = this.generateBearerToken();
    const sessionId = randomUUID();
    const now = new Date();
    const expiration = new Date(now.getTime() + this.config.sessionTtlMs);
    const sessionTokenHash = this.hashToken(accessToken);

    this.databaseService.db.transaction((tx) => {
      tx.insert(usersSessions)
        .values({
          expirationTimestamp: expiration,
          id: sessionId,
          ipAddress: requestMetadata.ipAddress,
          location: requestMetadata.location,
          sessionTokenHash,
          startTimestamp: now,
          userId: credentialRow.userId,
        })
        .run();
    });
    await this.databaseService.persist();

    return {
      accessToken,
      session: this.buildSessionSummary(
        this.getSessionByIdOrThrow(sessionId),
      ),
      tokenType: "Bearer",
      user: this.buildAuthUser(credentialRow.userId),
    };
  }

  authenticateBearerToken(token: string): AuthContext {
    const now = new Date();
    const session = this.databaseService.db
      .select({
        id: usersSessions.id,
        userId: usersSessions.userId,
      })
      .from(usersSessions)
      .where(
        and(
          eq(usersSessions.sessionTokenHash, this.hashToken(token)),
          gt(usersSessions.expirationTimestamp, now),
          isNull(usersSessions.revokedAt),
        ),
      )
      .get();

    if (!session) {
      throw new UnauthorizedException("Invalid or expired session");
    }

    const roleRows = this.databaseService.db
      .select({
        roleCode: usersSystemRoles.roleCode,
      })
      .from(usersSystemRoles)
      .where(eq(usersSystemRoles.userId, session.userId))
      .all();

    return {
      roleCodes: roleRows.map((row) => row.roleCode),
      sessionId: session.id,
      userId: session.userId,
    };
  }

  getCurrentSession(authContext: AuthContext): {
    session: SessionSummary;
    user: AuthUserResponse;
  } {
    return {
      session: this.buildSessionSummary(
        this.getSessionByIdOrThrow(authContext.sessionId),
      ),
      user: this.buildAuthUser(authContext.userId),
    };
  }

  listActiveSessions(
    authContext: AuthContext,
    query: SessionQuery,
  ): { sessions: SessionSummary[] } {
    this.assertCanManageUserSessions(authContext, query.userId);

    const sessions = this.databaseService.db
      .select()
      .from(usersSessions)
      .where(
        and(
          eq(usersSessions.userId, query.userId),
          gt(usersSessions.expirationTimestamp, new Date()),
          isNull(usersSessions.revokedAt),
        ),
      )
      .orderBy(desc(usersSessions.startTimestamp))
      .all();

    return {
      sessions: sessions.map((session) => this.buildSessionSummary(session)),
    };
  }

  async revokeSessions(
    authContext: AuthContext,
    payload: RevokeSessionsRequest,
  ): Promise<{ revokedSessionIds: string[] }> {
    const sessions = this.databaseService.db
      .select({
        id: usersSessions.id,
        userId: usersSessions.userId,
      })
      .from(usersSessions)
      .where(inArray(usersSessions.id, payload.sessionIds))
      .all();

    for (const session of sessions) {
      this.assertCanManageUserSessions(authContext, session.userId);
    }

    const revocationTimestamp = new Date();
    const revocableIds = sessions.map((session) => session.id);

    if (revocableIds.length > 0) {
      this.databaseService.db.transaction((tx) => {
        tx.update(usersSessions)
          .set({
            revokedAt: revocationTimestamp,
            updatedAt: revocationTimestamp,
          })
          .where(inArray(usersSessions.id, revocableIds))
          .run();
      });
      await this.databaseService.persist();
    }

    return {
      revokedSessionIds: revocableIds,
    };
  }

  extractRequestMetadata(request: {
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
    socket?: { remoteAddress?: string | undefined };
  }): { ipAddress: string; location: string | null } {
    const forwardedFor = request.headers["x-forwarded-for"];
    const forwardedValue = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor;
    const candidateIp = forwardedValue?.split(",")[0]?.trim()
      || request.ip
      || request.socket?.remoteAddress
      || "unknown";
    const normalizedIp = candidateIp.startsWith("::ffff:")
      ? candidateIp.slice("::ffff:".length)
      : candidateIp;

    const locationHeader = request.headers["x-client-location"];
    const location = Array.isArray(locationHeader)
      ? locationHeader[0]
      : locationHeader;

    return {
      ipAddress: normalizedIp,
      location: location ?? null,
    };
  }

  private async ensureSeedUsers(): Promise<SeededUserIds> {
    return {
      admin: await this.seedUser({
        email: seededTestAccounts.admin.email,
        passwordHash: seededTestAccounts.admin.passwordHash,
        systemRoleCode: systemRoleCodes.admin,
        username: seededTestAccounts.admin.username,
      }),
      noRole: await this.seedUser({
        email: seededTestAccounts.noRole.email,
        passwordHash: seededTestAccounts.noRole.passwordHash,
        systemRoleCode: null,
        username: seededTestAccounts.noRole.username,
      }),
      orgOrganizationManager: await this.seedUser({
        email: seededTestAccounts.orgOrganizationManager.email,
        passwordHash: seededTestAccounts.orgOrganizationManager.passwordHash,
        systemRoleCode: null,
        username: seededTestAccounts.orgOrganizationManager.username,
      }),
      orgProjectManager: await this.seedUser({
        email: seededTestAccounts.orgProjectManager.email,
        passwordHash: seededTestAccounts.orgProjectManager.passwordHash,
        systemRoleCode: null,
        username: seededTestAccounts.orgProjectManager.username,
      }),
      orgTeamManager: await this.seedUser({
        email: seededTestAccounts.orgTeamManager.email,
        passwordHash: seededTestAccounts.orgTeamManager.passwordHash,
        systemRoleCode: null,
        username: seededTestAccounts.orgTeamManager.username,
      }),
      projectProjectManager: await this.seedUser({
        email: seededTestAccounts.projectProjectManager.email,
        passwordHash: seededTestAccounts.projectProjectManager.passwordHash,
        systemRoleCode: null,
        username: seededTestAccounts.projectProjectManager.username,
      }),
      teamProjectManager: await this.seedUser({
        email: seededTestAccounts.teamProjectManager.email,
        passwordHash: seededTestAccounts.teamProjectManager.passwordHash,
        systemRoleCode: null,
        username: seededTestAccounts.teamProjectManager.username,
      }),
      teamTeamManager: await this.seedUser({
        email: seededTestAccounts.teamTeamManager.email,
        passwordHash: seededTestAccounts.teamTeamManager.passwordHash,
        systemRoleCode: null,
        username: seededTestAccounts.teamTeamManager.username,
      }),
    };
  }

  private ensureScopedSeedFixtures(
    tx: SeedDatabase,
    seededUserIds: SeededUserIds,
  ): void {
    const organizationManagerOrganizationId = this.ensureOrganization(
      tx,
      seededScopedFixtures.organizations.orgOrganizationManager,
    );
    const organizationProjectManagerOrganizationId = this.ensureOrganization(
      tx,
      seededScopedFixtures.organizations.orgProjectManager,
    );
    const organizationTeamManagerOrganizationId = this.ensureOrganization(
      tx,
      seededScopedFixtures.organizations.orgTeamManager,
    );
    const directProjectManagerProjectId = this.ensureProject(
      tx,
      seededScopedFixtures.projects.projectProjectManager,
    );
    const organizationProjectManagerProjectId = this.ensureProject(
      tx,
      seededScopedFixtures.projects.orgProjectManager,
    );
    const teamProjectManagerProjectId = this.ensureProject(
      tx,
      seededScopedFixtures.projects.teamProjectManager,
    );
    const directTeamManagerTeamId = this.ensureTeam(
      tx,
      seededScopedFixtures.teams.teamTeamManager,
    );
    const organizationTeamManagerTeamId = this.ensureTeam(
      tx,
      seededScopedFixtures.teams.orgTeamManager,
    );
    const teamProjectManagerTeamId = this.ensureTeam(
      tx,
      seededScopedFixtures.teams.teamProjectManager,
    );

    this.ensureOrganizationMembership(
      tx,
      organizationManagerOrganizationId,
      seededUserIds.orgOrganizationManager,
    );
    this.ensureOrganizationRole(
      tx,
      organizationManagerOrganizationId,
      seededUserIds.orgOrganizationManager,
      organizationRoleCodes.organizationManager,
    );

    this.ensureOrganizationMembership(
      tx,
      organizationProjectManagerOrganizationId,
      seededUserIds.orgProjectManager,
    );
    this.ensureOrganizationRole(
      tx,
      organizationProjectManagerOrganizationId,
      seededUserIds.orgProjectManager,
      organizationRoleCodes.projectManager,
    );
    this.ensureProjectMembership(
      tx,
      organizationProjectManagerProjectId,
      seededUserIds.orgProjectManager,
    );
    this.ensureProjectOrganizationAssociation(
      tx,
      organizationProjectManagerProjectId,
      organizationProjectManagerOrganizationId,
    );

    this.ensureOrganizationMembership(
      tx,
      organizationTeamManagerOrganizationId,
      seededUserIds.orgTeamManager,
    );
    this.ensureOrganizationRole(
      tx,
      organizationTeamManagerOrganizationId,
      seededUserIds.orgTeamManager,
      organizationRoleCodes.teamManager,
    );
    this.ensureTeamMembership(
      tx,
      organizationTeamManagerTeamId,
      seededUserIds.orgTeamManager,
    );
    this.ensureOrganizationTeamAssociation(
      tx,
      organizationTeamManagerTeamId,
      organizationTeamManagerOrganizationId,
    );

    this.ensureTeamMembership(
      tx,
      directTeamManagerTeamId,
      seededUserIds.teamTeamManager,
    );
    this.ensureTeamRole(
      tx,
      directTeamManagerTeamId,
      seededUserIds.teamTeamManager,
      teamRoleCodes.teamManager,
    );

    this.ensureTeamMembership(
      tx,
      teamProjectManagerTeamId,
      seededUserIds.teamProjectManager,
    );
    this.ensureTeamRole(
      tx,
      teamProjectManagerTeamId,
      seededUserIds.teamProjectManager,
      teamRoleCodes.projectManager,
    );
    this.ensureProjectTeamAssociation(
      tx,
      teamProjectManagerProjectId,
      teamProjectManagerTeamId,
    );

    this.ensureProjectMembership(
      tx,
      directProjectManagerProjectId,
      seededUserIds.projectProjectManager,
    );
    this.ensureProjectRole(
      tx,
      directProjectManagerProjectId,
      seededUserIds.projectProjectManager,
      projectRoleCodes.projectManager,
    );
  }

  private ensureOrganization(
    tx: SeedDatabase,
    seed: NamedSeedEntity,
  ): number {
    const existingOrganization = tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.name, seed.name))
      .get();

    if (existingOrganization) {
      tx.update(organizations)
        .set({
          description: seed.description,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, existingOrganization.id))
        .run();

      return existingOrganization.id;
    }

    const [createdOrganization] = tx.insert(organizations)
      .values({
        description: seed.description,
        name: seed.name,
      })
      .returning({ id: organizations.id })
      .all();

    return createdOrganization.id;
  }

  private ensureOrganizationMembership(
    tx: SeedDatabase,
    organizationId: number,
    userId: number,
  ): void {
    tx.insert(usersOrganizations)
      .values({
        organizationId,
        userId,
      })
      .onConflictDoNothing()
      .run();
  }

  private ensureOrganizationRole(
    tx: SeedDatabase,
    organizationId: number,
    userId: number,
    roleCode: string,
  ): void {
    tx.insert(usersOrganizationsOrganizationRoles)
      .values({
        organizationId,
        roleCode,
        userId,
      })
      .onConflictDoNothing()
      .run();
  }

  private ensureOrganizationTeamAssociation(
    tx: SeedDatabase,
    teamId: number,
    organizationId: number,
  ): void {
    tx.insert(organizationsTeams)
      .values({
        organizationId,
        teamId,
      })
      .onConflictDoNothing()
      .run();
  }

  private ensureProject(
    tx: SeedDatabase,
    seed: NamedSeedEntity,
  ): number {
    const existingProject = tx
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.name, seed.name))
      .get();

    if (existingProject) {
      tx.update(projects)
        .set({
          description: seed.description,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, existingProject.id))
        .run();

      return existingProject.id;
    }

    const [createdProject] = tx.insert(projects)
      .values({
        description: seed.description,
        name: seed.name,
      })
      .returning({ id: projects.id })
      .all();

    return createdProject.id;
  }

  private ensureProjectMembership(
    tx: SeedDatabase,
    projectId: number,
    userId: number,
  ): void {
    tx.insert(projectsUsers)
      .values({
        projectId,
        userId,
      })
      .onConflictDoNothing()
      .run();
  }

  private ensureProjectOrganizationAssociation(
    tx: SeedDatabase,
    projectId: number,
    organizationId: number,
  ): void {
    tx.insert(projectsOrganizations)
      .values({
        organizationId,
        projectId,
      })
      .onConflictDoNothing()
      .run();
  }

  private ensureProjectRole(
    tx: SeedDatabase,
    projectId: number,
    userId: number,
    roleCode: string,
  ): void {
    tx.insert(usersProjectsProjectRoles)
      .values({
        projectId,
        roleCode,
        userId,
      })
      .onConflictDoNothing()
      .run();
  }

  private ensureProjectTeamAssociation(
    tx: SeedDatabase,
    projectId: number,
    teamId: number,
  ): void {
    tx.insert(projectsTeams)
      .values({
        projectId,
        teamId,
      })
      .onConflictDoNothing()
      .run();
  }

  private ensureTeam(
    tx: SeedDatabase,
    seed: NamedSeedEntity,
  ): number {
    const existingTeam = tx
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.name, seed.name))
      .get();

    if (existingTeam) {
      tx.update(teams)
        .set({
          description: seed.description,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, existingTeam.id))
        .run();

      return existingTeam.id;
    }

    const [createdTeam] = tx.insert(teams)
      .values({
        description: seed.description,
        name: seed.name,
      })
      .returning({ id: teams.id })
      .all();

    return createdTeam.id;
  }

  private ensureTeamMembership(
    tx: SeedDatabase,
    teamId: number,
    userId: number,
  ): void {
    tx.insert(teamsUsers)
      .values({
        teamId,
        userId,
      })
      .onConflictDoNothing()
      .run();
  }

  private ensureTeamRole(
    tx: SeedDatabase,
    teamId: number,
    userId: number,
    roleCode: string,
  ): void {
    tx.insert(usersTeamsTeamRoles)
      .values({
        roleCode,
        teamId,
        userId,
      })
      .onConflictDoNothing()
      .run();
  }

  private async seedUser(seed: {
    email: string;
      passwordHash: string;
      systemRoleCode: string | null;
      username: string;
  }): Promise<number> {
    const userId = this.databaseService.db.transaction((tx) => {
      let user = tx
        .select({
          id: users.id,
        })
        .from(users)
        .where(eq(users.username, seed.username))
        .get();

      if (!user) {
        [user] = tx
          .insert(users)
          .values({
            email: seed.email,
            username: seed.username,
          })
          .returning({
            id: users.id,
          })
          .all();
      } else {
        tx.update(users)
          .set({
            email: seed.email,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .run();
      }

      let passwordCredential = tx
        .select({
          id: usersCredentialTypes.id,
        })
        .from(usersCredentialTypes)
        .where(
          and(
            eq(usersCredentialTypes.userId, user.id),
            eq(
              usersCredentialTypes.credentialTypeCode,
              credentialTypeCodes.usernamePassword,
            ),
          ),
        )
        .get();

      if (!passwordCredential) {
        [passwordCredential] = tx
          .insert(usersCredentialTypes)
          .values({
            credentialTypeCode: credentialTypeCodes.usernamePassword,
            userId: user.id,
          })
          .returning({
            id: usersCredentialTypes.id,
          })
          .all();
      }

      const passwordRow = tx
        .select({
          id: usersPasswordCredentials.id,
        })
        .from(usersPasswordCredentials)
        .where(
          eq(
            usersPasswordCredentials.userCredentialTypeId,
            passwordCredential.id,
          ),
        )
        .get();

      if (!passwordRow) {
        tx.insert(usersPasswordCredentials)
          .values({
            passwordHash: seed.passwordHash,
            userCredentialTypeId: passwordCredential.id,
          })
          .run();
      } else {
        tx.update(usersPasswordCredentials)
          .set({
            passwordHash: seed.passwordHash,
            passwordUpdatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(usersPasswordCredentials.id, passwordRow.id))
          .run();
      }

      if (seed.systemRoleCode) {
        tx.insert(usersSystemRoles)
          .values({
            roleCode: seed.systemRoleCode,
            userId: user.id,
          })
          .onConflictDoNothing()
          .run();
      } else {
        tx.delete(usersSystemRoles)
          .where(eq(usersSystemRoles.userId, user.id))
          .run();
      }

      return user.id;
    });

    await this.databaseService.persist();
    return userId;
  }

  private buildAuthUser(userId: number): AuthUserResponse {
    const user = this.databaseService.db
      .select({
        email: users.email,
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const roleRows = this.databaseService.db
      .select({
        roleCode: usersSystemRoles.roleCode,
      })
      .from(usersSystemRoles)
      .where(eq(usersSystemRoles.userId, userId))
      .all();

    return {
      email: user.email,
      id: user.id,
      roles: roleRows.map((role) => role.roleCode),
      username: user.username,
    };
  }

  private buildSessionSummary(
    session: typeof usersSessions.$inferSelect,
  ): SessionSummary {
    return {
      expirationTimestamp: session.expirationTimestamp.toISOString(),
      id: session.id,
      ipAddress: session.ipAddress,
      location: session.location ?? null,
      revokedAt: session.revokedAt ? session.revokedAt.toISOString() : null,
      startTimestamp: session.startTimestamp.toISOString(),
      userId: session.userId,
    };
  }

  private getSessionByIdOrThrow(
    sessionId: string,
  ): typeof usersSessions.$inferSelect {
    const session = this.databaseService.db
      .select()
      .from(usersSessions)
      .where(eq(usersSessions.id, sessionId))
      .get();

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    return session;
  }

  private generateBearerToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private assertCanManageUserSessions(
    authContext: AuthContext,
    targetUserId: number,
  ): void {
    if (
      authContext.userId !== targetUserId &&
      !authContext.roleCodes.includes(systemRoleCodes.admin)
    ) {
      throw new ForbiddenException("Not permitted to access those sessions");
    }
  }

  private translatePersistenceError(error: unknown): never {
    const message = String(error);
    if (message.includes("Users.username")) {
      throw new ConflictException("Username already exists");
    }
    if (message.includes("Users.email")) {
      throw new ConflictException("Email already exists");
    }

    throw error;
  }
}
