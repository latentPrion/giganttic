import type { KanbanColumnValue } from "../components/kanban/kanban.types.js";

export interface ParsedGanttKanbanTask {
  column: KanbanColumnValue;
  id: string;
  progressPercentage: number;
  startDate: string;
  title: string;
}

const GANTT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const IN_PROGRESS_COLUMN: KanbanColumnValue = "ISSUE_STATUS_IN_PROGRESS";
const MAX_PROGRESS_RATIO = 1;

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

function parseTaskProgress(taskElement: Element): number {
  const rawProgress = Number(taskElement.getAttribute("progress") ?? "0");
  if (!Number.isFinite(rawProgress) || rawProgress < 0) {
    return 0;
  }

  return Math.min(rawProgress, MAX_PROGRESS_RATIO);
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

function isCompletedTask(progressRatio: number): boolean {
  return progressRatio >= MAX_PROGRESS_RATIO;
}

function parseVisibleTask(
  taskElement: Element,
  now: Date,
): ParsedGanttKanbanTask | null {
  const title = parseTaskTitle(taskElement);
  const taskId = taskElement.getAttribute("id")?.trim() ?? "";
  const startDate = parseGanttDate(taskElement.getAttribute("start_date") ?? "");
  const progressRatio = parseTaskProgress(taskElement);

  if (!title || !taskId || !hasTaskBegun(startDate, now) || isCompletedTask(progressRatio)) {
    return null;
  }

  return {
    column: IN_PROGRESS_COLUMN,
    id: taskId,
    progressPercentage: Math.round(progressRatio * 100),
    startDate: startDate!.toISOString(),
    title,
  };
}

export function parseProjectKanbanTasksFromXml(
  xmlContent: string,
  now: Date = new Date(),
): ParsedGanttKanbanTask[] {
  const xmlDocument = new DOMParser().parseFromString(xmlContent, "application/xml");
  const parserError = xmlDocument.querySelector("parsererror");

  if (parserError) {
    throw new Error("Project chart XML could not be parsed");
  }

  return Array.from(xmlDocument.querySelectorAll("task"))
    .map((taskElement) => parseVisibleTask(taskElement, now))
    .filter((task): task is ParsedGanttKanbanTask => task !== null);
}
