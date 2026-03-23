import React from "react";
import {
  Chip,
  Stack,
  Typography,
} from "@mui/material";

import { EntityListItemCard } from "../../../../common/components/entity-list/EntityListItemCard.js";
import type { EntityListItemViewMode } from "../../../../common/components/entity-list/entity-list-item.types.js";
import type { ParsedProjectTaskHistoryEntry } from "../../lib/project-tasks-history-parser.js";

interface TaskListItemProps {
  task: ParsedProjectTaskHistoryEntry;
  viewMode: EntityListItemViewMode;
}

function createStatusColor(status: ParsedProjectTaskHistoryEntry["status"]) {
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

function createStatusLabel(status: ParsedProjectTaskHistoryEntry["status"]): string {
  return status.replace("ISSUE_STATUS_", "").toLowerCase().replace("_", " ");
}

function createTypeLabel(type: ParsedProjectTaskHistoryEntry["type"]): string {
  return type === "milestone" ? "Milestone" : "Task";
}

export function TaskListItem(props: TaskListItemProps) {
  const { task } = props;

  return (
    <EntityListItemCard
      description={`Task ID: ${task.id}`}
      title={task.title}
      viewMode={props.viewMode}
    >
      <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
        <Chip
          color={createStatusColor(task.status)}
          label={createStatusLabel(task.status)}
          size="small"
          variant="outlined"
        />
        <Chip
          label={createTypeLabel(task.type)}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`Progress ${task.progressPercentage}%`}
          size="small"
          variant="outlined"
        />
      </Stack>
      <Typography color="text.secondary" variant="caption">
        Started {new Date(task.startDate).toLocaleString()}
      </Typography>
    </EntityListItemCard>
  );
}
