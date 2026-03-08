import React from "react";
import { Stack } from "@mui/material";

import { LoggedInUsername } from "./LoggedInUsername.js";
import { LoggedInUserMenu } from "./LoggedInUserMenu.js";

interface LoggedInSessionManagerProps {
  isBusy: boolean;
  onLogout(): Promise<void>;
  roles: string[];
  username: string;
}

export function LoggedInSessionManager(
  props: LoggedInSessionManagerProps,
) {
  return (
    <Stack alignItems="center" direction="row" spacing={1.5}>
      <LoggedInUsername username={props.username} />
      <LoggedInUserMenu
        isBusy={props.isBusy}
        onLogout={props.onLogout}
        roles={props.roles}
      />
    </Stack>
  );
}
