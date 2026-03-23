export const GGTC_TASK_STATUS_ATTRIBUTE = "ggtc_task_status";
export const GGTC_TASK_CLOSED_REASON_ATTRIBUTE = "ggtc_task_closed_reason";

export const GGTC_TASK_STATUS_OPEN = "ISSUE_STATUS_OPEN";
export const GGTC_TASK_STATUS_IN_PROGRESS = "ISSUE_STATUS_IN_PROGRESS";
export const GGTC_TASK_STATUS_BLOCKED = "ISSUE_STATUS_BLOCKED";
export const GGTC_TASK_STATUS_CLOSED = "ISSUE_STATUS_CLOSED";

export const GGTC_TASK_CLOSED_REASON_NONE = "";
export const GGTC_TASK_CLOSED_REASON_WONTFIX = "ISSUE_CLOSED_REASON_WONTFIX";
export const GGTC_TASK_CLOSED_REASON_CANTFIX = "ISSUE_CLOSED_REASON_CANTFIX";
export const GGTC_TASK_CLOSED_REASON_RESOLVED = "ISSUE_CLOSED_REASON_RESOLVED";

const XML_MIME_TYPE = "application/xml";
const XML_TASK_SELECTOR = "task";
const XML_PARSER_ERROR_SELECTOR = "parsererror";

export interface GgtcTaskExtensionMissingAttributeReport {
  missingAttributes: string[];
  taskId: string;
}

export interface GgtcTaskExtensionNormalizationResult {
  mutatedTaskIds: string[];
  xml: string;
}

interface XmlTaskElement {
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
}

interface TaskLikeWithExtensions {
  ggtc_task_closed_reason?: string | null;
  ggtc_task_status?: string | null;
}

function parseChartXmlDocument(xml: string): XMLDocument {
  const xmlDocument = new DOMParser().parseFromString(xml, XML_MIME_TYPE);
  const parserError = xmlDocument.querySelector(XML_PARSER_ERROR_SELECTOR);
  if (parserError) {
    throw new Error("Project chart XML could not be parsed");
  }
  return xmlDocument;
}

function serializeXmlDocument(xmlDocument: XMLDocument): string {
  return new XMLSerializer().serializeToString(xmlDocument);
}

function createTaskIdentifier(taskElement: XmlTaskElement, fallbackIndex: number): string {
  const rawId = taskElement.getAttribute("id")?.trim();
  if (rawId && rawId.length > 0) {
    return rawId;
  }
  return `index:${fallbackIndex}`;
}

function isMissingRequiredStatusAttribute(taskElement: XmlTaskElement): boolean {
  const status = taskElement.getAttribute(GGTC_TASK_STATUS_ATTRIBUTE);
  return status === null || status.trim().length === 0;
}

function isMissingRequiredClosedReasonAttribute(taskElement: XmlTaskElement): boolean {
  const closedReason = taskElement.getAttribute(GGTC_TASK_CLOSED_REASON_ATTRIBUTE);
  return closedReason === null;
}

function collectMissingAttributes(taskElement: XmlTaskElement): string[] {
  const missingAttributes: string[] = [];
  if (isMissingRequiredStatusAttribute(taskElement)) {
    missingAttributes.push(GGTC_TASK_STATUS_ATTRIBUTE);
  }
  if (isMissingRequiredClosedReasonAttribute(taskElement)) {
    missingAttributes.push(GGTC_TASK_CLOSED_REASON_ATTRIBUTE);
  }
  return missingAttributes;
}

function normalizeTaskElementAttributes(taskElement: XmlTaskElement): boolean {
  let mutated = false;

  if (isMissingRequiredStatusAttribute(taskElement)) {
    taskElement.setAttribute(GGTC_TASK_STATUS_ATTRIBUTE, GGTC_TASK_STATUS_OPEN);
    mutated = true;
  }

  if (isMissingRequiredClosedReasonAttribute(taskElement)) {
    taskElement.setAttribute(GGTC_TASK_CLOSED_REASON_ATTRIBUTE, GGTC_TASK_CLOSED_REASON_NONE);
    mutated = true;
  }

  return mutated;
}

function trimOrEmpty(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function shouldSetRuntimeStatus(task: TaskLikeWithExtensions): boolean {
  return trimOrEmpty(task.ggtc_task_status).length === 0;
}

function shouldSetRuntimeClosedReason(task: TaskLikeWithExtensions): boolean {
  return task.ggtc_task_closed_reason === null || task.ggtc_task_closed_reason === undefined;
}

export class GgtcDhtmlxGanttExtensionsManager {
  normalizeXmlTasksWithExtensionAttrs(xml: string): GgtcTaskExtensionNormalizationResult {
    const xmlDocument = parseChartXmlDocument(xml);
    const taskElements = Array.from(xmlDocument.querySelectorAll(XML_TASK_SELECTOR));
    const mutatedTaskIds: string[] = [];

    taskElements.forEach((taskElement, index) => {
      const mutated = normalizeTaskElementAttributes(taskElement);
      if (mutated) {
        mutatedTaskIds.push(createTaskIdentifier(taskElement, index));
      }
    });

    if (mutatedTaskIds.length === 0) {
      return {
        mutatedTaskIds,
        xml,
      };
    }

    return {
      mutatedTaskIds,
      xml: serializeXmlDocument(xmlDocument),
    };
  }

  scanXmlForMissingExtensionAttrs(xml: string): GgtcTaskExtensionMissingAttributeReport[] {
    const xmlDocument = parseChartXmlDocument(xml);
    const taskElements = Array.from(xmlDocument.querySelectorAll(XML_TASK_SELECTOR));

    return taskElements
      .map((taskElement, index): GgtcTaskExtensionMissingAttributeReport | null => {
        const missingAttributes = collectMissingAttributes(taskElement);
        if (missingAttributes.length === 0) {
          return null;
        }
        return {
          missingAttributes,
          taskId: createTaskIdentifier(taskElement, index),
        };
      })
      .filter((report): report is GgtcTaskExtensionMissingAttributeReport => report !== null);
  }

  ensureTaskObjectAttrs(task: TaskLikeWithExtensions): boolean {
    let mutated = false;

    if (shouldSetRuntimeStatus(task)) {
      task.ggtc_task_status = GGTC_TASK_STATUS_OPEN;
      mutated = true;
    }

    if (shouldSetRuntimeClosedReason(task)) {
      task.ggtc_task_closed_reason = GGTC_TASK_CLOSED_REASON_NONE;
      mutated = true;
    }

    return mutated;
  }
}
