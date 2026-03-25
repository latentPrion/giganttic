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

const VIEW_MODE = "link-only-no-action-buttons";
const CARD_BORDER_WIDTH = 1;
const CARD_BORDER_RADIUS = 3;
const SINGLE_CLICK_NAVIGATE_DELAY_MS = 220;
const DOUBLE_CLICK_NAVIGATION_SUPPRESSION_MS = SINGLE_CLICK_NAVIGATE_DELAY_MS + 300;

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
  const [menuAnchor, setMenuAnchor] = React.useState<{
    left: number;
    top: number;
  } | null>(null);
  const pendingNavigateTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressSingleClickNavigationUntilRef = React.useRef<number>(0);

  function clearPendingNavigateTimeout(): void {
    if (pendingNavigateTimeoutRef.current === null) {
      return;
    }
    clearTimeout(pendingNavigateTimeoutRef.current);
    pendingNavigateTimeoutRef.current = null;
  }

  function scheduleSingleClickNavigation(): void {
    if (props.disabled) {
      return;
    }
    clearPendingNavigateTimeout();

    if (menuAnchor !== null) {
      return;
    }

    if (Date.now() < suppressSingleClickNavigationUntilRef.current) {
      return;
    }

    if (!props.onNavigateToIssue) {
      return;
    }

    pendingNavigateTimeoutRef.current = setTimeout(() => {
      pendingNavigateTimeoutRef.current = null;
      props.onNavigateToIssue?.(issue.id);
    }, SINGLE_CLICK_NAVIGATE_DELAY_MS);
  }

  React.useEffect(() => () => {
    clearPendingNavigateTimeout();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>): void {
    if (props.disabled) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    scheduleSingleClickNavigation();
  }

  function closeMenu(): void {
    setMenuAnchor(null);
    // Prevent a background click right after dismissing the menu
    // from triggering our delayed single-click navigation.
    suppressSingleClickNavigationUntilRef.current = Math.max(
      suppressSingleClickNavigationUntilRef.current,
      Date.now() + DOUBLE_CLICK_NAVIGATION_SUPPRESSION_MS,
    );
    clearPendingNavigateTimeout();
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLElement>): void {
    event.preventDefault();
    clearPendingNavigateTimeout();
    if (props.disabled) {
      return;
    }
    suppressSingleClickNavigationUntilRef.current = Date.now() + DOUBLE_CLICK_NAVIGATION_SUPPRESSION_MS;
    setMenuAnchor({
      left: event.clientX,
      top: event.clientY,
    });
  }

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
      onClick={() => scheduleSingleClickNavigation()}
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
