import React from "react";
import {
  AppBar,
  Box,
  Container,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";

import { HomeLink } from "./HomeLink.js";

const PRODUCT_NAME = "Giganttic";
const PRODUCT_TAGLINE = "Structured project control";

interface HeaderNavbarProps {
  navigation?: React.ReactNode;
  sessionSlot?: React.ReactNode;
}

export function HeaderNavbar({ navigation, sessionSlot }: HeaderNavbarProps) {
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
            <HomeLink>
              <Typography color="primary.main" variant="h6">
                {PRODUCT_NAME}
              </Typography>
              <Typography color="rgba(255, 255, 255, 0.72)" variant="body2">
                {PRODUCT_TAGLINE}
              </Typography>
            </HomeLink>
            {navigation ? (
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  flexWrap: "wrap",
                  marginTop: 1,
                }}
              >
                {navigation}
              </Stack>
            ) : null}
          </Box>
          {sessionSlot}
        </Toolbar>
      </Container>
    </AppBar>
  );
}
