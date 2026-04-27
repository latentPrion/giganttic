import React from "react";
import {
  Box,
  Chip,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";

import { EntityListItemCard } from "../../../../common/components/entity-list/EntityListItemCard.js";
import type { IssueStatus } from "../../contracts/issue.contracts.js";
import {
  formatKanbanStatusLabel,
  KANBAN_STATUS_OPTIONS,
} from "./kanban-status-options.js";
import type { KanbanTaskCardModel } from "./kanban.types.js";
import { useKanbanCardInteraction } from "./useKanbanCardInteraction.js";

const VIEW_MODE = "link-only-no-action-buttons";
const CARD_BORDER_WIDTH = 1;
const CARD_BORDER_RADIUS = 3;

export function KanbanTaskCard(props: {
  allowStatusChange?: boolean;
  card: KanbanTaskCardModel;
  disabled?: boolean;
  onNavigateToTask?: (taskId: string, chartId: number) => void;
  onUpdateStatus: (taskId: string, chartId: number, status: IssueStatus) => void;
}) {
  const { task } = props.card;
  const isReadOnlyMilestone = task.isMilestone;
  const {
    closeMenu,
    handleClick,
    handleDoubleClick,
    handleKeyDown,
    menuAnchor,
  } = useKanbanCardInteraction({
    disabled: props.disabled,
    onNavigate: props.onNavigateToTask
      ? () => props.onNavigateToTask?.(task.id, task.chartId)
      : undefined,
    shouldOpenMenuOnDoubleClick: () => (props.allowStatusChange ?? false) && !isReadOnlyMilestone,
  });

  function handleSelectStatus(status: IssueStatus): void {
    closeMenu();
    if (status === task.status) {
      return;
    }
    props.onUpdateStatus(task.id, task.chartId, status);
  }

  return (
    <Box
      data-testid={`kanban-task-card-${task.chartId}-${task.id}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      <EntityListItemCard
        description="Derived from the project gantt chart"
        paperSx={{
          border: (theme) => {
            if (task.isMilestone) {
              return `${CARD_BORDER_WIDTH + 1}px solid ${theme.palette.warning.main}`;
            }
            return `${CARD_BORDER_WIDTH}px dashed ${theme.palette.divider}`;
          },
          borderRadius: CARD_BORDER_RADIUS,
        }}
        title={task.title}
        viewMode={VIEW_MODE}
      >
        <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
          <Chip
            color={task.isMilestone ? "warning" : "info"}
            label={task.isMilestone ? "Milestone" : "Gantt Task"}
            size="small"
            variant="outlined"
          />
          <Chip
            label={formatKanbanStatusLabel(task.status)}
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
      <Menu
        anchorReference="anchorPosition"
        anchorPosition={menuAnchor === null ? undefined : menuAnchor}
        onClose={closeMenu}
        open={menuAnchor !== null}
      >
        {KANBAN_STATUS_OPTIONS.map((status) => (
          <MenuItem
            key={status}
            disabled={props.disabled || isReadOnlyMilestone || status === task.status}
            onClick={() => handleSelectStatus(status)}
          >
            {formatKanbanStatusLabel(status)}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
