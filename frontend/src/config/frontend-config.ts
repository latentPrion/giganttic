const DEFAULT_API_BASE_URL = "";
const DEFAULT_ROUTE_PREFIX = "/stc-proj-mgmt/api";
const DEFAULT_AUTH_TOKEN_STORAGE_KEY = "giganttic.auth.bearerToken";

interface FrontendConfig {
  apiBaseUrl: string;
  authTokenStorageKey: string;
  routePrefix: string;
}

function normalizeApiBaseUrl(value: string | undefined): string {
  const normalizedValue = value?.trim() ?? "";

  if (normalizedValue.length === 0) {
    return DEFAULT_API_BASE_URL;
  }

  return normalizedValue.endsWith("/")
    ? normalizedValue.slice(0, -1)
    : normalizedValue;
}

export const frontendConfig: FrontendConfig = {
  apiBaseUrl: normalizeApiBaseUrl(import.meta.env.VITE_BACKEND_BASE_URL),
  authTokenStorageKey:
    import.meta.env.VITE_AUTH_TOKEN_STORAGE_KEY?.trim()
    || DEFAULT_AUTH_TOKEN_STORAGE_KEY,
  routePrefix: import.meta.env.VITE_ROUTE_PREFIX?.trim() || DEFAULT_ROUTE_PREFIX,
};
