import React from "react";
import {
  AppBar,
  Box,
  CircularProgress,
  Container,
  Toolbar,
  Typography,
} from "@mui/material";

import { useSessionManager } from "../hooks/useSessionManager.js";
import { LoggedInSessionManager } from "./LoggedInSessionManager.js";
import { LoggedOutSessionManager } from "./LoggedOutSessionManager.js";

const PRODUCT_NAME = "Gigantt";
const PRODUCT_TAGLINE = "Structured project control";
const LOADING_SIZE = 20;

export function HeaderNavbar() {
  const { actions, authState, isBusy } = useSessionManager();

  return (
    <AppBar
      color="transparent"
      elevation={0}
      position="static"
      sx={{
        borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
        backdropFilter: "blur(18px)",
        backgroundColor: "rgba(15, 18, 25, 0.72)",
      }}
    >
      <Container maxWidth="lg">
        <Toolbar
          disableGutters
          sx={{
            alignItems: { sm: "center", xs: "flex-start" },
            flexWrap: "wrap",
            gap: 2,
            minHeight: { sm: 80, xs: "auto" },
            paddingY: { sm: 0, xs: 1.5 },
          }}
        >
          <Box sx={{ flexGrow: 1, minWidth: 0, width: { xs: "100%", sm: "auto" } }}>
            <Typography color="primary.main" variant="h6">
              {PRODUCT_NAME}
            </Typography>
            <Typography color="rgba(255, 255, 255, 0.72)" variant="body2">
              {PRODUCT_TAGLINE}
            </Typography>
          </Box>
          {authState.status === "loading" ? (
            <CircularProgress size={LOADING_SIZE} />
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
        </Toolbar>
      </Container>
    </AppBar>
  );
}
