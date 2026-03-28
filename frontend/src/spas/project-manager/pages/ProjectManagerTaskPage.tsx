import React, {
  useMemo,
  useRef,
} from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { getApiErrorMessage } from "../../../common/api/api-error.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import { DiscussionWorkspaceTabs } from "../components/discussion/DiscussionWorkspaceTabs.js";
import { TaskAttachmentsPanel } from "../components/tasks/TaskAttachmentsPanel.js";
import { TaskCommentsPanel } from "../components/tasks/TaskCommentsPanel.js";
import { TaskDetailsCard } from "../components/tasks/TaskDetailsCard.js";
import type { TaskDetailTab } from "../contracts/route-query.contracts.js";
import { useGanttChartFileManager } from "../hooks/use-gantt-chart-file-manager.js";
import {
  parseProjectTaskDetailFromXml,
  type ParsedProjectTaskDetail,
} from "../lib/project-tasks-history-parser.js";
import type { GanttChartHandle } from "../models/gantt-chart-handle.js";
import {
  createProjectTaskRoute,
  createProjectTasksRoute,
} from "../routes/project-route-paths.js";

interface ProjectManagerTaskPageProps {
  commentId: number | null;
  currentUserId: number;
  projectId: number | null;
  taskId: string | null;
  taskTab: TaskDetailTab;
  token: string;
}

interface TaskDetailResolution {
  errorMessage: string | null;
  task: ParsedProjectTaskDetail | null;
}

const TASK_DETAIL_WORKSPACE_TABLIST_LABEL = "Task detail workspace sections";
const DEFAULT_ERROR_MESSAGE = "Unable to load that task right now.";
const MISSING_ROUTE_MESSAGE = "Provide both a valid task id and projectId to view a task.";
const MISSING_TASK_MESSAGE = "That task was not found in the current gantt chart.";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Task Detail";

function createTaskResolution(options: {
  loadErrorMessage: string | null;
  runtimeValidationErrorMessage: string | null;
  serializedXml: string | null;
  taskId: string | null;
}): TaskDetailResolution {
  const {
    loadErrorMessage,
    runtimeValidationErrorMessage,
    serializedXml,
    taskId,
  } = options;

  if (taskId === null || serializedXml === null) {
    return {
      errorMessage: null,
      task: null,
    };
  }

  if (loadErrorMessage) {
    return {
      errorMessage: loadErrorMessage,
      task: null,
    };
  }

  if (runtimeValidationErrorMessage) {
    return {
      errorMessage: runtimeValidationErrorMessage,
      task: null,
    };
  }

  try {
    const task = parseProjectTaskDetailFromXml(serializedXml, taskId);
    return {
      errorMessage: task === null ? MISSING_TASK_MESSAGE : null,
      task,
    };
  } catch (error) {
    return {
      errorMessage: getApiErrorMessage(error, DEFAULT_ERROR_MESSAGE),
      task: null,
    };
  }
}

function renderLoadingState(message: string): React.ReactNode {
  return (
    <Stack alignItems="center" direction="row" spacing={1.5}>
      <CircularProgress size={20} />
      <Typography>{message}</Typography>
    </Stack>
  );
}

function renderDetailsTab(options: {
  errorMessage: string | null;
  isLoading: boolean;
  projectId: number | null;
  task: ParsedProjectTaskDetail | null;
  taskId: string | null;
  token: string;
}): React.ReactNode {
  const {
    errorMessage,
    isLoading,
    projectId,
    task,
    taskId,
    token,
  } = options;

  if (projectId === null || taskId === null) {
    return <Alert severity="info">{MISSING_ROUTE_MESSAGE}</Alert>;
  }

  if (isLoading) {
    return renderLoadingState("Loading task detail...");
  }

  if (errorMessage) {
    return <Alert severity="error">{errorMessage}</Alert>;
  }

  if (!task) {
    return <Alert severity="error">{MISSING_TASK_MESSAGE}</Alert>;
  }

  return (
    <TaskDetailsCard
      projectId={projectId}
      task={task}
      token={token}
    />
  );
}

export function ProjectManagerTaskPage(props: ProjectManagerTaskPageProps) {
  const navigate = useNavigate();
  const ganttRef = useRef<GanttChartHandle | null>(null);
  const fileManager = useGanttChartFileManager({
    ganttRef,
    projectId: props.projectId,
    token: props.token,
  });

  const taskResolution = useMemo(
    () =>
      createTaskResolution({
        loadErrorMessage: fileManager.loadErrorMessage,
        runtimeValidationErrorMessage: fileManager.runtimeValidationErrorMessage,
        serializedXml: fileManager.cache.serializedXml,
        taskId: props.taskId,
      }),
    [
      fileManager.cache.serializedXml,
      fileManager.loadErrorMessage,
      fileManager.runtimeValidationErrorMessage,
      props.taskId,
    ],
  );

  function goBackToTasks(): void {
    if (props.projectId === null) {
      navigate("/pm/project/tasks");
      return;
    }

    navigate(createProjectTasksRoute(props.projectId));
  }

  function handleTaskTabChange(
    _event: React.SyntheticEvent,
    nextTab: TaskDetailTab,
  ): void {
    if (props.projectId === null || props.taskId === null) {
      return;
    }

    const nextCommentId = nextTab === "comments" ? props.commentId : null;
    navigate(
      createProjectTaskRoute(props.projectId, props.taskId, {
        commentId: nextCommentId === null ? undefined : nextCommentId,
        tab: nextTab,
      }),
    );
  }

  function navigateToCommentAnchor(commentId: number): void {
    if (props.projectId === null || props.taskId === null) {
      return;
    }

    navigate(
      createProjectTaskRoute(props.projectId, props.taskId, {
        commentId,
        tab: "comments",
      }),
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
          <Typography component="h1" variant="h3">
            {PAGE_TITLE}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Selected project:
            {" "}
            {props.projectId ?? "None"}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Selected task:
            {" "}
            {props.taskId ?? "None"}
          </Typography>
        </Stack>
        <ProjectManagerProjectNavigation
          currentSection={
            props.projectId !== null && props.taskId !== null ? "task-detail" : "tasks"
          }
          projectId={props.projectId}
          taskDetailContext={
            props.projectId !== null && props.taskId !== null
              ? { onCloseTaskTab: goBackToTasks, taskId: props.taskId }
              : null
          }
        />
        <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}>
          <Typography variant="h6">
            Task workspace
            {taskResolution.task ? ` · ${taskResolution.task.title}` : ""}
          </Typography>
          <Button onClick={goBackToTasks} type="button" variant="outlined">
            Back to Tasks
          </Button>
        </Stack>
        {props.projectId !== null && props.taskId !== null ? (
          <DiscussionWorkspaceTabs
            ariaLabel={TASK_DETAIL_WORKSPACE_TABLIST_LABEL}
            onChange={handleTaskTabChange}
            value={props.taskTab}
          />
        ) : null}
        {props.taskTab === "details"
          ? renderDetailsTab({
            errorMessage: taskResolution.errorMessage,
            isLoading: fileManager.isLoading,
            projectId: props.projectId,
            task: taskResolution.task,
            taskId: props.taskId,
            token: props.token,
          })
          : null}
        {props.projectId !== null && props.taskId !== null ? (
          <>
            <TaskCommentsPanel
              currentUserId={props.currentUserId}
              highlightCommentId={props.commentId}
              onNavigateToComment={navigateToCommentAnchor}
              projectId={props.projectId}
              taskId={props.taskId}
              taskTab={props.taskTab}
              token={props.token}
            />
            <TaskAttachmentsPanel
              projectId={props.projectId}
              taskId={props.taskId}
              taskTab={props.taskTab}
              token={props.token}
            />
          </>
        ) : null}
      </Stack>
    </Box>
  );
}
