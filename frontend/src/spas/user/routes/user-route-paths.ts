export const USER_LOBBY_PATH = "/user/lobby";

export const USER_TOP_TAB_VALUES = [
  "lobby",
  "details",
  "associations",
  "credentials",
  "sessions",
  "settings",
] as const;
export type UserTopTab = typeof USER_TOP_TAB_VALUES[number];

export const USER_CREDENTIALS_TAB_VALUES = ["password", "scoped-access-tokens", "passkeys"] as const;
export type UserCredentialsTab = typeof USER_CREDENTIALS_TAB_VALUES[number];

export function isUserLobbyPath(pathname: string): boolean {
  return pathname === USER_LOBBY_PATH || pathname.endsWith(USER_LOBBY_PATH);
}

export function createUserRoute(
  userId: number,
  topTab: UserTopTab = "details",
  credentialsTab: UserCredentialsTab = "password",
): string {
  if (topTab === "lobby") {
    return USER_LOBBY_PATH;
  }
  const params = new URLSearchParams({
    credentialsTab,
    tab: topTab,
    userId: String(userId),
  });
  return `/user?${params.toString()}`;
}
