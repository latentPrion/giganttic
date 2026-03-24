import { describe, expect, it } from "vitest";

import { updateTaskStatusInChartXml } from "./kanban-task-status-cache-update.js";

const GRAPH_XML = `<?xml version="1.0" encoding="UTF-8"?>
<data>
  <task id="t1" type="task" start_date="2026-03-01 09:00" progress="0.34" ggtc_task_status="ISSUE_STATUS_BLOCKED"><![CDATA[T1]]></task>
  <task id="t2" type="task" start_date="2026-03-02 09:00" ggtc_task_status="ISSUE_STATUS_CLOSED"><![CDATA[T2]]></task>
  <task id="mile" type="milestone" start_date="2026-03-03 09:00"><![CDATA[Mile]]></task>
  <link id="l1" source="t1" target="t2" />
  <link id="l2" source="t2" target="mile" />
</data>`;

function getTaskStatus(xml: string, id: string): string | null {
  const xmlDocument = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(xmlDocument.querySelectorAll("task"))
    .find((taskElement) => taskElement.getAttribute("id") === id)
    ?.getAttribute("ggtc_task_status") ?? null;
}

describe("kanban-task-status-cache-update", () => {
  it("updates the specified task status and re-infers milestone statuses", () => {
    const updatedXml = updateTaskStatusInChartXml(GRAPH_XML, "t1", "ISSUE_STATUS_CLOSED");

    expect(getTaskStatus(updatedXml, "t1")).toBe("ISSUE_STATUS_CLOSED");
    expect(getTaskStatus(updatedXml, "mile")).toBe("ISSUE_STATUS_CLOSED");
  });

  it("returns original xml when task id does not exist", () => {
    const updatedXml = updateTaskStatusInChartXml(GRAPH_XML, "does-not-exist", "ISSUE_STATUS_OPEN");
    expect(updatedXml).toBe(GRAPH_XML);
  });

  it("preserves progress values when updating status through cache xml", () => {
    const updatedXml = updateTaskStatusInChartXml(GRAPH_XML, "t1", "ISSUE_STATUS_OPEN");
    expect(updatedXml).toMatch(/<task[^>]*id="t1"[^>]*progress="0.34"/);
  });
});

