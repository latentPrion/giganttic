import React from "react";
import {
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { Navigate } from "react-router-dom";

import { AppShell } from "../../../app/shell/AppShell.js";
import { useSessionManager } from "../../../auth/hooks/useSessionManager.js";
import { UserLobbyPage } from "../../../lobby/components/UserLobbyPage.js";

const LOBBY_LOADING_MESSAGE = "Loading your lobby...";
const LOBBY_LOADING_SIZE = 28;

function LobbyLoadingState() {
  return (
    <Stack
      alignItems="center"
      className="lobby-page lobby-page__content"
      justifyContent="center"
      spacing={1.5}
    >
      <CircularProgress size={LOBBY_LOADING_SIZE} />
      <Typography>{LOBBY_LOADING_MESSAGE}</Typography>
    </Stack>
  );
}

export function LobbyRoute() {
  const { authState } = useSessionManager();

  if (authState.status === "loading") {
    return (
      <AppShell>
        <LobbyLoadingState />
      </AppShell>
    );
  }

  if (authState.status !== "authenticated") {
    return <Navigate replace to="/" />;
  }

  return (
    <AppShell>
      <UserLobbyPage
        currentUserId={authState.auth.user.id}
        token={authState.auth.token}
      />
    </AppShell>
  );
}
