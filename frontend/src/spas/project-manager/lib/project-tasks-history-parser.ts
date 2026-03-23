import type { IssueStatus } from "../contracts/issue.contracts.js";
import {
  GGTC_TASK_STATUS_ATTRIBUTE,
  GGTC_TASK_STATUS_BLOCKED,
  GGTC_TASK_STATUS_CLOSED,
  GGTC_TASK_STATUS_IN_PROGRESS,
  GGTC_TASK_STATUS_OPEN,
} from "./ggtc-dhtmlx-gantt-extensions-manager.js";
import {
  inferMilestoneStatus,
  type MilestoneInferenceTaskLike,
} from "./milestone-status-inference.js";

const GANTT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const XML_MIME_TYPE = "application/xml";
const XML_PARSER_ERROR_SELECTOR = "parsererror";
const TASK_SELECTOR = "task";
const LINK_SELECTOR = "link";

type ParsedTaskNodeType = "milestone" | "project" | "task";

interface ParsedTaskNode {
  id: string;
  predecessorIds: string[];
  progressPercentage: number;
  startDate: Date | null;
  status: IssueStatus;
  title: string;
  type: ParsedTaskNodeType;
}

export interface ParsedProjectTaskHistoryEntry {
  id: string;
  progressPercentage: number;
  startDate: string;
  status: IssueStatus;
  title: string;
  type: "milestone" | "task";
}

function parseChartXmlDocument(xmlContent: string): XMLDocument {
  const xmlDocument = new DOMParser().parseFromString(xmlContent, XML_MIME_TYPE);
  const parserError = xmlDocument.querySelector(XML_PARSER_ERROR_SELECTOR);
  if (parserError) {
    throw new Error("Project chart XML could not be parsed");
  }
  return xmlDocument;
}

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

function parseTaskNodeType(taskElement: Element): ParsedTaskNodeType {
  const rawType = taskElement.getAttribute("type")?.trim().toLowerCase();
  if (rawType === "milestone") {
    return "milestone";
  }
  if (rawType === "project") {
    return "project";
  }
  return "task";
}

function parseTaskStatus(taskElement: Element): IssueStatus {
  const rawStatus = taskElement.getAttribute(GGTC_TASK_STATUS_ATTRIBUTE)?.trim();
  switch (rawStatus) {
    case GGTC_TASK_STATUS_IN_PROGRESS:
      return GGTC_TASK_STATUS_IN_PROGRESS;
    case GGTC_TASK_STATUS_BLOCKED:
      return GGTC_TASK_STATUS_BLOCKED;
    case GGTC_TASK_STATUS_CLOSED:
      return GGTC_TASK_STATUS_CLOSED;
    case GGTC_TASK_STATUS_OPEN:
    default:
      return GGTC_TASK_STATUS_OPEN;
  }
}

function parseTaskProgressPercentage(taskElement: Element): number {
  const rawProgress = Number(taskElement.getAttribute("progress") ?? "0");
  if (!Number.isFinite(rawProgress) || rawProgress < 0) {
    return 0;
  }

  const normalized = rawProgress <= 1 ? rawProgress * 100 : rawProgress;
  return Math.min(100, Math.round(normalized));
}

function extractOwnTextContent(taskElement: Element): string {
  return Array.from(taskElement.childNodes)
    .filter((node) => node.nodeType === Node.CDATA_SECTION_NODE || node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTaskNode(taskElement: Element): ParsedTaskNode | null {
  const id = taskElement.getAttribute("id")?.trim() ?? "";
  const title = extractOwnTextContent(taskElement);
  if (!id || !title) {
    return null;
  }

  return {
    id,
    predecessorIds: [],
    progressPercentage: parseTaskProgressPercentage(taskElement),
    startDate: parseGanttDate(taskElement.getAttribute("start_date") ?? ""),
    status: parseTaskStatus(taskElement),
    title,
    type: parseTaskNodeType(taskElement),
  };
}

function mapTaskNodesById(xmlDocument: XMLDocument): Map<string, ParsedTaskNode> {
  return Array.from(xmlDocument.querySelectorAll(TASK_SELECTOR))
    .map((taskElement) => parseTaskNode(taskElement))
    .filter((task): task is ParsedTaskNode => task !== null)
    .reduce((map, task) => {
      map.set(task.id, task);
      return map;
    }, new Map<string, ParsedTaskNode>());
}

function collectIncomingDependencies(
  xmlDocument: XMLDocument,
): Map<string, string[]> {
  return Array.from(xmlDocument.querySelectorAll(LINK_SELECTOR))
    .reduce((map, linkElement) => {
      const sourceId = linkElement.getAttribute("source")?.trim() ?? "";
      const targetId = linkElement.getAttribute("target")?.trim() ?? "";
      if (!sourceId || !targetId) {
        return map;
      }

      const existing = map.get(targetId) ?? [];
      existing.push(sourceId);
      map.set(targetId, existing);
      return map;
    }, new Map<string, string[]>());
}

function applyDependenciesToTasks(
  tasksById: Map<string, ParsedTaskNode>,
  dependenciesByTarget: Map<string, string[]>,
): void {
  tasksById.forEach((task) => {
    task.predecessorIds = dependenciesByTarget.get(task.id) ?? [];
  });
}

function createMilestoneInferenceLookup(
  tasksById: Map<string, ParsedTaskNode>,
): Map<string, MilestoneInferenceTaskLike> {
  return new Map(
    Array.from(tasksById.values()).map((task) => [
      task.id,
      {
        id: task.id,
        predecessorIds: task.predecessorIds,
        type: task.type === "milestone" ? "milestone" : "task",
      } satisfies MilestoneInferenceTaskLike,
    ]),
  );
}

function createStatusResolver(tasksById: Map<string, ParsedTaskNode>): (taskId: string) => IssueStatus {
  const inferenceLookup = createMilestoneInferenceLookup(tasksById);
  const statusMemo = new Map<string, IssueStatus>();
  const visiting = new Set<string>();

  function resolveTaskStatus(taskId: string): IssueStatus {
    const memoized = statusMemo.get(taskId);
    if (memoized) {
      return memoized;
    }

    const task = tasksById.get(taskId);
    if (!task) {
      return GGTC_TASK_STATUS_IN_PROGRESS;
    }

    if (task.type !== "milestone") {
      statusMemo.set(task.id, task.status);
      return task.status;
    }

    if (visiting.has(taskId)) {
      return GGTC_TASK_STATUS_IN_PROGRESS;
    }

    visiting.add(taskId);
    const inferredStatus = inferMilestoneStatus(taskId, {
      resolveTaskStatus,
      tasksById: inferenceLookup,
    });
    visiting.delete(taskId);
    statusMemo.set(task.id, inferredStatus);
    return inferredStatus;
  }

  return resolveTaskStatus;
}

function hasStarted(startDate: Date | null, now: Date): boolean {
  return startDate !== null && startDate.getTime() <= now.getTime();
}

function isDisplayableTask(task: ParsedTaskNode, now: Date): boolean {
  if (task.type === "project") {
    return false;
  }
  return hasStarted(task.startDate, now);
}

function toHistoryEntry(task: ParsedTaskNode, status: IssueStatus): ParsedProjectTaskHistoryEntry {
  return {
    id: task.id,
    progressPercentage: task.progressPercentage,
    startDate: task.startDate!.toISOString(),
    status,
    title: task.title,
    type: task.type === "milestone" ? "milestone" : "task",
  };
}

export function parseProjectTasksHistoryFromXml(
  xmlContent: string,
  now: Date = new Date(),
): ParsedProjectTaskHistoryEntry[] {
  const xmlDocument = parseChartXmlDocument(xmlContent);
  const tasksById = mapTaskNodesById(xmlDocument);
  const dependenciesByTarget = collectIncomingDependencies(xmlDocument);
  applyDependenciesToTasks(tasksById, dependenciesByTarget);

  const resolveTaskStatus = createStatusResolver(tasksById);

  return Array.from(tasksById.values())
    .filter((task) => isDisplayableTask(task, now))
    .map((task) => toHistoryEntry(task, task.type === "milestone" ? resolveTaskStatus(task.id) : task.status));
}
