export interface AuthContext {
  roleCodes: string[];
  sessionId: string;
  userId: number;
}

export interface AuthenticatedRequest {
  authContext?: AuthContext;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string | undefined;
  };
}
