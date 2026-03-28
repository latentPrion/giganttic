import {
  createDuplicateTaskIdIssue,
  createInvalidProjectChartXmlIssue,
  createMissingTaskIdIssue,
  validateProjectChartTaskIdValue,
  type ProjectChartTaskIdValidationIssue,
} from "../../../../../common/project-chart/project-chart-task-id-validation.js";

const XML_MIME_TYPE = "application/xml";
const XML_PARSER_ERROR_SELECTOR = "parsererror";
const XML_TASK_SELECTOR = "task";

export class ProjectChartTaskIdValidationError extends Error {
  readonly issue: ProjectChartTaskIdValidationIssue;

  constructor(issue: ProjectChartTaskIdValidationIssue) {
    super(issue.message);
    this.issue = issue;
  }
}

function parseXmlDocument(xml: string): XMLDocument {
  const xmlDocument = new DOMParser().parseFromString(xml, XML_MIME_TYPE);
  if (xmlDocument.querySelector(XML_PARSER_ERROR_SELECTOR)) {
    throw new ProjectChartTaskIdValidationError(createInvalidProjectChartXmlIssue());
  }

  return xmlDocument;
}

export function validateProjectChartTaskIdsInFrontend(xml: string): string[] {
  const xmlDocument = parseXmlDocument(xml);
  const taskIds: string[] = [];
  const seenTaskIds = new Set<string>();

  for (const taskElement of Array.from(xmlDocument.querySelectorAll(XML_TASK_SELECTOR))) {
    const rawTaskId = taskElement.getAttribute("id");
    if (rawTaskId === null) {
      throw new ProjectChartTaskIdValidationError(createMissingTaskIdIssue());
    }

    const issue = validateProjectChartTaskIdValue(rawTaskId);
    if (issue) {
      throw new ProjectChartTaskIdValidationError(issue);
    }

    if (seenTaskIds.has(rawTaskId)) {
      throw new ProjectChartTaskIdValidationError(createDuplicateTaskIdIssue(rawTaskId));
    }

    seenTaskIds.add(rawTaskId);
    taskIds.push(rawTaskId);
  }

  return taskIds;
}
