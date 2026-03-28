export const RESERVED_PROJECT_CHART_TASK_IDS = [
  "0",
  "__proto__",
  "constructor",
  "hasOwnProperty",
] as const;

export type ProjectChartTaskIdValidationCode =
  | "duplicate_id"
  | "empty_id"
  | "invalid_xml"
  | "missing_id"
  | "reserved_id"
  | "trimmed_id";

export interface ProjectChartTaskIdValidationIssue {
  code: ProjectChartTaskIdValidationCode;
  message: string;
  taskId: string | null;
}

const reservedTaskIds = new Set<string>(RESERVED_PROJECT_CHART_TASK_IDS);

export function isReservedProjectChartTaskId(taskId: string): boolean {
  return reservedTaskIds.has(taskId);
}

export function createMissingTaskIdIssue(): ProjectChartTaskIdValidationIssue {
  return {
    code: "missing_id",
    message: "Every <task> element must include an id attribute.",
    taskId: null,
  };
}

export function createEmptyTaskIdIssue(): ProjectChartTaskIdValidationIssue {
  return {
    code: "empty_id",
    message: "Task ids must not be empty.",
    taskId: null,
  };
}

export function createTrimmedTaskIdIssue(
  rawTaskId: string,
): ProjectChartTaskIdValidationIssue {
  return {
    code: "trimmed_id",
    message: `Task id "${rawTaskId}" must not contain leading or trailing whitespace.`,
    taskId: rawTaskId,
  };
}

export function createReservedTaskIdIssue(
  taskId: string,
): ProjectChartTaskIdValidationIssue {
  return {
    code: "reserved_id",
    message: `Task id "${taskId}" is reserved and cannot be used.`,
    taskId,
  };
}

export function createDuplicateTaskIdIssue(
  taskId: string,
): ProjectChartTaskIdValidationIssue {
  return {
    code: "duplicate_id",
    message: `Task id "${taskId}" is duplicated in the chart.`,
    taskId,
  };
}

export function createInvalidProjectChartXmlIssue(
  message = "Project chart XML could not be parsed.",
): ProjectChartTaskIdValidationIssue {
  return {
    code: "invalid_xml",
    message,
    taskId: null,
  };
}

export function validateProjectChartTaskIdValue(
  rawTaskId: string,
): ProjectChartTaskIdValidationIssue | null {
  if (rawTaskId.length === 0) {
    return createEmptyTaskIdIssue();
  }

  const trimmedTaskId = rawTaskId.trim();
  if (trimmedTaskId.length === 0) {
    return createEmptyTaskIdIssue();
  }

  if (trimmedTaskId !== rawTaskId) {
    return createTrimmedTaskIdIssue(rawTaskId);
  }

  if (isReservedProjectChartTaskId(trimmedTaskId)) {
    return createReservedTaskIdIssue(trimmedTaskId);
  }

  return null;
}
