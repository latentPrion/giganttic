import React from "react";
import {
  Box,
  CircularProgress,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import {
  Link as RouterLink,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";

import { AuthSessionProvider } from "./auth/context/AuthSessionContext.js";
import { HeaderNavbar } from "./auth/components/HeaderNavbar.js";
import { SessionManager } from "./auth/components/SessionManager.js";
import { useSessionManager } from "./auth/hooks/useSessionManager.js";
import { AboutPage } from "./home/components/AboutPage.js";
import { ContactPage } from "./home/components/ContactPage.js";
import { HomeHero } from "./home/components/HomeHero.js";
import { UserLobbyPage } from "./lobby/components/UserLobbyPage.js";
import "./styles/app.css";

function HomeNavigation() {
  return (
    <>
      <Link
        color="rgba(255, 255, 255, 0.82)"
        component={RouterLink}
        to="/about"
        underline="hover"
      >
        About
      </Link>
      <Link
        color="rgba(255, 255, 255, 0.82)"
        component={RouterLink}
        to="/contact"
        underline="hover"
      >
        Contact
      </Link>
    </>
  );
}

function HomeLayout() {
  return (
    <Box className="app-shell">
      <HeaderNavbar navigation={<HomeNavigation />} />
      <SessionManager />
      <Outlet />
    </Box>
  );
}

function LobbyRoute() {
  const { authState } = useSessionManager();

  if (authState.status === "loading") {
    return (
      <Box className="app-shell">
        <HeaderNavbar />
        <SessionManager />
        <Box className="lobby-page">
          <Stack
            alignItems="center"
            className="lobby-page__content"
            justifyContent="center"
            spacing={1.5}
          >
            <CircularProgress size={28} />
            <Typography>Loading your lobby...</Typography>
          </Stack>
        </Box>
      </Box>
    );
  }

  if (authState.status !== "authenticated") {
    return <Navigate replace to="/" />;
  }

  return (
    <Box className="app-shell">
      <HeaderNavbar />
      <SessionManager />
      <UserLobbyPage
        currentUserId={authState.auth.user.id}
        token={authState.auth.token}
      />
    </Box>
  );
}

export function App() {
  return (
    <AuthSessionProvider>
      <Routes>
        <Route element={<HomeLayout />}>
          <Route element={<HomeHero />} index />
          <Route element={<ContactPage />} path="/contact" />
          <Route element={<AboutPage />} path="/about" />
        </Route>
        <Route element={<LobbyRoute />} path="/lobby" />
      </Routes>
    </AuthSessionProvider>
  );
}
