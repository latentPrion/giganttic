import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { EntityItemList } from "../../../common/components/entity-list/EntityItemList.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import { TaskListItem } from "../components/tasks/TaskListItem.js";
import type { IssueStatus } from "../contracts/issue.contracts.js";
import { getTaskStatusTab, setTaskStatusTab } from "../lib/subtab-memory.js";
import {
  type ParsedProjectTaskHistoryEntry,
  parseProjectTasksHistoryFromXml,
} from "../lib/project-tasks-history-parser.js";
import { useGanttChartFileManager } from "../hooks/use-gantt-chart-file-manager.js";
import type { GanttChartHandle } from "../models/gantt-chart-handle.js";
import { createProjectTaskRoute } from "../routes/project-route-paths.js";

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
  const navigate = useNavigate();
  const ganttRef = useRef<GanttChartHandle | null>(null);
  const fileManager = useGanttChartFileManager({
    ganttRef,
    projectId: props.projectId,
    token: props.token,
  });

  const [activeStatusTab, setActiveStatusTab] = useState<IssueStatus>(() => {
    if (props.projectId === null) {
      return STATUS_TAB_IN_PROGRESS;
    }

    return getTaskStatusTab(props.projectId) ?? STATUS_TAB_IN_PROGRESS;
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ParsedProjectTaskHistoryEntry[]>([]);

  useEffect(() => {
    if (props.projectId === null) {
      setActiveStatusTab(STATUS_TAB_IN_PROGRESS);
      return;
    }

    setActiveStatusTab(getTaskStatusTab(props.projectId) ?? STATUS_TAB_IN_PROGRESS);
  }, [props.projectId]);

  useEffect(() => {
    if (props.projectId === null) {
      return;
    }

    setTaskStatusTab(props.projectId, activeStatusTab);
  }, [activeStatusTab, props.projectId]);

  const visibleTasks = useMemo(
    () => sortTasksByMostRecentStartDate(filterTasksByStatus(tasks, activeStatusTab)),
    [activeStatusTab, tasks],
  );

  useEffect(() => {
    if (props.projectId === null) {
      setErrorMessage(null);
      setTasks([]);
      return;
    }

    if (fileManager.loadErrorMessage) {
      setErrorMessage(fileManager.loadErrorMessage);
      setTasks([]);
      return;
    }

    if (fileManager.runtimeValidationErrorMessage) {
      setErrorMessage(fileManager.runtimeValidationErrorMessage);
      setTasks([]);
      return;
    }

    if (fileManager.cache.serializedXml === null) {
      setErrorMessage(null);
      setTasks([]);
      return;
    }

    try {
      setErrorMessage(null);
      setTasks(parseProjectTasksHistoryFromXml(fileManager.cache.serializedXml));
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, DEFAULT_ERROR_MESSAGE));
      setTasks([]);
    }
  }, [
    fileManager.cache.serializedXml,
    fileManager.loadErrorMessage,
    fileManager.runtimeValidationErrorMessage,
    props.projectId,
  ]);

  function renderContent() {
    if (props.projectId === null) {
      return <Alert severity="info">{MISSING_PROJECT_MESSAGE}</Alert>;
    }

    if (fileManager.isLoading) {
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
            onNavigate={() => {
              if (props.projectId !== null) {
                navigate(createProjectTaskRoute(props.projectId, task.id));
              }
            }}
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
