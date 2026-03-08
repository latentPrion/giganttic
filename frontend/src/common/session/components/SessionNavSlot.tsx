import React from "react";
import { CircularProgress } from "@mui/material";

import { useSessionManager } from "../hooks/useSessionManager.js";
import { LoggedInSessionManager } from "./LoggedInSessionManager.js";
import { LoggedOutSessionManager } from "./LoggedOutSessionManager.js";

const LOADING_SIZE = 20;

export function SessionNavSlot() {
  const { actions, authState, isBusy } = useSessionManager();

  if (authState.status === "loading") {
    return <CircularProgress size={LOADING_SIZE} />;
  }

  if (authState.status === "authenticated") {
    return (
      <LoggedInSessionManager
        isBusy={isBusy}
        onLogout={actions.logout}
        roles={authState.auth.user.roles}
        username={authState.auth.user.username}
      />
    );
  }

  return (
    <LoggedOutSessionManager
      isBusy={isBusy}
      onLogin={actions.login}
      onRegister={actions.register}
    />
  );
}
