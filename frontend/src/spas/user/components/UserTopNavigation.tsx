import React from "react";
import { Tab, Tabs } from "@mui/material";

import type { UserTopTab } from "../routes/user-route-paths.js";

interface UserTopNavigationProps {
  onChange(nextTab: UserTopTab): void;
  showLobbyTab: boolean;
  showSelfOnlyTabs: boolean;
  value: UserTopTab;
}

export function UserTopNavigation(props: UserTopNavigationProps) {
  return (
    <Tabs
      allowScrollButtonsMobile
      onChange={(_event, nextTab: UserTopTab) => props.onChange(nextTab)}
      scrollButtons="auto"
      value={props.value}
      variant="scrollable"
    >
      {props.showLobbyTab ? <Tab label="Lobby" value="lobby" /> : null}
      <Tab label="Details" value="details" />
      <Tab label="Associations" value="associations" />
      {props.showSelfOnlyTabs ? <Tab label="Credentials" value="credentials" /> : null}
      {props.showSelfOnlyTabs ? <Tab label="Sessions" value="sessions" /> : null}
      {props.showSelfOnlyTabs ? <Tab label="Settings" value="settings" /> : null}
    </Tabs>
  );
}
