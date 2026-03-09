import React, { useEffect, useRef } from "react";
import { Box } from "@mui/material";

import { getDhtmlxGantt } from "../lib/dhtmlx-gantt-adapter.js";
import type { GanttChartSource } from "../models/gantt-chart-source.js";
import type { GanttDisplayMode } from "../models/gantt-display-mode.js";

interface GanttChartProps {
  chartSource: GanttChartSource;
  displayMode: GanttDisplayMode;
}

const GANTT_CONTAINER_MIN_HEIGHT = 520;
const GANTT_DATE_FORMAT = "%Y-%m-%d %H:%i";
const GANTT_DURATION_COLUMN_WIDTH = 100;
const GANTT_NAME_COLUMN_WIDTH = 220;
const GANTT_START_COLUMN_WIDTH = 120;
const GANTT_SURFACE_BACKGROUND = "#ffffff";
const GANTT_GRID_PADDING_WIDTH = 32;
const GANTT_HORIZONTAL_SCROLLBAR_HEIGHT = 20;
const GANTT_LAYOUT_CSS_CLASS = "gantt_container";
const GANTT_TIMELINE_GRAVITY = 2;
const GANTT_GRID_WIDTH =
  GANTT_NAME_COLUMN_WIDTH + GANTT_START_COLUMN_WIDTH + GANTT_DURATION_COLUMN_WIDTH
  + GANTT_GRID_PADDING_WIDTH;

interface GanttLayoutCell {
  cols?: GanttLayoutCell[];
  css?: string;
  gravity?: number;
  height?: number;
  id?: string;
  resizer?: boolean;
  rows?: GanttLayoutCell[];
  scrollX?: string;
  scrollY?: string;
  view?: string;
  width?: number;
}

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
      width: GANTT_START_COLUMN_WIDTH,
    },
    {
      align: "center",
      label: "Duration",
      name: "duration",
      width: GANTT_DURATION_COLUMN_WIDTH,
    },
  ];
  ganttInstance.config.date_format = GANTT_DATE_FORMAT;
  ganttInstance.config.grid_width = GANTT_GRID_WIDTH;
  ganttInstance.config.keep_grid_width = true;
}

function createBothModeLayout(): GanttLayoutCell {
  return {
    css: GANTT_LAYOUT_CSS_CLASS,
    rows: [
      {
        cols: [
          {
            view: "grid",
            width: GANTT_GRID_WIDTH,
            scrollX: "scrollHor",
            scrollY: "scrollVer",
          },
          {
            resizer: true,
            width: 1,
          },
          {
            gravity: GANTT_TIMELINE_GRAVITY,
            view: "timeline",
            scrollX: "scrollHor",
            scrollY: "scrollVer",
          },
          {
            id: "scrollVer",
            view: "scrollbar",
          },
        ],
      },
      {
        id: "scrollHor",
        view: "scrollbar",
        height: GANTT_HORIZONTAL_SCROLLBAR_HEIGHT,
      },
    ],
  };
}

function createGridOnlyLayout(): GanttLayoutCell {
  return {
    css: GANTT_LAYOUT_CSS_CLASS,
    rows: [
      {
        cols: [
          {
            view: "grid",
            scrollX: "scrollHor",
            scrollY: "scrollVer",
          },
          {
            id: "scrollVer",
            view: "scrollbar",
          },
        ],
      },
      {
        id: "scrollHor",
        view: "scrollbar",
        height: GANTT_HORIZONTAL_SCROLLBAR_HEIGHT,
      },
    ],
  };
}

function createChartOnlyLayout(): GanttLayoutCell {
  return {
    css: GANTT_LAYOUT_CSS_CLASS,
    rows: [
      {
        cols: [
          {
            view: "timeline",
            scrollX: "scrollHor",
            scrollY: "scrollVer",
          },
          {
            id: "scrollVer",
            view: "scrollbar",
          },
        ],
      },
      {
        id: "scrollHor",
        view: "scrollbar",
        height: GANTT_HORIZONTAL_SCROLLBAR_HEIGHT,
      },
    ],
  };
}

function createLayoutForDisplayMode(displayMode: GanttDisplayMode): GanttLayoutCell {
  if (displayMode === "grid") {
    return createGridOnlyLayout();
  }

  if (displayMode === "chart") {
    return createChartOnlyLayout();
  }

  return createBothModeLayout();
}

function initializeMountedGantt(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  chartSource: GanttChartSource,
  containerElement: HTMLDivElement,
  displayMode: GanttDisplayMode,
) {
  configureBaseGantt(ganttInstance);
  ganttInstance.config.layout = createLayoutForDisplayMode(displayMode);
  ganttInstance.config.show_grid = displayMode !== "chart";
  ganttInstance.config.show_chart = displayMode !== "grid";
  ganttInstance.init(containerElement);
  ganttInstance.parse(chartSource.content, chartSource.type);
  ganttInstance.render();
  ganttInstance.setSizes();
}

function cleanupMountedGantt(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  containerElement: HTMLDivElement,
) {
  ganttInstance.clearAll();
  containerElement.replaceChildren();
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

    initializeMountedGantt(ganttInstance, props.chartSource, containerElement, props.displayMode);

    return () => {
      cleanupMountedGantt(ganttInstance, containerElement);
      ganttReference.current = null;
    };
  }, [props.chartSource, props.displayMode]);

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
