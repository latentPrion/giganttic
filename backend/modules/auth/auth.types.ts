export interface StandardSessionAuth {
  kind: "standard";
}

export interface ScopedAccessTokenSessionAuth {
  kind: "scoped_access_token";
  scopedAccessTokenCredentialId: number;
}

export interface AuthContext {
  roleCodes: string[];
  sessionId: string;
  sessionAuth: StandardSessionAuth | ScopedAccessTokenSessionAuth;
  userId: number;
}

export interface AuthenticatedRequest {
  authContext?: AuthContext;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  method?: string;
  originalUrl?: string;
  socket?: {
    remoteAddress?: string | undefined;
  };
  url?: string;
}
