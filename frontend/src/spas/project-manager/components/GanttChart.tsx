import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Box } from "@mui/material";

import { getDhtmlxGantt } from "../lib/dhtmlx-gantt-adapter.js";
import {
  GGTC_TASK_CLOSED_REASON_CANTFIX,
  GGTC_TASK_CLOSED_REASON_NONE,
  GGTC_TASK_CLOSED_REASON_RESOLVED,
  GGTC_TASK_CLOSED_REASON_WONTFIX,
  GGTC_TASK_STATUS_BLOCKED,
  GGTC_TASK_STATUS_CLOSED,
  GGTC_TASK_STATUS_IN_PROGRESS,
  GGTC_TASK_STATUS_OPEN,
  GgtcDhtmlxGanttExtensionsManager,
} from "../lib/ggtc-dhtmlx-gantt-extensions-manager.js";
import { inferMilestoneStatusesFromXml } from "../lib/project-tasks-history-parser.js";
import {
  emitGanttRuntimeChartUpdatedEvent,
} from "../lib/gantt-runtime-chart-events.js";
import type {
  GanttChartHandle,
  GanttSelectedTask,
  GanttTaskId,
  GanttTaskType,
} from "../models/gantt-chart-handle.js";
import type { GanttChartSource } from "../models/gantt-chart-source.js";
import type { GanttDisplayMode } from "../models/gantt-display-mode.js";

export type { GanttChartHandle };

interface GanttChartProps {
  projectId: number;
  chartSource: GanttChartSource;
  displayMode: GanttDisplayMode;
  interactionsEnabled?: boolean;
  onBaselineReady?: (serializedXml: string) => void;
  onEditorChange?: () => void;
  onSelectionChange?: (selectedTask: GanttSelectedTask | null) => void;
}

const GANTT_ADD_COLUMN_WIDTH = 44;
const GANTT_CONTAINER_MIN_HEIGHT = 520;
const GANTT_DATE_FORMAT = "%Y-%m-%d %H:%i";
const GANTT_DEFAULT_NEW_TASK_DURATION = 1;
const GANTT_DEFAULT_NEW_MILESTONE_DURATION = 0;
const GANTT_DEFAULT_NEW_MILESTONE_TEXT = "New Milestone";
const GANTT_DEFAULT_NEW_TASK_TEXT = "New Task";
const GANTT_DURATION_COLUMN_WIDTH = 100;
const GANTT_NAME_COLUMN_WIDTH = 220;
const GANTT_MILESTONE_TASK_TYPE: GanttTaskType = "milestone";
const GANTT_PREDECESSORS_COLUMN_WIDTH = 140;
const GANTT_ROOT_PARENT_ID = 0;
const GANTT_START_COLUMN_WIDTH = 120;
const GANTT_SURFACE_BACKGROUND = "#ffffff";
const GANTT_TASK_TASK_TYPE: GanttTaskType = "task";
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
const LIGHTBOX_GGTC_TEXTAREA_HEIGHT = 70;
const LIGHTBOX_GGTC_SELECT_HEIGHT = 28;
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
  options?: GanttLightboxSelectOption[];
  type: string;
}

interface GanttLightboxSelectOption {
  key: string;
  label: string;
}

type GanttInlineEditors = {
  duration: GanttGridEditor;
  predecessors: GanttGridEditor;
  startDate: GanttGridEditor;
  text: GanttGridEditor;
};

type GanttTaskLike = {
  duration?: number;
  end_date?: Date | string;
  ggtc_task_closed_reason?: string | null;
  ggtc_task_description?: string | null;
  ggtc_task_status?: string | null;
  open?: boolean | "true" | "false";
  parent?: GanttTaskId | 0 | "" | null;
  progress?: number;
  start_date?: Date | string;
  text?: string;
  type?: GanttTaskType | string;
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
const TASK_EXTENSION_EVENT_NAMES: string[] = [
  "onAfterTaskAdd",
  "onAfterTaskUpdate",
];
const ggtcExtensionsManager = new GgtcDhtmlxGanttExtensionsManager();

function createGgtcStatusOptions(): GanttLightboxSelectOption[] {
  return [
    { key: GGTC_TASK_STATUS_OPEN, label: "Open" },
    { key: GGTC_TASK_STATUS_IN_PROGRESS, label: "In Progress" },
    { key: GGTC_TASK_STATUS_BLOCKED, label: "Blocked" },
    { key: GGTC_TASK_STATUS_CLOSED, label: "Closed" },
  ];
}

function createGgtcClosedReasonOptions(): GanttLightboxSelectOption[] {
  return [
    { key: GGTC_TASK_CLOSED_REASON_NONE, label: "None" },
    { key: GGTC_TASK_CLOSED_REASON_RESOLVED, label: "Resolved" },
    { key: GGTC_TASK_CLOSED_REASON_WONTFIX, label: "Won't fix" },
    { key: GGTC_TASK_CLOSED_REASON_CANTFIX, label: "Can't fix" },
  ];
}

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
  const statusOptions = createGgtcStatusOptions();
  const closedReasonOptions = createGgtcClosedReasonOptions();

  return [
    {
      focus: true,
      height: LIGHTBOX_DESCRIPTION_HEIGHT,
      map_to: "text",
      name: "description",
      type: "textarea",
    },
    {
      height: LIGHTBOX_GGTC_TEXTAREA_HEIGHT,
      map_to: "ggtc_task_description",
      name: "ggtc description",
      type: "textarea",
    },
    {
      height: LIGHTBOX_GGTC_SELECT_HEIGHT,
      map_to: "ggtc_task_status",
      name: "ggtc status",
      options: statusOptions,
      type: "select",
    },
    {
      height: LIGHTBOX_GGTC_SELECT_HEIGHT,
      map_to: "ggtc_task_closed_reason",
      name: "ggtc closed reason",
      options: closedReasonOptions,
      type: "select",
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
  projectId: number,
  isApplyingMilestoneInferenceRef: { current: boolean },
): string[] {
  const gantt = ganttInstance as unknown as {
    attachEvent: (
      name: string,
      handler: (taskId: GanttTaskId, task: GanttTaskLike) => boolean,
    ) => string;
  };

  const eventId = gantt.attachEvent("onLightboxSave", (taskId, task) => {
    normalizeTaskParent(task);
    ggtcExtensionsManager.ensureTaskObjectAttrs(task);

    // DHTMLX runs `onLightboxSave` before it applies the task changes into the runtime chart.
    // We need the runtime chart to reflect the edited `task` immediately so that we can
    // serialize/infer using the new status values.
    try {
      if (taskId === null || taskId === undefined) {
        return true;
      }

      const runtimeTask = ganttInstance.getTask(taskId as GanttTaskId);
      runtimeTask.parent = task.parent ?? undefined;
      runtimeTask.ggtc_task_status = task.ggtc_task_status;
      runtimeTask.ggtc_task_closed_reason = task.ggtc_task_closed_reason;
      runtimeTask.ggtc_task_description = task.ggtc_task_description;
    } catch {
      // If the runtime task cannot be found (e.g. transient UI state), inference still
      // happens best-effort based on whatever is currently serializable.
    }

    if (isApplyingMilestoneInferenceRef.current) {
      return true;
    }

    isApplyingMilestoneInferenceRef.current = true;
    try {
      inferAndApplyMilestoneStatusesToRuntime(ganttInstance, {
        projectId,
        shouldEmit: true,
      });
    } finally {
      isApplyingMilestoneInferenceRef.current = false;
    }

    return true;
  });

  return [eventId];
}

function inferAndApplyMilestoneStatusesToRuntime(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  options: {
    projectId: number;
    shouldEmit: boolean;
  },
): void {
  const gantt = ganttInstance as ReturnType<typeof getDhtmlxGantt> & {
    getTask: (id: GanttTaskId) => GanttTaskLike;
    updateTask?: (id: GanttTaskId) => void;
    refreshTask?: (id: GanttTaskId) => void;
  };

  const preInferenceXml = serializeGanttXml(ganttInstance);
  let inferredStatusesByMilestoneId: ReturnType<typeof inferMilestoneStatusesFromXml> | null = null;
  try {
    inferredStatusesByMilestoneId = inferMilestoneStatusesFromXml(preInferenceXml);
  } catch {
    // If the chart XML is malformed (e.g. during certain UI tests or intermediate states),
    // don't break the editor; just skip milestone inference for this pass.
    inferredStatusesByMilestoneId = null;
  }

  if (!inferredStatusesByMilestoneId) {
    return;
  }
  let didMutate = false;

  for (const [milestoneId, inferredStatus] of inferredStatusesByMilestoneId.entries()) {
    let milestoneTask: GanttTaskLike | undefined;
    try {
      milestoneTask = gantt.getTask(milestoneId);
    } catch {
      milestoneTask = undefined;
    }

    if (!milestoneTask) {
      continue;
    }

    const currentStatus = milestoneTask.ggtc_task_status ?? null;
    if (currentStatus === inferredStatus) {
      continue;
    }

    milestoneTask.ggtc_task_status = inferredStatus;
    didMutate = true;

    gantt.updateTask?.(milestoneId);
    gantt.refreshTask?.(milestoneId);
  }

  const postInferenceXml = didMutate ? serializeGanttXml(ganttInstance) : preInferenceXml;
  if (options.shouldEmit) {
    emitGanttRuntimeChartUpdatedEvent({
      projectId: options.projectId,
      serializedXml: postInferenceXml,
    });
  }
}

function attachTaskExtensionAttributeEvents(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
): string[] {
  const gantt = ganttInstance as ReturnType<typeof getDhtmlxGantt> & {
    attachEvent: (name: string, handler: (...args: unknown[]) => boolean) => string;
    getTask: (id: GanttTaskId) => GanttTaskLike;
    refreshTask?: (id: GanttTaskId) => void;
    updateTask: (id: GanttTaskId) => void;
  };

  function handleRuntimeTaskMutation(taskId: GanttTaskId, task: GanttTaskLike): boolean {
    const didMutate = ggtcExtensionsManager.ensureTaskObjectAttrs(task);
    if (didMutate) {
      gantt.updateTask(taskId);
      gantt.refreshTask?.(taskId);
    }
    return true;
  }

  return TASK_EXTENSION_EVENT_NAMES.map((eventName) =>
    gantt.attachEvent(eventName, (...args: unknown[]) => {
      const taskId = args[0] as GanttTaskId | null | undefined;
      if (taskId === null || taskId === undefined) {
        return true;
      }

      const taskFromEvent = args[1] as GanttTaskLike | undefined;
      const task = taskFromEvent ?? gantt.getTask(taskId);
      return handleRuntimeTaskMutation(taskId, task);
    }),
  );
}

function attachSelectionEvents(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  onSelectionChange?: (selectedTask: GanttSelectedTask | null) => void,
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
      onSelectionChange(createSelectedTaskSummary(ganttInstance));
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
  projectId: number,
  isApplyingMilestoneInferenceRef: { current: boolean },
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

  // Ensure milestone statuses are inferred and written into runtime tasks on initial load,
  // so the lightbox shows consistent values even before the first user edit.
  inferAndApplyMilestoneStatusesToRuntime(ganttInstance, {
    projectId,
    shouldEmit: false,
  });

  const eventIds = [
    ...attachTaskExtensionAttributeEvents(ganttInstance),
    ...attachLightboxParentNormalizationEvent(
      ganttInstance,
      projectId,
      isApplyingMilestoneInferenceRef,
    ),
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

function normalizeTaskType(task: GanttTaskLike | null): GanttTaskType {
  if (task?.type === GANTT_MILESTONE_TASK_TYPE) {
    return GANTT_MILESTONE_TASK_TYPE;
  }

  if (task?.type === "project") {
    return "project";
  }

  return GANTT_TASK_TASK_TYPE;
}

function createSelectedTaskSummary(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
): GanttSelectedTask | null {
  const selectedTaskId = getSelectedTaskId(ganttInstance);
  if (selectedTaskId === null) {
    return null;
  }

  const gantt = ganttInstance as ReturnType<typeof getDhtmlxGantt> & {
    getTask: (id: GanttTaskId) => GanttTaskLike;
  };
  const selectedTask = gantt.getTask(selectedTaskId);
  return {
    id: selectedTaskId,
    type: normalizeTaskType(selectedTask),
  };
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

function createTaskDuration(taskType: GanttTaskType): number {
  return taskType === GANTT_MILESTONE_TASK_TYPE
    ? GANTT_DEFAULT_NEW_MILESTONE_DURATION
    : GANTT_DEFAULT_NEW_TASK_DURATION;
}

function createTaskLabel(taskType: GanttTaskType): string {
  return taskType === GANTT_MILESTONE_TASK_TYPE
    ? GANTT_DEFAULT_NEW_MILESTONE_TEXT
    : GANTT_DEFAULT_NEW_TASK_TEXT;
}

function createTaskTypeAttributes(taskType: GanttTaskType) {
  if (taskType === GANTT_MILESTONE_TASK_TYPE) {
    return {
      progress: 0,
      type: GANTT_MILESTONE_TASK_TYPE,
    };
  }

  return {
    type: GANTT_TASK_TASK_TYPE,
  };
}

function createNewTaskBlueprint(
  task: GanttTaskLike | null,
  parentId: GanttTaskId | null,
  taskType: GanttTaskType,
) {
  const blueprint: GanttTaskLike & {
    duration: number;
    progress?: number;
    start_date: Date;
    text: string;
    type: GanttTaskType;
  } = {
    ...createTaskTypeAttributes(taskType),
    duration: createTaskDuration(taskType),
    start_date: createNewTaskStartDate(task),
    text: createTaskLabel(taskType),
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
  taskType: GanttTaskType,
) {
  const newTaskBlueprint = createNewTaskBlueprint(parentTask, parentId, taskType);

  if (parentId === null) {
    return gantt.addTask(newTaskBlueprint);
  }

  return gantt.addTask(newTaskBlueprint, parentId);
}

function normalizeTaskShape(task: GanttTaskLike, taskType: GanttTaskType) {
  if (taskType === GANTT_MILESTONE_TASK_TYPE) {
    task.duration = 0;
    task.progress = 0;
    task.type = GANTT_MILESTONE_TASK_TYPE;
    return;
  }

  task.type = GANTT_TASK_TASK_TYPE;
  if (typeof task.duration !== "number" || task.duration <= 0) {
    task.duration = GANTT_DEFAULT_NEW_TASK_DURATION;
  }
}

function updateSelectedTaskType(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  nextTaskType: GanttTaskType,
) {
  const selectedTaskId = getSelectedTaskId(ganttInstance);
  if (selectedTaskId === null) {
    return;
  }

  const gantt = ganttInstance as ReturnType<typeof getDhtmlxGantt> & {
    getTask: (id: GanttTaskId) => GanttTaskLike;
    refreshTask?: (id: GanttTaskId) => void;
    showLightbox: (id: GanttTaskId) => void;
    showTask?: (id: GanttTaskId) => void;
    updateTask: (id: GanttTaskId) => void;
  };
  const selectedTask = gantt.getTask(selectedTaskId);
  normalizeTaskShape(selectedTask, nextTaskType);
  gantt.updateTask(selectedTaskId);
  gantt.refreshTask?.(selectedTaskId);
  gantt.showTask?.(selectedTaskId);
  gantt.showLightbox(selectedTaskId);
}

function revealTaskBranch(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  createdTaskId: GanttTaskId,
  parentId: GanttTaskId | null,
) {
  const gantt = ganttInstance as ReturnType<typeof getDhtmlxGantt> & {
    getTask?: (id: GanttTaskId) => GanttTaskLike;
    open?: (id: GanttTaskId) => void;
    refreshTask?: (id: GanttTaskId) => void;
    showTask?: (id: GanttTaskId) => void;
    updateTask?: (id: GanttTaskId) => void;
  };

  if (parentId !== null) {
    const parentTask = gantt.getTask?.(parentId);
    if (parentTask && parentTask.open !== true) {
      parentTask.open = true;
      gantt.updateTask?.(parentId);
      gantt.refreshTask?.(parentId);
    }

    gantt.open?.(parentId);
  }

  gantt.showTask?.(createdTaskId);
  gantt.refreshTask?.(createdTaskId);
}

function addTaskAndFocusEditor(
  ganttInstance: ReturnType<typeof getDhtmlxGantt>,
  parentId: GanttTaskId | null,
  taskType: GanttTaskType,
) {
  const gantt = ganttInstance as ReturnType<typeof getDhtmlxGantt> & {
    addTask: (task: Record<string, unknown>, parent?: GanttTaskId) => GanttTaskId;
    getTask: (id: GanttTaskId) => GanttTaskLike;
    selectTask: (id: GanttTaskId) => GanttTaskId;
    showLightbox: (id: GanttTaskId) => void;
  };
  const parentTask = parentId === null ? null : gantt.getTask(parentId);
  const createdTaskId = createTaskWithParent(gantt, parentTask, parentId, taskType);

  revealTaskBranch(ganttInstance, createdTaskId, parentId);
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
      projectId,
      chartSource,
      displayMode,
      interactionsEnabled = true,
      onBaselineReady,
      onEditorChange,
      onSelectionChange,
    } = props;
    const containerReference = useRef<HTMLDivElement | null>(null);
    const ganttReference = useRef<ReturnType<typeof getDhtmlxGantt> | null>(null);
    const isApplyingMilestoneInferenceRef = useRef(false);

    useImperativeHandle(ref, () => ({
      addChildTask(): void {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return;
        }

        addTaskAndFocusEditor(
          ganttInstance,
          getSelectedTaskId(ganttInstance),
          GANTT_TASK_TASK_TYPE,
        );
      },
      addChildMilestone(): void {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return;
        }

        addTaskAndFocusEditor(
          ganttInstance,
          getSelectedTaskId(ganttInstance),
          GANTT_MILESTONE_TASK_TYPE,
        );
      },
      addRootTask(): void {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return;
        }

        addTaskAndFocusEditor(ganttInstance, null, GANTT_TASK_TASK_TYPE);
      },
      addRootMilestone(): void {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return;
        }

        addTaskAndFocusEditor(ganttInstance, null, GANTT_MILESTONE_TASK_TYPE);
      },
      convertSelectedMilestoneToTask(): void {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return;
        }

        updateSelectedTaskType(ganttInstance, GANTT_TASK_TASK_TYPE);
      },
      convertSelectedTaskToMilestone(): void {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return;
        }

        updateSelectedTaskType(ganttInstance, GANTT_MILESTONE_TASK_TYPE);
      },
      deleteSelectedTask(): void {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return;
        }

        deleteSelectedTask(ganttInstance);
        onSelectionChange?.(createSelectedTaskSummary(ganttInstance));
      },
      editSelectedTask(): void {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return;
        }

        editSelectedTask(ganttInstance);
      },
      getSelectedTask(): GanttSelectedTask | null {
        const ganttInstance = ganttReference.current;
        if (!ganttInstance) {
          return null;
        }

        return createSelectedTaskSummary(ganttInstance);
      },
      /**
       * Returns chart XML via `serializeGanttXml` (DHTMLX `serialize("xml")` + root-parent normalization).
       * GGTC attrs are merged inside the global `gantt.xml.serialize` hook (`dhtmlx-gantt-adapter.ts`), not in this component.
       */
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
        projectId,
        isApplyingMilestoneInferenceRef,
        onBaselineReady,
        onEditorChange,
      );
      const selectionEventIds = attachSelectionEvents(
        ganttInstance,
        onSelectionChange,
      );
      onSelectionChange?.(createSelectedTaskSummary(ganttInstance));

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
      projectId,
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
