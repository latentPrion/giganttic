import type { KanbanColumnValue } from "../components/kanban/kanban.types.js";
import {
  type IssueStatus,
} from "../contracts/issue.contracts.js";
import {
  GGTC_TASK_STATUS_ATTRIBUTE,
  GGTC_TASK_STATUS_OPEN,
} from "./ggtc-dhtmlx-gantt-extensions-manager.js";
import { inferMilestoneStatusesFromXml } from "./project-tasks-history-parser.js";

export interface ParsedGanttKanbanTask {
  chartId: number;
  column: KanbanColumnValue;
  id: string;
  isMilestone: boolean;
  progressPercentage: number;
  startDate: string;
  status: IssueStatus;
  title: string;
}

const GANTT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const MAX_PROGRESS_PERCENTAGE = 100;
const MILESTONE_TYPE = "milestone";

function parseGanttDate(value: string): Date | null {
  const match = GANTT_DATE_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
}

function parseTaskProgressPercentage(taskElement: Element): number {
  const rawProgress = Number(taskElement.getAttribute("progress") ?? "0");
  if (!Number.isFinite(rawProgress) || rawProgress < 0) {
    return 0;
  }

  const normalized = rawProgress <= 1 ? rawProgress * 100 : rawProgress;
  return Math.min(MAX_PROGRESS_PERCENTAGE, Math.round(normalized));
}

function extractOwnTextContent(taskElement: Element): string {
  return Array.from(taskElement.childNodes)
    .filter((node) => node.nodeType === Node.CDATA_SECTION_NODE || node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTaskTitle(taskElement: Element): string {
  return extractOwnTextContent(taskElement);
}

function hasTaskBegun(startDate: Date | null, now: Date): boolean {
  return startDate !== null && startDate.getTime() <= now.getTime();
}

function parseTaskStatus(taskElement: Element): IssueStatus {
  const value = taskElement.getAttribute(GGTC_TASK_STATUS_ATTRIBUTE);
  switch (value) {
    case "ISSUE_STATUS_IN_PROGRESS":
    case "ISSUE_STATUS_BLOCKED":
    case "ISSUE_STATUS_CLOSED":
    case "ISSUE_STATUS_OPEN":
      return value;
    default:
      return GGTC_TASK_STATUS_OPEN;
  }
}

function isMilestone(taskElement: Element): boolean {
  return taskElement.getAttribute("type")?.trim().toLowerCase() === MILESTONE_TYPE;
}

function shouldDisplayTask(
  startDate: Date | null,
  status: IssueStatus,
  now: Date,
): boolean {
  if (startDate === null) {
    return false;
  }

  if (hasTaskBegun(startDate, now)) {
    return true;
  }

  return status !== GGTC_TASK_STATUS_OPEN;
}

function parseVisibleTask(
  taskElement: Element,
  now: Date,
  inferredMilestoneStatuses: ReadonlyMap<string, IssueStatus>,
): Omit<ParsedGanttKanbanTask, "chartId"> | null {
  const title = parseTaskTitle(taskElement);
  const taskId = taskElement.getAttribute("id")?.trim() ?? "";
  const startDate = parseGanttDate(taskElement.getAttribute("start_date") ?? "");
  const progressPercentage = parseTaskProgressPercentage(taskElement);
  const milestone = isMilestone(taskElement);
  const rawStatus = parseTaskStatus(taskElement);
  const status = milestone
    ? (inferredMilestoneStatuses.get(taskId) ?? rawStatus)
    : rawStatus;
  if (!title || !taskId || !shouldDisplayTask(startDate, status, now)) {
    return null;
  }

  // Milestones are hidden from Kanban until their start date is reached.
  if (milestone && !hasTaskBegun(startDate, now)) {
    return null;
  }

  return {
    column: status,
    id: taskId,
    isMilestone: milestone,
    progressPercentage,
    startDate: startDate!.toISOString(),
    status,
    title,
  };
}

export function parseProjectKanbanTasksFromXml(
  xmlContent: string,
  now: Date = new Date(),
  chartId: number = 0,
): ParsedGanttKanbanTask[] {
  const xmlDocument = new DOMParser().parseFromString(xmlContent, "application/xml");
  const parserError = xmlDocument.querySelector("parsererror");

  if (parserError) {
    throw new Error("Project chart XML could not be parsed");
  }

  const inferredMilestoneStatuses = inferMilestoneStatusesFromXml(xmlContent);
  return Array.from(xmlDocument.querySelectorAll("task"))
    .map((taskElement) => {
      const parsed = parseVisibleTask(taskElement, now, inferredMilestoneStatuses);
      return parsed ? { ...parsed, chartId } : null;
    })
    .filter((task): task is ParsedGanttKanbanTask => task !== null);
}
