import React from "react";
import { Box } from "@mui/material";

import { HeaderNavbar } from "../../auth/components/HeaderNavbar.js";
import { SessionManager } from "../../auth/components/SessionManager.js";

interface AppShellProps {
  children?: React.ReactNode;
  navigation?: React.ReactNode;
}

export function AppShell({ children, navigation }: AppShellProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        width: "100%",
      }}
    >
      <HeaderNavbar navigation={navigation} />
      <SessionManager />
      {children}
    </Box>
  );
}
