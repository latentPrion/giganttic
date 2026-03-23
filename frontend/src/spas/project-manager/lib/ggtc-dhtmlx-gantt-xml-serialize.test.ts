import { describe, expect, it } from "vitest";

import {
  GGTC_TASK_CLOSED_REASON_ATTRIBUTE,
  GGTC_TASK_DESCRIPTION_ATTRIBUTE,
  GGTC_TASK_STATUS_ATTRIBUTE,
  GgtcDhtmlxGanttExtensionsManager,
} from "./ggtc-dhtmlx-gantt-extensions-manager.js";
import { injectGgtcTaskAttributesIntoSerializedXml } from "./ggtc-dhtmlx-gantt-xml-serialize.js";

describe("injectGgtcTaskAttributesIntoSerializedXml", () => {
  it("adds type and GGTC attrs from runtime tasks", () => {
    const xml = "<data><task id=\"7\" start_date=\"2026-01-01 00:00\" duration=\"1\"><![CDATA[T]]></task></data>";
    const ganttStub = {
      getTask: (id: string | number) => ({
        ggtc_task_closed_reason: "",
        ggtc_task_description: "Task details",
        ggtc_task_status: "ISSUE_STATUS_OPEN",
        id,
        type: "milestone",
      }),
    };

    const result = injectGgtcTaskAttributesIntoSerializedXml(xml, ganttStub);

    expect(result).toContain("type=\"milestone\"");
    expect(result).toContain(`${GGTC_TASK_STATUS_ATTRIBUTE}=\"ISSUE_STATUS_OPEN\"`);
    expect(result).toContain(`${GGTC_TASK_CLOSED_REASON_ATTRIBUTE}=\"\"`);
    expect(result).toContain(`${GGTC_TASK_DESCRIPTION_ATTRIBUTE}=\"Task details\"`);
  });

  it("returns the original string when XML does not parse", () => {
    const invalid = "<data><task></task>";
    const ganttStub = { getTask: () => ({}) };

    const result = injectGgtcTaskAttributesIntoSerializedXml(invalid, ganttStub);

    expect(result).toBe(invalid);
  });

  it("does not invent GGTC attrs when runtime tasks omit them (enforcement can flag gaps)", () => {
    const xml = "<data><task id=\"9\" start_date=\"2026-01-01 00:00\" duration=\"1\"><![CDATA[Orphan]]></task></data>";
    const ganttStub = {
      getTask: () => ({
        id: 9,
        type: "task",
      }),
    };

    const result = injectGgtcTaskAttributesIntoSerializedXml(xml, ganttStub);
    const manager = new GgtcDhtmlxGanttExtensionsManager();
    const reports = manager.scanXmlForMissingExtensionAttrs(result);

    expect(result).toContain("type=\"task\"");
    expect(reports.length).toBeGreaterThan(0);
    expect(reports[0]?.missingAttributes).toEqual(
      expect.arrayContaining([
        GGTC_TASK_STATUS_ATTRIBUTE,
        GGTC_TASK_CLOSED_REASON_ATTRIBUTE,
        GGTC_TASK_DESCRIPTION_ATTRIBUTE,
      ]),
    );
  });

  it("produces XML that passes extension scan when runtime tasks include GGTC fields", () => {
    const xml = "<data><task id=\"3\" start_date=\"2026-01-01 00:00\" duration=\"1\"><![CDATA[Ok]]></task></data>";
    const ganttStub = {
      getTask: () => ({
        ggtc_task_closed_reason: "",
        ggtc_task_description: "Task details",
        ggtc_task_status: "ISSUE_STATUS_OPEN",
        id: 3,
        type: "task",
      }),
    };

    const result = injectGgtcTaskAttributesIntoSerializedXml(xml, ganttStub);
    const manager = new GgtcDhtmlxGanttExtensionsManager();

    expect(manager.scanXmlForMissingExtensionAttrs(result)).toEqual([]);
  });
});
