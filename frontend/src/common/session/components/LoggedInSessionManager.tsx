import React from "react";
import { Stack } from "@mui/material";

import { NotificationBell } from "../../notifications/components/NotificationBell.js";
import { LoggedInUsername } from "./LoggedInUsername.js";
import { LoggedInUserMenu } from "./LoggedInUserMenu.js";

interface LoggedInSessionManagerProps {
  isBusy: boolean;
  isScopedAccessSession?: boolean;
  onLogout(): Promise<void>;
  roles: string[];
  token: string;
  username: string;
}

export function LoggedInSessionManager(
  props: LoggedInSessionManagerProps,
) {
  return (
    <Stack alignItems="center" direction="row" spacing={1.5}>
      {!props.isScopedAccessSession ? <NotificationBell token={props.token} /> : null}
      <LoggedInUsername
        isScopedAccessSession={props.isScopedAccessSession}
        username={props.username}
      />
      <LoggedInUserMenu
        isBusy={props.isBusy}
        onLogout={props.onLogout}
        roles={props.roles}
      />
    </Stack>
  );
}
