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
  credentialTypes,
  credentialTypeCodes,
  roleCodes,
  roles,
  users,
  usersCredentialTypes,
  usersPasswordCredentials,
  usersRoles,
  usersSessions,
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
import { seededTestAccounts } from "./auth.seed-data.js";
import type { AuthContext } from "./auth.types.js";

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
      tx.insert(roles).values([...authSeedData.roles]).onConflictDoNothing().run();
    });
    await this.databaseService.persist();

    await this.seedUser({
      email: seededTestAccounts.admin.email,
      passwordHash: seededTestAccounts.admin.passwordHash,
      roleCode: roleCodes.admin,
      username: seededTestAccounts.admin.username,
    });
    await this.seedUser({
      email: seededTestAccounts.noRole.email,
      passwordHash: seededTestAccounts.noRole.passwordHash,
      roleCode: null,
      username: seededTestAccounts.noRole.username,
    });
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
        roleCode: usersRoles.roleCode,
      })
      .from(usersRoles)
      .where(eq(usersRoles.userId, session.userId))
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

  private async seedUser(seed: {
    email: string;
    passwordHash: string;
    roleCode: string | null;
    username: string;
  }): Promise<void> {
    this.databaseService.db.transaction((tx) => {
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

      if (seed.roleCode) {
        tx.insert(usersRoles)
          .values({
            roleCode: seed.roleCode,
            userId: user.id,
          })
          .onConflictDoNothing()
          .run();
      } else {
        tx.delete(usersRoles).where(eq(usersRoles.userId, user.id)).run();
      }
    });

    await this.databaseService.persist();
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
        roleCode: usersRoles.roleCode,
      })
      .from(usersRoles)
      .where(eq(usersRoles.userId, userId))
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
      !authContext.roleCodes.includes(roleCodes.admin)
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
