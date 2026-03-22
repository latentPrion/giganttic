import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import type { GetProjectResponse } from "../../../lobby/contracts/lobby.contracts.js";
import { GanttChart } from "../components/GanttChart.js";
import { GanttChartControlPanel } from "../components/GanttChartControlPanel.js";
import { GanttDownloadSplitButton } from "../components/GanttDownloadSplitButton.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import { useGanttChartFileManager } from "../hooks/use-gantt-chart-file-manager.js";
import { canEditProject } from "../lib/project-edit-permissions.js";
import type {
  GanttChartHandle,
  GanttTaskId,
} from "../models/gantt-chart-handle.js";
import type { GanttChartSource } from "../models/gantt-chart-source.js";
import type { GanttDisplayMode } from "../models/gantt-display-mode.js";

interface ProjectManagerGanttPageProps {
  currentUserId?: number;
  currentUserRoles?: string[];
  projectId: number | null;
  token: string;
}

const DEFAULT_DISPLAY_MODE: GanttDisplayMode = "both";
const LOADING_MESSAGE = "Loading gantt chart...";
const MISSING_CHART_MESSAGE = "No gantt chart exists for this project yet.";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Project Manager Gantt";
const SELECT_PROJECT_MESSAGE = "Select a valid project to view its gantt chart.";
const UNSAVED_CHANGES_LABEL = "Unsaved changes";
const ADD_CHILD_TASK_LABEL = "Add Child Task";
const ADD_TASK_LABEL = "Add Task";
const DELETE_SELECTED_LABEL = "Delete Selected";
const EDIT_SELECTED_LABEL = "Edit Selected";

function createSelectedProjectLabel(projectId: number | null): string {
  return projectId === null ? "None" : `${projectId}`;
}

function renderEditorActionButtons(
  chartSource: GanttChartSource | null,
  isLoading: boolean,
  isPersisting: boolean,
  isTaskSelected: boolean,
  onAddChildTask: () => void,
  onAddTask: () => void,
  onDeleteSelectedTask: () => void,
  onEditSelectedTask: () => void,
) {
  if (chartSource === null) {
    return null;
  }

  return (
    <>
      <Button
        disabled={isLoading || isPersisting}
        onClick={() => {
          onAddTask();
        }}
        size="small"
        variant="outlined"
      >
        {ADD_TASK_LABEL}
      </Button>
      <Button
        disabled={isLoading || isPersisting || !isTaskSelected}
        onClick={() => {
          onAddChildTask();
        }}
        size="small"
        variant="outlined"
      >
        {ADD_CHILD_TASK_LABEL}
      </Button>
      <Button
        disabled={isLoading || isPersisting || !isTaskSelected}
        onClick={() => {
          onEditSelectedTask();
        }}
        size="small"
        variant="outlined"
      >
        {EDIT_SELECTED_LABEL}
      </Button>
      <Button
        color="error"
        disabled={isLoading || isPersisting || !isTaskSelected}
        onClick={() => {
          onDeleteSelectedTask();
        }}
        size="small"
        variant="outlined"
      >
        {DELETE_SELECTED_LABEL}
      </Button>
    </>
  );
}

function renderPersistenceActions(
  hasServerChart: boolean,
  isDirty: boolean,
  isLoading: boolean,
  isPersisting: boolean,
  onPersist: () => void,
) {
  return (
    <Stack
      alignItems={{ xs: "stretch", sm: "center" }}
      direction={{ xs: "column", sm: "row" }}
      justifyContent="flex-end"
      spacing={1}
      sx={{ width: "100%" }}
    >
      {isDirty && (
        <Chip
          color="warning"
          label={UNSAVED_CHANGES_LABEL}
          size="small"
          sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
          variant="outlined"
        />
      )}
      <Button
        disabled={isPersisting || isLoading}
        onClick={() => {
          void onPersist();
        }}
        size="small"
        sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
        variant="contained"
      >
        {hasServerChart ? "Save" : "Create"}
      </Button>
    </Stack>
  );
}

function renderGanttContainer(
  chartRef: React.RefObject<GanttChartHandle | null>,
  canEdit: boolean,
  chartSource: GanttChartSource,
  displayMode: GanttDisplayMode,
  isControlPanelExpanded: boolean,
  onBaselineReady: (serializedXml: string) => void,
  onDisplayModeChange: (nextValue: GanttDisplayMode) => void,
  onEditorChange: () => void,
  onSelectionChange: (selectedTaskId: GanttTaskId | null) => void,
  onToggleExpanded: () => void,
) {
  return (
    <Box
      sx={{
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: 3,
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: "70dvh",
        overflow: "hidden",
      }}
    >
      <GanttChart
        ref={chartRef}
        chartSource={chartSource}
        displayMode={displayMode}
        interactionsEnabled={canEdit}
        onBaselineReady={onBaselineReady}
        onEditorChange={onEditorChange}
        onSelectionChange={onSelectionChange}
      />
      <GanttChartControlPanel
        displayMode={displayMode}
        isExpanded={isControlPanelExpanded}
        onDisplayModeChange={onDisplayModeChange}
        onToggleExpanded={onToggleExpanded}
      />
    </Box>
  );
}

function renderNavigationActions(
  chartSource: GanttChartSource | null,
  canEdit: boolean,
  hasServerChart: boolean,
  isDirty: boolean,
  isLoading: boolean,
  isPersisting: boolean,
  isTaskSelected: boolean,
  onAddChildTask: () => void,
  onAddTask: () => void,
  onDeleteSelectedTask: () => void,
  onEditSelectedTask: () => void,
  onPersist: () => void,
  projectId: number | null,
  token: string,
) {
  if (projectId === null) {
    return undefined;
  }

  return (
    <Stack spacing={1} sx={{ minWidth: 0, width: { xs: "100%", md: "auto" } }}>
      <Stack alignItems="center" direction="row" flexWrap="wrap" spacing={1}>
        <GanttDownloadSplitButton
          chartSource={chartSource}
          isLoadingChart={isLoading}
          projectId={projectId}
          token={token}
        />
        {canEdit && renderEditorActionButtons(
          chartSource,
          isLoading,
          isPersisting,
          isTaskSelected,
          onAddChildTask,
          onAddTask,
          onDeleteSelectedTask,
          onEditSelectedTask,
        )}
      </Stack>
      {canEdit && renderPersistenceActions(
        hasServerChart,
        isDirty,
        isLoading,
        isPersisting,
        onPersist,
      )}
    </Stack>
  );
}

export function ProjectManagerGanttPage(props: ProjectManagerGanttPageProps) {
  const [displayMode, setDisplayMode] = useState<GanttDisplayMode>(DEFAULT_DISPLAY_MODE);
  const [isControlPanelExpanded, setIsControlPanelExpanded] = useState(true);
  const [projectResponse, setProjectResponse] = useState<GetProjectResponse | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<GanttTaskId | null>(null);
  const ganttRef = useRef<GanttChartHandle | null>(null);

  const fileManager = useGanttChartFileManager({
    ganttRef,
    projectId: props.projectId,
    token: props.token,
  });

  const {
    chartSource,
    clearPersistError,
    hasServerChart,
    isDirty,
    isLoading,
    isPersisting,
    loadErrorMessage,
    persistChart,
    persistErrorMessage,
    setDirtyFromEditor,
    setInitialBaseline,
  } = fileManager;

  useEffect(() => {
    const { projectId, token } = props;

    if (projectId === null) {
      setProjectResponse(null);
      return;
    }

    let isMounted = true;

    async function loadProject(): Promise<void> {
      try {
        const response = await lobbyApi.getProject(token, projectId);
        if (isMounted) {
          setProjectResponse(response);
        }
      } catch {
        if (isMounted) {
          setProjectResponse(null);
        }
      }
    }

    void loadProject();

    return () => {
      isMounted = false;
    };
  }, [props.projectId, props.token]);

  const onBaselineReady = useCallback(
    (serializedXml: string) => {
      setInitialBaseline(serializedXml);
    },
    [setInitialBaseline],
  );

  const onEditorChange = useCallback(() => {
    setDirtyFromEditor();
  }, [setDirtyFromEditor]);

  const onSelectionChange = useCallback((nextSelectedTaskId: GanttTaskId | null) => {
    setSelectedTaskId(nextSelectedTaskId);
  }, []);

  const canEdit = canEditProject(
    props.currentUserId,
    props.currentUserRoles,
    projectResponse,
  );

  function toggleControlPanelExpanded(): void {
    setIsControlPanelExpanded((current) => !current);
  }

  function addChildTask(): void {
    ganttRef.current?.addChildTask();
  }

  function addTask(): void {
    ganttRef.current?.addRootTask();
  }

  function deleteSelectedTask(): void {
    ganttRef.current?.deleteSelectedTask();
  }

  function editSelectedTask(): void {
    ganttRef.current?.editSelectedTask();
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
            actions={renderNavigationActions(
              chartSource,
              canEdit,
              hasServerChart,
              isDirty,
              isLoading,
              isPersisting,
              selectedTaskId !== null,
              addChildTask,
              addTask,
              deleteSelectedTask,
              editSelectedTask,
              persistChart,
              props.projectId,
              props.token,
            )}
            currentSection="gantt"
            projectId={props.projectId}
          />
          <Typography component="h1" variant="h3">
            {PAGE_TITLE}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Selected project: {createSelectedProjectLabel(props.projectId)}
          </Typography>
        </Stack>
        {isLoading && (
          <Stack alignItems="center" direction="row" spacing={1.5}>
            <CircularProgress size={20} />
            <Typography>{LOADING_MESSAGE}</Typography>
          </Stack>
        )}
        {!isLoading && loadErrorMessage && (
          <Alert severity="error">{loadErrorMessage}</Alert>
        )}
        {!isLoading && !loadErrorMessage && props.projectId === null && (
          <Alert severity="info">{SELECT_PROJECT_MESSAGE}</Alert>
        )}
        {!isLoading && !loadErrorMessage && persistErrorMessage && (
          <Alert onClose={() => clearPersistError()} severity="error">
            {persistErrorMessage}
          </Alert>
        )}
        {!isLoading && !loadErrorMessage && props.projectId !== null && chartSource === null && (
          <Alert severity="info">{MISSING_CHART_MESSAGE}</Alert>
        )}
        {!isLoading && !loadErrorMessage && chartSource && (
          renderGanttContainer(
            ganttRef,
            canEdit,
            chartSource,
            displayMode,
            isControlPanelExpanded,
            onBaselineReady,
            setDisplayMode,
            onEditorChange,
            onSelectionChange,
            toggleControlPanelExpanded,
          )
        )}
      </Stack>
    </Box>
  );
}
