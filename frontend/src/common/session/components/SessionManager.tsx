import React from "react";
import { Box, CircularProgress } from "@mui/material";

import { useSessionManager } from "../hooks/useSessionManager.js";
import { AuthStatusDialog } from "./AuthStatusDialog.js";

const SESSION_FAILURE_TITLE = "Session Error";

export function SessionManager() {
  const { actions, authState } = useSessionManager();

  return (
    <>
      {authState.status === "loading" ? (
        <Box
          aria-label="Loading session"
          sx={{ display: "none", minHeight: 40, minWidth: 120, placeItems: "center" }}
        >
          <CircularProgress size={24} />
        </Box>
      ) : null}
      <AuthStatusDialog
        isOpen={authState.status === "error"}
        message={authState.status === "error" ? authState.message : ""}
        onClose={actions.dismissFailure}
        title={SESSION_FAILURE_TITLE}
      />
    </>
  );
}
