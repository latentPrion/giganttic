import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

import {
  getApiErrorMessage,
  isApiError,
} from "../../../common/api/api-error.js";
import { GanttChart } from "../components/GanttChart.js";
import { GanttChartControlPanel } from "../components/GanttChartControlPanel.js";
import { ganttApi } from "../api/gantt-api.js";
import { ProjectManagerProjectNavigation } from "../components/ProjectManagerProjectNavigation.js";
import type { GanttChartSource } from "../models/gantt-chart-source.js";
import type { GanttDisplayMode } from "../models/gantt-display-mode.js";

interface ProjectManagerGanttPageProps {
  projectId: number | null;
  token: string;
}

const DEFAULT_DISPLAY_MODE: GanttDisplayMode = "both";
const DEFAULT_ERROR_MESSAGE = "Unable to load that gantt chart right now.";
const LOADING_MESSAGE = "Loading gantt chart...";
const MISSING_CHART_MESSAGE = "No gantt chart file exists for this project yet.";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Project Manager Gantt";
const SAMPLE_PROJECT_LABEL = "Sample chart";

function createSelectedProjectLabel(projectId: number | null): string {
  return projectId === null ? SAMPLE_PROJECT_LABEL : `${projectId}`;
}

function renderGanttContainer(
  chartSource: GanttChartSource | null,
  errorMessage: string | null,
  isLoading: boolean,
  displayMode: GanttDisplayMode,
  isControlPanelExpanded: boolean,
  onDisplayModeChange: (nextValue: GanttDisplayMode) => void,
  onToggleExpanded: () => void,
) {
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
        onDisplayModeChange={onDisplayModeChange}
        onToggleExpanded={onToggleExpanded}
      />
    </Box>
  );
}

export function ProjectManagerGanttPage(props: ProjectManagerGanttPageProps) {
  const [chartSource, setChartSource] = useState<GanttChartSource | null>(null);
  const [displayMode, setDisplayMode] = useState<GanttDisplayMode>(DEFAULT_DISPLAY_MODE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isControlPanelExpanded, setIsControlPanelExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(props.projectId !== null);

  useEffect(() => {
    const { projectId, token } = props;

    if (projectId === null) {
      setChartSource(null);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }
    const resolvedProjectId = projectId;

    let isMounted = true;

    async function loadChart(): Promise<void> {
      setChartSource(null);
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const nextChartSource = await ganttApi.getProjectChart(
          token,
          resolvedProjectId,
        );

        if (isMounted) {
          setChartSource(nextChartSource);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (isApiError(error) && error.kind === "http" && error.status === 404) {
          setChartSource(null);
          return;
        }

        setErrorMessage(getApiErrorMessage(error, DEFAULT_ERROR_MESSAGE));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadChart();

    return () => {
      isMounted = false;
    };
  }, [props.projectId, props.token]);

  function toggleControlPanelExpanded(): void {
    setIsControlPanelExpanded((current) => !current);
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
          <ProjectManagerProjectNavigation currentSection="gantt" projectId={props.projectId} />
          <Typography component="h1" variant="h3">
            {PAGE_TITLE}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Selected project: {createSelectedProjectLabel(props.projectId)}
          </Typography>
        </Stack>
        {renderGanttContainer(
          chartSource,
          errorMessage,
          isLoading,
          displayMode,
          isControlPanelExpanded,
          setDisplayMode,
          toggleControlPanelExpanded,
        )}
      </Stack>
    </Box>
  );
}
