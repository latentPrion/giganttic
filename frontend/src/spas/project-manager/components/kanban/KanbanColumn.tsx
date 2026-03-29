import React from "react";
import { Paper, Stack, Typography } from "@mui/material";

import type { IssueStatus } from "../../contracts/issue.contracts.js";
import {
  KANBAN_COLUMN_LABELS,
  KANBAN_EMPTY_COLUMN_MESSAGE,
} from "./kanban.constants.js";
import { KanbanIssueCard } from "./KanbanIssueCard.js";
import { KanbanTaskCard } from "./KanbanTaskCard.js";
import type { KanbanColumnModel } from "./kanban.types.js";

function renderKanbanCard(
  card: KanbanColumnModel["cards"][number],
  onIssueStatusChange: (issueId: number, status: IssueStatus) => void,
  onIssueNavigateToDetail: ((issueId: number) => void) | undefined,
  onTaskNavigateToDetail: ((taskId: string) => void) | undefined,
  onTaskStatusChange: (taskId: string, status: IssueStatus) => void,
  isBusy: boolean,
) {
  switch (card.kind) {
    case "ganttTask":
      return (
        <KanbanTaskCard
          card={card}
          disabled={isBusy}
          onNavigateToTask={onTaskNavigateToDetail}
          onUpdateStatus={onTaskStatusChange}
        />
      );
    case "issue":
    default:
      return (
        <KanbanIssueCard
          card={card}
          disabled={isBusy}
          onUpdateStatus={onIssueStatusChange}
          onNavigateToIssue={onIssueNavigateToDetail}
        />
      );
  }
}

export function KanbanColumn(props: {
  column: KanbanColumnModel;
  isBusy: boolean;
  onIssueStatusChange: (issueId: number, status: IssueStatus) => void;
  onIssueNavigateToDetail?: (issueId: number) => void;
  onTaskNavigateToDetail?: (taskId: string) => void;
  onTaskStatusChange: (taskId: string, status: IssueStatus) => void;
}) {
  const { column } = props;

  return (
    <Paper
      elevation={0}
      sx={{
        minHeight: 320,
        padding: 2,
        width: "100%",
      }}
    >
      <Stack spacing={2}>
        <Typography component="h2" variant="h6">
          {KANBAN_COLUMN_LABELS[column.value]}
        </Typography>
        {column.cards.length > 0 ? (
          <Stack spacing={1.5}>
            {column.cards.map((card) => (
              <React.Fragment key={card.id}>
                {renderKanbanCard(
                  card,
                  props.onIssueStatusChange,
                  props.onIssueNavigateToDetail,
                  props.onTaskNavigateToDetail,
                  props.onTaskStatusChange,
                  props.isBusy,
                )}
              </React.Fragment>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary" variant="body2">
            {KANBAN_EMPTY_COLUMN_MESSAGE}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
