/** Deployment-relative URL helpers. Canonical routing notes: `common/routes/app-route-paths.ts`. */

import { SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH } from "../../../../common/routes/app-route-paths.js";
import { frontendConfig } from "../../config/frontend-config.js";

function normalizeRoutePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * Prefixes a route path with the reverse-proxy mount path. This deliberately does not
 * dedupe same-named app route segments, so `/pm` mounted PM routes become `/pm/pm/...`.
 */
export function buildAppRelativeUrl(
  path: string,
  proxyPassMountPath: string = frontendConfig.proxyPassMountPath,
): string {
  const normalizedPath = normalizeRoutePath(path);
  const trimmedBase = trimTrailingSlash(proxyPassMountPath);

  if (proxyPassMountPath === "/" || trimmedBase === "") {
    return normalizedPath;
  }

  return `${trimmedBase}${normalizedPath}`;
}

export function buildAppAbsoluteUrl(
  path: string,
  origin: string,
  proxyPassMountPath: string = frontendConfig.proxyPassMountPath,
): string {
  return `${trimTrailingSlash(origin)}${buildAppRelativeUrl(path, proxyPassMountPath)}`;
}

export function createScopedAccessLoginRelativeUrl(
  tokenValue: string,
): string {
  const relativePath = buildAppRelativeUrl(SCOPED_ACCESS_TOKEN_LOGIN_ROUTE_PATH);
  return `${relativePath}?token=${encodeURIComponent(tokenValue)}`;
}

export function createScopedAccessLoginAbsoluteUrl(
  tokenValue: string,
  origin: string,
): string {
  return `${trimTrailingSlash(origin)}${createScopedAccessLoginRelativeUrl(tokenValue)}`;
}
