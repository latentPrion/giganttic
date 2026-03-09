import React, { useEffect, useRef } from "react";
import { Box } from "@mui/material";

import { createSampleGanttData } from "../data/sample-gantt-data.js";
import { getDhtmlxGantt } from "../lib/dhtmlx-gantt-adapter.js";
import type { GanttDisplayMode } from "../models/gantt-display-mode.js";

interface GanttChartProps {
  displayMode: GanttDisplayMode;
}

const GANTT_CONTAINER_MIN_HEIGHT = 520;
const GANTT_DATE_FORMAT = "%Y-%m-%d %H:%i";
const GANTT_NAME_COLUMN_WIDTH = 220;
const GANTT_SURFACE_BACKGROUND = "#ffffff";

function configureBaseGantt(ganttInstance: ReturnType<typeof getDhtmlxGantt>) {
  ganttInstance.config.columns = [
    {
      label: "Task",
      name: "text",
      tree: true,
      width: GANTT_NAME_COLUMN_WIDTH,
    },
    {
      align: "center",
      label: "Start",
      name: "start_date",
    },
    {
      align: "center",
      label: "Duration",
      name: "duration",
    },
  ];
  ganttInstance.config.date_format = GANTT_DATE_FORMAT;
}

function initializeMountedGantt(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  containerElement: HTMLDivElement,
  displayMode: GanttDisplayMode,
) {
  configureBaseGantt(ganttInstance);
  ganttInstance.init(containerElement);
  ganttInstance.parse(createSampleGanttData());
  applyDisplayMode(ganttInstance, displayMode);
}

function cleanupMountedGantt(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  containerElement: HTMLDivElement,
) {
  ganttInstance.clearAll();
  containerElement.replaceChildren();
}

function applyDisplayMode(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  displayMode: GanttDisplayMode,
) {
  ganttInstance.config.show_grid = displayMode !== "chart";
  ganttInstance.config.show_chart = displayMode !== "grid";
  ganttInstance.resetLayout();
  ganttInstance.setSizes();
}

export function GanttChart(props: GanttChartProps) {
  const containerReference = useRef<HTMLDivElement | null>(null);
  const ganttReference = useRef<ReturnType<typeof getDhtmlxGantt> | null>(null);

  useEffect(() => {
    const containerElement = containerReference.current;
    if (!containerElement) {
      return;
    }

    const ganttInstance = getDhtmlxGantt();
    ganttReference.current = ganttInstance;

    initializeMountedGantt(ganttInstance, containerElement, props.displayMode);

    return () => {
      cleanupMountedGantt(ganttInstance, containerElement);
      ganttReference.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ganttReference.current) {
      return;
    }

    applyDisplayMode(ganttReference.current, props.displayMode);
  }, [props.displayMode]);

  return (
    <Box
      data-testid="pm-gantt-chart-container"
      sx={{
        backgroundColor: GANTT_SURFACE_BACKGROUND,
        flex: 1,
        minHeight: GANTT_CONTAINER_MIN_HEIGHT,
        overflow: "hidden",
        width: "100%",
      }}
    >
      <Box
        ref={containerReference}
        sx={{
          height: "100%",
          minHeight: GANTT_CONTAINER_MIN_HEIGHT,
          width: "100%",
        }}
      />
    </Box>
  );
}
