import React from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import type { GanttDisplayMode } from "../models/gantt-display-mode.js";

interface GanttChartControlPanelProps {
  displayMode: GanttDisplayMode;
  isExpanded: boolean;
  onDisplayModeChange(displayMode: GanttDisplayMode): void;
  onToggleExpanded(): void;
}

const PANEL_PADDING = 2;
const PANEL_TITLE = "Gantt Controls";

function createNextDisplayMode(value: unknown): GanttDisplayMode {
  if (value === "grid" || value === "chart") {
    return value;
  }

  return "both";
}

function createToggleButtonLabel(isExpanded: boolean): string {
  return isExpanded ? "Hide Controls" : "Show Controls";
}

export function GanttChartControlPanel(props: GanttChartControlPanelProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderTop: "1px solid rgba(255, 255, 255, 0.12)",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: PANEL_PADDING,
      }}
    >
      <Stack spacing={1.5}>
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="space-between"
          spacing={2}
        >
          <Typography variant="subtitle1">{PANEL_TITLE}</Typography>
          <Button onClick={props.onToggleExpanded} type="button" variant="text">
            {createToggleButtonLabel(props.isExpanded)}
          </Button>
        </Stack>
        {props.isExpanded ? (
          <Box>
            <Tabs
              aria-label="Gantt display mode"
              onChange={(_, value) => props.onDisplayModeChange(createNextDisplayMode(value))}
              value={props.displayMode}
              variant="scrollable"
            >
              <Tab label="Both" value="both" />
              <Tab label="Grid" value="grid" />
              <Tab label="Chart" value="chart" />
            </Tabs>
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}
