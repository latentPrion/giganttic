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
import { getIssuePriorityLabel } from "../../lib/issue-priority.js";
import {
  formatKanbanStatusLabel,
  KANBAN_STATUS_OPTIONS,
} from "./kanban-status-options.js";
import type { KanbanIssueCardData } from "./kanban.types.js";
import { useKanbanCardInteraction } from "./useKanbanCardInteraction.js";

const VIEW_MODE = "link-only-no-action-buttons";
const CARD_BORDER_WIDTH = 1;
const CARD_BORDER_RADIUS = 3;

function createIssueStatusLabel(status: KanbanIssueCardData["issue"]["status"]): string {
  return formatKanbanStatusLabel(status);
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

export function KanbanIssueCard(props: {
  card: KanbanIssueCardData;
  disabled?: boolean;
  onNavigateToIssue?: (issueId: number) => void;
  onUpdateStatus: (issueId: number, status: IssueStatus) => void;
}) {
  const { issue } = props.card;
  const {
    closeMenu,
    handleClick,
    handleDoubleClick,
    handleKeyDown,
    menuAnchor,
  } = useKanbanCardInteraction({
    disabled: props.disabled,
    onNavigate: props.onNavigateToIssue
      ? () => props.onNavigateToIssue?.(issue.id)
      : undefined,
    shouldOpenMenuOnDoubleClick: () => true,
  });

  function handleSelectStatus(status: IssueStatus): void {
    closeMenu();
    if (status === issue.status) {
      return;
    }
    props.onUpdateStatus(issue.id, status);
  }

  return (
    <Box
      data-testid={`kanban-issue-card-${issue.id}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
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
            label={`Priority ${getIssuePriorityLabel(issue.priority)}`}
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
      <Menu
        anchorReference="anchorPosition"
        anchorPosition={menuAnchor === null ? undefined : menuAnchor}
        onClose={closeMenu}
        open={menuAnchor !== null}
      >
        {KANBAN_STATUS_OPTIONS.map((status) => (
          <MenuItem
            key={status}
            disabled={props.disabled || status === issue.status}
            onClick={() => handleSelectStatus(status)}
          >
            {formatKanbanStatusLabel(status)}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
