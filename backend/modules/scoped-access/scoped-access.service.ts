import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

import {
  credentialTypeCodes,
  projects,
  scopedAccessObjectTypeCodes,
  scopedAccessTokenCredentialsObjects,
  users,
  usersCredentialTypes,
  usersScopedAccessTokenCredentials,
} from "../../../db/index.js";
import {
  hasProjectAccess,
  hasSystemAdminRole,
} from "../access-control/access-control.utils.js";
import { AuthService } from "../auth/auth.service.js";
import type { AuthContext } from "../auth/auth.types.js";
import type {
  AuthUserResponse,
  SessionSummary,
} from "../auth/auth.contracts.js";
import { DatabaseService } from "../database/database.service.js";
import type {
  AddScopedAccessProjectScopeRequest,
  CreateScopedAccessTokenRequest,
} from "./scoped-access.contracts.js";
import { assertStandardSession } from "./scoped-access.policy.js";

@Injectable()
export class ScopedAccessService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  createToken(
    authContext: AuthContext,
    payload: CreateScopedAccessTokenRequest,
  ): { token: string; tokenCredential: ScopedTokenResponse } {
    assertStandardSession(authContext);
    const expiresAt = this.parseOptionalExpiration(payload.expiresAt);
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const now = new Date();

    const createdCredentialId = this.databaseService.db.transaction((tx) => {
      const [credentialType] = tx.insert(usersCredentialTypes)
        .values({
          credentialTypeCode: credentialTypeCodes.scopedAccessToken,
          userId: authContext.userId,
        })
        .returning({ id: usersCredentialTypes.id })
        .all();

      const [createdCredential] = tx.insert(usersScopedAccessTokenCredentials)
        .values({
          expiresAt,
          ownerUserId: authContext.userId,
          tokenHash,
          updatedAt: now,
          userCredentialTypeId: credentialType.id,
        })
        .returning({ id: usersScopedAccessTokenCredentials.id })
        .all();

      return createdCredential.id;
    });

    return {
      token,
      tokenCredential: this.getTokenCredential(authContext.userId, createdCredentialId),
    };
  }

  listTokens(authContext: AuthContext): { tokenCredentials: ScopedTokenResponse[] } {
    assertStandardSession(authContext);
    return {
      tokenCredentials: this.listOwnerTokenCredentials(authContext.userId),
    };
  }

  revokeToken(
    authContext: AuthContext,
    tokenCredentialId: number,
  ): { revokedTokenCredentialId: number } {
    assertStandardSession(authContext);
    this.assertOwnerTokenCredential(authContext.userId, tokenCredentialId);
    this.databaseService.db.delete(usersScopedAccessTokenCredentials)
      .where(eq(usersScopedAccessTokenCredentials.id, tokenCredentialId))
      .run();

    return { revokedTokenCredentialId: tokenCredentialId };
  }

  addProjectScope(
    authContext: AuthContext,
    tokenCredentialId: number,
    payload: AddScopedAccessProjectScopeRequest,
  ): { tokenCredential: ScopedTokenResponse } {
    assertStandardSession(authContext);
    this.assertOwnerTokenCredential(authContext.userId, tokenCredentialId);
    this.assertProjectExists(payload.projectId);
    this.assertOwnerCanAccessProject(authContext, payload.projectId);

    try {
      this.databaseService.db.insert(scopedAccessTokenCredentialsObjects)
        .values({
          scopedAccessObjectId: payload.projectId,
          scopedAccessObjectTypeCode: scopedAccessObjectTypeCodes.project,
          scopedAccessTokenCredentialId: tokenCredentialId,
        })
        .run();
    } catch (error) {
      if (String(error).includes("unique")) {
        throw new ConflictException("Project scope already exists for token");
      }
      throw error;
    }

    return {
      tokenCredential: this.getTokenCredential(authContext.userId, tokenCredentialId),
    };
  }

  removeProjectScope(
    authContext: AuthContext,
    tokenCredentialId: number,
    projectId: number,
  ): { tokenCredential: ScopedTokenResponse } {
    assertStandardSession(authContext);
    this.assertOwnerTokenCredential(authContext.userId, tokenCredentialId);

    this.databaseService.db.delete(scopedAccessTokenCredentialsObjects)
      .where(
        and(
          eq(
            scopedAccessTokenCredentialsObjects.scopedAccessTokenCredentialId,
            tokenCredentialId,
          ),
          eq(
            scopedAccessTokenCredentialsObjects.scopedAccessObjectTypeCode,
            scopedAccessObjectTypeCodes.project,
          ),
          eq(scopedAccessTokenCredentialsObjects.scopedAccessObjectId, projectId),
        ),
      )
      .run();

    return {
      tokenCredential: this.getTokenCredential(authContext.userId, tokenCredentialId),
    };
  }

  redeemToken(
    token: string,
    requestMetadata: { ipAddress: string; location: string | null },
  ): {
    accessToken: string;
    session: SessionSummary;
    tokenType: "Bearer";
    user: AuthUserResponse;
  } {
    const tokenRow = this.databaseService.db
      .select({
        credentialId: usersScopedAccessTokenCredentials.id,
        expiresAt: usersScopedAccessTokenCredentials.expiresAt,
        revokedAt: usersScopedAccessTokenCredentials.revokedAt,
        userId: usersScopedAccessTokenCredentials.ownerUserId,
        userIsActive: users.isActive,
        userDeletedAt: users.deletedAt,
        userDeactivatedAt: users.deactivatedAt,
      })
      .from(usersScopedAccessTokenCredentials)
      .innerJoin(users, eq(users.id, usersScopedAccessTokenCredentials.ownerUserId))
      .where(eq(usersScopedAccessTokenCredentials.tokenHash, this.hashToken(token)))
      .get();

    if (!tokenRow) {
      throw new UnauthorizedException("Invalid scoped access token");
    }

    const now = new Date();
    if (
      tokenRow.revokedAt !== null ||
      (tokenRow.expiresAt !== null && tokenRow.expiresAt <= now)
    ) {
      throw new UnauthorizedException("Invalid scoped access token");
    }
    if (
      !tokenRow.userIsActive ||
      tokenRow.userDeletedAt !== null ||
      tokenRow.userDeactivatedAt !== null
    ) {
      throw new UnauthorizedException("Invalid scoped access token");
    }

    const sessionResult = this.authService.createSessionForUser(
      tokenRow.userId,
      requestMetadata,
      {
        credentialId: tokenRow.credentialId,
        credentialTypeCode: credentialTypeCodes.scopedAccessToken,
      },
    );

    this.databaseService.db.update(usersScopedAccessTokenCredentials)
      .set({
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(eq(usersScopedAccessTokenCredentials.id, tokenRow.credentialId))
      .run();

    return {
      accessToken: sessionResult.accessToken,
      session: sessionResult.session,
      tokenType: "Bearer",
      user: this.authService.getAuthUserById(tokenRow.userId),
    };
  }

  private listOwnerTokenCredentials(ownerUserId: number): ScopedTokenResponse[] {
    const tokenRows = this.databaseService.db
      .select()
      .from(usersScopedAccessTokenCredentials)
      .where(eq(usersScopedAccessTokenCredentials.ownerUserId, ownerUserId))
      .all();

    if (tokenRows.length === 0) {
      return [];
    }

    const scopeRows = this.databaseService.db
      .select({
        objectId: scopedAccessTokenCredentialsObjects.scopedAccessObjectId,
        objectTypeCode: scopedAccessTokenCredentialsObjects.scopedAccessObjectTypeCode,
        tokenCredentialId: scopedAccessTokenCredentialsObjects.scopedAccessTokenCredentialId,
      })
      .from(scopedAccessTokenCredentialsObjects)
      .all();

    return tokenRows.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      id: row.id,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      scopes: scopeRows
        .filter((scopeRow) => scopeRow.tokenCredentialId === row.id)
        .map((scopeRow) => ({
          objectId: scopeRow.objectId,
          objectTypeCode: scopeRow.objectTypeCode,
        })),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  private getTokenCredential(
    ownerUserId: number,
    tokenCredentialId: number,
  ): ScopedTokenResponse {
    this.assertOwnerTokenCredential(ownerUserId, tokenCredentialId);

    return this.listOwnerTokenCredentials(ownerUserId)
      .find((tokenCredential) => tokenCredential.id === tokenCredentialId)!;
  }

  private assertOwnerTokenCredential(ownerUserId: number, tokenCredentialId: number): void {
    const row = this.databaseService.db
      .select({ id: usersScopedAccessTokenCredentials.id })
      .from(usersScopedAccessTokenCredentials)
      .where(
        and(
          eq(usersScopedAccessTokenCredentials.id, tokenCredentialId),
          eq(usersScopedAccessTokenCredentials.ownerUserId, ownerUserId),
        ),
      )
      .get();

    if (!row) {
      throw new NotFoundException("Scoped access token credential not found");
    }
  }

  private assertProjectExists(projectId: number): void {
    const projectRow = this.databaseService.db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
    if (!projectRow) {
      throw new NotFoundException("Project not found");
    }
  }

  private assertOwnerCanAccessProject(authContext: AuthContext, projectId: number): void {
    if (
      !hasSystemAdminRole(authContext) &&
      !hasProjectAccess(this.databaseService.db, projectId, authContext.userId)
    ) {
      throw new ForbiddenException("Owner does not have access to project");
    }
  }

  private parseOptionalExpiration(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new ConflictException("Invalid expiration timestamp");
    }
    if (parsed <= new Date()) {
      throw new ConflictException("Token expiration must be in the future");
    }

    return parsed;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private generateToken(): string {
    return randomBytes(32).toString("base64url");
  }
}

interface ScopedTokenResponse {
  createdAt: string;
  expiresAt: string | null;
  id: number;
  lastUsedAt: string | null;
  revokedAt: string | null;
  scopes: Array<{
    objectId: number;
    objectTypeCode: string;
  }>;
  updatedAt: string;
}
