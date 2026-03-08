import React from "react";
import { Box } from "@mui/material";

import { HeaderNavbar } from "../../common/components/HeaderNavbar.js";
import { SessionManager } from "../../common/session/components/SessionManager.js";
import { SessionNavSlot } from "../../common/session/components/SessionNavSlot.js";

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
      <HeaderNavbar navigation={navigation} sessionSlot={<SessionNavSlot />} />
      <SessionManager />
      {children}
    </Box>
  );
}
