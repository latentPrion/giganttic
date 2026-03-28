import React from "react";
import {
  Tab,
  Tabs,
} from "@mui/material";

import type { DiscussionDetailTab } from "../../contracts/route-query.contracts.js";

interface DiscussionWorkspaceTabsProps {
  ariaLabel: string;
  onChange: (_event: React.SyntheticEvent, nextTab: DiscussionDetailTab) => void;
  value: DiscussionDetailTab;
}

export function DiscussionWorkspaceTabs(props: DiscussionWorkspaceTabsProps) {
  const {
    ariaLabel,
    onChange,
    value,
  } = props;

  return (
    <Tabs
      aria-label={ariaLabel}
      onChange={onChange}
      value={value}
      variant="fullWidth"
    >
      <Tab label="Details" value="details" />
      <Tab label="Comments" value="comments" />
      <Tab label="Attachments" value="attachments" />
    </Tabs>
  );
}
