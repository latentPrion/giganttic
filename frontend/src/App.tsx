import React from "react";
import { Box } from "@mui/material";

import { AuthSessionProvider } from "./auth/context/AuthSessionContext.js";
import { HeaderNavbar } from "./auth/components/HeaderNavbar.js";
import { SessionManager } from "./auth/components/SessionManager.js";
import { HomeHero } from "./home/components/HomeHero.js";
import "./styles/app.css";

export function App() {
  return (
    <AuthSessionProvider>
      <Box className="app-shell">
        <HeaderNavbar />
        <SessionManager />
        <HomeHero />
      </Box>
    </AuthSessionProvider>
  );
}
