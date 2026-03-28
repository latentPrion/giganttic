import { describe, expect, it } from "vitest";

import { ProjectChartTaskIdValidationError, validateProjectChartTaskIdsInFrontend } from "./project-chart-task-id-validation.js";

describe("frontend project chart task id validation", () => {
  it("returns task ids for valid project chart xml", () => {
    const xml = "<data><task id=\"task-1\"/><task id=\"task-2\"/></data>";

    expect(validateProjectChartTaskIdsInFrontend(xml)).toEqual(["task-1", "task-2"]);
  });

  it("rejects malformed xml", () => {
    expect(() => validateProjectChartTaskIdsInFrontend("<data><task")).toThrowError(
      ProjectChartTaskIdValidationError,
    );
  });

  it("rejects missing task ids", () => {
    expect(() => validateProjectChartTaskIdsInFrontend("<data><task /></data>"))
      .toThrowError(/id attribute/i);
  });

  it("rejects duplicate, reserved, and trimmed task ids", () => {
    expect(() => validateProjectChartTaskIdsInFrontend("<data><task id=\"dup\"/><task id=\"dup\"/></data>"))
      .toThrowError(/duplicated/i);
    expect(() => validateProjectChartTaskIdsInFrontend("<data><task id=\"0\"/></data>"))
      .toThrowError(/reserved/i);
    expect(() => validateProjectChartTaskIdsInFrontend("<data><task id=\" task-1\"/></data>"))
      .toThrowError(/leading or trailing whitespace/i);
  });
});
