import React from "react";
import { Box, CircularProgress, Stack } from "@mui/material";

import { useSessionManager } from "../hooks/useSessionManager.js";
import { AuthStatusDialog } from "./AuthStatusDialog.js";
import { LoggedInSessionManager } from "./LoggedInSessionManager.js";
import { LoggedOutSessionManager } from "./LoggedOutSessionManager.js";

const SESSION_FAILURE_TITLE = "Session Error";

export function SessionManager() {
  const { actions, authState, isBusy } = useSessionManager();

  return (
    <Stack alignItems="flex-end" spacing={1.5}>
      {authState.status === "loading" ? (
        <Box
          aria-label="Loading session"
          sx={{ display: "flex", minHeight: 40, minWidth: 120, placeItems: "center" }}
        >
          <CircularProgress size={24} />
        </Box>
      ) : null}

      {authState.status === "authenticated" ? (
        <LoggedInSessionManager
          isBusy={isBusy}
          onLogout={actions.logout}
          roles={authState.auth.user.roles}
          username={authState.auth.user.username}
        />
      ) : null}

      {authState.status !== "authenticated" && authState.status !== "loading" ? (
        <LoggedOutSessionManager
          isBusy={isBusy}
          onLogin={actions.login}
          onRegister={actions.register}
        />
      ) : null}
      <AuthStatusDialog
        isOpen={authState.status === "error"}
        message={authState.status === "error" ? authState.message : ""}
        onClose={actions.dismissFailure}
        title={SESSION_FAILURE_TITLE}
      />
    </Stack>
  );
}
