import React from "react";
import { Box } from "@mui/material";

import { HeaderNavbar } from "./auth/components/HeaderNavbar.js";
import "./styles/app.css";

export function App() {
  return (
    <Box className="app-shell">
      <HeaderNavbar />
    </Box>
  );
}
