import React from "react";
import { Chip } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

interface LoggedInUsernameProps {
  username: string;
}

export function LoggedInUsername({ username }: LoggedInUsernameProps) {
  return (
    <Chip
      aria-label="Go to your lobby"
      clickable
      color="secondary"
      component={RouterLink}
      label={username}
      to="/lobby"
      variant="outlined"
    />
  );
}
