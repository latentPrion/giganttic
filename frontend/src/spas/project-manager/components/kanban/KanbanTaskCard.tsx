import React from "react";
import { Chip, Stack, Typography } from "@mui/material";

import { EntityListItemCard } from "../../../../common/components/entity-list/EntityListItemCard.js";
import type { KanbanTaskCardModel } from "./kanban.types.js";

const VIEW_MODE = "link-only-no-action-buttons";
const CARD_BORDER_WIDTH = 1;
const CARD_BORDER_RADIUS = 3;

export function KanbanTaskCard(props: { card: KanbanTaskCardModel }) {
  const { task } = props.card;

  return (
    <EntityListItemCard
      description="Derived from the project gantt chart"
      paperSx={{
        border: (theme) => `${CARD_BORDER_WIDTH}px dashed ${theme.palette.divider}`,
        borderRadius: CARD_BORDER_RADIUS,
      }}
      title={task.title}
      viewMode={VIEW_MODE}
    >
      <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
        <Chip
          color="info"
          label="Gantt Task"
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
