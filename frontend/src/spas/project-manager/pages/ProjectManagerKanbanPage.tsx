import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { issuesApi } from "../api/issues-api.js";
import { ganttApi } from "../api/gantt-api.js";
import { KanbanBoard } from "../components/kanban/KanbanBoard.js";
import { createKanbanColumns } from "../components/kanban/kanban-models.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import type { Issue } from "../contracts/issue.contracts.js";
import {
  parseProjectKanbanTasksFromXml,
  type ParsedGanttKanbanTask,
} from "../lib/project-kanban-gantt-parser.js";

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

async function loadGanttTasks(
  token: string,
  projectId: number,
): Promise<ParsedGanttKanbanTask[]> {
  const chartSource = await ganttApi.getProjectChartOrNull(token, projectId);
  if (chartSource === null) {
    return [];
  }
  return parseProjectKanbanTasksFromXml(chartSource.content);
}

export function ProjectManagerKanbanPage(props: ProjectManagerKanbanPageProps) {
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

    const resolvedProjectId = projectId;
    let isMounted = true;

    async function loadKanbanData(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const [issuesResponse, ganttTasks] = await Promise.all([
          issuesApi.listIssues(token, resolvedProjectId),
          loadGanttTasks(token, resolvedProjectId),
        ]);

        if (!isMounted) {
          return;
        }

        setIssues(issuesResponse.issues);
        setTasks(ganttTasks);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
        setIssues([]);
        setTasks([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadKanbanData();

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
