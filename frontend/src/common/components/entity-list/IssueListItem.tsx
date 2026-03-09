import React from "react";
import {
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import type { Issue } from "../../../spas/project-manager/contracts/issue.contracts.js";
import { EntityListItemCard } from "./EntityListItemCard.js";
import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface IssueListItemProps {
  actionContent?: React.ReactNode;
  issue: Issue;
  onOpenSummary(): void;
  viewMode: EntityListItemViewMode;
}

function createStatusColor(status: Issue["status"]) {
  switch (status) {
    case "ISSUE_STATUS_CLOSED":
      return "success";
    case "ISSUE_STATUS_BLOCKED":
      return "warning";
    default:
      return "primary";
  }
}

function createStatusLabel(status: Issue["status"]): string {
  return status.replace("ISSUE_STATUS_", "").toLowerCase();
}

export function IssueListItem(props: IssueListItemProps) {
  return (
    <EntityListItemCard
      actionContent={props.actionContent}
      description={props.issue.description}
      onOpenSummary={props.onOpenSummary}
      title={props.issue.name}
      viewMode={props.viewMode}
    >
      <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
        <Chip
          color={createStatusColor(props.issue.status)}
          label={createStatusLabel(props.issue.status)}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`Progress ${props.issue.progressPercentage}%`}
          size="small"
          variant="outlined"
        />
        {props.issue.closedReason ? (
          <Chip
            label={props.issue.closedReason.replace("ISSUE_CLOSED_REASON_", "").toLowerCase()}
            size="small"
            variant="outlined"
          />
        ) : null}
      </Stack>
      <Typography color="text.secondary" variant="caption">
        Opened {new Date(props.issue.openedAt).toLocaleString()}
      </Typography>
    </EntityListItemCard>
  );
}
