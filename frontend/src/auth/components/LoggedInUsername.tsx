import React from "react";
import { Chip } from "@mui/material";

interface LoggedInUsernameProps {
  username: string;
}

export function LoggedInUsername({ username }: LoggedInUsernameProps) {
  return <Chip color="secondary" label={username} variant="outlined" />;
}
