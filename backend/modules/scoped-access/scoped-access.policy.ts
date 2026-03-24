import { ForbiddenException } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import {
  scopedAccessObjectTypeCodes,
  scopedAccessTokenCredentialsObjects,
} from "../../../db/index.js";
import type {
  AuthContext,
  ScopedAccessTokenSessionAuth,
} from "../auth/auth.types.js";
import type { DatabaseService } from "../database/database.service.js";

type AppDatabase = DatabaseService["db"];

export interface RouteAllowRule {
  method: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  pattern: string;
}

export function isScopedAccessSession(
  authContext: AuthContext,
): authContext is AuthContext & { sessionAuth: ScopedAccessTokenSessionAuth } {
  return authContext.sessionAuth.kind === "scoped_access_token";
}

export function assertStandardSession(authContext: AuthContext): void {
  if (isScopedAccessSession(authContext)) {
    throw new ForbiddenException("Scoped access sessions are not permitted for this route");
  }
}

export function normalizeApiPath(pathname: string, routePrefix: string): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalizedPrefix = routePrefix.startsWith("/")
    ? routePrefix
    : `/${routePrefix}`;

  if (normalizedPath === normalizedPrefix) {
    return "/";
  }

  if (normalizedPath.startsWith(`${normalizedPrefix}/`)) {
    return normalizedPath.slice(normalizedPrefix.length);
  }

  return normalizedPath;
}

export function isRouteAllowedForScopedSession(
  method: string,
  routePathWithoutPrefix: string,
  allowlist: ReadonlyArray<RouteAllowRule>,
): boolean {
  const normalizedMethod = method.toUpperCase();
  const normalizedRoutePath = routePathWithoutPrefix.startsWith("/")
    ? routePathWithoutPrefix
    : `/${routePathWithoutPrefix}`;

  return allowlist.some((rule) =>
    rule.method === normalizedMethod &&
    doesPathMatchPattern(normalizedRoutePath, rule.pattern)
  );
}

export function assertRouteAllowedForScopedSession(
  method: string,
  routePathWithoutPrefix: string,
  allowlist: ReadonlyArray<RouteAllowRule>,
): void {
  if (!isRouteAllowedForScopedSession(method, routePathWithoutPrefix, allowlist)) {
    throw new ForbiddenException("Scoped access session is not allowed for this route");
  }
}

export function tokenGrantsProjectAccess(
  database: AppDatabase,
  scopedAccessTokenCredentialId: number,
  projectId: number,
): boolean {
  const row = database
    .select({ id: scopedAccessTokenCredentialsObjects.id })
    .from(scopedAccessTokenCredentialsObjects)
    .where(
      and(
        eq(
          scopedAccessTokenCredentialsObjects.scopedAccessTokenCredentialId,
          scopedAccessTokenCredentialId,
        ),
        eq(
          scopedAccessTokenCredentialsObjects.scopedAccessObjectTypeCode,
          scopedAccessObjectTypeCodes.project,
        ),
        eq(scopedAccessTokenCredentialsObjects.scopedAccessObjectId, projectId),
      ),
    )
    .get();

  return Boolean(row);
}

export function assertProjectAccessibleWithScopedPolicy(
  database: AppDatabase,
  authContext: AuthContext,
  projectId: number,
  assertUserHasProjectAccess: () => void,
): void {
  assertUserHasProjectAccess();
  if (!isScopedAccessSession(authContext)) {
    return;
  }

  if (!tokenGrantsProjectAccess(
    database,
    authContext.sessionAuth.scopedAccessTokenCredentialId,
    projectId,
  )) {
    throw new ForbiddenException("Scoped token is not authorized for this project");
  }
}

export function listScopedTokenProjectIds(
  database: AppDatabase,
  scopedAccessTokenCredentialId: number,
): number[] {
  return database
    .select({ projectId: scopedAccessTokenCredentialsObjects.scopedAccessObjectId })
    .from(scopedAccessTokenCredentialsObjects)
    .where(
      and(
        eq(
          scopedAccessTokenCredentialsObjects.scopedAccessTokenCredentialId,
          scopedAccessTokenCredentialId,
        ),
        eq(
          scopedAccessTokenCredentialsObjects.scopedAccessObjectTypeCode,
          scopedAccessObjectTypeCodes.project,
        ),
      ),
    )
    .all()
    .map((row) => row.projectId);
}

export function intersectProjectIds(
  left: ReadonlyArray<number>,
  right: ReadonlyArray<number>,
): number[] {
  if (left.length === 0 || right.length === 0) {
    return [];
  }

  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function doesPathMatchPattern(pathname: string, pattern: string): boolean {
  const pathSegments = splitRouteSegments(pathname);
  const patternSegments = splitRouteSegments(pattern);

  if (pathSegments.length !== patternSegments.length) {
    return false;
  }

  for (let index = 0; index < pathSegments.length; index += 1) {
    const pathSegment = pathSegments[index];
    const patternSegment = patternSegments[index];
    if (patternSegment.startsWith(":")) {
      if (pathSegment.length === 0) {
        return false;
      }
      continue;
    }
    if (pathSegment !== patternSegment) {
      return false;
    }
  }

  return true;
}

function splitRouteSegments(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment.length > 0);
}
