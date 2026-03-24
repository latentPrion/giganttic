import React from "react";
import {
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { Navigate } from "react-router-dom";

import { AppShell } from "../../../app/shell/AppShell.js";
import { useSessionManager } from "../../../common/session/hooks/useSessionManager.js";

interface UserAuthenticatedRouteProps {
  children(
    token: string,
    currentUserId: number,
    currentUserRoles: string[],
    isScopedAccessSession: boolean,
  ): React.ReactNode;
}

export function UserAuthenticatedRoute(props: UserAuthenticatedRouteProps) {
  const { authState } = useSessionManager();

  if (authState.status === "loading") {
    return (
      <AppShell>
        <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ flex: 1 }}>
          <CircularProgress size={24} />
          <Typography>Loading user workspace...</Typography>
        </Stack>
      </AppShell>
    );
  }

  if (authState.status !== "authenticated") {
    return <Navigate replace to="/" />;
  }

  return (
    <AppShell>
      {props.children(
        authState.auth.token,
        authState.auth.user.id,
        authState.auth.user.roles,
        authState.auth.session.isScopedAccessSession,
      )}
    </AppShell>
  );
}
