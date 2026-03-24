import type { IssueStatus } from "../contracts/issue.contracts.js";
import { GGTC_TASK_STATUS_ATTRIBUTE } from "./ggtc-dhtmlx-gantt-extensions-manager.js";
import { inferMilestoneStatusesFromXml } from "./project-tasks-history-parser.js";

const XML_MIME_TYPE = "application/xml";
const XML_PARSER_ERROR_SELECTOR = "parsererror";

function parseChartXml(xmlContent: string): XMLDocument {
  const xmlDocument = new DOMParser().parseFromString(xmlContent, XML_MIME_TYPE);
  if (xmlDocument.querySelector(XML_PARSER_ERROR_SELECTOR)) {
    throw new Error("Project chart XML could not be parsed");
  }
  return xmlDocument;
}

function serializeChartXml(xmlDocument: XMLDocument): string {
  return new XMLSerializer().serializeToString(xmlDocument);
}

function getTaskElement(xmlDocument: XMLDocument, taskId: string): Element | null {
  return Array.from(xmlDocument.querySelectorAll("task"))
    .find((taskElement) => (taskElement.getAttribute("id")?.trim() ?? "") === taskId) ?? null;
}

export function updateTaskStatusInChartXml(
  xmlContent: string,
  taskId: string,
  status: IssueStatus,
): string {
  const xmlDocument = parseChartXml(xmlContent);
  const taskElement = getTaskElement(xmlDocument, taskId);
  if (!taskElement) {
    return xmlContent;
  }

  taskElement.setAttribute(GGTC_TASK_STATUS_ATTRIBUTE, status);
  const updatedXml = serializeChartXml(xmlDocument);
  const milestoneStatuses = inferMilestoneStatusesFromXml(updatedXml);
  if (milestoneStatuses.size === 0) {
    return updatedXml;
  }

  milestoneStatuses.forEach((inferredStatus, milestoneId) => {
    const milestoneElement = getTaskElement(xmlDocument, milestoneId);
    if (!milestoneElement) {
      return;
    }
    milestoneElement.setAttribute(GGTC_TASK_STATUS_ATTRIBUTE, inferredStatus);
  });

  return serializeChartXml(xmlDocument);
}

