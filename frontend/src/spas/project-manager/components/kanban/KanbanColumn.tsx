import React from "react";
import { Paper, Stack, Typography } from "@mui/material";

import {
  KANBAN_COLUMN_LABELS,
  KANBAN_EMPTY_COLUMN_MESSAGE,
} from "./kanban.constants.js";
import { KanbanIssueCard } from "./KanbanIssueCard.js";
import { KanbanTaskCard } from "./KanbanTaskCard.js";
import type { KanbanColumnModel } from "./kanban.types.js";

function renderKanbanCard(card: KanbanColumnModel["cards"][number]) {
  switch (card.kind) {
    case "ganttTask":
      return <KanbanTaskCard card={card} />;
    case "issue":
    default:
      return <KanbanIssueCard card={card} />;
  }
}

export function KanbanColumn(props: { column: KanbanColumnModel }) {
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
                {renderKanbanCard(card)}
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
