import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import {
  collectProjectChartTaskIdsBestEffort,
  validateProjectChartTaskIdsOrThrow,
} from "./project-chart-task-id-validation.js";

describe("backend project chart task id validation", () => {
  it("returns task ids for valid xml with nested tasks and comments", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <!-- comment -->
  <task id="root"><![CDATA[Root]]></task>
  <group>
    <task id="child" />
  </group>
</data>`;

    expect(validateProjectChartTaskIdsOrThrow(xml)).toEqual(["root", "child"]);
  });

  it("rejects duplicate task ids", () => {
    const xml = "<data><task id=\"dup\"/><task id=\"dup\"/></data>";

    expect(() => validateProjectChartTaskIdsOrThrow(xml)).toThrowError(
      new BadRequestException("Task id \"dup\" is duplicated in the chart."),
    );
  });

  it("rejects missing task ids", () => {
    const xml = "<data><task /><task id=\"ok\"/></data>";

    expect(() => validateProjectChartTaskIdsOrThrow(xml)).toThrowError(
      new BadRequestException("Every <task> element must include an id attribute."),
    );
  });

  it("rejects reserved and trimmed task ids", () => {
    expect(() => validateProjectChartTaskIdsOrThrow("<data><task id=\"0\"/></data>"))
      .toThrowError(new BadRequestException("Task id \"0\" is reserved and cannot be used."));

    expect(() => validateProjectChartTaskIdsOrThrow("<data><task id=\" task-7\"/></data>"))
      .toThrowError(
        new BadRequestException(
          "Task id \" task-7\" must not contain leading or trailing whitespace.",
        ),
      );
  });

  it("rejects malformed xml-like markup", () => {
    expect(() => validateProjectChartTaskIdsOrThrow("<data><task id=\"a\"></data>"))
      .toThrowError(new BadRequestException("Project chart XML could not be parsed."));
  });

  it("collects valid unique ids best-effort when xml is partially malformed", () => {
    const xml = "<data><task id=\"good\"/><task id=\"dup\"/><task id=\"dup\"><broken";

    expect(collectProjectChartTaskIdsBestEffort(xml)).toEqual(["good", "dup"]);
  });

  it("drops invalid ids during best-effort collection", () => {
    const xml = "<data><task id=\"ok\"/><task id=\"  nope\"/><task id=\"0\"/></data";

    expect(collectProjectChartTaskIdsBestEffort(xml)).toEqual(["ok"]);
  });
});
