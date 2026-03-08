import React from "react";
import {
  Box,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { useSessionManager } from "../../auth/hooks/useSessionManager.js";
import { LoggedOutSessionManager } from "../../auth/components/LoggedOutSessionManager.js";

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
    <Box className="home-hero">
      <Paper className="home-hero__paper" elevation={0}>
        <Stack className="home-hero__content" spacing={3}>
          <Typography className="home-hero__title" component="h1" variant="h1">
            {HERO_MESSAGE}
          </Typography>
          <Box className="home-hero__links-wrap">
            <Stack
              className="home-hero__links"
              direction={{ sm: "row", xs: "column" }}
              justifyContent="center"
              spacing={2}
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
          </Box>
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
