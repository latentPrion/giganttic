import React, { useState } from "react";
import {
  Box,
  Stack,
  Typography,
} from "@mui/material";

import { GanttChart } from "../components/GanttChart.js";
import { GanttChartControlPanel } from "../components/GanttChartControlPanel.js";
import { getRepoGanttChartSource } from "../data/repo-gantt-chart-source.js";
import type { GanttDisplayMode } from "../models/gantt-display-mode.js";

interface ProjectManagerGanttPageProps {
  projectId: number | null;
}

const DEFAULT_DISPLAY_MODE: GanttDisplayMode = "both";
const PAGE_OVERLINE = "PM SPA";
const PAGE_TITLE = "Project Manager Gantt";
const SAMPLE_PROJECT_LABEL = "Sample chart";

function createSelectedProjectLabel(projectId: number | null): string {
  return projectId === null ? SAMPLE_PROJECT_LABEL : `${projectId}`;
}

export function ProjectManagerGanttPage(props: ProjectManagerGanttPageProps) {
  const [displayMode, setDisplayMode] = useState<GanttDisplayMode>(DEFAULT_DISPLAY_MODE);
  const [isControlPanelExpanded, setIsControlPanelExpanded] = useState(true);
  const chartSource = getRepoGanttChartSource(props.projectId);

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
          <Typography component="h1" variant="h3">
            {PAGE_TITLE}
          </Typography>
          <Typography color="text.secondary" variant="body1">
            Selected project: {createSelectedProjectLabel(props.projectId)}
          </Typography>
        </Stack>
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
      </Stack>
    </Box>
  );
}
