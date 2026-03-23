import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { issuesApi } from "../api/issues-api.js";
import { KanbanBoard } from "../components/kanban/KanbanBoard.js";
import { createKanbanColumns } from "../components/kanban/kanban-models.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import type { Issue } from "../contracts/issue.contracts.js";
import {
  parseProjectKanbanTasksFromXml,
  type ParsedGanttKanbanTask,
} from "../lib/project-kanban-gantt-parser.js";
import { useGanttChartFileManager } from "../hooks/use-gantt-chart-file-manager.js";
import type { GanttChartHandle } from "../models/gantt-chart-handle.js";

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
  const ganttRef = useRef<GanttChartHandle | null>(null);
  const fileManager = useGanttChartFileManager({
    ganttRef,
    projectId: props.projectId,
    token: props.token,
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(props.projectId !== null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tasks, setTasks] = useState<ParsedGanttKanbanTask[]>([]);

  const columns = useMemo(
    () => createKanbanColumns(issues, tasks),
    [issues, tasks],
  );

  useEffect(() => {
    const { projectId, token } = props;

    if (projectId === null) {
      setErrorMessage(null);
      setIsLoading(false);
      setIssues([]);
      setTasks([]);
      return;
    }

    // Keep issues loading independent from chart-cache loading.
    setIsLoading(true);
    setErrorMessage(null);

    let isMounted = true;
    issuesApi
      .listIssues(token, projectId)
      .then((issuesResponse) => {
        if (!isMounted) {
          return;
        }
        setIssues(issuesResponse.issues);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
        setIssues([]);
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [props.projectId, props.token]);

  useEffect(() => {
    if (props.projectId === null) {
      return;
    }

    if (fileManager.loadErrorMessage) {
      setErrorMessage(fileManager.loadErrorMessage);
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
    props.projectId,
  ]);

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

    return <KanbanBoard columns={columns} />;
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
