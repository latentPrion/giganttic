/** Deployment-relative URL helpers. Canonical routing notes: `common/routes/app-route-paths.ts`. */

import { SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH } from "../../../../common/routes/app-route-paths.js";
import { frontendConfig } from "../../config/frontend-config.js";

function normalizeRoutePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function buildAppRelativeUrl(
  path: string,
  appBasePath: string = frontendConfig.appBasePath,
): string {
  const normalizedPath = normalizeRoutePath(path);
  const trimmedBase = trimTrailingSlash(appBasePath);
  if (appBasePath !== "/" && (normalizedPath === trimmedBase || normalizedPath.startsWith(`${trimmedBase}/`))) {
    throw new Error(
      `buildAppRelativeUrl: path "${path}" already contains appBasePath "${appBasePath}". ` +
      `Pass a path relative to appBasePath to avoid double-prefixing (e.g. "/some-page", not "${appBasePath}/some-page").`,
    );
  }

  if (appBasePath === "/") {
    return normalizedPath;
  }

  return `${trimmedBase}${normalizedPath}`;
}

export function buildAppAbsoluteUrl(
  path: string,
  origin: string,
  appBasePath: string = frontendConfig.appBasePath,
): string {
  return `${trimTrailingSlash(origin)}${buildAppRelativeUrl(path, appBasePath)}`;
}

export function createScopedAccessLoginRelativeUrl(
  tokenValue: string,
): string {
  return `${SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH}?token=${encodeURIComponent(tokenValue)}`;
}

export function createScopedAccessLoginAbsoluteUrl(
  tokenValue: string,
  origin: string,
): string {
  return `${trimTrailingSlash(origin)}${SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH}?token=${encodeURIComponent(tokenValue)}`;
}
