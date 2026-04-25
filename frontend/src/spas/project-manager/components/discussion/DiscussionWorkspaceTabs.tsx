import React from "react";
import {
  Tab,
  Tabs,
} from "@mui/material";

import type { DiscussionDetailTab } from "../../contracts/route-query.contracts.js";
import { DiscussionTabLabel } from "./DiscussionTabLabel.js";

interface DiscussionWorkspaceTabsProps {
  attachmentsCount?: number | null;
  ariaLabel: string;
  commentsCount?: number | null;
  onChange: (_event: React.SyntheticEvent, nextTab: DiscussionDetailTab) => void;
  value: DiscussionDetailTab;
}

export function DiscussionWorkspaceTabs(props: DiscussionWorkspaceTabsProps) {
  const {
    attachmentsCount = null,
    ariaLabel,
    commentsCount = null,
    onChange,
    value,
  } = props;

  return (
    <Tabs
      allowScrollButtonsMobile
      aria-label={ariaLabel}
      onChange={onChange}
      scrollButtons="auto"
      value={value}
      variant="scrollable"
    >
      <Tab label="Details" value="details" />
      <Tab
        label={(
          <DiscussionTabLabel
            count={commentsCount}
            countTestId="discussion-tab-count-comments"
            label="Comments"
          />
        )}
        value="comments"
      />
      <Tab
        label={(
          <DiscussionTabLabel
            count={attachmentsCount}
            countTestId="discussion-tab-count-attachments"
            label="Attachments"
          />
        )}
        value="attachments"
      />
    </Tabs>
  );
}
