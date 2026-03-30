const DEFAULT_API_BASE_URL = "";
const DEFAULT_ROUTE_PREFIX = "/stc-proj-mgmt/api";
const DEFAULT_AUTH_TOKEN_STORAGE_KEY = "giganttic.auth.bearerToken";
const DEFAULT_APP_BASE_PATH = "/";
const DEFAULT_DEBUG_INGEST_ENABLED = false;

export interface FrontendConfig {
  apiBaseUrl: string;
  appBasePath: string;
  authTokenStorageKey: string;
  debugIngestEnabled: boolean;
  debugIngestUrl: string | null;
  routePrefix: string;
}

export function normalizeApiBaseUrl(value: string | undefined): string {
  const normalizedValue = value?.trim() ?? "";

  if (normalizedValue.length === 0) {
    return DEFAULT_API_BASE_URL;
  }

  return normalizedValue.endsWith("/")
    ? normalizedValue.slice(0, -1)
    : normalizedValue;
}

export function normalizeAppBasePath(value: string | undefined): string {
  const normalizedValue = value?.trim() ?? "";

  if (normalizedValue.length === 0 || normalizedValue === "/") {
    return DEFAULT_APP_BASE_PATH;
  }

  const withoutTrailingSlash = normalizedValue.endsWith("/")
    ? normalizedValue.slice(0, -1)
    : normalizedValue;

  if (!withoutTrailingSlash.startsWith("/")) {
    return `/${withoutTrailingSlash}`;
  }

  return withoutTrailingSlash;
}

export function normalizeBooleanFlag(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  const normalizedValue = value?.trim().toLowerCase();
  if (!normalizedValue) {
    return defaultValue;
  }

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  return defaultValue;
}

export function normalizeOptionalUrl(value: string | undefined): string | null {
  const normalizedValue = value?.trim() ?? "";
  if (!normalizedValue) {
    return null;
  }

  return normalizedValue;
}

export const frontendConfig: FrontendConfig = {
  apiBaseUrl: normalizeApiBaseUrl(import.meta.env.VITE_BACKEND_BASE_URL),
  appBasePath: normalizeAppBasePath(import.meta.env.VITE_APP_BASE_PATH),
  authTokenStorageKey:
    import.meta.env.VITE_AUTH_TOKEN_STORAGE_KEY?.trim()
    || DEFAULT_AUTH_TOKEN_STORAGE_KEY,
  debugIngestEnabled: normalizeBooleanFlag(
    import.meta.env.VITE_DEBUG_INGEST_ENABLED,
    DEFAULT_DEBUG_INGEST_ENABLED,
  ),
  debugIngestUrl: normalizeOptionalUrl(import.meta.env.VITE_DEBUG_INGEST_URL),
  routePrefix: import.meta.env.VITE_ROUTE_PREFIX?.trim() || DEFAULT_ROUTE_PREFIX,
};
