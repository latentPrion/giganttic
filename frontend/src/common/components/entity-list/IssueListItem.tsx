import React from "react";
import {
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import type { Issue } from "../../../spas/project-manager/contracts/issue.contracts.js";
import { getIssuePriorityLabel } from "../../../spas/project-manager/lib/issue-priority.js";
import { EntityListItemCard } from "./EntityListItemCard.js";
import type { EntityListItemViewMode } from "./entity-list-item.types.js";

interface IssueListItemProps {
  actionContent?: React.ReactNode;
  issue: Issue;
  onNavigate?(): void;
  viewMode: EntityListItemViewMode;
}

function createStatusColor(status: Issue["status"]) {
  switch (status) {
    case "ISSUE_STATUS_CLOSED":
      return "success";
    case "ISSUE_STATUS_BLOCKED":
      return "warning";
    case "ISSUE_STATUS_IN_PROGRESS":
      return "info";
    default:
      return "primary";
  }
}

function createStatusLabel(status: Issue["status"]): string {
  return status.replace("ISSUE_STATUS_", "").toLowerCase().replace("_", " ");
}

export function IssueListItem(props: IssueListItemProps) {
  return (
    <EntityListItemCard
      actionContent={props.actionContent}
      description={props.issue.description}
      onNavigate={props.onNavigate}
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
          label={`Priority ${getIssuePriorityLabel(props.issue.priority)}`}
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
