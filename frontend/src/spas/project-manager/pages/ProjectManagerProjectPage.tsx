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
import { useNavigate } from "react-router-dom";
import { ProjectDeleteButton } from "../../../common/components/entity-actions/ProjectDeleteButton.js";
import { ProjectEditButton } from "../../../common/components/entity-actions/ProjectEditButton.js";
import { ProjectViewButton } from "../../../common/components/entity-actions/ProjectViewButton.js";
import { ProjectListItem } from "../../../common/components/entity-list/ProjectListItem.js";
import type { EntityListItemViewMode } from "../../../common/components/entity-list/entity-list-item.types.js";
import { isApiError } from "../../../common/api/api-error.js";
import { lobbyApi } from "../../../lobby/api/lobby-api.js";
import type {
  GetProjectResponse,
  LobbyProject,
  UpdateProjectRequest,
} from "../../../lobby/contracts/lobby.contracts.js";
import { ProjectEditModal } from "../../../lobby/components/project/ProjectEditModal.js";
import { ProjectSummaryModal } from "../../../lobby/components/project/ProjectSummaryModal.js";
import { GanttChart } from "../components/GanttChart.js";
import { GanttChartControlPanel } from "../components/GanttChartControlPanel.js";
import { ProjectDetailsCard } from "../components/projects/ProjectDetailsCard.js";
import { getRepoGanttChartSource } from "../data/repo-gantt-chart-source.js";
import type { GanttDisplayMode } from "../models/gantt-display-mode.js";
import type { ProjectViewMode } from "../models/project-view-mode.js";

interface ProjectManagerProjectPageProps {
  projectId: number | null;
  token: string;
  viewMode: ProjectViewMode;
}

const DETAIL_VIEW_LABEL = "Detail";
const DEFAULT_DISPLAY_MODE: GanttDisplayMode = "both";
const DEFAULT_ERROR_MESSAGE = "Unable to load that project right now.";
const GANTT_VIEW_LABEL = "Gantt";
const LIST_ITEM_VIEW_MODE: EntityListItemViewMode = "main-listing-view";
const MISSING_CHART_MESSAGE = "No gantt chart file exists for this project yet.";
const MISSING_ROUTE_MESSAGE = "Provide a valid projectId to view a project.";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Project";
const PROJECT_DELETE_ERROR_MESSAGE = "Unable to delete that project.";

function buildErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error) && error.responseBody) {
    return error.responseBody;
  }

  return fallback;
}

function createSelectedProjectLabel(projectId: number | null): string {
  return projectId === null ? "None" : `${projectId}`;
}

function createProjectEntity(response: GetProjectResponse): LobbyProject {
  return response.project;
}

function createProjectRoute(projectId: number, viewMode: ProjectViewMode): string {
  return `/pm/project?projectId=${projectId}&view=${viewMode}`;
}

export function ProjectManagerProjectPage(props: ProjectManagerProjectPageProps) {
  const navigate = useNavigate();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<GanttDisplayMode>(DEFAULT_DISPLAY_MODE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isControlPanelExpanded, setIsControlPanelExpanded] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(props.projectId !== null);
  const [projectResponse, setProjectResponse] = useState<GetProjectResponse | null>(null);
  const [projectSummaryRefreshKey, setProjectSummaryRefreshKey] = useState(0);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  const chartSource = useMemo(
    () => getRepoGanttChartSource(props.projectId),
    [props.projectId],
  );
  const project = projectResponse ? createProjectEntity(projectResponse) : null;

  useEffect(() => {
    if (props.projectId === null) {
      setProjectResponse(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadProject(): Promise<void> {
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const response = await lobbyApi.getProject(props.token, props.projectId!);
        if (isMounted) {
          setProjectResponse(response);
        }
      } catch (error) {
        if (isMounted) {
          setProjectResponse(null);
          setErrorMessage(buildErrorMessage(error, DEFAULT_ERROR_MESSAGE));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProject();

    return () => {
      isMounted = false;
    };
  }, [props.projectId, props.token, projectSummaryRefreshKey]);

  function navigateToIssues(): void {
    if (props.projectId === null) {
      navigate("/pm/issues");
      return;
    }

    navigate(`/pm/issues?projectId=${props.projectId}`);
  }

  function navigateToProjectView(viewMode: ProjectViewMode): void {
    if (props.projectId === null) {
      return;
    }

    navigate(createProjectRoute(props.projectId, viewMode));
  }

  function toggleControlPanelExpanded(): void {
    setIsControlPanelExpanded((current) => !current);
  }

  async function handleUpdateProject(
    projectId: number,
    payload: UpdateProjectRequest,
  ): Promise<LobbyProject> {
    setBusyKey(`project:${projectId}`);
    try {
      const response = await lobbyApi.updateProject(props.token, projectId, payload);
      setProjectResponse((current) => (
        current
          ? {
              ...current,
              project: response.project,
            }
          : current
      ));
      setProjectSummaryRefreshKey((current) => current + 1);
      return response.project;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteProject(projectId: number): Promise<void> {
    setBusyKey(`project:${projectId}`);
    setErrorMessage(null);

    try {
      await lobbyApi.deleteProject(props.token, projectId);
      navigateToIssues();
    } catch (error) {
      setErrorMessage(buildErrorMessage(error, PROJECT_DELETE_ERROR_MESSAGE));
    } finally {
      setBusyKey(null);
    }
  }

  function renderProjectContent() {
    if (props.projectId === null) {
      return <Alert severity="info">{MISSING_ROUTE_MESSAGE}</Alert>;
    }

    if (isLoading) {
      return (
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <CircularProgress size={20} />
          <Typography>Loading project...</Typography>
        </Stack>
      );
    }

    if (!projectResponse || !project) {
      return <Alert severity="error">{errorMessage ?? DEFAULT_ERROR_MESSAGE}</Alert>;
    }

    if (props.viewMode === "gantt") {
      if (chartSource === null) {
        return <Alert severity="info">{MISSING_CHART_MESSAGE}</Alert>;
      }

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
          <GanttChart chartSource={chartSource} displayMode={displayMode} />
          <GanttChartControlPanel
            displayMode={displayMode}
            isExpanded={isControlPanelExpanded}
            onDisplayModeChange={setDisplayMode}
            onToggleExpanded={toggleControlPanelExpanded}
          />
        </Box>
      );
    }

    return <ProjectDetailsCard projectResponse={projectResponse} />;
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
          <Typography component="h1" variant="h3">
            {PAGE_TITLE}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Selected project: {createSelectedProjectLabel(props.projectId)}
          </Typography>
        </Stack>
        {project ? (
          <ProjectListItem
            actionContent={(
              <>
                <ProjectViewButton
                  disabled={busyKey === `project:${project.id}`}
                  onClick={() => setIsSummaryModalOpen(true)}
                />
                <ProjectEditButton
                  disabled={busyKey === `project:${project.id}`}
                  onClick={() => setIsEditModalOpen(true)}
                />
                <ProjectDeleteButton
                  disabled={busyKey === `project:${project.id}`}
                  onClick={() => void handleDeleteProject(project.id)}
                />
              </>
            )}
            onNavigate={() => navigateToProjectView("detail")}
            project={project}
            viewMode={LIST_ITEM_VIEW_MODE}
          />
        ) : null}
        <Stack direction={{ sm: "row", xs: "column" }} justifyContent="space-between" spacing={1.5}>
          <Tabs
            onChange={(_event, nextValue: ProjectViewMode) => navigateToProjectView(nextValue)}
            value={props.viewMode}
          >
            <Tab label={DETAIL_VIEW_LABEL} value="detail" />
            <Tab label={GANTT_VIEW_LABEL} value="gantt" />
          </Tabs>
          <Typography color="text.secondary" sx={{ alignSelf: { sm: "center", xs: "flex-start" } }} variant="body2">
            {props.viewMode === "detail" ? "Project entity detail view" : "Project gantt view"}
          </Typography>
        </Stack>
        {errorMessage && project ? <Alert severity="error">{errorMessage}</Alert> : null}
        {renderProjectContent()}
      </Stack>
      <ProjectEditModal
        isBusy={project !== null && busyKey === `project:${project.id}`}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdate={handleUpdateProject}
        project={project}
      />
      <ProjectSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        projectId={props.projectId}
        refreshKey={projectSummaryRefreshKey}
        token={props.token}
      />
    </Box>
  );
}
