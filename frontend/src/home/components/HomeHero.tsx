import React from "react";
import {
  Box,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { useSessionManager } from "../../common/session/hooks/useSessionManager.js";
import { LoggedOutSessionManager } from "../../common/session/components/LoggedOutSessionManager.js";

const GITHUB_HREF = "https://github.com/latentprion";
const GITHUB_LABEL = "Github";
const HERO_MESSAGE = "Giganttic, built by LatentPrion";
const LINKEDIN_HREF = "https://www.linkedin.com/in/kofi-doku-atuah-0142054a/";
const LINKEDIN_LABEL = "LinkedIn";

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
            {HERO_MESSAGE}
          </Typography>
          <Stack
            direction={{ sm: "row", xs: "column" }}
            justifyContent="center"
            spacing={2}
            sx={(theme) => ({
              alignItems: "center",
              backgroundColor: theme.palette.action.hover,
              border: 1,
              borderColor: theme.palette.divider,
              borderRadius: 999,
              padding: "0.5rem 1.25rem",
              width: "100%",
            })}
          >
            <Link href={GITHUB_HREF} rel="noreferrer" target="_blank" underline="hover">
              {GITHUB_LABEL}
            </Link>
            <Divider
              flexItem
              orientation="vertical"
              sx={{ display: { xs: "none", sm: "block" } }}
            />
            <Divider
              flexItem
              sx={{ display: { xs: "block", sm: "none" } }}
            />
            <Link href={LINKEDIN_HREF} rel="noreferrer" target="_blank" underline="hover">
              {LINKEDIN_LABEL}
            </Link>
          </Stack>
        {shouldShowAuthCta ? (
          <LoggedOutSessionManager
            buttonSize="large"
            isBusy={isBusy}
            onLogin={actions.login}
            onRegister={actions.register}
          />
        ) : null}
        </Stack>
      </Paper>
    </Box>
  );
}
