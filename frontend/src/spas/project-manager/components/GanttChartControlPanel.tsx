import React from "react";
import {
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import type { GanttDisplayMode } from "../models/gantt-display-mode.js";

interface GanttChartControlPanelProps {
  actions?: React.ReactNode;
  displayMode: GanttDisplayMode;
  hasChart: boolean;
  isExpanded: boolean;
  onDisplayModeChange(displayMode: GanttDisplayMode): void;
  onToggleExpanded(): void;
}

const PANEL_PADDING = 2;
const PANEL_TITLE = "Gantt Controls";
const VIEW_CONTROL_LABEL = "View";

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
      data-testid="pm-gantt-control-panel"
      elevation={0}
      sx={{
        borderTop: props.hasChart ? "1px solid rgba(255, 255, 255, 0.12)" : "none",
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
          <Stack
            alignItems={{ xs: "stretch", lg: "center" }}
            direction={{ xs: "column", lg: "row" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <TextField
              disabled={!props.hasChart}
              label={VIEW_CONTROL_LABEL}
              onChange={(event) => {
                props.onDisplayModeChange(createNextDisplayMode(event.target.value));
              }}
              select
              size="small"
              sx={{ minWidth: { xs: "100%", sm: 220 }, width: { xs: "100%", sm: "auto" } }}
              value={props.displayMode}
            >
              <MenuItem value="both">Both</MenuItem>
              <MenuItem value="grid">Grid</MenuItem>
              <MenuItem value="chart">Chart</MenuItem>
            </TextField>
            {props.actions ? (
              <Stack
                alignItems={{ xs: "stretch", sm: "center" }}
                direction={{ xs: "column", sm: "row" }}
                flexWrap="wrap"
                spacing={1}
                sx={{ width: "100%" }}
              >
                {props.actions}
              </Stack>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
