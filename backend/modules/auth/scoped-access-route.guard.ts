import { Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";

import {
  BACKEND_CONFIG,
  type BackendConfig,
} from "../../config/backend-config.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import {
  assertRouteAllowedForScopedSession,
  isScopedAccessSession,
  normalizeApiPath,
} from "../scoped-access/scoped-access.policy.js";

@Injectable()
export class ScopedAccessRouteGuard implements CanActivate {
  constructor(
    @Inject(BACKEND_CONFIG)
    private readonly config: BackendConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authContext = request.authContext;

    if (!authContext || !isScopedAccessSession(authContext)) {
      return true;
    }

    const requestPath = extractPathWithoutQuery(
      request.originalUrl ?? request.url ?? "/",
    );
    const routePath = normalizeApiPath(requestPath, this.config.routePrefix);

    assertRouteAllowedForScopedSession(
      request.method ?? "GET",
      routePath,
      this.config.scopedSessionRouteAllowlist,
    );

    return true;
  }
}

function extractPathWithoutQuery(urlOrPath: string): string {
  const queryIndex = urlOrPath.indexOf("?");
  return queryIndex >= 0 ? urlOrPath.slice(0, queryIndex) : urlOrPath;
}
