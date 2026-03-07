import React from "react";
import {
  AppBar,
  Box,
  Container,
  Toolbar,
  Typography,
} from "@mui/material";

import { SessionManager } from "./SessionManager.js";

const PRODUCT_NAME = "Gigantt";
const PRODUCT_TAGLINE = "Structured project control";

export function HeaderNavbar() {
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
        <Toolbar disableGutters sx={{ gap: 3, minHeight: 80 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography color="primary.main" variant="h6">
              {PRODUCT_NAME}
            </Typography>
            <Typography color="rgba(255, 255, 255, 0.72)" variant="body2">
              {PRODUCT_TAGLINE}
            </Typography>
          </Box>
          <SessionManager />
        </Toolbar>
      </Container>
    </AppBar>
  );
}
