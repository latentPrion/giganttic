import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import { EntityItemList } from "../../../common/components/entity-list/EntityItemList.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { ganttApi } from "../api/gantt-api.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import { TaskListItem } from "../components/tasks/TaskListItem.js";
import type { IssueStatus } from "../contracts/issue.contracts.js";
import {
  type ParsedProjectTaskHistoryEntry,
  parseProjectTasksHistoryFromXml,
} from "../lib/project-tasks-history-parser.js";
import {
  subscribeGanttRuntimeChartUpdatedEvent,
  type GanttRuntimeChartUpdatedEventDetail,
} from "../lib/gantt-runtime-chart-events.js";

interface ProjectManagerTasksPageProps {
  projectId: number | null;
  token: string;
}

const VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const DEFAULT_ERROR_MESSAGE = "Unable to load project tasks right now.";
const EMPTY_TASKS_MESSAGE = "No tasks match the current filters yet.";
const STATUS_TAB_OPEN: IssueStatus = "ISSUE_STATUS_OPEN";
const STATUS_TAB_IN_PROGRESS: IssueStatus = "ISSUE_STATUS_IN_PROGRESS";
const STATUS_TAB_BLOCKED: IssueStatus = "ISSUE_STATUS_BLOCKED";
const STATUS_TAB_CLOSED: IssueStatus = "ISSUE_STATUS_CLOSED";
const STATUS_TAB_LABEL_OPEN = "Open";
const STATUS_TAB_LABEL_IN_PROGRESS = "In Progress";
const STATUS_TAB_LABEL_BLOCKED = "Blocked";
const STATUS_TAB_LABEL_CLOSED = "Closed";
const MISSING_PROJECT_MESSAGE = "Select a valid project to view its tasks.";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Project Tasks";

function sortTasksByMostRecentStartDate(tasks: ParsedProjectTaskHistoryEntry[]): ParsedProjectTaskHistoryEntry[] {
  return [...tasks].sort((left, right) => {
    const timeDifference = new Date(right.startDate).getTime() - new Date(left.startDate).getTime();
    if (timeDifference !== 0) {
      return timeDifference;
    }
    return left.id.localeCompare(right.id);
  });
}

function filterTasksByStatus(
  tasks: ParsedProjectTaskHistoryEntry[],
  status: IssueStatus,
): ParsedProjectTaskHistoryEntry[] {
  return tasks.filter((task) => task.status === status);
}

export function ProjectManagerTasksPage(props: ProjectManagerTasksPageProps) {
  const [activeStatusTab, setActiveStatusTab] = useState<IssueStatus>(STATUS_TAB_IN_PROGRESS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(props.projectId !== null);
  const [tasks, setTasks] = useState<ParsedProjectTaskHistoryEntry[]>([]);

  useEffect(() => {
    if (props.projectId === null) {
      return undefined;
    }

    const unsubscribe = subscribeGanttRuntimeChartUpdatedEvent((detail: GanttRuntimeChartUpdatedEventDetail) => {
      if (detail.projectId !== props.projectId) {
        return;
      }

      setErrorMessage(null);
      setIsLoading(false);
      setTasks(parseProjectTasksHistoryFromXml(detail.serializedXml));
    });

    return () => unsubscribe();
  }, [props.projectId]);

  const visibleTasks = useMemo(
    () => sortTasksByMostRecentStartDate(filterTasksByStatus(tasks, activeStatusTab)),
    [activeStatusTab, tasks],
  );

  useEffect(() => {
    if (props.projectId === null) {
      setErrorMessage(null);
      setIsLoading(false);
      setTasks([]);
      return;
    }

    let isMounted = true;

    async function loadTasks(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const chartSource = await ganttApi.getProjectChartOrNull(props.token, props.projectId!);
        if (!isMounted) {
          return;
        }

        if (!chartSource) {
          setTasks([]);
          return;
        }

        setTasks(parseProjectTasksHistoryFromXml(chartSource.content));
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(getApiErrorMessage(error, DEFAULT_ERROR_MESSAGE));
        setTasks([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadTasks();

    return () => {
      isMounted = false;
    };
  }, [props.projectId, props.token]);

  function renderContent() {
    if (props.projectId === null) {
      return <Alert severity="info">{MISSING_PROJECT_MESSAGE}</Alert>;
    }

    if (isLoading) {
      return (
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <CircularProgress size={20} />
          <Typography>Loading tasks...</Typography>
        </Stack>
      );
    }

    if (visibleTasks.length === 0) {
      return (
        <Typography color="text.secondary" variant="body2">
          {EMPTY_TASKS_MESSAGE}
        </Typography>
      );
    }

    return (
      <EntityItemList viewMode={VIEW_MODE}>
        {visibleTasks.map((task) => (
          <TaskListItem
            key={task.id}
            task={task}
            viewMode={VIEW_MODE}
          />
        ))}
      </EntityItemList>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        justifyContent: "center",
        padding: { xs: 1.5, sm: 2 },
        width: "100%",
      }}
    >
      <Stack spacing={2.5} sx={{ flex: 1, maxWidth: 1240, width: "100%" }}>
        <Stack spacing={0.75}>
          <Typography color="primary" variant="overline" sx={{ letterSpacing: "0.14em" }}>
            {PAGE_OVERLINE}
          </Typography>
          <ProjectManagerProjectNavigation currentSection="tasks" projectId={props.projectId} />
          <Typography component="h1" variant="h3">
            {PAGE_TITLE}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Selected project: {props.projectId ?? "None"}
          </Typography>
        </Stack>
        <Stack
          alignItems={{ sm: "center", xs: "stretch" }}
          direction={{ sm: "row", xs: "column" }}
          justifyContent="space-between"
          spacing={1.5}
        >
          <Typography variant="h6">All tasks for the current project</Typography>
          <Tabs
            onChange={(_event, nextValue: IssueStatus) => {
              setActiveStatusTab(nextValue);
            }}
            value={activeStatusTab}
          >
            <Tab label={STATUS_TAB_LABEL_OPEN} value={STATUS_TAB_OPEN} />
            <Tab label={STATUS_TAB_LABEL_IN_PROGRESS} value={STATUS_TAB_IN_PROGRESS} />
            <Tab label={STATUS_TAB_LABEL_BLOCKED} value={STATUS_TAB_BLOCKED} />
            <Tab label={STATUS_TAB_LABEL_CLOSED} value={STATUS_TAB_CLOSED} />
          </Tabs>
        </Stack>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {renderContent()}
      </Stack>
    </Box>
  );
}
