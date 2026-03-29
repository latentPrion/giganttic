import React, { useEffect, useMemo, useState } from "react";
import NotificationsIcon from "@mui/icons-material/Notifications";
import {
  Badge,
  Box,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import type { NotificationSummaryRow } from "../../../../../common/notifications/notification.contracts.js";
import { createNotificationsRoute } from "../../../../../common/notifications/notification-targets.js";
import { notificationsApi } from "../notifications-api.js";
import { emitUserNotificationsStateEvent } from "../user-notifications-state-events.js";
import { useNotificationSummary } from "../hooks/use-notification-summary.js";
import { NotificationNoticeToggleButton } from "./NotificationNoticeToggleButton.js";
import { NotificationRowContent } from "./NotificationRowContent.js";

interface NotificationBellProps {
  token: string;
}

const DEFAULT_DROPDOWN_LIMIT = 20;

function createBellLabel(unnoticedCount: number): string {
  return `Notifications (${unnoticedCount} unnoticed)`;
}

function updateNotificationListAfterToggle(
  currentRows: NotificationSummaryRow[],
  notificationId: number,
  nextState: { hasBeenNoticed: boolean; noticedTimestamp: string | null },
): NotificationSummaryRow[] {
  return currentRows
    .map((row) =>
      row.id === notificationId
        ? {
          ...row,
          hasBeenNoticed: nextState.hasBeenNoticed,
          noticedTimestamp: nextState.noticedTimestamp,
        }
        : row
    )
    .filter((row) => !row.hasBeenNoticed);
}

export function NotificationBell(props: NotificationBellProps) {
  const navigate = useNavigate();
  const { unnoticedCount } = useNotificationSummary(props.token);
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const [rows, setRows] = useState<NotificationSummaryRow[]>([]);
  const isOpen = Boolean(anchorElement);
  const bellLabel = useMemo(() => createBellLabel(unnoticedCount), [unnoticedCount]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let mounted = true;

    async function loadRows(): Promise<void> {
      try {
        const response = await notificationsApi.listUnnoticedNotifications(
          props.token,
          DEFAULT_DROPDOWN_LIMIT,
        );
        if (mounted) {
          setRows(response.notifications);
        }
      } catch {
        if (mounted) {
          setRows([]);
        }
      }
    }

    void loadRows();

    return () => {
      mounted = false;
    };
  }, [isOpen, props.token]);

  async function toggleNotificationNoticed(notificationId: number): Promise<void> {
    const response = await notificationsApi.toggleNotificationNoticed(
      props.token,
      notificationId,
    );
    setRows((currentRows) =>
      updateNotificationListAfterToggle(currentRows, notificationId, response)
    );
    emitUserNotificationsStateEvent();
  }

  async function handleNotificationClick(row: NotificationSummaryRow): Promise<void> {
    if (!row.hasBeenNoticed) {
      await toggleNotificationNoticed(row.id);
    }
    setAnchorElement(null);
    navigate(row.targetUrl);
  }

  return (
    <Box>
      <IconButton
        aria-label={bellLabel}
        color="inherit"
        onClick={(event) => setAnchorElement(event.currentTarget)}
      >
        <Badge badgeContent={unnoticedCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorElement}
        onClose={() => setAnchorElement(null)}
        open={isOpen}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Link component={RouterLink} to={createNotificationsRoute()} underline="hover">
            View all notifications
          </Link>
        </Box>
        {rows.length === 0 ? (
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography color="text.secondary" variant="body2">
              No unnoticed notifications.
            </Typography>
          </Box>
        ) : null}
        {rows.map((row) => (
          <MenuItem
            key={row.id}
            onClick={() => void handleNotificationClick(row)}
          >
            <Stack
              alignItems="center"
              direction="row"
              spacing={1}
              sx={{ width: 360 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <NotificationRowContent
                  createdAt={row.createdAt}
                  message={row.message}
                />
              </Box>
              <NotificationNoticeToggleButton
                hasBeenNoticed={row.hasBeenNoticed}
                onToggle={() => toggleNotificationNoticed(row.id)}
              />
            </Stack>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
