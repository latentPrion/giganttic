import { describe, expect, it } from "vitest";

import {
  GGTC_TASK_CLOSED_REASON_ATTRIBUTE,
  GGTC_TASK_CLOSED_REASON_CANTFIX,
  GGTC_TASK_CLOSED_REASON_NONE,
  GGTC_TASK_DESCRIPTION_ATTRIBUTE,
  GGTC_TASK_STATUS_ATTRIBUTE,
  GGTC_TASK_STATUS_IN_PROGRESS,
  GGTC_TASK_STATUS_OPEN,
  GgtcDhtmlxGanttExtensionsManager,
} from "./ggtc-dhtmlx-gantt-extensions-manager.js";

const BASELINE_XML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><data><task id=\"1\"><![CDATA[Task A]]></task><task id=\"2\" ggtc_task_status=\"ISSUE_STATUS_IN_PROGRESS\"><![CDATA[Task B]]></task><task id=\"3\" ggtc_task_closed_reason=\"ISSUE_CLOSED_REASON_CANTFIX\"><![CDATA[Task C]]></task><task id=\"4\" ggtc_task_status=\"ISSUE_STATUS_IN_PROGRESS\" ggtc_task_closed_reason=\"ISSUE_CLOSED_REASON_CANTFIX\" ggtc_task_description=\"Task D note\"><![CDATA[Task D]]></task></data>";

function parseXml(xml: string): XMLDocument {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function getTaskAttribute(xml: string, taskId: string, attributeName: string): string | null {
  const document = parseXml(xml);
  return document.querySelector(`task[id="${taskId}"]`)?.getAttribute(attributeName) ?? null;
}

describe("GgtcDhtmlxGanttExtensionsManager", () => {
  it("adds missing extension attrs and reports mutated task ids", () => {
    const manager = new GgtcDhtmlxGanttExtensionsManager();

    const result = manager.normalizeXmlTasksWithExtensionAttrs(BASELINE_XML);

    expect(result.mutatedTaskIds).toEqual(["1", "2", "3"]);
    expect(getTaskAttribute(result.xml, "1", GGTC_TASK_STATUS_ATTRIBUTE)).toBe(GGTC_TASK_STATUS_OPEN);
    expect(getTaskAttribute(result.xml, "1", GGTC_TASK_CLOSED_REASON_ATTRIBUTE)).toBe(
      GGTC_TASK_CLOSED_REASON_NONE,
    );
    expect(getTaskAttribute(result.xml, "1", GGTC_TASK_DESCRIPTION_ATTRIBUTE)).toBe("");
    expect(getTaskAttribute(result.xml, "2", GGTC_TASK_STATUS_ATTRIBUTE)).toBe(
      GGTC_TASK_STATUS_IN_PROGRESS,
    );
    expect(getTaskAttribute(result.xml, "2", GGTC_TASK_CLOSED_REASON_ATTRIBUTE)).toBe(
      GGTC_TASK_CLOSED_REASON_NONE,
    );
    expect(getTaskAttribute(result.xml, "2", GGTC_TASK_DESCRIPTION_ATTRIBUTE)).toBe("");
    expect(getTaskAttribute(result.xml, "3", GGTC_TASK_STATUS_ATTRIBUTE)).toBe(GGTC_TASK_STATUS_OPEN);
    expect(getTaskAttribute(result.xml, "3", GGTC_TASK_CLOSED_REASON_ATTRIBUTE)).toBe(
      GGTC_TASK_CLOSED_REASON_CANTFIX,
    );
    expect(getTaskAttribute(result.xml, "3", GGTC_TASK_DESCRIPTION_ATTRIBUTE)).toBe("");
  });

  it("returns source xml unchanged when no attrs are missing", () => {
    const manager = new GgtcDhtmlxGanttExtensionsManager();
    const completeXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><data><task id=\"4\" ggtc_task_status=\"ISSUE_STATUS_IN_PROGRESS\" ggtc_task_closed_reason=\"ISSUE_CLOSED_REASON_CANTFIX\" ggtc_task_description=\"Task D note\"><![CDATA[Task D]]></task></data>";

    const result = manager.normalizeXmlTasksWithExtensionAttrs(completeXml);

    expect(result.mutatedTaskIds).toEqual([]);
    expect(result.xml).toBe(completeXml);
  });

  it("reports tasks with missing required attrs", () => {
    const manager = new GgtcDhtmlxGanttExtensionsManager();

    const reports = manager.scanXmlForMissingExtensionAttrs(BASELINE_XML);

    expect(reports).toEqual([
      {
        missingAttributes: [
          GGTC_TASK_STATUS_ATTRIBUTE,
          GGTC_TASK_CLOSED_REASON_ATTRIBUTE,
          GGTC_TASK_DESCRIPTION_ATTRIBUTE,
        ],
        taskId: "1",
      },
      {
        missingAttributes: [GGTC_TASK_CLOSED_REASON_ATTRIBUTE, GGTC_TASK_DESCRIPTION_ATTRIBUTE],
        taskId: "2",
      },
      {
        missingAttributes: [GGTC_TASK_STATUS_ATTRIBUTE, GGTC_TASK_DESCRIPTION_ATTRIBUTE],
        taskId: "3",
      },
    ]);
  });

  it("ensures runtime attrs on task objects when absent", () => {
    const manager = new GgtcDhtmlxGanttExtensionsManager();
    const task = {};

    const mutated = manager.ensureTaskObjectAttrs(task);

    expect(mutated).toBe(true);
    expect(task).toMatchObject({
      ggtc_task_closed_reason: GGTC_TASK_CLOSED_REASON_NONE,
      ggtc_task_description: "",
      ggtc_task_status: GGTC_TASK_STATUS_OPEN,
    });
  });

  it("preserves runtime attrs when already set", () => {
    const manager = new GgtcDhtmlxGanttExtensionsManager();
    const task = {
      ggtc_task_closed_reason: GGTC_TASK_CLOSED_REASON_CANTFIX,
      ggtc_task_description: "already set",
      ggtc_task_status: GGTC_TASK_STATUS_IN_PROGRESS,
    };

    const mutated = manager.ensureTaskObjectAttrs(task);

    expect(mutated).toBe(false);
    expect(task).toEqual({
      ggtc_task_closed_reason: GGTC_TASK_CLOSED_REASON_CANTFIX,
      ggtc_task_description: "already set",
      ggtc_task_status: GGTC_TASK_STATUS_IN_PROGRESS,
    });
  });
});
