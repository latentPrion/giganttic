import React from "react";
import { Chip, Stack, Typography } from "@mui/material";

import { EntityListItemCard } from "../../../../common/components/entity-list/EntityListItemCard.js";
import type { KanbanIssueCardData } from "./kanban.types.js";

const VIEW_MODE = "link-only-no-action-buttons";
const CARD_BORDER_WIDTH = 1;
const CARD_BORDER_RADIUS = 3;

function createIssueStatusLabel(status: KanbanIssueCardData["issue"]["status"]): string {
  return status.replace("ISSUE_STATUS_", "").toLowerCase().replace("_", " ");
}

function createIssueStatusColor(status: KanbanIssueCardData["issue"]["status"]) {
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

export function KanbanIssueCard(props: { card: KanbanIssueCardData }) {
  const { issue } = props.card;

  return (
    <EntityListItemCard
      description={issue.description}
      paperSx={{
        border: (theme) => `${CARD_BORDER_WIDTH}px solid ${theme.palette.divider}`,
        borderRadius: CARD_BORDER_RADIUS,
      }}
      title={issue.name}
      viewMode={VIEW_MODE}
    >
      <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
        <Chip
          color={createIssueStatusColor(issue.status)}
          label={createIssueStatusLabel(issue.status)}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`Priority ${issue.priority}`}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`Progress ${issue.progressPercentage}%`}
          size="small"
          variant="outlined"
        />
      </Stack>
      <Typography color="text.secondary" variant="caption">
        Opened {new Date(issue.openedAt).toLocaleString()}
      </Typography>
    </EntityListItemCard>
  );
}
