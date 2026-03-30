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
  if (appBasePath === "/") {
    return normalizedPath;
  }

  return `${trimTrailingSlash(appBasePath)}${normalizedPath}`;
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
  appBasePath: string = frontendConfig.appBasePath,
): string {
  return `${buildAppRelativeUrl(SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH, appBasePath)}?token=${encodeURIComponent(tokenValue)}`;
}

export function createScopedAccessLoginAbsoluteUrl(
  tokenValue: string,
  origin: string,
  appBasePath: string = frontendConfig.appBasePath,
): string {
  return buildAppAbsoluteUrl(
    `${SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH}?token=${encodeURIComponent(tokenValue)}`,
    origin,
    appBasePath,
  );
}
