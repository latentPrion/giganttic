import React from "react";
import LockIcon from "@mui/icons-material/Lock";
import { Chip } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { USER_LOBBY_PATH } from "../../../spas/user/routes/user-route-paths.js";

interface LoggedInUsernameProps {
  isScopedAccessSession?: boolean;
  username: string;
}

const SCOPED_SESSION_CHIP_ARIA_LABEL = "Go to your lobby (scoped access session)";
const STANDARD_SESSION_CHIP_ARIA_LABEL = "Go to your lobby";

export function LoggedInUsername(props: LoggedInUsernameProps) {
  const { isScopedAccessSession = false, username } = props;
  return (
    <Chip
      aria-label={isScopedAccessSession
        ? SCOPED_SESSION_CHIP_ARIA_LABEL
        : STANDARD_SESSION_CHIP_ARIA_LABEL}
      clickable
      color="secondary"
      component={RouterLink}
      icon={isScopedAccessSession
        ? (
          <LockIcon
            aria-hidden
            sx={{ fontSize: "1rem !important" }}
          />
        )
        : undefined}
      label={username}
      to={USER_LOBBY_PATH}
      variant="outlined"
    />
  );
}
