import React from "react";
import { Tab, Tabs } from "@mui/material";

import type { UserCredentialsTab } from "../routes/user-route-paths.js";

interface UserCredentialsTabsProps {
  onChange(nextTab: UserCredentialsTab): void;
  value: UserCredentialsTab;
}

export function UserCredentialsTabs(props: UserCredentialsTabsProps) {
  return (
    <Tabs
      allowScrollButtonsMobile
      onChange={(_event, nextTab: UserCredentialsTab) => props.onChange(nextTab)}
      scrollButtons="auto"
      value={props.value}
      variant="scrollable"
    >
      <Tab label="Password" value="password" />
      <Tab label="Scoped Access Tokens" value="scoped-access-tokens" />
      <Tab label="Passkeys" value="passkeys" />
    </Tabs>
  );
}
