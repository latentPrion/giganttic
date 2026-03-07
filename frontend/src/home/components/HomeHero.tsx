import React from "react";
import {
  Box,
  Link,
  Stack,
  Typography,
} from "@mui/material";

import { useSessionManager } from "../../auth/hooks/useSessionManager.js";
import { LoggedOutSessionManager } from "../../auth/components/LoggedOutSessionManager.js";

const GITHUB_HREF = "https://github.com/latentprion";
const GITHUB_LABEL = "github.com/latentprion";
const HERO_MESSAGE = "GiGantt, built by LatentPrion";
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
      <Stack className="home-hero__content" spacing={3}>
        <Typography className="home-hero__title" component="h1" variant="h1">
          {HERO_MESSAGE}
        </Typography>
        <Stack
          className="home-hero__links"
          direction={{ sm: "row", xs: "column" }}
          spacing={2}
        >
          <Link href={GITHUB_HREF} rel="noreferrer" target="_blank" underline="hover">
            {GITHUB_LABEL}
          </Link>
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
    </Box>
  );
}
