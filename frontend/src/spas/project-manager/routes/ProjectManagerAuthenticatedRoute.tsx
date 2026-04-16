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
  children(token: string, currentUserId: number, currentUserRoles: string[]): React.ReactNode;
}

const LOADING_MESSAGE = "Loading the project manager workspace...";
const LOADING_SIZE = 28;

/** Shown when the PM route matches but the user is not signed in — keep the URL; do not send users to `/`. */
export const PROJECT_MANAGER_UNAUTHENTICATED_PROMPT_TEXT =
  "Sign in to use the project manager.";

export const PROJECT_MANAGER_SIGN_IN_PROMPT_TEST_ID = "project-manager-sign-in-prompt";

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
    return (
      <AppShell>
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={2}
          sx={{ flex: 1, px: 2, py: 4 }}
        >
          <Typography
            component="p"
            data-testid={PROJECT_MANAGER_SIGN_IN_PROMPT_TEST_ID}
            variant="h6"
          >
            {PROJECT_MANAGER_UNAUTHENTICATED_PROMPT_TEXT}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Use Login or Register in the header.
          </Typography>
        </Stack>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {props.children(
        authState.auth.token,
        authState.auth.user.id,
        authState.auth.user.roles,
      )}
    </AppShell>
  );
}
