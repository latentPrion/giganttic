import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { issuesApi } from "../api/issues-api.js";
import { KanbanBoard } from "../components/kanban/KanbanBoard.js";
import { createKanbanColumns } from "../components/kanban/kanban-models.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import type { Issue } from "../contracts/issue.contracts.js";
import type { IssueStatus } from "../contracts/issue.contracts.js";
import { createProjectIssueRoute } from "../routes/project-route-paths.js";
import {
  parseProjectKanbanTasksFromXml,
  type ParsedGanttKanbanTask,
} from "../lib/project-kanban-gantt-parser.js";
import { useGanttChartFileManager } from "../hooks/use-gantt-chart-file-manager.js";
import type { GanttChartHandle } from "../models/gantt-chart-handle.js";
import {
  emitProjectManagerIssueUpdatedEvent,
  subscribeProjectManagerIssueUpdatedEvent,
} from "../lib/issue-updated-events.js";
import {
  getGanttRuntimeChartCacheEntry,
  trySetValidatedGanttRuntimeChartCacheEntry,
} from "../lib/gantt-runtime-chart-cache.js";
import {
  emitGanttRuntimeMetadataReloadRequestedEvent,
} from "../lib/gantt-runtime-chart-events.js";
import { updateTaskStatusInChartXml } from "../lib/kanban-task-status-cache-update.js";

interface ProjectManagerKanbanPageProps {
  projectId: number | null;
  token: string;
}

const DEFAULT_ERROR_MESSAGE = "Unable to load that project kanban board right now.";
const LOADING_MESSAGE = "Loading kanban board...";
const MISSING_PROJECT_MESSAGE = "Select a valid project to view its kanban board.";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Project Kanban Board";

function buildErrorMessage(error: unknown, fallback: string): string {
  return getApiErrorMessage(error, fallback);
}

function createSelectedProjectLabel(projectId: number | null): string {
  return projectId === null ? "None" : `${projectId}`;
}

export function ProjectManagerKanbanPage(props: ProjectManagerKanbanPageProps) {
  const navigate = useNavigate();
  const ganttRef = useRef<GanttChartHandle | null>(null);
  const fileManager = useGanttChartFileManager({
    ganttRef,
    projectId: props.projectId,
    token: props.token,
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(props.projectId !== null);
  const [isUpdatingCardStatus, setIsUpdatingCardStatus] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tasks, setTasks] = useState<ParsedGanttKanbanTask[]>([]);

  const columns = useMemo(
    () => createKanbanColumns(issues, tasks),
    [issues, tasks],
  );

  const reloadIssuesFromBackend = useCallback(async () => {
    if (props.projectId === null) {
      setIssues([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const issuesResponse = await issuesApi.listIssues(props.token, props.projectId);
      setIssues(issuesResponse.issues);
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
      setIssues([]);
    } finally {
      setIsLoading(false);
    }
  }, [props.projectId, props.token]);

  useEffect(() => {
    if (props.projectId === null) {
      setErrorMessage(null);
      setIsLoading(false);
      setIssues([]);
      setTasks([]);
      return;
    }

    void reloadIssuesFromBackend();
  }, [props.projectId, reloadIssuesFromBackend]);

  useEffect(() => {
    if (props.projectId === null) {
      return undefined;
    }

    return subscribeProjectManagerIssueUpdatedEvent((detail) => {
      if (detail.projectId !== props.projectId) {
        return;
      }

      void reloadIssuesFromBackend();
    });
  }, [props.projectId, reloadIssuesFromBackend]);

  useEffect(() => {
    if (props.projectId === null) {
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
      setTasks([]);
      return;
    }

    try {
      setTasks(parseProjectKanbanTasksFromXml(fileManager.cache.serializedXml));
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
      setTasks([]);
    }
  }, [
    fileManager.cache.serializedXml,
    fileManager.loadErrorMessage,
    fileManager.runtimeValidationErrorMessage,
    props.projectId,
  ]);

  async function handleIssueStatusChange(issueId: number, status: IssueStatus): Promise<void> {
    if (props.projectId === null) {
      return;
    }

    const targetIssue = issues.find((issue) => issue.id === issueId);
    if (!targetIssue || targetIssue.status === status) {
      return;
    }

    setIsUpdatingCardStatus(true);
    const previousIssues = issues;
    setIssues((current) => current.map((issue) => (
      issue.id === issueId
        ? { ...issue, status }
        : issue
    )));

    try {
      const response = await issuesApi.updateIssue(props.token, props.projectId, issueId, { status });
      setIssues((current) => current.map((issue) => (
        issue.id === issueId
          ? response.issue
          : issue
      )));
      emitProjectManagerIssueUpdatedEvent({
        issueId: response.issue.id,
        projectId: response.issue.projectId,
      });
    } catch (error) {
      setIssues(previousIssues);
      setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
    } finally {
      setIsUpdatingCardStatus(false);
    }
  }

  function openIssueDetail(issueId: number): void {
    if (props.projectId === null) {
      return;
    }
    navigate(createProjectIssueRoute(props.projectId, issueId));
  }

  function handleTaskStatusChange(taskId: string, status: IssueStatus): void {
    if (props.projectId === null) {
      return;
    }

    const cacheEntry = getGanttRuntimeChartCacheEntry(props.projectId);
    if (!cacheEntry) {
      return;
    }

    try {
      const updatedXml = updateTaskStatusInChartXml(cacheEntry.serializedXml, taskId, status);
      const result = trySetValidatedGanttRuntimeChartCacheEntry(props.projectId, {
        serializedXml: updatedXml,
        type: "xml",
      });
      if (!result.ok) {
        setErrorMessage(result.error?.message ?? DEFAULT_ERROR_MESSAGE);
        return;
      }
      emitGanttRuntimeMetadataReloadRequestedEvent({ projectId: props.projectId });
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
    }
  }

  function renderContent() {
    if (props.projectId === null) {
      return <Alert severity="info">{MISSING_PROJECT_MESSAGE}</Alert>;
    }

    if (isLoading || fileManager.isLoading) {
      return (
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <CircularProgress size={20} />
          <Typography>{LOADING_MESSAGE}</Typography>
        </Stack>
      );
    }

    if (errorMessage) {
      return <Alert severity="error">{errorMessage}</Alert>;
    }

    return (
      <KanbanBoard
        columns={columns}
        isBusy={isUpdatingCardStatus}
        onIssueNavigateToDetail={openIssueDetail}
        onIssueStatusChange={(issueId, status) => {
          void handleIssueStatusChange(issueId, status);
        }}
        onTaskStatusChange={handleTaskStatusChange}
      />
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
      <Stack spacing={2.5} sx={{ flex: 1, maxWidth: 1360, width: "100%" }}>
        <Stack spacing={0.75}>
          <Typography color="primary" variant="overline" sx={{ letterSpacing: "0.14em" }}>
            {PAGE_OVERLINE}
          </Typography>
          <ProjectManagerProjectNavigation currentSection="kanban" projectId={props.projectId} />
          <Typography component="h1" variant="h3">
            {PAGE_TITLE}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Selected project: {createSelectedProjectLabel(props.projectId)}
          </Typography>
        </Stack>
        {renderContent()}
      </Stack>
    </Box>
  );
}
