import React from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { useSessionManager } from "../../common/session/hooks/useSessionManager.js";
import { LoggedOutSessionManager } from "../../common/session/components/LoggedOutSessionManager.js";

const FEATURE_SECTION_LABEL = "What Giganttic Can Do";
const HERO_HEADLINE = "Run projects with clarity.";
const HERO_SUPPORTING_COPY =
  "Giganttic brings scheduling, issue tracking, task discussion, and access-controlled collaboration into one structured workspace, including client-facing project insight access for viewing gantt charts and participating through issues, comments, and attachments.";

const HOME_FEATURES = [
  {
    description: "Plan timelines with gantt charts, milestones, and live task updates.",
    title: "Schedule work",
  },
  {
    description: "Give clients project insight access so they can follow the gantt chart, raise issues, and collaborate through comments and attachments.",
    title: "Share with clients",
  },
  {
    description: "Track blockers, progress, comments, and attachments without losing context.",
    title: "Manage delivery",
  },
  {
    description: "Coordinate projects, teams, and organizations with explicit scoped permissions.",
    title: "Control access",
  },
  {
    description: "Keep journals and discussions close to the project, issue, or task they belong to.",
    title: "Capture decisions",
  },
] as const;

function HomeFeatureHighlights() {
  return (
    <Paper
      sx={(theme) => ({
        backgroundColor: theme.palette.background.default,
        border: 1,
        borderColor: theme.palette.divider,
        borderRadius: 3,
        padding: { xs: 1.25, sm: 1.5 },
        width: "100%",
      })}
      variant="outlined"
    >
      <Stack spacing={1.25}>
        <Typography color="text.secondary" variant="overline">
          {FEATURE_SECTION_LABEL}
        </Typography>
        <Stack spacing={1}>
          {HOME_FEATURES.map((feature) => (
            <Paper
              key={feature.title}
              sx={{ borderRadius: 2, padding: 1.25 }}
              variant="outlined"
            >
              <Stack spacing={0.35}>
                <Typography variant="subtitle1">{feature.title}</Typography>
                <Typography color="text.secondary" variant="body2">
                  {feature.description}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

export function HomeHero() {
  const { actions, authState, isBusy } = useSessionManager();
  const shouldShowAuthCta =
    authState.status === "anonymous"
    || authState.status === "error"
    || authState.status === "loading";

  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flex: 1,
        justifyContent: "center",
        minHeight: 0,
        padding: { xs: 1.5, sm: 2 },
        width: "100%",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxWidth: 832,
          padding: { xs: 1.75, sm: 2.5 },
          width: "100%",
        }}
      >
        <Stack
          alignItems="center"
          spacing={3}
          sx={{ maxWidth: 832, textAlign: "center", width: "100%" }}
        >
          <Typography
            component="h1"
            variant="h1"
            sx={{
              fontSize: { xs: "clamp(2.35rem, 12vw, 3.8rem)", sm: "clamp(2.8rem, 7vw, 5.8rem)" },
              fontWeight: 900,
              letterSpacing: "0.04em",
              lineHeight: 1.02,
              overflowWrap: "anywhere",
            }}
          >
            {HERO_HEADLINE}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ maxWidth: 680 }}
            variant="h6"
          >
            {HERO_SUPPORTING_COPY}
          </Typography>
          <HomeFeatureHighlights />
        {shouldShowAuthCta ? (
          <LoggedOutSessionManager
            buttonSize="large"
            isBusy={isBusy}
            onLogin={actions.login}
            onLoginWithScopedAccessToken={actions.loginWithScopedAccessToken}
            onRegister={actions.register}
          />
        ) : null}
        </Stack>
      </Paper>
    </Box>
  );
}
