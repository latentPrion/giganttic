import React, { useEffect, useMemo, useState } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import {
  NOTIFICATION_EVENT_CATEGORIES,
  type NotificationEventCategory,
  type NotificationListSort,
  type NotificationSummaryRow,
} from "../../../../../common/notifications/notification.contracts.js";
import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { notificationsApi } from "../../../common/notifications/notifications-api.js";
import { emitUserNotificationsStateEvent } from "../../../common/notifications/user-notifications-state-events.js";
import { NotificationNoticeToggleButton } from "../../../common/notifications/components/NotificationNoticeToggleButton.js";
import { NotificationRowContent } from "../../../common/notifications/components/NotificationRowContent.js";

interface ProjectManagerNotificationsPageProps {
  currentUserId: number;
  currentUserRoles: string[];
  token: string;
}

interface NotificationListQueryState {
  eventTypes: NotificationEventCategory[];
  includeNoticed: boolean;
  limit: number;
  offset: number;
  sort: NotificationListSort;
}

const DEFAULT_ERROR_MESSAGE = "Unable to load notifications right now.";
const DEFAULT_LIMIT = 20;
const PAGE_TITLE = "Notifications";
const ROWS_PER_PAGE_OPTIONS = [10, 20, 50] as const;

const EVENT_TYPE_LABELS: Record<NotificationEventCategory, string> = {
  attachments: "Attachments",
  comments: "Comments",
  "issue-status": "Issue status",
  "journal-updates": "Journal updates",
  "task-status": "Task status",
};

function createDefaultQueryState(): NotificationListQueryState {
  return {
    eventTypes: [],
    includeNoticed: false,
    limit: DEFAULT_LIMIT,
    offset: 0,
    sort: "desc",
  };
}

function updateNotificationRowAfterToggle(
  rows: NotificationSummaryRow[],
  notificationId: number,
  nextState: { hasBeenNoticed: boolean; noticedTimestamp: string | null },
): NotificationSummaryRow[] {
  return rows.map((row) =>
    row.id === notificationId
      ? {
        ...row,
        hasBeenNoticed: nextState.hasBeenNoticed,
        noticedTimestamp: nextState.noticedTimestamp,
      }
      : row
  );
}

function calculatePageCount(totalCount: number, limit: number): number {
  return Math.max(1, Math.ceil(totalCount / limit));
}

export function ProjectManagerNotificationsPage(
  props: ProjectManagerNotificationsPageProps,
) {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eventTypesAnchor, setEventTypesAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState<NotificationListQueryState>(createDefaultQueryState);
  const [rows, setRows] = useState<NotificationSummaryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const currentPage = Math.floor(query.offset / query.limit) + 1;
  const sortButtonLabel = query.sort === "desc" ? "Most recent first" : "Least recent first";
  const pageCount = useMemo(
    () => calculatePageCount(totalCount, query.limit),
    [query.limit, totalCount],
  );

  useEffect(() => {
    let mounted = true;

    async function loadNotifications(): Promise<void> {
      setErrorMessage(null);
      try {
        const response = await notificationsApi.listNotifications(props.token, query);
        if (mounted) {
          setRows(response.notifications);
          setTotalCount(response.totalCount);
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(getApiErrorMessage(error, DEFAULT_ERROR_MESSAGE));
        }
      }
    }

    void loadNotifications();

    return () => {
      mounted = false;
    };
  }, [props.token, query]);

  async function handleToggleNoticed(notificationId: number): Promise<void> {
    const response = await notificationsApi.toggleNotificationNoticed(
      props.token,
      notificationId,
    );
    setRows((currentRows) =>
      updateNotificationRowAfterToggle(currentRows, notificationId, response)
    );
    emitUserNotificationsStateEvent();
  }

  async function handleRowClick(row: NotificationSummaryRow): Promise<void> {
    if (!row.hasBeenNoticed) {
      await handleToggleNoticed(row.id);
    }
    navigate(row.targetUrl);
  }

  function toggleEventCategory(eventCategory: NotificationEventCategory): void {
    setQuery((currentQuery) => {
      const alreadySelected = currentQuery.eventTypes.includes(eventCategory);
      return {
        ...currentQuery,
        eventTypes: alreadySelected
          ? currentQuery.eventTypes.filter((value) => value !== eventCategory)
          : [...currentQuery.eventTypes, eventCategory],
        offset: 0,
      };
    });
  }

  return (
    <Stack spacing={2}>
      <Typography component="h1" variant="h4">
        {PAGE_TITLE}
      </Typography>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      <Paper elevation={0} sx={{ p: 2 }}>
        <Stack
          alignItems={{ md: "center", xs: "stretch" }}
          direction={{ md: "row", xs: "column" }}
          spacing={2}
        >
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="notifications-rows-per-page-label">Rows per page</InputLabel>
            <Select
              label="Rows per page"
              labelId="notifications-rows-per-page-label"
              onChange={(event) => {
                const nextLimit = Number(event.target.value);
                setQuery((currentQuery) => ({
                  ...currentQuery,
                  limit: nextLimit,
                  offset: 0,
                }));
              }}
              value={String(query.limit)}
            >
              {ROWS_PER_PAGE_OPTIONS.map((option) => (
                <MenuItem key={option} value={String(option)}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={query.includeNoticed}
                onChange={(_, checked) =>
                  setQuery((currentQuery) => ({
                    ...currentQuery,
                    includeNoticed: checked,
                    offset: 0,
                  }))}
              />
            }
            label="Include noticed notifications"
          />
          <Button
            onClick={(event) => setEventTypesAnchor(event.currentTarget)}
            variant="outlined"
          >
            Event types
          </Button>
          <Button
            onClick={() =>
              setQuery((currentQuery) => ({
                ...currentQuery,
                offset: 0,
                sort: currentQuery.sort === "desc" ? "asc" : "desc",
              }))}
            startIcon={query.sort === "desc" ? <VisibilityIcon /> : <VisibilityOffIcon />}
            variant="outlined"
          >
            {sortButtonLabel}
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={0}>
        <List disablePadding>
          {rows.map((row) => (
            <ListItem
              key={row.id}
              disableGutters
              secondaryAction={(
                <NotificationNoticeToggleButton
                  hasBeenNoticed={row.hasBeenNoticed}
                  onToggle={() => handleToggleNoticed(row.id)}
                />
              )}
            >
              <ListItemButton onClick={() => void handleRowClick(row)}>
                <ListItemText
                  primary={(
                    <NotificationRowContent
                      createdAt={row.createdAt}
                      message={row.message}
                    />
                  )}
                />
              </ListItemButton>
            </ListItem>
          ))}
          {rows.length === 0 ? (
            <Box sx={{ p: 2 }}>
              <Typography color="text.secondary" variant="body2">
                No notifications match the current filters.
              </Typography>
            </Box>
          ) : null}
        </List>
      </Paper>

      <Stack alignItems="center">
        <Pagination
          count={pageCount}
          onChange={(_, nextPage) =>
            setQuery((currentQuery) => ({
              ...currentQuery,
              offset: (nextPage - 1) * currentQuery.limit,
            }))}
          page={currentPage}
        />
      </Stack>

      <Menu
        anchorEl={eventTypesAnchor}
        onClose={() => setEventTypesAnchor(null)}
        open={Boolean(eventTypesAnchor)}
      >
        {NOTIFICATION_EVENT_CATEGORIES.map((eventCategory) => (
          <MenuItem
            key={eventCategory}
            onClick={() => toggleEventCategory(eventCategory)}
            role="menuitemcheckbox"
            selected={query.eventTypes.includes(eventCategory)}
          >
            <Checkbox checked={query.eventTypes.includes(eventCategory)} />
            {EVENT_TYPE_LABELS[eventCategory]}
          </MenuItem>
        ))}
      </Menu>
    </Stack>
  );
}
