import React from "react";
import { Tab, Tabs } from "@mui/material";

import type { UserTopTab } from "../routes/user-route-paths.js";

interface UserTopNavigationProps {
  isSelfView: boolean;
  onChange(nextTab: UserTopTab): void;
  value: UserTopTab;
}

export function UserTopNavigation(props: UserTopNavigationProps) {
  return (
    <Tabs
      onChange={(_event, nextTab: UserTopTab) => props.onChange(nextTab)}
      value={props.value}
      variant="scrollable"
    >
      <Tab label="Details" value="details" />
      <Tab label="Associations" value="associations" />
      {props.isSelfView ? <Tab label="Credentials" value="credentials" /> : null}
      {props.isSelfView ? <Tab label="Sessions" value="sessions" /> : null}
      {props.isSelfView ? <Tab label="Settings" value="settings" /> : null}
    </Tabs>
  );
}
