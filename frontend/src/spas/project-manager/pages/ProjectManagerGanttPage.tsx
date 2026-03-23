import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";

import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import type { GetProjectResponse } from "../../../lobby/contracts/lobby.contracts.js";
import { GanttChart } from "../components/GanttChart.js";
import {
  GanttControlActionMenu,
  type GanttControlActionMenuItem,
} from "../components/GanttControlActionMenu.js";
import { GanttChartControlPanel } from "../components/GanttChartControlPanel.js";
import { GanttDownloadSplitButton } from "../components/GanttDownloadSplitButton.js";
import { GanttSaveSplitButton } from "../components/GanttSaveSplitButton.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import {
  type PersistChartResult,
  useGanttChartFileManager,
} from "../hooks/use-gantt-chart-file-manager.js";
import { type GgtcTaskExtensionMissingAttributeReport } from "../lib/ggtc-dhtmlx-gantt-extensions-manager.js";
import { canEditProject } from "../lib/project-edit-permissions.js";
import type {
  GanttChartHandle,
  GanttSelectedTask,
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
const REFRESH_CANCEL_LABEL = "Cancel";
const REFRESH_CONFIRM_LABEL = "Refresh";
const REFRESH_CONFIRMATION_MESSAGE = "Refreshing discards all unsaved changes and resets the current frontend and UI state to the chart reloaded from the backend.";
const REFRESH_CONFIRMATION_TITLE = "Refresh chart from backend?";
const SAVE_EXTENSION_WARNING_BODY = "Some tasks are missing required GGTC extension attributes. This should not happen if frontend listeners are working correctly. Please report this to the developers as a bug.";
const SAVE_EXTENSION_WARNING_CONTINUE = "The chart was still saved successfully.";
const SAVE_EXTENSION_WARNING_TITLE = "Saved with extension attribute gaps";
const SELECT_PROJECT_MESSAGE = "Select a valid project to view its gantt chart.";
const ADD_CHILD_MILESTONE_LABEL = "Add Child Milestone";
const ADD_CHILD_TASK_LABEL = "Add Child Task";
const ADD_MILESTONE_LABEL = "Add Milestone";
const ADD_TASK_LABEL = "Add Task";
const CONVERT_SELECTED_MILESTONE_LABEL = "Convert Selected Milestone to Task";
const CONVERT_SELECTED_TASK_LABEL = "Convert Selected Task to Milestone";
const DELETE_SELECTED_MILESTONE_LABEL = "Delete Selected Milestone";
const DELETE_SELECTED_TASK_LABEL = "Delete Selected Task";
const EDIT_SELECTED_MILESTONE_LABEL = "Edit Selected Milestone";
const EDIT_SELECTED_TASK_LABEL = "Edit Selected Task";
const MILESTONE_ACTIONS_LABEL = "Milestone actions";
const TASK_ACTIONS_LABEL = "Task actions";

function createSelectedProjectLabel(projectId: number | null): string {
  return projectId === null ? "None" : `${projectId}`;
}

function createMissingAttributeLabel(
  report: GgtcTaskExtensionMissingAttributeReport,
): string {
  return `Task ${report.taskId}: ${report.missingAttributes.join(", ")}`;
}

function isMilestoneSelected(selectedTask: GanttSelectedTask | null): boolean {
  return selectedTask?.type === "milestone";
}

function isTaskSelected(selectedTask: GanttSelectedTask | null): boolean {
  return selectedTask !== null && selectedTask.type !== "milestone";
}

function canAddChildUnderSelection(selectedTask: GanttSelectedTask | null): boolean {
  return selectedTask !== null && selectedTask.type !== "milestone";
}

function createTaskActionItems(
  chartSource: GanttChartSource | null,
  isLoading: boolean,
  isPersisting: boolean,
  selectedTask: GanttSelectedTask | null,
  onAddChildTask: () => void,
  onAddTask: () => void,
  onDeleteSelectedTask: () => void,
  onEditSelectedTask: () => void,
): GanttControlActionMenuItem[] {
  const isBusy = isLoading || isPersisting || chartSource === null;
  return [
    {
      disabled: isBusy,
      label: ADD_TASK_LABEL,
      onClick: onAddTask,
    },
    {
      disabled: isBusy || !canAddChildUnderSelection(selectedTask),
      label: ADD_CHILD_TASK_LABEL,
      onClick: onAddChildTask,
    },
    {
      disabled: isBusy || !isTaskSelected(selectedTask),
      label: EDIT_SELECTED_TASK_LABEL,
      onClick: onEditSelectedTask,
    },
    {
      color: "error",
      disabled: isBusy || !isTaskSelected(selectedTask),
      label: DELETE_SELECTED_TASK_LABEL,
      onClick: onDeleteSelectedTask,
    },
  ];
}

function createMilestoneActionItems(
  chartSource: GanttChartSource | null,
  isLoading: boolean,
  isPersisting: boolean,
  selectedTask: GanttSelectedTask | null,
  onAddChildMilestone: () => void,
  onAddMilestone: () => void,
  onConvertSelectedMilestoneToTask: () => void,
  onConvertSelectedTaskToMilestone: () => void,
  onDeleteSelectedMilestone: () => void,
  onEditSelectedMilestone: () => void,
): GanttControlActionMenuItem[] {
  const isBusy = isLoading || isPersisting || chartSource === null;
  return [
    {
      disabled: isBusy,
      label: ADD_MILESTONE_LABEL,
      onClick: onAddMilestone,
    },
    {
      disabled: isBusy || !canAddChildUnderSelection(selectedTask),
      label: ADD_CHILD_MILESTONE_LABEL,
      onClick: onAddChildMilestone,
    },
    {
      disabled: isBusy || !isMilestoneSelected(selectedTask),
      label: EDIT_SELECTED_MILESTONE_LABEL,
      onClick: onEditSelectedMilestone,
    },
    {
      color: "error",
      disabled: isBusy || !isMilestoneSelected(selectedTask),
      label: DELETE_SELECTED_MILESTONE_LABEL,
      onClick: onDeleteSelectedMilestone,
    },
    {
      disabled: isBusy || !isTaskSelected(selectedTask),
      label: CONVERT_SELECTED_TASK_LABEL,
      onClick: onConvertSelectedTaskToMilestone,
    },
    {
      disabled: isBusy || !isMilestoneSelected(selectedTask),
      label: CONVERT_SELECTED_MILESTONE_LABEL,
      onClick: onConvertSelectedMilestoneToTask,
    },
  ];
}

function renderPersistenceActions(
  hasServerChart: boolean,
  isLoading: boolean,
  isPersisting: boolean,
  onPersist: () => Promise<void>,
  onRefresh: () => void,
  showSavedState: boolean,
  isDirty: boolean,
) {
  return (
    <GanttSaveSplitButton
      hasServerChart={hasServerChart}
      isDirty={isDirty}
      isLoading={isLoading}
      isPersisting={isPersisting}
      onRefreshClick={onRefresh}
      onSaveClick={onPersist}
      showSavedState={showSavedState}
    />
  );
}

function renderBottomControlActions(
  canEdit: boolean,
  chartSource: GanttChartSource | null,
  hasServerChart: boolean,
  isDirty: boolean,
  isLoading: boolean,
  isPersisting: boolean,
  onAddChildMilestone: () => void,
  onAddChildTask: () => void,
  onAddMilestone: () => void,
  onAddTask: () => void,
  onConvertSelectedMilestoneToTask: () => void,
  onConvertSelectedTaskToMilestone: () => void,
  onDeleteSelectedMilestone: () => void,
  onDeleteSelectedTask: () => void,
  onEditSelectedMilestone: () => void,
  onEditSelectedTask: () => void,
  onPersist: () => Promise<void>,
  onRefresh: () => void,
  projectId: number,
  selectedTask: GanttSelectedTask | null,
  showSavedState: boolean,
  token: string,
) {
  const taskActionItems = createTaskActionItems(
    chartSource,
    isLoading,
    isPersisting,
    selectedTask,
    onAddChildTask,
    onAddTask,
    onDeleteSelectedTask,
    onEditSelectedTask,
  );
  const milestoneActionItems = createMilestoneActionItems(
    chartSource,
    isLoading,
    isPersisting,
    selectedTask,
    onAddChildMilestone,
    onAddMilestone,
    onConvertSelectedMilestoneToTask,
    onConvertSelectedTaskToMilestone,
    onDeleteSelectedMilestone,
    onEditSelectedMilestone,
  );

  return (
    <>
      <GanttDownloadSplitButton
        chartSource={chartSource}
        isLoadingChart={isLoading}
        projectId={projectId}
        token={token}
      />
      {canEdit ? (
        <>
          <GanttControlActionMenu buttonLabel={TASK_ACTIONS_LABEL} items={taskActionItems} />
          <GanttControlActionMenu
            buttonLabel={MILESTONE_ACTIONS_LABEL}
            items={milestoneActionItems}
          />
          {renderPersistenceActions(
            hasServerChart,
            isLoading,
            isPersisting,
            onPersist,
            onRefresh,
            showSavedState,
            isDirty,
          )}
        </>
      ) : null}
    </>
  );
}

function renderGanttWorkspace(
  chartRef: React.RefObject<GanttChartHandle | null>,
  canEdit: boolean,
  chartSource: GanttChartSource | null,
  displayMode: GanttDisplayMode,
  hasServerChart: boolean,
  isControlPanelExpanded: boolean,
  isDirty: boolean,
  isLoading: boolean,
  isPersisting: boolean,
  onBaselineReady: (serializedXml: string) => void,
  onAddChildMilestone: () => void,
  onAddChildTask: () => void,
  onAddMilestone: () => void,
  onAddTask: () => void,
  onConvertSelectedMilestoneToTask: () => void,
  onConvertSelectedTaskToMilestone: () => void,
  onDeleteSelectedMilestone: () => void,
  onDeleteSelectedTask: () => void,
  onDisplayModeChange: (nextValue: GanttDisplayMode) => void,
  onEditSelectedMilestone: () => void,
  onEditSelectedTask: () => void,
  onEditorChange: () => void,
  onPersist: () => Promise<void>,
  onRefresh: () => void,
  onSelectionChange: (selectedTask: GanttSelectedTask | null) => void,
  onToggleExpanded: () => void,
  projectId: number,
  selectedTask: GanttSelectedTask | null,
  showSavedState: boolean,
  token: string,
) {
  return (
    <Box
      sx={{
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: 3,
        display: "flex",
        flex: 1,
        flexDirection: "column",
        minHeight: chartSource ? "70dvh" : undefined,
        overflow: "hidden",
      }}
    >
      {chartSource ? (
        <GanttChart
          ref={chartRef}
          chartSource={chartSource}
          displayMode={displayMode}
          interactionsEnabled={canEdit}
          onBaselineReady={onBaselineReady}
          onEditorChange={onEditorChange}
          onSelectionChange={onSelectionChange}
        />
      ) : null}
      <GanttChartControlPanel
        actions={renderBottomControlActions(
          canEdit,
          chartSource,
          hasServerChart,
          isDirty,
          isLoading,
          isPersisting,
          onAddChildMilestone,
          onAddChildTask,
          onAddMilestone,
          onAddTask,
          onConvertSelectedMilestoneToTask,
          onConvertSelectedTaskToMilestone,
          onDeleteSelectedMilestone,
          onDeleteSelectedTask,
          onEditSelectedMilestone,
          onEditSelectedTask,
          onPersist,
          onRefresh,
          projectId,
          selectedTask,
          showSavedState,
          token,
        )}
        displayMode={displayMode}
        hasChart={chartSource !== null}
        isExpanded={isControlPanelExpanded}
        onDisplayModeChange={onDisplayModeChange}
        onToggleExpanded={onToggleExpanded}
      />
    </Box>
  );
}

export function ProjectManagerGanttPage(props: ProjectManagerGanttPageProps) {
  const [displayMode, setDisplayMode] = useState<GanttDisplayMode>(DEFAULT_DISPLAY_MODE);
  const [isControlPanelExpanded, setIsControlPanelExpanded] = useState(true);
  const [isRefreshConfirmOpen, setIsRefreshConfirmOpen] = useState(false);
  const [projectResponse, setProjectResponse] = useState<GetProjectResponse | null>(null);
  const [showSavedState, setShowSavedState] = useState(false);
  const [saveExtensionWarningReports, setSaveExtensionWarningReports] = useState<
    GgtcTaskExtensionMissingAttributeReport[]
  >([]);
  const [isSaveExtensionWarningOpen, setIsSaveExtensionWarningOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<GanttSelectedTask | null>(null);
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
    reloadChart,
    setDirtyFromEditor,
    setInitialBaseline,
  } = fileManager;

  useEffect(() => {
    const { projectId, token } = props;

    if (projectId === null) {
      setProjectResponse(null);
      return;
    }

    const projectIdForRequest = projectId;
    let isMounted = true;

    async function loadProject(): Promise<void> {
      try {
        const response = await lobbyApi.getProject(token, projectIdForRequest);
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
    setShowSavedState(false);
    setDirtyFromEditor();
  }, [setDirtyFromEditor]);

  const onSelectionChange = useCallback((nextSelectedTask: GanttSelectedTask | null) => {
    setSelectedTask(nextSelectedTask);
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

  function addChildMilestone(): void {
    ganttRef.current?.addChildMilestone();
  }

  function addMilestone(): void {
    ganttRef.current?.addRootMilestone();
  }

  function addTask(): void {
    ganttRef.current?.addRootTask();
  }

  function convertSelectedMilestoneToTask(): void {
    ganttRef.current?.convertSelectedMilestoneToTask();
  }

  function convertSelectedTaskToMilestone(): void {
    ganttRef.current?.convertSelectedTaskToMilestone();
  }

  function deleteSelectedMilestone(): void {
    ganttRef.current?.deleteSelectedTask();
  }

  function deleteSelectedTask(): void {
    ganttRef.current?.deleteSelectedTask();
  }

  function editSelectedMilestone(): void {
    ganttRef.current?.editSelectedTask();
  }

  function editSelectedTask(): void {
    ganttRef.current?.editSelectedTask();
  }

  function shouldOpenSaveExtensionWarning(result: PersistChartResult): boolean {
    return result.didPersist && result.missingExtensionAttributeReports.length > 0;
  }

  function closeSaveExtensionWarningDialog(): void {
    setIsSaveExtensionWarningOpen(false);
  }

  async function persistCurrentChart(): Promise<void> {
    const persistResult = await persistChart();
    setShowSavedState(persistResult.didPersist);
    setSaveExtensionWarningReports(persistResult.missingExtensionAttributeReports);
    setIsSaveExtensionWarningOpen(shouldOpenSaveExtensionWarning(persistResult));
  }

  function requestRefresh(): void {
    setIsRefreshConfirmOpen(true);
  }

  function closeRefreshDialog(): void {
    setIsRefreshConfirmOpen(false);
  }

  async function confirmRefresh(): Promise<void> {
    setIsRefreshConfirmOpen(false);
    setDisplayMode(DEFAULT_DISPLAY_MODE);
    setIsControlPanelExpanded(true);
    setSelectedTask(null);
    setShowSavedState(false);
    await reloadChart();
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
        {!isLoading && !loadErrorMessage && props.projectId !== null && (
          renderGanttWorkspace(
            ganttRef,
            canEdit,
            chartSource,
            displayMode,
            hasServerChart,
            isControlPanelExpanded,
            isDirty,
            isLoading,
            isPersisting,
            onBaselineReady,
            addChildMilestone,
            addChildTask,
            addMilestone,
            addTask,
            convertSelectedMilestoneToTask,
            convertSelectedTaskToMilestone,
            deleteSelectedMilestone,
            deleteSelectedTask,
            setDisplayMode,
            editSelectedMilestone,
            editSelectedTask,
            onEditorChange,
            persistCurrentChart,
            requestRefresh,
            onSelectionChange,
            toggleControlPanelExpanded,
            props.projectId,
            selectedTask,
            showSavedState,
            props.token,
          )
        )}
        <Dialog onClose={closeRefreshDialog} open={isRefreshConfirmOpen}>
          <DialogTitle>{REFRESH_CONFIRMATION_TITLE}</DialogTitle>
          <DialogContent>
            <DialogContentText>{REFRESH_CONFIRMATION_MESSAGE}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeRefreshDialog} type="button">
              {REFRESH_CANCEL_LABEL}
            </Button>
            <Button
              color="warning"
              onClick={() => {
                void confirmRefresh();
              }}
              type="button"
              variant="contained"
            >
              {REFRESH_CONFIRM_LABEL}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog onClose={closeSaveExtensionWarningDialog} open={isSaveExtensionWarningOpen}>
          <DialogTitle>{SAVE_EXTENSION_WARNING_TITLE}</DialogTitle>
          <DialogContent>
            <Stack spacing={1.25}>
              <DialogContentText>{SAVE_EXTENSION_WARNING_BODY}</DialogContentText>
              <DialogContentText>{SAVE_EXTENSION_WARNING_CONTINUE}</DialogContentText>
              <Box component="ul" sx={{ margin: 0, paddingLeft: 2.5 }}>
                {saveExtensionWarningReports.map((report) => (
                  <Box component="li" key={`${report.taskId}-${report.missingAttributes.join("|")}`}>
                    <Typography variant="body2">
                      {createMissingAttributeLabel(report)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeSaveExtensionWarningDialog} type="button" variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Box>
  );
}
