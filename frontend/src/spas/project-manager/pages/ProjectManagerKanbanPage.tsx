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
import { createProjectTaskRoute } from "../routes/project-route-paths.js";
import {
  parseProjectKanbanTasksFromXml,
  type ParsedGanttKanbanTask,
} from "../lib/project-kanban-gantt-parser.js";
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
  subscribeGanttRuntimeChartUpdatedEvent,
} from "../lib/gantt-runtime-chart-events.js";
import { updateTaskStatusInChartXml } from "../lib/kanban-task-status-cache-update.js";
import { useProjectEditAccess } from "../hooks/use-project-edit-access.js";
import { loadAggregatedProjectChartSources } from "../lib/project-charts-aggregation.js";

interface ProjectManagerKanbanPageProps {
  chartId?: number;
  currentUserId: number;
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

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [issueErrorMessage, setIssueErrorMessage] = useState<string | null>(null);
  const [taskErrorMessage, setTaskErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(props.projectId !== null);
  const [isUpdatingCardStatus, setIsUpdatingCardStatus] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tasks, setTasks] = useState<ParsedGanttKanbanTask[]>([]);
  const chartXmlByIdRef = useRef<Map<number, string>>(new Map());
  const { canEdit: canEditProjectContent } = useProjectEditAccess({
    currentUserId: props.currentUserId,
    projectId: props.projectId,
    token: props.token,
  });

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
    setIssueErrorMessage(null);

    try {
      const issuesResponse = await issuesApi.listIssues(props.token, props.projectId);
      setIssues(issuesResponse.issues);
    } catch (error) {
      setIssueErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
      setIssues([]);
    } finally {
      setIsLoading(false);
    }
  }, [props.projectId, props.token]);

  useEffect(() => {
    if (props.projectId === null) {
      setTaskErrorMessage(null);
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

  const reloadTasksFromAllCharts = useCallback(async () => {
    if (props.projectId === null) {
      chartXmlByIdRef.current.clear();
      setTasks([]);
      return;
    }

    try {
      const chartSources = await loadAggregatedProjectChartSources(props.token, props.projectId);
      const nextChartXmlById = new Map<number, string>();
      const nextTasks: ParsedGanttKanbanTask[] = [];
      for (const source of chartSources) {
        nextChartXmlById.set(source.chartId, source.serializedXml);
        nextTasks.push(...parseProjectKanbanTasksFromXml(source.serializedXml, new Date(), source.chartId));
      }
      chartXmlByIdRef.current = nextChartXmlById;
      setErrorMessage(null);
      setTasks(nextTasks);
    } catch (error) {
      setTaskErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
      chartXmlByIdRef.current.clear();
      setTasks([]);
    }
  }, [props.projectId, props.token]);

  useEffect(() => {
    void reloadTasksFromAllCharts();
  }, [reloadTasksFromAllCharts]);

  useEffect(() => {
    if (props.projectId === null) {
      return undefined;
    }
    return subscribeGanttRuntimeChartUpdatedEvent((detail) => {
      if (detail.projectId !== props.projectId) {
        return;
      }
      void reloadTasksFromAllCharts();
    });
  }, [props.projectId, reloadTasksFromAllCharts]);

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

  function openTaskDetail(taskId: string, chartId: number): void {
    if (props.projectId === null) {
      return;
    }
    navigate(createProjectTaskRoute(props.projectId, taskId, { chartId }));
  }

  function handleTaskStatusChange(taskId: string, chartId: number, status: IssueStatus): void {
    if (props.projectId === null || !canEditProjectContent) {
      return;
    }

    const cacheEntry = getGanttRuntimeChartCacheEntry(props.projectId, chartId)
      ?? (chartXmlByIdRef.current.has(chartId)
        ? {
            serializedXml: chartXmlByIdRef.current.get(chartId)!,
            type: "xml" as const,
          }
        : null);
    if (!cacheEntry?.serializedXml) {
      return;
    }

    try {
      const updatedXml = updateTaskStatusInChartXml(cacheEntry.serializedXml, taskId, status);
      const result = trySetValidatedGanttRuntimeChartCacheEntry(props.projectId, chartId, {
        serializedXml: updatedXml,
        type: "xml",
      });
      if (!result.ok) {
        setErrorMessage(result.error?.message ?? DEFAULT_ERROR_MESSAGE);
        return;
      }
      emitGanttRuntimeMetadataReloadRequestedEvent({ chartId, projectId: props.projectId });
      void reloadTasksFromAllCharts();
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
    }
  }

  function renderContent() {
    if (props.projectId === null) {
      return <Alert severity="info">{MISSING_PROJECT_MESSAGE}</Alert>;
    }

    if (isLoading) {
      return (
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <CircularProgress size={20} />
          <Typography>{LOADING_MESSAGE}</Typography>
        </Stack>
      );
    }

    const combinedErrorMessage = issueErrorMessage ?? taskErrorMessage ?? errorMessage;
    if (combinedErrorMessage) {
      return <Alert severity="error">{combinedErrorMessage}</Alert>;
    }

    return (
      <KanbanBoard
        columns={columns}
        isBusy={isUpdatingCardStatus}
        onIssueNavigateToDetail={openIssueDetail}
        onIssueStatusChange={(issueId, status) => {
          void handleIssueStatusChange(issueId, status);
        }}
        onTaskNavigateToDetail={openTaskDetail}
        taskStatusChangeEnabled={canEditProjectContent}
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
          <ProjectManagerProjectNavigation
            authToken={props.token}
            chartId={props.chartId}
            currentSection="kanban"
            projectId={props.projectId}
          />
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
