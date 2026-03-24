export const USER_TOP_TAB_VALUES = ["details", "associations", "settings", "credentials"] as const;
export type UserTopTab = typeof USER_TOP_TAB_VALUES[number];

export const USER_CREDENTIALS_TAB_VALUES = ["password", "scoped-access-tokens", "passkeys"] as const;
export type UserCredentialsTab = typeof USER_CREDENTIALS_TAB_VALUES[number];

export function createUserRoute(
  userId: number,
  topTab: UserTopTab = "details",
  credentialsTab: UserCredentialsTab = "password",
): string {
  const params = new URLSearchParams({
    credentialsTab,
    tab: topTab,
    userId: String(userId),
  });
  return `/user?${params.toString()}`;
}
