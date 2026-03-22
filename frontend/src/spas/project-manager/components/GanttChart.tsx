import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Box } from "@mui/material";

import { getDhtmlxGantt } from "../lib/dhtmlx-gantt-adapter.js";
import type {
  GanttChartHandle,
  GanttTaskId,
} from "../models/gantt-chart-handle.js";
import type { GanttChartSource } from "../models/gantt-chart-source.js";
import type { GanttDisplayMode } from "../models/gantt-display-mode.js";

export type { GanttChartHandle };

interface GanttChartProps {
  chartSource: GanttChartSource;
  displayMode: GanttDisplayMode;
  interactionsEnabled?: boolean;
  onBaselineReady?: (serializedXml: string) => void;
  onEditorChange?: () => void;
  onSelectionChange?: (selectedTaskId: GanttTaskId | null) => void;
}

const GANTT_ADD_COLUMN_WIDTH = 44;
const GANTT_CONTAINER_MIN_HEIGHT = 520;
const GANTT_DATE_FORMAT = "%Y-%m-%d %H:%i";
const GANTT_DEFAULT_NEW_TASK_DURATION = 1;
const GANTT_DEFAULT_NEW_TASK_TEXT = "New Task";
const GANTT_DURATION_COLUMN_WIDTH = 100;
const GANTT_NAME_COLUMN_WIDTH = 220;
const GANTT_PREDECESSORS_COLUMN_WIDTH = 140;
const GANTT_ROOT_PARENT_ID = 0;
const GANTT_START_COLUMN_WIDTH = 120;
const GANTT_SURFACE_BACKGROUND = "#ffffff";
const GANTT_GRID_PADDING_WIDTH = 32;
const GANTT_HORIZONTAL_SCROLLBAR_HEIGHT = 20;
const GANTT_LAYOUT_CSS_CLASS = "gantt_container";
const GANTT_SERIALIZATION_FORMAT = "xml";
const GANTT_TIMELINE_GRAVITY = 2;
const GANTT_GRID_WIDTH =
  GANTT_NAME_COLUMN_WIDTH
  + GANTT_START_COLUMN_WIDTH
  + GANTT_DURATION_COLUMN_WIDTH
  + GANTT_PREDECESSORS_COLUMN_WIDTH
  + GANTT_ADD_COLUMN_WIDTH + GANTT_GRID_PADDING_WIDTH;
const LIGHTBOX_DESCRIPTION_HEIGHT = 70;
const LIGHTBOX_PARENT_HEIGHT = 28;
const LIGHTBOX_TIME_HEIGHT = 72;

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

interface GanttGridEditor {
  map_to: string;
  type: string;
}

interface GanttGridColumn {
  align?: "center" | "left" | "right";
  editor?: GanttGridEditor;
  label?: string;
  name: string;
  resize?: boolean;
  template?: (task: Record<string, unknown>) => string;
  tree?: boolean;
  width?: number | string;
}

interface GanttLightboxSection {
  focus?: boolean;
  height: number;
  map_to: string;
  name: string;
  type: string;
}

type GanttInlineEditors = {
  duration: GanttGridEditor;
  predecessors: GanttGridEditor;
  startDate: GanttGridEditor;
  text: GanttGridEditor;
};

type GanttTaskLike = {
  parent?: GanttTaskId | 0 | "" | null;
  start_date?: Date | string;
  text?: string;
};

type GanttLinkLike = {
  source?: GanttTaskId;
};

/** DHTMLX events that indicate the document may have changed (types vary by build). */
const EDITOR_EVENT_NAMES: string[] = [
  "onAfterTaskUpdate",
  "onAfterTaskAdd",
  "onAfterTaskDelete",
  "onAfterLinkAdd",
  "onAfterLinkDelete",
  "onLightboxSave",
  "onLightboxDelete",
  "onAfterTaskMove",
  "onAfterTaskDrag",
];

const SELECTION_EVENT_NAMES: string[] = [
  "onTaskSelected",
  "onTaskUnselected",
];

function createInlineEditors(): GanttInlineEditors {
  return {
    duration: {
      map_to: "duration",
      type: "duration",
    },
    predecessors: {
      map_to: "auto",
      type: "predecessor",
    },
    startDate: {
      map_to: "start_date",
      type: "date",
    },
    text: {
      map_to: "text",
      type: "text",
    },
  };
}

function createPredecessorsTemplate(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
): (task: Record<string, unknown>) => string {
  const gantt = ganttInstance as ReturnType<typeof getDhtmlxGantt> & {
    getLink: (id: GanttTaskId) => GanttLinkLike;
  };

  return (task) => {
    const taskTargetLinks = Array.isArray(task.$target) ? task.$target : [];
    return taskTargetLinks
      .map((linkId) => {
        const link = gantt.getLink(linkId as GanttTaskId);
        return link.source == null ? "" : String(link.source);
      })
      .filter((label) => label.length > 0)
      .join(", ");
  };
}

function createGridColumns(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
): GanttGridColumn[] {
  const editors = createInlineEditors();

  return [
    {
      editor: editors.text,
      label: "Task",
      name: "text",
      resize: true,
      tree: true,
      width: GANTT_NAME_COLUMN_WIDTH,
    },
    {
      align: "center",
      editor: editors.startDate,
      label: "Start",
      name: "start_date",
      resize: true,
      width: GANTT_START_COLUMN_WIDTH,
    },
    {
      align: "center",
      editor: editors.duration,
      label: "Duration",
      name: "duration",
      resize: true,
      width: GANTT_DURATION_COLUMN_WIDTH,
    },
    {
      editor: editors.predecessors,
      label: "Predecessors",
      name: "predecessors",
      resize: true,
      template: createPredecessorsTemplate(ganttInstance),
      width: GANTT_PREDECESSORS_COLUMN_WIDTH,
    },
    {
      name: "add",
      width: GANTT_ADD_COLUMN_WIDTH,
    },
  ];
}

function createDefaultLightboxSections(): GanttLightboxSection[] {
  return [
    {
      focus: true,
      height: LIGHTBOX_DESCRIPTION_HEIGHT,
      map_to: "text",
      name: "description",
      type: "textarea",
    },
    {
      height: LIGHTBOX_PARENT_HEIGHT,
      map_to: "parent",
      name: "parent",
      type: "parent",
    },
    {
      height: LIGHTBOX_TIME_HEIGHT,
      map_to: "auto",
      name: "time",
      type: "duration",
    },
  ];
}

function configureLightbox(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
) {
  const lightboxSections = createDefaultLightboxSections();
  const ganttWithLightbox = ganttInstance as ReturnType<typeof getDhtmlxGantt> & {
    config: {
      lightbox: {
        milestone_sections?: GanttLightboxSection[];
        project_sections?: GanttLightboxSection[];
        sections?: GanttLightboxSection[];
      } | undefined;
    };
  };

  if (!ganttWithLightbox.config.lightbox) {
    ganttWithLightbox.config.lightbox = {};
  }

  ganttWithLightbox.config.lightbox.sections = lightboxSections;
  ganttWithLightbox.config.lightbox.project_sections = lightboxSections;
  ganttWithLightbox.config.lightbox.milestone_sections = lightboxSections;
}

function configureBaseGantt(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  interactionsEnabled: boolean,
) {
  ganttInstance.config.columns = createGridColumns(ganttInstance);
  ganttInstance.config.date_format = GANTT_DATE_FORMAT;
  ganttInstance.config.details_on_dblclick = true;
  ganttInstance.config.grid_width = GANTT_GRID_WIDTH;
  ganttInstance.config.keep_grid_width = true;
  ganttInstance.config.readonly = !interactionsEnabled;
  configureLightbox(ganttInstance);
  if (interactionsEnabled) {
    ganttInstance.config.drag_links = true;
    ganttInstance.config.drag_move = true;
    ganttInstance.config.drag_progress = true;
    ganttInstance.config.drag_resize = true;
  }
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

function attachEditorEvents(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  onEditorChange?: () => void,
): string[] {
  if (!onEditorChange) {
    return [];
  }

  const gantt = ganttInstance as unknown as {
    attachEvent: (name: string, handler: () => boolean) => string;
  };
  const eventIds: string[] = [];
  for (const eventName of EDITOR_EVENT_NAMES) {
    const id = gantt.attachEvent(eventName, () => {
      onEditorChange();
      return true;
    });
    eventIds.push(id);
  }
  return eventIds;
}

function attachLightboxParentNormalizationEvent(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
): string[] {
  const gantt = ganttInstance as unknown as {
    attachEvent: (
      name: string,
      handler: (taskId: GanttTaskId, task: GanttTaskLike) => boolean,
    ) => string;
  };

  const eventId = gantt.attachEvent("onLightboxSave", (_taskId, task) => {
    normalizeTaskParent(task);
    return true;
  });

  return [eventId];
}

function attachSelectionEvents(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  onSelectionChange?: (selectedTaskId: GanttTaskId | null) => void,
): string[] {
  if (!onSelectionChange) {
    return [];
  }

  const gantt = ganttInstance as unknown as {
    attachEvent: (name: string, handler: () => boolean) => string;
  };
  const eventIds: string[] = [];

  for (const eventName of SELECTION_EVENT_NAMES) {
    const id = gantt.attachEvent(eventName, () => {
      onSelectionChange(getSelectedTaskId(ganttInstance));
      return true;
    });
    eventIds.push(id);
  }

  return eventIds;
}

function detachEditorEvents(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  eventIds: readonly string[],
) {
  const gantt = ganttInstance as unknown as {
    detachEvent: (id: string) => void;
  };
  for (const id of eventIds) {
    gantt.detachEvent(id);
  }
}

function initializeMountedGantt(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  chartSource: GanttChartSource,
  containerElement: HTMLDivElement,
  displayMode: GanttDisplayMode,
  interactionsEnabled: boolean,
  onBaselineReady?: (serializedXml: string) => void,
  onEditorChange?: () => void,
) {
  configureBaseGantt(ganttInstance, interactionsEnabled);
  ganttInstance.config.layout = createLayoutForDisplayMode(displayMode);
  ganttInstance.config.show_grid = displayMode !== "chart";
  ganttInstance.config.show_chart = displayMode !== "grid";
  ganttInstance.init(containerElement);
  ganttInstance.parse(chartSource.content, chartSource.type);
  ganttInstance.render();
  ganttInstance.setSizes();

  const eventIds = [
    ...attachLightboxParentNormalizationEvent(ganttInstance),
    ...attachEditorEvents(ganttInstance, onEditorChange),
  ];

  const serialized = serializeGanttXml(ganttInstance);
  onBaselineReady?.(serialized);

  return eventIds;
}

function cleanupMountedGantt(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  containerElement: HTMLDivElement,
  eventIds: readonly string[],
) {
  detachEditorEvents(ganttInstance, eventIds);
  ganttInstance.clearAll();
  containerElement.replaceChildren();
}

function normalizeSerializedRootTaskParents(serializedXml: string): string {
  return serializedXml.replace(
    /(<task\b[^>]*\bparent=)(['"])\2/g,
    `$1$2${GANTT_ROOT_PARENT_ID}$2`,
  );
}

function serializeGanttXml(ganttInstance: ReturnType<typeof getDhtmlxGantt>): string {
  const serializedXml = ganttInstance.serialize(GANTT_SERIALIZATION_FORMAT) as string;
  return normalizeSerializedRootTaskParents(serializedXml);
}

function getSelectedTaskId(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
): GanttTaskId | null {
  const gantt = ganttInstance as ReturnType<typeof getDhtmlxGantt> & {
    getSelectedId: () => GanttTaskId | null;
  };

  return gantt.getSelectedId();
}

function createNewTaskStartDate(task: GanttTaskLike | null): Date {
  if (task?.start_date instanceof Date) {
    return task.start_date;
  }

  if (typeof task?.start_date === "string") {
    return new Date(task.start_date);
  }

  return new Date();
}

function isRootParentValue(parent: GanttTaskLike["parent"]): boolean {
  return parent === undefined || parent === null || parent === "";
}

function normalizeTaskParent(task: GanttTaskLike) {
  if (isRootParentValue(task.parent)) {
    task.parent = GANTT_ROOT_PARENT_ID;
  }
}

function createNewTaskBlueprint(
  task: GanttTaskLike | null,
  parentId: GanttTaskId | null,
) {
  const blueprint: GanttTaskLike & {
    duration: number;
    start_date: Date;
    text: string;
  } = {
    duration: GANTT_DEFAULT_NEW_TASK_DURATION,
    start_date: createNewTaskStartDate(task),
    text: GANTT_DEFAULT_NEW_TASK_TEXT,
  };

  if (parentId === null) {
    blueprint.parent = GANTT_ROOT_PARENT_ID;
  }

  return blueprint;
}

function createTaskWithParent(
  gantt: ReturnType<typeof getDhtmlxGantt> & {
    addTask: (task: Record<string, unknown>, parent?: GanttTaskId) => GanttTaskId;
  },
  parentTask: GanttTaskLike | null,
  parentId: GanttTaskId | null,
) {
  const newTaskBlueprint = createNewTaskBlueprint(parentTask, parentId);

  if (parentId === null) {
    return gantt.addTask(newTaskBlueprint);
  }

  return gantt.addTask(newTaskBlueprint, parentId);
}

function addTaskAndFocusEditor(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  parentId: GanttTaskId | null,
) {
  const gantt = ganttInstance as ReturnType<typeof getDhtmlxGantt> & {
    addTask: (task: Record<string, unknown>, parent?: GanttTaskId) => GanttTaskId;
    getTask: (id: GanttTaskId) => GanttTaskLike;
    selectTask: (id: GanttTaskId) => GanttTaskId;
    showLightbox: (id: GanttTaskId) => void;
  };
  const parentTask = parentId === null ? null : gantt.getTask(parentId);
  const createdTaskId = createTaskWithParent(gantt, parentTask, parentId);

  gantt.selectTask(createdTaskId);
  gantt.showLightbox(createdTaskId);
}

function deleteSelectedTask(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
) {
  const selectedTaskId = getSelectedTaskId(ganttInstance);
  if (selectedTaskId === null) {
    return;
  }

  const gantt = ganttInstance as ReturnType<typeof getDhtmlxGantt> & {
    deleteTask: (id: GanttTaskId) => void;
  };
  gantt.deleteTask(selectedTaskId);
}

function editSelectedTask(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
) {
  const selectedTaskId = getSelectedTaskId(ganttInstance);
  if (selectedTaskId === null) {
    return;
  }

  const gantt = ganttInstance as ReturnType<typeof getDhtmlxGantt> & {
    showLightbox: (id: GanttTaskId) => void;
  };
  gantt.showLightbox(selectedTaskId);
}

export const GanttChart = forwardRef<GanttChartHandle, GanttChartProps>(
  function GanttChart(props, ref) {
    const {
      chartSource,
      displayMode,
      interactionsEnabled = true,
      onBaselineReady,
      onEditorChange,
      onSelectionChange,
    } = props;
    const containerReference = useRef<HTMLDivElement | null>(null);
    const ganttReference = useRef<ReturnType<typeof getDhtmlxGantt> | null>(null);

    useImperativeHandle(ref, () => ({
      addChildTask(): void {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return;
        }

        addTaskAndFocusEditor(ganttInstance, getSelectedTaskId(ganttInstance));
      },
      addRootTask(): void {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return;
        }

        addTaskAndFocusEditor(ganttInstance, null);
      },
      deleteSelectedTask(): void {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return;
        }

        deleteSelectedTask(ganttInstance);
        onSelectionChange?.(getSelectedTaskId(ganttInstance));
      },
      editSelectedTask(): void {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return;
        }

        editSelectedTask(ganttInstance);
      },
      getSelectedTaskId(): GanttTaskId | null {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return null;
        }

        return getSelectedTaskId(ganttInstance);
      },
      getSerializedXml(): string {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return "";
        }
        return serializeGanttXml(ganttInstance);
      },
    }));

    useEffect(() => {
      const containerElement = containerReference.current;
      if (!containerElement) {
        return;
      }

      const ganttInstance = getDhtmlxGantt();
      ganttReference.current = ganttInstance;

      const editorEventIds = initializeMountedGantt(
        ganttInstance,
        chartSource,
        containerElement,
        displayMode,
        interactionsEnabled,
        onBaselineReady,
        onEditorChange,
      );
      const selectionEventIds = attachSelectionEvents(
        ganttInstance,
        onSelectionChange,
      );
      onSelectionChange?.(getSelectedTaskId(ganttInstance));

      return () => {
        cleanupMountedGantt(
          ganttInstance,
          containerElement,
          [...editorEventIds, ...selectionEventIds],
        );
        ganttReference.current = null;
        onSelectionChange?.(null);
      };
    }, [
      chartSource,
      displayMode,
      interactionsEnabled,
      onBaselineReady,
      onEditorChange,
      onSelectionChange,
    ]);

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
  },
);
