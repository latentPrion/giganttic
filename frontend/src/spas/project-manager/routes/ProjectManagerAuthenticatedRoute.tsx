import React from "react";
import {
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { Navigate } from "react-router-dom";
import { AppShell } from "../../../app/shell/AppShell.js";
import { useSessionManager } from "../../../common/session/hooks/useSessionManager.js";

interface ProjectManagerAuthenticatedRouteProps {
  children(token: string, currentUserId: number): React.ReactNode;
}

const LOADING_MESSAGE = "Loading the project manager workspace...";
const LOADING_SIZE = 28;

function ProjectManagerLoadingState() {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      sx={{ flex: 1 }}
    >
      <CircularProgress size={LOADING_SIZE} />
      <Typography>{LOADING_MESSAGE}</Typography>
    </Stack>
  );
}

export function ProjectManagerAuthenticatedRoute(
  props: ProjectManagerAuthenticatedRouteProps,
) {
  const { authState } = useSessionManager();

  if (authState.status === "loading") {
    return (
      <AppShell>
        <ProjectManagerLoadingState />
      </AppShell>
    );
  }

  if (authState.status !== "authenticated") {
    return <Navigate replace to="/" />;
  }

  return (
    <AppShell>
      {props.children(authState.auth.token, authState.auth.user.id)}
    </AppShell>
  );
}
