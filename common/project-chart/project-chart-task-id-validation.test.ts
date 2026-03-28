import { describe, expect, it } from "vitest";

import {
  RESERVED_PROJECT_CHART_TASK_IDS,
  createDuplicateTaskIdIssue,
  createEmptyTaskIdIssue,
  createInvalidProjectChartXmlIssue,
  createMissingTaskIdIssue,
  createReservedTaskIdIssue,
  createTrimmedTaskIdIssue,
  isReservedProjectChartTaskId,
  validateProjectChartTaskIdValue,
} from "./project-chart-task-id-validation.js";

describe("project chart task id validation helpers", () => {
  it("exports the reserved task id set used by frontend and backend validators", () => {
    expect(RESERVED_PROJECT_CHART_TASK_IDS).toEqual([
      "0",
      "__proto__",
      "constructor",
      "hasOwnProperty",
    ]);
  });

  it("accepts canonical task ids", () => {
    expect(validateProjectChartTaskIdValue("task-42")).toBeNull();
    expect(validateProjectChartTaskIdValue("MILESTONE_ALPHA")).toBeNull();
  });

  it("rejects empty task ids", () => {
    expect(validateProjectChartTaskIdValue("")).toEqual(createEmptyTaskIdIssue());
    expect(validateProjectChartTaskIdValue("   ")).toEqual(createEmptyTaskIdIssue());
  });

  it("rejects task ids with leading or trailing whitespace", () => {
    expect(validateProjectChartTaskIdValue(" task-42")).toEqual(
      createTrimmedTaskIdIssue(" task-42"),
    );
    expect(validateProjectChartTaskIdValue("task-42 ")).toEqual(
      createTrimmedTaskIdIssue("task-42 "),
    );
  });

  it("rejects reserved task ids", () => {
    for (const taskId of RESERVED_PROJECT_CHART_TASK_IDS) {
      expect(isReservedProjectChartTaskId(taskId)).toBe(true);
      expect(validateProjectChartTaskIdValue(taskId)).toEqual(
        createReservedTaskIdIssue(taskId),
      );
    }
  });

  it("creates stable issue payloads for duplicate and missing ids", () => {
    expect(createDuplicateTaskIdIssue("dup-task")).toEqual({
      code: "duplicate_id",
      message: "Task id \"dup-task\" is duplicated in the chart.",
      taskId: "dup-task",
    });
    expect(createMissingTaskIdIssue()).toEqual({
      code: "missing_id",
      message: "Every <task> element must include an id attribute.",
      taskId: null,
    });
  });

  it("creates a stable invalid xml issue payload", () => {
    expect(createInvalidProjectChartXmlIssue()).toEqual({
      code: "invalid_xml",
      message: "Project chart XML could not be parsed.",
      taskId: null,
    });
    expect(createInvalidProjectChartXmlIssue("Broken XML")).toEqual({
      code: "invalid_xml",
      message: "Broken XML",
      taskId: null,
    });
  });
});
