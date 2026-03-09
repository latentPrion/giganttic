import React from "react";
import {
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import {
  Navigate,
  useSearchParams,
} from "react-router-dom";

import { AppShell } from "../../../app/shell/AppShell.js";
import { useSessionManager } from "../../../common/session/hooks/useSessionManager.js";
import { parseProjectIdFromSearchParameters } from "../contracts/gantt-route.contracts.js";
import { ProjectManagerGanttPage } from "../pages/ProjectManagerGanttPage.js";

const GANTT_LOADING_MESSAGE = "Loading the project manager workspace...";
const GANTT_LOADING_SIZE = 28;

function GanttLoadingState() {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      sx={{ flex: 1 }}
    >
      <CircularProgress size={GANTT_LOADING_SIZE} />
      <Typography>{GANTT_LOADING_MESSAGE}</Typography>
    </Stack>
  );
}

export function GanttRoute() {
  const { authState } = useSessionManager();
  const [searchParameters] = useSearchParams();

  if (authState.status === "loading") {
    return (
      <AppShell>
        <GanttLoadingState />
      </AppShell>
    );
  }

  if (authState.status !== "authenticated") {
    return <Navigate replace to="/" />;
  }

  return (
    <AppShell>
      <ProjectManagerGanttPage
        projectId={parseProjectIdFromSearchParameters(searchParameters)}
      />
    </AppShell>
  );
}
