import React, {
  useCallback,
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
import { taskJournalApi } from "../api/task-journal-api.js";
import { taskAttachmentsApi } from "../api/task-attachments-api.js";
import { taskCommentsApi } from "../api/task-comments-api.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import { DiscussionWorkspaceTabs } from "../components/discussion/DiscussionWorkspaceTabs.js";
import { DiscussionJournalSection } from "../components/discussion/DiscussionJournalSection.js";
import { TaskAttachmentsPanel } from "../components/tasks/TaskAttachmentsPanel.js";
import { TaskCommentsPanel } from "../components/tasks/TaskCommentsPanel.js";
import { TaskDetailsCard } from "../components/tasks/TaskDetailsCard.js";
import { TaskMarkdownRender, TASK_MARKDOWN_HELP_TEXT } from "../components/tasks/TaskMarkdownRender.js";
import type { TaskDetailTab } from "../contracts/route-query.contracts.js";
import { useGanttChartFileManager } from "../hooks/use-gantt-chart-file-manager.js";
import { useDiscussionItemCount } from "../hooks/use-discussion-item-count.js";
import { useProjectEditAccess } from "../hooks/use-project-edit-access.js";
import {
  parseProjectTaskDetailFromXml,
  type ParsedProjectTaskDetail,
} from "../lib/project-tasks-history-parser.js";
import {
  emitProjectManagerTaskDiscussionStateEvent,
  subscribeProjectManagerTaskDiscussionStateEvent,
} from "../lib/task-discussion-state-events.js";
import {
  TASK_ATTACHMENTS_SECTION_ANCHOR,
  TASK_JOURNAL_SECTION_ANCHOR,
} from "../lib/detail-section-anchor-routing.js";
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
const MISSING_TASK_JOURNAL_FILE_MESSAGE =
  "No task journal file exists yet for this task.";
const MISSING_TASK_MIRROR_MESSAGE =
  "No task journal exists yet because this task does not have a TaskMirror row yet.";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Task Detail";

function buildErrorMessage(error: unknown, fallback: string): string {
  return getApiErrorMessage(error, fallback);
}

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
  journalErrorMessage: string | null;
  journalExists: boolean;
  journalMarkdown: string | null;
  missingJournalStateMessage: string | null;
  onSaveJournal: (markdown: string) => Promise<void>;
  canEditProjectContent: boolean;
  isJournalLoading: boolean;
  isJournalSaving: boolean;
  isLoading: boolean;
  projectId: number | null;
  task: ParsedProjectTaskDetail | null;
  taskId: string | null;
  token: string;
}): React.ReactNode {
  const {
    errorMessage,
    journalErrorMessage,
    journalExists,
    journalMarkdown,
    missingJournalStateMessage,
    onSaveJournal,
    canEditProjectContent,
    isJournalLoading,
    isJournalSaving,
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
    <Stack spacing={2}>
      <TaskDetailsCard
        projectId={projectId}
        task={task}
        token={token}
      />
      <DiscussionJournalSection
        canEdit={canEditProjectContent}
        editorHelpText={TASK_MARKDOWN_HELP_TEXT}
        errorMessage={journalErrorMessage}
        isLoading={isJournalLoading}
        isSaving={isJournalSaving}
        journalExists={journalExists}
        markdown={journalMarkdown}
        missingStateMessage={missingJournalStateMessage}
        onSave={onSaveJournal}
        renderMarkdown={(markdown) => (
          <TaskMarkdownRender
            markdown={markdown}
            projectId={projectId}
            taskId={task.id}
            token={token}
          />
        )}
        sectionId={TASK_JOURNAL_SECTION_ANCHOR}
        title="Task Journal"
      />
    </Stack>
  );
}

export function ProjectManagerTaskPage(props: ProjectManagerTaskPageProps) {
  const navigate = useNavigate();
  const ganttRef = useRef<GanttChartHandle | null>(null);
  const [isTaskJournalLoading, setIsTaskJournalLoading] = React.useState(
    props.projectId !== null && props.taskId !== null,
  );
  const [isTaskJournalSaving, setIsTaskJournalSaving] = React.useState(false);
  const [taskJournalErrorMessage, setTaskJournalErrorMessage] = React.useState<string | null>(null);
  const [taskJournalExists, setTaskJournalExists] = React.useState(false);
  const [taskJournalMarkdown, setTaskJournalMarkdown] = React.useState<string | null>(null);
  const [taskMirrorExists, setTaskMirrorExists] = React.useState(false);
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
  const { canEdit: canEditProjectContent } = useProjectEditAccess({
    currentUserId: props.currentUserId,
    projectId: props.projectId,
    token: props.token,
  });
  const loadTaskCommentsCount = useCallback(async () => {
    const response = await taskCommentsApi.listComments(
      props.token,
      props.projectId!,
      props.taskId!,
    );
    return response.comments.length;
  }, [props.projectId, props.taskId, props.token]);
  const subscribeToTaskDiscussionCountChanges = useCallback(
    (handler: () => void) => subscribeProjectManagerTaskDiscussionStateEvent((detail) => {
      if (detail.projectId !== props.projectId || detail.taskId !== props.taskId) {
        return;
      }
      handler();
    }),
    [props.projectId, props.taskId],
  );
  const taskCommentsCount = useDiscussionItemCount({
    isEnabled: props.projectId !== null && props.taskId !== null,
    loadCount: loadTaskCommentsCount,
    subscribeToChanges: subscribeToTaskDiscussionCountChanges,
  });
  const loadTaskAttachmentsCount = useCallback(async () => {
    const response = await taskAttachmentsApi.listAttachments(
      props.token,
      props.projectId!,
      props.taskId!,
    );
    return response.attachments.length;
  }, [props.projectId, props.taskId, props.token]);
  const taskAttachmentsCount = useDiscussionItemCount({
    isEnabled: props.projectId !== null && props.taskId !== null,
    loadCount: loadTaskAttachmentsCount,
    subscribeToChanges: subscribeToTaskDiscussionCountChanges,
  });

  React.useEffect(() => {
    if (props.projectId === null || props.taskId === null) {
      setIsTaskJournalLoading(false);
      setTaskJournalErrorMessage(null);
      setTaskJournalExists(false);
      setTaskJournalMarkdown(null);
      setTaskMirrorExists(false);
      return;
    }

    let mounted = true;

    async function loadTaskJournal(): Promise<void> {
      setIsTaskJournalLoading(true);
      setTaskJournalErrorMessage(null);
      try {
        const response = await taskJournalApi.getJournal(
          props.token,
          props.projectId!,
          props.taskId!,
        );
        if (mounted) {
          setTaskJournalExists(response.journalExists);
          setTaskJournalMarkdown(response.markdown);
          setTaskMirrorExists(response.taskMirrorExists);
        }
      } catch (error) {
        if (mounted) {
          setTaskJournalErrorMessage(buildErrorMessage(error, "Unable to load the task journal."));
        }
      } finally {
        if (mounted) {
          setIsTaskJournalLoading(false);
        }
      }
    }

    void loadTaskJournal();

    return subscribeProjectManagerTaskDiscussionStateEvent((detail) => {
      if (detail.projectId !== props.projectId || detail.taskId !== props.taskId) {
        return;
      }
      void loadTaskJournal();
    });
  }, [props.projectId, props.taskId, props.token]);

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

  async function handleSaveTaskJournal(markdown: string): Promise<void> {
    if (props.projectId === null || props.taskId === null) {
      return;
    }

    setIsTaskJournalSaving(true);
    setTaskJournalErrorMessage(null);
    try {
      const response = await taskJournalApi.updateJournal(
        props.token,
        props.projectId,
        props.taskId,
        markdown,
      );
      setTaskJournalExists(response.journalExists);
      setTaskJournalMarkdown(response.markdown);
      setTaskMirrorExists(response.taskMirrorExists);
      emitProjectManagerTaskDiscussionStateEvent({
        projectId: props.projectId,
        taskId: props.taskId,
      });
    } catch (error) {
      setTaskJournalErrorMessage(buildErrorMessage(error, "Unable to save the task journal."));
      throw error;
    } finally {
      setIsTaskJournalSaving(false);
    }
  }

  const missingJournalStateMessage = !taskMirrorExists
    ? MISSING_TASK_MIRROR_MESSAGE
    : !taskJournalExists
      ? MISSING_TASK_JOURNAL_FILE_MESSAGE
      : null;

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
            attachmentsCount={taskAttachmentsCount.count}
            ariaLabel={TASK_DETAIL_WORKSPACE_TABLIST_LABEL}
            commentsCount={taskCommentsCount.count}
            onChange={handleTaskTabChange}
            value={props.taskTab}
          />
        ) : null}
        {props.taskTab === "details"
          ? renderDetailsTab({
            errorMessage: taskResolution.errorMessage,
            journalErrorMessage: taskJournalErrorMessage,
            journalExists: taskJournalExists,
            journalMarkdown: taskJournalMarkdown,
            missingJournalStateMessage,
            onSaveJournal: handleSaveTaskJournal,
            canEditProjectContent,
            isJournalLoading: isTaskJournalLoading,
            isJournalSaving: isTaskJournalSaving,
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
              canManageTaskDiscussion={canEditProjectContent}
              currentUserId={props.currentUserId}
              highlightCommentId={props.commentId}
              onNavigateToComment={navigateToCommentAnchor}
              projectId={props.projectId}
              taskId={props.taskId}
              taskTab={props.taskTab}
              token={props.token}
            />
        <TaskAttachmentsPanel
          canManageAttachments={canEditProjectContent}
          projectId={props.projectId}
          sectionId={TASK_ATTACHMENTS_SECTION_ANCHOR}
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
